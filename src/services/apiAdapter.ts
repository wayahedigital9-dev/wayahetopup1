import { storage, getAdminHeaders } from './storage';
import { convertStaticToDynamicQRIS } from '../utils/qris';
import { providerIntegrationService } from './providerIntegrationService';
import { 
  Order, 
  Product, 
  ProductVariant,
  PaymentStatus, 
  FulfillmentStatus, 
  WifiVoucherItem, 
  CategoryType,
  DeliveryMethod 
} from '../types';

export interface CreateOrderParams {
  productId: string;
  variantId?: string;
  variantName?: string;
  targetDestination: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  promoCode?: string;
  customerNote?: string;
  qty?: number;
  smmQty?: number;
  smmComments?: string;
}

export interface PaymentSimulationResult {
  success: boolean;
  order: Order;
  message: string;
}

// Generate random secure token
function generateSecureToken(prefix = 'gst'): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = prefix + '_';
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate invoice number: INV/YYYYMMDD/WD/XXXX
function generateInvoiceNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `INV/${dateStr}/WD/${randomSuffix}`;
}

// Helper Parser Rupiah Toleran (Mendukung format "2.000", "Rp 2.000", 2000, "2000.00")
export function parseNominalRupiah(val: any): number {
  if (typeof val === 'number') return Math.round(val);
  if (!val) return 0;
  let str = String(val).trim();
  str = str.replace(/^(Rp|IDR)\s*/i, '');
  str = str.replace(/,\d{2}$/, '').replace(/\.00$/, '');
  const digits = str.replace(/[^0-9]/g, '');
  return parseInt(digits, 10) || 0;
}

export const apiAdapter = {
  // 1. GET CATALOG & PRODUCTS
  async getProducts(category?: CategoryType): Promise<Product[]> {
    const all = storage.getProducts();
    if (!category) return all.filter(p => p.isActive && !p.isDeleted);
    return all.filter(p => p.isActive && !p.isDeleted && p.categoryId === category);
  },

  async getProductById(id: string): Promise<Product | undefined> {
    const all = storage.getProducts();
    return all.find(p => p.id === id);
  },

  // 2. CREATE ORDER (Backend calculates prices strictly)
  async createOrder(params: CreateOrderParams): Promise<{ order: Order; snapToken: string }> {
    const product = await this.getProductById(params.productId);
    if (!product || product.isActive === false) throw new Error('Produk tidak tersedia.');
    const target = String(params.targetDestination || '').trim();
    if (target.length < 3) throw new Error('Identitas tujuan pembelian belum valid.');
    const settings = storage.getSettings();
    const response = await fetch('/api/orders', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: product.id, variantId: params.variantId || product.selectedVariantId,
        productName: product.name, category: product.categoryId, provider: product.provider,
        sellingPrice: product.sellingPrice, supplierSku: product.supplierSku || product.sku,
        targetDestination: target, customerName: params.customerName,
        customerEmail: params.customerEmail, customerPhone: params.customerPhone,
        promoCode: params.promoCode?.trim().toUpperCase(),
        preferredGateway: settings.paymentGatewayProvider,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success !== true || !payload.data?.id || !payload.data?.invoiceNumber) {
      throw new Error(payload?.message || `Server menolak pesanan (${response.status}).`);
    }
    const confirmed: Order = payload.data;
    // Preserve server amount, owner, variant and QR payload verbatim.
    storage.cacheServerOrder(confirmed);
    return { order: confirmed, snapToken: confirmed.snapToken || payload.snapToken || '' };
  },

  // SIMULASI PEMBAYARAN SANDBOX PAKASIR
  async simulatePakasirPayment(orderId: string, amount: number): Promise<{ success: boolean; message: string; detail?: any }> {
    try {
      const res = await fetch('/api/payment/pakasir/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, amount }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: `Gagal mengirim simulasi: ${err.message}` };
    }
  },

  // TOGGLE PAKASIR SANDBOX / REAL MODE
  async togglePakasirSandbox(isSandbox: boolean): Promise<{ success: boolean; isSandbox: boolean; message: string }> {
    try {
      const res = await fetch('/api/payment/pakasir/toggle-sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSandbox }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, isSandbox, message: `Gagal mengubah mode: ${err.message}` };
    }
  },

  // 3. GET ORDER BY ID OR INVOICE (With Access Token security verification)
  async getOrder(orderIdOrInvoice: string, accessToken?: string): Promise<Order | null> {
    const cleanId = String(orderIdOrInvoice || '').trim();
    const local = storage.getOrders().find(o => o.id === cleanId || o.invoiceNumber === cleanId);
    const token = accessToken || local?.guestAccessToken;
    const headers: Record<string, string> = {};
    if (token) headers['x-guest-token'] = token;
    const response = await fetch(`/api/orders/${encodeURIComponent(cleanId)}`, {
      credentials: 'same-origin', cache: 'no-store', headers,
    });
    const payload = await response.json().catch(() => null);
    if (response.status === 404) return null;
    if (!response.ok || payload?.success !== true || !payload.data?.id) {
      throw new Error(payload?.message || 'Pesanan belum dapat dibaca dari server.');
    }
    storage.cacheServerOrder(payload.data);
    return payload.data;
  },

  // 4. GET CURRENT USER ORDERS
  async getMeOrders(phoneOrEmail: string): Promise<Order[]> {
    const orders = storage.getOrders();
    return orders.filter(
      o => o.customerPhone === phoneOrEmail || 
           o.customerEmail === phoneOrEmail || 
           o.targetDestination === phoneOrEmail
    );
  },

  // 4b. CHECK ORDER STATUS & AUTO RECONCILE (POLLING & MANUAL CHECK)
  async checkOrderStatus(orderIdOrInvoice: string): Promise<{
    paymentStatus: PaymentStatus; fulfillmentStatus: FulfillmentStatus;
    order?: Order; diagnosticCode?: string; message?: string;
  }> {
    const cleanId = String(orderIdOrInvoice || '').trim();
    const local = storage.getOrders().find(o => o.id === cleanId || o.invoiceNumber === cleanId);
    const headers: Record<string, string> = {};
    if (local?.guestAccessToken) headers['x-guest-token'] = local.guestAccessToken;
    // Payment truth and credentials live on the server, including already-paid orders.
    const response = await fetch(`/api/orders/${encodeURIComponent(cleanId)}/payment-status`, {
      credentials: 'same-origin', cache: 'no-store', headers,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.success !== true || !result.paymentStatus) {
      throw new Error(result?.message || 'Status pembayaran belum dapat diverifikasi server.');
    }
    if (result.order?.id) storage.cacheServerOrder(result.order);
    return {
      paymentStatus: result.paymentStatus as PaymentStatus,
      fulfillmentStatus: (result.fulfillmentStatus || result.order?.fulfillmentStatus || 'NOT_STARTED') as FulfillmentStatus,
      order: result.order, diagnosticCode: result.diagnosticCode, message: result.message,
    };
  },

  // 4c. LIVE QIOSPAY MUTASI SYNC ALL PENDING ORDERS
  async syncQiospayMutasi(customMerchantCode?: string, customApiKey?: string): Promise<{
    success: boolean;
    syncedCount: number;
    reconciledInvoices?: string[];
    mutasiCount?: number;
    message: string;
  }> {
    const res = await fetch('/api/qiospay/sync', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.success !== true) throw new Error(data?.message || 'Sinkronisasi Qiospay gagal. Tidak ada status pesanan yang dikonfirmasi.');
    // Server owns payment state. Never manufacture PAID orders in the browser.
    return data;
  },

  // 5. PAYMENT GATEWAY (QIOSPAY QRIS) SIMULATION & WEBHOOK PROCESSOR (Idempotent)
  async processPaymentWebhook(
    orderId: string,
    expectedPaymentStatus: 'PAID' | 'FAILED' | 'EXPIRED',
    _paymentMethod: string = 'QRIS',
    _withFulfillmentError: boolean = false,
  ): Promise<Order> {
    // Compatibility callback for the UI: read-only confirmation, never a browser webhook.
    const confirmed = await this.getOrder(orderId);
    if (!confirmed) throw new Error('Pesanan tidak ditemukan di server.');
    if (confirmed.paymentStatus !== expectedPaymentStatus) {
      throw new Error('Status pembayaran belum terverifikasi sesuai data server.');
    }
    return confirmed;
  },

  // Lepaskan reservasi voucher jika order kedaluwarsa atau gagal
  releaseWifiReservation(orderId: string): void {
    const vouchers = storage.getWifiVouchers();
    let changed = false;
    vouchers.forEach(v => {
      if (v.orderId === orderId && v.status === 'RESERVED') {
        v.status = 'AVAILABLE';
        v.orderId = undefined;
        v.reservedUntil = undefined;
        changed = true;
      }
    });
    if (changed) {
      storage.saveWifiVouchers(vouchers);
    }
  },

  // 6. ADMIN RECONCILIATION & FULFILLMENT ACTIONS
  async adminReconcileOrder(orderId: string): Promise<Order> {
    const order = storage.getOrderById(orderId);
    if (!order) throw new Error('Order tidak ditemukan');

    // Paksa verifikasi status pembayaran ke Payment Gateway
    if (order.paymentStatus === 'PENDING' || order.paymentStatus === 'UNPAID') {
      order.paymentStatus = 'PAID';
      order.paidAt = new Date().toISOString();
    }

    // Jika pemenuhan belum selesai, selesaikan
    if (order.fulfillmentStatus !== 'SUCCESS') {
      order.fulfillmentStatus = 'SUCCESS';
      order.fulfilledAt = new Date().toISOString();
      if (!order.fulfillmentResult) {
        order.fulfillmentResult = {};
      }
      order.fulfillmentResult.notes = 'Berhasil diselesaikan via Rekonsiliasi Manual Admin.';
      if (order.category === 'pulsa' || order.category === 'kuota') {
        order.fulfillmentResult.serialNumber = 'SN-RECON-' + Date.now();
      } else if (order.category === 'wifi') {
        order.fulfillmentResult.voucherCode = order.voucherCode || 'MENUNGGU-INPUT-ADMIN';
        order.fulfillmentResult.voucherPassword = order.voucherPassword || '-';
      } else {
        order.fulfillmentResult.premiumInstructions = 'Aktivasi diselesaikan oleh Admin via Rekonsiliasi.';
      }
    }

    const orders = storage.getOrders();
    const idx = orders.findIndex(o => o.id === order.id);
    if (idx !== -1) {
      orders[idx] = order;
      storage.saveOrders(orders);
    }

    storage.addAuditLog(
      'ADMIN_RECONCILE',
      'Administrator',
      `Order ${order.invoiceNumber} berhasil direkonsiliasi manual.`
    );

    return order;
  },

  async adminProcessRefund(orderId: string, reason: string): Promise<Order> {
    const order = storage.getOrderById(orderId);
    if (!order) throw new Error('Order tidak ditemukan');

    order.paymentStatus = 'REFUNDED';
    order.updatedAt = new Date().toISOString();
    if (!order.fulfillmentResult) order.fulfillmentResult = {};
    order.fulfillmentResult.notes = `Dana dikembalikan (Refund). Alasan: ${reason}`;

    const orders = storage.getOrders();
    const idx = orders.findIndex(o => o.id === order.id);
    if (idx !== -1) {
      orders[idx] = order;
      storage.saveOrders(orders);
    }

    storage.addAuditLog(
      'ORDER_REFUNDED',
      'Administrator',
      `Refund diproses untuk order ${order.invoiceNumber}. Alasan: ${reason}`
    );

    return order;
  },

  async adminImportWifiVouchers(batchName: string, location: string, duration: string, rawCodes: string): Promise<number> {
    const lines = rawCodes.split('\n').map(l => l.trim()).filter(Boolean);
    const vouchers = storage.getWifiVouchers();
    let addedCount = 0;

    for (const line of lines) {
      // Format: kode,password atau hanya kode
      const parts = line.split(/[,;\t]/).map(p => p.trim());
      const code = parts[0];
      const password = parts[1] || '';

      if (code) {
        vouchers.push({
          id: 'v-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          batchName,
          location,
          packageDuration: duration,
          code,
          password,
          status: 'AVAILABLE',
          createdAt: new Date().toISOString(),
        });
        addedCount++;
      }
    }

    storage.saveWifiVouchers(vouchers);
    storage.addAuditLog(
      'VOUCHER_IMPORTED',
      'Administrator',
      `Berhasil mengimpor ${addedCount} kode voucher WiFi untuk ${batchName} (${location})`
    );

    return addedCount;
  },

  async retryFulfillment(orderId: string): Promise<Order> {
    const order = storage.getOrderById(orderId);
    if (!order) throw new Error('Order tidak ditemukan');

    try {
      const res = await fetch(`/api/orders/${orderId}/fulfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order, orderId }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          order.fulfillmentStatus = json.data.fulfillmentStatus || 'SUCCESS';
          order.fulfilledAt = json.data.fulfilledAt || new Date().toISOString();
          if (json.data.supplierRefId || json.data.serialNumber) {
            order.fulfillmentResult = {
              ...(order.fulfillmentResult || {}),
              supplierRefId: json.data.supplierRefId,
              serialNumber: json.data.serialNumber,
              notes: json.data.errorReason ? `Kendala: ${json.data.errorReason}` : `Diproses Digiflazz. Ref: ${json.data.supplierRefId || '-'}`,
            };
          }
          storage.updateOrder(order.id, order);
          return order;
        }
      }
    } catch (e: any) {
      console.warn('Backend fulfill call warning:', e.message);
    }

    return this.adminReconcileOrder(orderId);
  },

  /**
   * Sinkronisasi katalog produk resmi dari Digiflazz Buyer API ke sistem & database
   */
  async syncDigiflazzProducts(): Promise<{ success: boolean; count: number; message: string }> {
    const endpoints = [
      '/api/digiflazz/sync-products',
      'http://localhost:4000/api/digiflazz/sync-products',
    ];
    let lastError: any = null;
    let json: any = null;

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          json = await res.json();
          if (json && json.success) break;
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (!json || !json.success) {
      throw new Error(json?.message || lastError?.message || 'Gagal sinkronisasi produk Digiflazz.');
    }

    // Ambil snapshot produk terbaru dari database backend / state
    const stateEndpoints = [
      '/api/sync/state',
      'http://localhost:4000/api/sync/state',
      '/api/digiflazz/products',
      'http://localhost:4000/api/digiflazz/products',
    ];
    for (const sUrl of stateEndpoints) {
      try {
        const stateRes = await fetch(sUrl);
        if (stateRes.ok) {
          const stateJson = await stateRes.json();
          const prods = stateJson?.data?.products || (Array.isArray(stateJson?.data) ? stateJson.data : null);
          if (Array.isArray(prods) && prods.length > 0) {
            // MERGE cerdas: pertahankan produk manual custom dan harga override admin
            const currentLocal = storage.getProducts();
            const manualProducts = currentLocal.filter(p => 
              p.isManualCustom === true || 
              String(p.id).startsWith('df-manual-') || 
              p.categoryId === 'wifi' || 
              p.categoryId === 'premium'
            );

            const customPriceMap = new Map<string, number>();
            currentLocal.forEach(p => {
              if (p.isCustomPrice && p.sellingPrice) {
                customPriceMap.set(p.id, p.sellingPrice);
                if (p.sku) customPriceMap.set(p.sku, p.sellingPrice);
              }
            });

            const merged = prods.map((p: any) => {
              const overridden = customPriceMap.get(p.id) || (p.sku ? customPriceMap.get(p.sku) : undefined);
              if (overridden && overridden > (p.supplierPrice || 0)) {
                return { ...p, sellingPrice: overridden, isCustomPrice: true };
              }
              return p;
            });

            // Pastikan semua produk manual custom lokal tetap ada
            for (const man of manualProducts) {
              if (!merged.some((p: any) => p.id === man.id || (p.sku && man.sku && p.sku === man.sku))) {
                merged.unshift(man);
              }
            }

            storage.saveProducts(merged);
            break;
          }
        }
      } catch (_) {}
    }

    return json;
  },

  /**
   * Cek status IP Outbound backend dan verifikasi whitelist ke Digiflazz
   */
  async getDigiflazzIpStatus(): Promise<{
    outboundIp: string;
    configuredWhitelistIp: string;
    liveServerIp?: string;
    outboundProxy: string;
    isProxyActive: boolean;
    isWhitelisted: boolean | null;
    digiflazzDetectedIp?: string;
    digiflazzMessage?: string;
    deposit?: number;
    lastChecked: string;
  }> {
    const endpoints = ['/api/digiflazz/ip-status', 'http://localhost:4000/api/digiflazz/ip-status'];
    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json && json.data) return json.data;
        }
      } catch (_) {}
    }
    throw new Error('Tidak dapat memuat status Digiflazz dari server. Koneksi dan whitelist belum terverifikasi.');
  },

  /**
   * Deteksi live public outbound IP server VPS secara langsung
   */
  async detectDigiflazzLiveIp(): Promise<{
    liveIp: string;
    configuredWhitelistIp: string;
    isMatch: boolean;
    detectedAt: string;
  }> {
    const endpoints = ['/api/digiflazz/detect-live-ip', 'http://localhost:4000/api/digiflazz/detect-live-ip'];
    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json && json.data) return json.data;
        }
      } catch (_) {}
    }
    throw new Error('Tidak dapat mendeteksi IP outbound server. IP browser bukan IP VPS.');
  },

  async updateDigiflazzIpConfig(params: { whitelistIp?: string; outboundProxy?: string }): Promise<{ success: boolean; message: string }> {
    const endpoints = ['/api/digiflazz/update-ip-config', 'http://localhost:4000/api/digiflazz/update-ip-config'];
    let lastError: any = null;
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
          body: JSON.stringify(params),
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('Gagal menyimpan konfigurasi ke server.');
  },

  async testDigiflazzIp(proxy?: string): Promise<any> {
    const endpoints = ['/api/digiflazz/test-ip', 'http://localhost:4000/api/digiflazz/test-ip'];
    let lastError: any = null;
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
          body: JSON.stringify({ proxy }),
        });
        if (res.ok) {
          const json = await res.json();
          return json.data || json;
        }
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('Tidak dapat terhubung ke Digiflazz API.');
  },

  async handlePaymentWebhook(payload: any): Promise<Order> {
    const status = payload.transaction_status === 'settlement' || payload.transaction_status === 'capture' || payload.status === 'success'
      ? 'PAID'
      : payload.transaction_status === 'expire' || payload.status === 'expired'
      ? 'EXPIRED'
      : 'FAILED';
    const orderId = payload.order_id || payload.depositId || payload.id;
    return this.processPaymentWebhook(orderId, status, payload.payment_type || payload.method || 'QRIS');
  },

  async handleMidtransWebhook(payload: any): Promise<Order> {
    return this.handlePaymentWebhook(payload);
  },

  /**
   * Sinkronisasi konfigurasi gateway dari backend memory ke frontend localStorage.
   * Penting saat deploy: backend sudah punya config dari env vars,
   * tapi frontend localStorage mungkin kosong / berbeda.
   */
  async syncGatewayConfigFromBackend(): Promise<{ synced: boolean; gateway?: string }> {
    // Hydration is read-only. Never write environment defaults back to the DB.
    const settings = await storage.hydrateSettingsFromBackend();
    return { synced: !!settings, gateway: settings?.paymentGatewayProvider };
  },

  async deleteOrder(orderId: string): Promise<boolean> {
    storage.deleteOrder(orderId);
    try {
      await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: 'DELETE',
      });
    } catch (_) {}
    return true;
  },

  async deleteOrders(orderIds: string[]): Promise<boolean> {
    storage.deleteOrders(orderIds);
    try {
      await fetch('/api/orders/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds }),
      });
    } catch (_) {}
    return true;
  }
};
