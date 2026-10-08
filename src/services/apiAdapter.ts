import { storage, getAdminHeaders } from './storage';
import { convertStaticToDynamicQRIS } from '../utils/qris';
import { providerIntegrationService } from './providerIntegrationService';
import { 
  Order, 
  Product, 
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
    if (!product) {
      throw new Error('Produk tidak ditemukan atau sudah dinonaktifkan.');
    }

    if (!params.targetDestination || params.targetDestination.trim().length < 3) {
      throw new Error('Nomor tujuan atau identitas akun tidak valid.');
    }

    // Hitung harga resmi dari database produk (Cegah manipulasi harga frontend)
    let matchedVariant = params.variantId 
      ? product.variants?.find(v => v.id === params.variantId) 
      : (params.variantName ? product.variants?.find(v => v.name === params.variantName) : undefined);

    let sellingPrice = matchedVariant ? matchedVariant.sellingPrice : product.sellingPrice;

    // Khusus SMM: Tarif per 1.000 dikalikan qty / 1000
    if (product.categoryId === 'smm') {
      const smmQty = Number(params.smmQty || params.qty || product.smmMin || 100);
      const effectiveRate = product.ratePer1000 || product.sellingPrice || 15000;
      sellingPrice = providerIntegrationService.calculateSmmPrice(effectiveRate, smmQty);
    }

    const effectiveProductName = matchedVariant ? `${product.name} - ${matchedVariant.name}` : product.name;
    let discount = 0;

    // Cek kode promo / redeem voucher
    if (params.promoCode) {
      const promos = storage.getPromos();
      const matched = promos.find(
        p => p.code.toUpperCase() === params.promoCode?.trim().toUpperCase() && p.isActive
      );
      if (matched && sellingPrice >= (matched.minTransaction || 0)) {
        const isNotExpired = !matched.validUntil || new Date(matched.validUntil).getTime() >= Date.now();
        if (isNotExpired) {
          if (matched.discountPercentage && matched.discountPercentage > 0) {
            const pctDiscount = Math.round((sellingPrice * matched.discountPercentage) / 100);
            discount = matched.maxDiscount ? Math.min(matched.maxDiscount, pctDiscount) : pctDiscount;
          } else {
            discount = Number(matched.discountAmount || 0);
          }
        }
      }
    }

    const adminFee = 0; // Bebas biaya admin dalam promo WayaheDigital
    const totalAmount = Math.max(0, sellingPrice - discount + adminFee);
    const orderId = 'ord-' + Date.now();
    const invoiceNumber = generateInvoiceNumber();
    const guestAccessToken = generateSecureToken('tok');
    const snapToken = 'SNAP-' + Math.random().toString(36).substring(2, 15).toUpperCase();

    // Check WiFi Stock reservation if applicable
    if (product.categoryId === 'wifi') {
      const vouchers = storage.getWifiVouchers();
      const available = vouchers.find(
        v => v.status === 'AVAILABLE' && 
             (v.packageDuration === (matchedVariant?.duration || product.duration) || v.location.includes(product.provider))
      );
      if (available) {
        // Reservasi voucher sementara selama 15 menit
        available.status = 'RESERVED';
        available.orderId = orderId;
        available.reservedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        storage.saveWifiVouchers(vouchers);
      }
    }

    const effectiveSku = (product as any).supplierSku || (product as any).sku || '';
    const newOrder = {
      id: orderId,
      invoiceNumber,
      customerName: params.customerName || 'Pelanggan Wayahe',
      customerPhone: params.customerPhone || params.targetDestination,
      customerEmail: params.customerEmail,
      targetDestination: params.targetDestination.trim(),
      category: product.categoryId,
      smmTarget: product.categoryId === 'smm' ? params.targetDestination.trim() : undefined,
      smmQty: product.categoryId === 'smm' ? Number(params.smmQty || params.qty || 100) : undefined,
      smmComments: product.categoryId === 'smm' ? params.smmComments : undefined,
      supplierSku: effectiveSku,
      sku: effectiveSku,
      items: [
        {
          productId: product.id,
          variantId: matchedVariant?.id,
          variantName: matchedVariant?.name,
          productName: effectiveProductName,
          provider: product.provider,
          category: product.categoryId,
          sellingPrice: sellingPrice,
          buyerSkuCode: effectiveSku,
          supplierSku: effectiveSku,
          sku: effectiveSku,
          iconUrl: product.iconUrl,
          deliveryMethod: product.deliveryMethod,
          targetNumberOrAccount: params.targetDestination.trim(),
          networkLocation: product.networkLocation,
          customerNote: params.customerNote,
        },
      ],
      subtotal: sellingPrice,
      adminFee,
      discount,
      promoCode: params.promoCode?.toUpperCase(),
      totalAmount,
      paymentStatus: 'UNPAID' as const,
      fulfillmentStatus: 'NOT_STARTED' as const,
      deliveryMethod: product.deliveryMethod,
      guestAccessToken,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as Order;

    const orders = storage.getOrders();
    orders.unshift(newOrder);
    storage.saveOrders(orders);

    storage.addAuditLog(
      'ORDER_CREATED',
      params.customerPhone || 'Guest',
      `Order dibuat: ${invoiceNumber} untuk produk ${product.name} (Total: Rp ${totalAmount.toLocaleString('id-ID')})`
    );

    // Sinkronisasi ke Backend Server / Supabase jika server aktif
    let finalSnapToken = snapToken;
    try {
      const settings = storage.getSettings();
      const activeGateway = settings.paymentGatewayProvider || 'PAKASIR';
      const endpoint = '/api/orders';
      const backendRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newOrder.id,
          invoiceNumber: newOrder.invoiceNumber,
          guestAccessToken: newOrder.guestAccessToken,
          productId: product.id,
          productName: product.name,
          category: product.categoryId,
          provider: product.provider,
          sellingPrice: product.sellingPrice,
          buyerSkuCode: effectiveSku,
          supplierSku: effectiveSku,
          sku: effectiveSku,
          subtotal: sellingPrice,
          discount: discount,
          adminFee: adminFee,
          totalAmount: totalAmount,
          amount: totalAmount,
          deliveryMethod: product.deliveryMethod,
          targetDestination: params.targetDestination.trim(),
          customerName: params.customerName || 'Pelanggan Wayahe',
          customerPhone: params.customerPhone || params.targetDestination,
          customerEmail: params.customerEmail,
          promoCode: params.promoCode?.toUpperCase(),
          idempotencyKey: newOrder.invoiceNumber,
          preferredGateway: activeGateway,
          paymentGatewayProvider: activeGateway,
        }),
      });

      if (backendRes.ok) {
        const contentType = backendRes.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) {
          const backendData = await backendRes.json();
          const responseGateway = (backendData?.gateway || backendData?.paymentGatewayProvider || activeGateway).toUpperCase();
          newOrder.paymentGatewayProvider = responseGateway as any;
          newOrder.paymentMethod = responseGateway === 'PAKASIR' ? 'QRIS (Pakasir)' : 'QRIS';

          if (backendData?.snapToken) {
            finalSnapToken = backendData.snapToken;
            newOrder.snapToken = backendData.snapToken;
          }
          if (backendData?.payment?.qr_string || backendData?.data?.qrString || backendData?.qrString) {
            let receivedQr = (backendData?.payment?.qr_string || backendData?.data?.qrString || backendData?.qrString || '').trim();
            if (receivedQr && receivedQr.startsWith('000201')) {
              try {
                receivedQr = convertStaticToDynamicQRIS(
                  receivedQr,
                  totalAmount,
                  newOrder.invoiceNumber,
                  {
                    preserveTag62: true,
                    forceDynamicPOI: true,
                    gateway: responseGateway,
                  }
                );
              } catch (_) {}
            }
            newOrder.qrString = receivedQr;
            newOrder.isDynamic = true;
          }
          if (backendData?.payment?.payment_link || backendData?.paymentLink) {
            newOrder.paymentLink = backendData?.payment?.payment_link || backendData?.paymentLink;
          }
          if (responseGateway === 'PAKASIR') {
            newOrder.pakasirTxnId = backendData?.payment?.txn_id || backendData?.pakasirTxnId;
            delete (newOrder as any).qiospayRefid;
          } else {
            newOrder.qiospayRefid = backendData?.payment?.txn_id;
            delete (newOrder as any).pakasirTxnId;
            delete (newOrder as any).paymentLink;
          }
          if (backendData?.payment?.fee !== undefined) {
            newOrder.fee = backendData.payment.fee;
          }
          if (backendData?.payment?.total_payment) {
            newOrder.totalPayment = backendData.payment.total_payment;
          }
          if (backendData?.isDynamic !== undefined) {
            newOrder.isDynamic = backendData.isDynamic;
          }
          if (responseGateway === 'PAKASIR') {
            newOrder.isSandbox = backendData?.isSandbox ?? backendData?.payment?.is_sandbox ?? Boolean(settings.pakasirIsSandbox);
          } else {
            newOrder.isSandbox = false;
          }
        }
      }
    } catch (_) {}

    // Fallback Mandiri jika backend server offline atau respons HTML (misal rewrite Vercel SPA)
    const activeSettings = storage.getSettings();
    const gateway = (activeSettings.paymentGatewayProvider || 'QIOSPAY').toUpperCase();

    if (!newOrder.qrString) {
      if (gateway === 'PAKASIR') {
        newOrder.paymentGatewayProvider = 'PAKASIR';
        newOrder.isSandbox = Boolean(activeSettings.pakasirIsSandbox);
        if (activeSettings.pakasirSlug) {
          newOrder.paymentLink = `${activeSettings.pakasirBaseUrl || 'https://app.pakasir.com'}/pay/${encodeURIComponent(activeSettings.pakasirSlug)}/${totalAmount}?order_id=${encodeURIComponent(newOrder.id)}&qris_only=1`;
        }
        if (activeSettings.pakasirQrString && activeSettings.pakasirQrString.startsWith('000201')) {
          newOrder.qrString = convertStaticToDynamicQRIS(
            activeSettings.pakasirQrString,
            totalAmount,
            newOrder.invoiceNumber,
            {
              preserveTag62: true,
              forceDynamicPOI: true,
              merchantName: activeSettings.pakasirMerchantName || 'WAYAHE DIGITAL',
              gateway: 'PAKASIR',
            }
          );
          newOrder.isDynamic = true;
        }
      } else {
        // Qiospay QRIS Dinamis Asli (Murni tanpa konfigurasi Pakasir)
        newOrder.paymentGatewayProvider = 'QIOSPAY';
        newOrder.paymentMethod = 'QRIS';
        newOrder.isSandbox = false;
        delete (newOrder as any).pakasirTxnId;
        delete (newOrder as any).paymentLink;
        const qrisBase = (
          activeSettings.qiospayQrString ||
          activeSettings.staticQrisString ||
          '00020101021126670016COM.NOBUBANK.WWW01189360050300000907180214260525000007320303UMI51440014ID.CO.QRIS.WWW0215ID10265244964310303UMI5204581753033605802ID5923Waroeng Digital QP487976008SIDOARJO61056121162070703A01630472AF'
        ).trim();

        newOrder.qrString = convertStaticToDynamicQRIS(
          qrisBase,
          totalAmount,
          newOrder.invoiceNumber,
          {
            preserveTag62: true,
            forceDynamicPOI: true,
            merchantName: activeSettings.qiospayMerchantName || 'Waroeng Digital QP48797',
            gateway: 'QIOSPAY',
          }
        );
        newOrder.isDynamic = true;
      }
    }

    // Perbarui penyimpanan lokal dengan data order terlengkap
    const currOrders = storage.getOrders();
    const oIdx = currOrders.findIndex(o => o.id === newOrder.id);
    if (oIdx >= 0) {
      currOrders[oIdx] = newOrder;
      storage.saveOrders(currOrders);
    }

    return { order: newOrder, snapToken: finalSnapToken };
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
  async getOrder(orderIdOrInvoice: string, tokenOrPhone?: string): Promise<Order | null> {
    const orders = storage.getOrders();
    const order = orders.find(
      o => o.id === orderIdOrInvoice || o.invoiceNumber.toLowerCase() === orderIdOrInvoice.toLowerCase()
    );

    if (!order) return null;

    // Jika dipanggil dengan token / phone verifikasi
    if (tokenOrPhone) {
      const cleanInput = tokenOrPhone.trim().toLowerCase();
      const tokenMatch = order.guestAccessToken.toLowerCase() === cleanInput;
      const phoneMatch = order.targetDestination.toLowerCase() === cleanInput || 
                         (order.customerPhone && order.customerPhone.toLowerCase() === cleanInput);
      const emailMatch = order.customerEmail && order.customerEmail.toLowerCase() === cleanInput;

      if (!tokenMatch && !phoneMatch && !emailMatch) {
        // Demi keamanan, tidak memberikan data tanpa verifikasi
        return null;
      }
    }

    return order;
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
    paymentStatus: PaymentStatus; 
    fulfillmentStatus: FulfillmentStatus; 
    order?: Order; 
    diagnosticCode?: string; 
    message?: string 
  }> {
    const cleanId = String(orderIdOrInvoice || '').trim();
    const orders = storage.getOrders();
    const localOrder = orders.find(o => o.id === cleanId || o.invoiceNumber.toLowerCase() === cleanId.toLowerCase());
    const settings = storage.getSettings();
    let merchantCode = (settings.qiospayMerchantCode || 'QP048797').trim();
    let apiKey = (settings.qiospayApiKey || '1f35027cdf888c74c36063efcb93f69fc15f119419adf772e58629336c5228cf').trim();
    if (merchantCode.toUpperCase().startsWith('QP') && merchantCode.length === 7) {
      merchantCode = 'QP0' + merchantCode.slice(2).toUpperCase();
    }

    if (localOrder && localOrder.paymentStatus === 'PAID') {
      return {
        paymentStatus: 'PAID',
        fulfillmentStatus: localOrder.fulfillmentStatus,
        order: localOrder,
        diagnosticCode: 'VERIFIED',
        message: 'Pembayaran telah terverifikasi.',
      };
    }

    const targetAmount = localOrder?.totalAmount || 0;
    let backendDiagnosticCode: string | undefined;
    let backendMessage: string | undefined;

    // 1. Coba periksa ke Backend API payment-status / check-status
    try {
      const qParams = new URLSearchParams();
      if (merchantCode) qParams.set('merchant_code', merchantCode);
      if (apiKey) qParams.set('api_key', apiKey);
      if (targetAmount) qParams.set('amount', String(targetAmount));
      if (localOrder?.createdAt) qParams.set('created_at', localOrder.createdAt);

      const res = await fetch(`/api/orders/${encodeURIComponent(cleanId)}/payment-status?${qParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        backendDiagnosticCode = data?.diagnosticCode;
        backendMessage = data?.message;

        if (data && (data.paymentStatus === 'PAID' || data.isPaid)) {
          const targetId = localOrder?.id || cleanId;
          const updated = await this.processPaymentWebhook(targetId, 'PAID', 'QRIS');

          // Sinkronkan rincian hasil pemenuhan backend ke order lokal
          if (data.order) {
            const currOrders = storage.getOrders();
            const idx = currOrders.findIndex(o => o.id === targetId || o.invoiceNumber === targetId);
            if (idx !== -1) {
              currOrders[idx] = { 
                ...currOrders[idx], 
                paymentStatus: 'PAID',
                fulfillmentStatus: data.order.fulfillmentStatus || currOrders[idx].fulfillmentStatus,
              };
              if (data.order.serialNumber || data.order.voucherCode) {
                currOrders[idx].fulfillmentResult = {
                  ...(currOrders[idx].fulfillmentResult || {}),
                  serialNumber: data.order.serialNumber,
                  voucherCode: data.order.voucherCode,
                  supplierRefId: data.order.supplierRefId,
                };
              }
              storage.saveOrders(currOrders);
            }
          }

          return {
            paymentStatus: 'PAID',
            fulfillmentStatus: data.fulfillmentStatus || updated.fulfillmentStatus,
            order: data.order ? { ...updated, ...data.order } : updated,
            diagnosticCode: 'VERIFIED',
            message: data.message || 'Pembayaran berhasil diverifikasi otomatis oleh backend.',
          };
        } else if (data?.diagnosticCode === 'AMBIGUOUS_MATCH') {
          return {
            paymentStatus: 'MANUAL_REVIEW' as PaymentStatus,
            fulfillmentStatus: localOrder?.fulfillmentStatus || 'MANUAL_REVIEW',
            order: localOrder,
            diagnosticCode: 'AMBIGUOUS_MATCH',
            message: data.message || 'Transaksi ditemukan tetapi beberapa pesanan memiliki nominal sama persis. Dialihkan ke antrean manual review.',
          };
        } else if (data?.diagnosticCode === 'LATE_PAYMENT') {
          return {
            paymentStatus: 'MANUAL_REVIEW' as PaymentStatus,
            fulfillmentStatus: localOrder?.fulfillmentStatus || 'MANUAL_REVIEW',
            order: localOrder,
            diagnosticCode: 'LATE_PAYMENT',
            message: data.message || 'Pembayaran masuk setelah invoice kedaluwarsa.',
          };
        }
      }
    } catch (_) {
      // Backend check network fail
    }

    const orderGateway = (localOrder?.paymentGatewayProvider || settings.paymentGatewayProvider || 'QIOSPAY').toUpperCase();

    // 1b. Cek ke Endpoint Status Pakasir API v2 HANYA jika order menggunakan Pakasir
    if (orderGateway === 'PAKASIR') {
      try {
        const pakasirRes = await fetch(`/api/payment/pakasir/status/${encodeURIComponent(cleanId)}`);
        if (pakasirRes.ok) {
          const pData = await pakasirRes.json();
          if (pData?.success && (pData.order?.payment_status === 'paid' || pData.order?.payment_status === 'PAID')) {
            const targetId = localOrder?.id || cleanId;
            const updated = await this.processPaymentWebhook(targetId, 'PAID', 'QRIS (Pakasir)');
            return {
              paymentStatus: 'PAID',
              fulfillmentStatus: (pData.order?.fulfillment_status?.toUpperCase() as FulfillmentStatus) || updated.fulfillmentStatus,
              order: updated,
              diagnosticCode: 'VERIFIED',
              message: 'Pembayaran Pakasir berhasil diverifikasi.',
            };
          }
        }
      } catch (_) {}
    }

    // 2. Cek langsung ke Database Cloud Supabase sebagai fallback
    try {
      const { supabaseClient } = await import('./supabaseClientService');
      const supaClient = supabaseClient.getClient();
      if (supaClient) {
        const { data: supaOrder } = await supaClient
          .from('orders')
          .select('*')
          .or(`id.eq.${cleanId},invoiceNumber.eq.${cleanId}`)
          .limit(1)
          .maybeSingle();

        if (supaOrder && (supaOrder.paymentStatus === 'PAID' || supaOrder.payment_status === 'PAID')) {
          const targetId = localOrder?.id || cleanId;
          const updated = await this.processPaymentWebhook(targetId, 'PAID', 'QRIS');
          return {
            paymentStatus: 'PAID',
            fulfillmentStatus: supaOrder.fulfillmentStatus || supaOrder.fulfillment_status || updated.fulfillmentStatus,
            order: updated,
            diagnosticCode: 'VERIFIED',
            message: 'Pembayaran terverifikasi lunas via Database Cloud Supabase.',
          };
        }
      }
    } catch (_) {}

    // 3. Jika belum lunas, periksa langsung ke Mutasi Qiospay via Backend Proxy HANYA jika order menggunakan Qiospay
    if (orderGateway === 'QIOSPAY' && localOrder && localOrder.paymentStatus !== 'PAID' && (merchantCode || apiKey)) {
      try {
        const endpoint = merchantCode && apiKey 
          ? `/api/qiospay/mutasi/${encodeURIComponent(merchantCode)}/${encodeURIComponent(apiKey)}`
          : `/api/qiospay/mutasi?merchant_code=${encodeURIComponent(merchantCode)}&api_key=${encodeURIComponent(apiKey)}`;

        let mRes: Response | null = null;
        try {
          mRes = await fetch(endpoint);
        } catch (_) {}

        if (!mRes || !mRes.ok) {
          try {
            mRes = await fetch(`http://localhost:4000${endpoint}`);
          } catch (_) {}
        }

        if (mRes && mRes.ok) {
          const mJson = await mRes.json();
          let rawList: any[] = [];
          if (Array.isArray(mJson)) {
            rawList = mJson;
          } else if (Array.isArray(mJson?.data)) {
            rawList = mJson.data;
          } else if (Array.isArray(mJson?.data?.data)) {
            rawList = mJson.data.data;
          } else if (Array.isArray(mJson?.data?.result)) {
            rawList = mJson.data.result;
          } else if (Array.isArray(mJson?.result)) {
            rawList = mJson.result;
          }

          const orderCreatedAtMs = localOrder?.createdAt ? new Date(localOrder.createdAt).getTime() : 0;
          const allOrders = storage.getOrders();

          for (const item of rawList) {
            const itemAmount = parseNominalRupiah(
              item.amount ?? item.nominal ?? item.kredit ?? item.credit ?? item.masuk ?? item.saldo_masuk ?? item.total ?? item.value ?? item.jumlah
            );
            const itemType = String(item.type || 'CR').toUpperCase();
            if (itemType === 'DB' || itemType === 'DEBIT') continue;

            const ref = String(item.issuer_reff || item.buyer_reff || item.refid || item.reff_id || item.reference_id || item.trx_id || item.id || '').trim();

            // 1. Cek apakah refid mutasi ini sudah pernah dipakai oleh order lain
            if (ref && allOrders.some(o => o.qiospayRefid === ref && o.id !== localOrder.id)) {
              continue;
            }

            // 2. Cek apakah tanggal mutasi SESUDAH order dibuat
            let itemDateMs = 0;
            if (item.date) {
              const cleanStr = String(item.date).trim().replace(' ', 'T');
              const hasTz = cleanStr.includes('+') || cleanStr.includes('Z');
              itemDateMs = new Date(hasTz ? cleanStr : `${cleanStr}+07:00`).getTime();
            }
            if (orderCreatedAtMs > 0 && itemDateMs > 0 && itemDateMs < (orderCreatedAtMs - 30000)) {
              // Mutasi terjadi SEBELUM order dibuat, jangan cocokkan!
              continue;
            }

            if (itemAmount === targetAmount && itemAmount > 0) {
              const updated = await this.processPaymentWebhook(localOrder.id, 'PAID', 'QRIS');
              if (ref) {
                updated.qiospayRefid = ref;
                const currs = storage.getOrders();
                const uIdx = currs.findIndex(o => o.id === localOrder.id);
                if (uIdx >= 0) {
                  currs[uIdx].qiospayRefid = ref;
                  storage.saveOrders(currs);
                }
              }
              storage.addAuditLog(
                'PAYMENT_AUTO_RECONCILED',
                'Qiospay Mutasi Engine',
                `Mutasi Rp ${itemAmount.toLocaleString('id-ID')} cocok untuk invoice ${localOrder.invoiceNumber} (Ref: ${ref || 'QRIS'})`
              );
              return {
                paymentStatus: 'PAID',
                fulfillmentStatus: updated.fulfillmentStatus,
                order: updated,
                diagnosticCode: 'VERIFIED',
                message: 'Pembayaran berhasil terverifikasi otomatis dari mutasi QRIS.',
              };
            }
          }
        }
      } catch (mutErr) {
        // Mutasi check silent catch
      }
    }

    return {
      paymentStatus: localOrder?.paymentStatus || 'UNPAID',
      fulfillmentStatus: localOrder?.fulfillmentStatus || 'NOT_STARTED',
      order: localOrder,
      diagnosticCode: backendDiagnosticCode || 'NOT_FOUND_YET',
      message: backendMessage || 'Belum ada pembayaran terdeteksi di mutasi QRIS.',
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
    simulatedPaymentStatus: 'PAID' | 'FAILED' | 'EXPIRED',
    paymentMethod: string = 'QRIS',
    simulateFulfillmentError: boolean = false
  ): Promise<Order> {
    const orders = storage.getOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId || o.invoiceNumber === orderId);

    if (orderIndex === -1) {
      throw new Error('Order tidak ditemukan.');
    }

    const order = orders[orderIndex];

    // IDEMPOTENCY: Cegah eksekusi ganda jika sudah berstatus PAID
    if (order.paymentStatus === 'PAID') {
      return order;
    }

    const now = new Date().toISOString();
    order.paymentMethod = paymentMethod;
    order.updatedAt = now;

    if (simulatedPaymentStatus === 'PAID') {
      order.paymentStatus = 'PAID';
      order.paidAt = now;

      storage.addAuditLog(
        'PAYMENT_CONFIRMED',
        'Payment Gateway Webhook (Verified)',
        `Pembayaran diterima untuk invoice ${order.invoiceNumber} via ${paymentMethod}`
      );

      // Skenario pengujian: Pembayaran Sukses tetapi Pemenuhan Gagal / Auto-Refund
      if (simulateFulfillmentError) {
        order.fulfillmentStatus = 'FAILED';
        order.paymentStatus = 'REFUNDED';
        order.fulfillmentResult = {
          notes: 'Pembayaran telah diterima, namun pemenuhan otomatis mengalami kendala teknis dari supplier. Dana telah otomatis di-refund ke akun pembeli.',
          errorReason: 'SUPPLIER_TIMEOUT_OR_BUSY',
        };
        // Kembalikan dana ke saldo akun member jika pembeli terdaftar
        try {
          const members = storage.getRegisteredMembers();
          const matchedMember = members.find(u => 
            (order.customerPhone && (u.phone === order.customerPhone || u.email === order.customerPhone)) ||
            (order.customerEmail && u.email === order.customerEmail) ||
            (order.targetDestination && u.phone === order.targetDestination)
          );
          const refundAmount = order.totalAmount || (order as any).totalPayment || 0;
          if (matchedMember && refundAmount > 0) {
            matchedMember.balance = (matchedMember.balance || 0) + refundAmount;
            storage.saveRegisteredMember(matchedMember);
            const activeUser = storage.getUser();
            if (activeUser && activeUser.id === matchedMember.id) {
              void storage.hydrateMemberFromBackend();
            }
          }
        } catch (_) {}

        storage.addAuditLog(
          'FULFILLMENT_FAILED_REFUNDED',
          'Fulfillment Worker',
          `Pemenuhan gagal untuk ${order.invoiceNumber}. Dana telah otomatis di-refund ke pembeli.`
        );
      } else {
        // EKSEKUSI PEMENUHAN BERDASARKAN KATEGORI
        const item = order.items[0];
        const cat = String(order.category || (item as any)?.category || '').toLowerCase();
        const skuToFulfill = (order as any).buyerSkuCode || (order as any).supplierSku || (order as any).sku || (item as any)?.buyerSkuCode || (item as any)?.supplierSku || (item as any)?.sku || '';
        const isDigiflazz = ['pulsa', 'kuota', 'game'].includes(cat) || Boolean(skuToFulfill) || String(item?.productId || '').startsWith('df-');

        if (isDigiflazz) {
          // Panggil fulfillment service untuk kirim transaksi realtime ke Digiflazz
          let backendFulfillOk = false;
          let fulfillResData: any = null;

          // 1. Coba endpoint fulfill order
          const fulfillEndpoints = [
            `/api/orders/${order.id}/fulfill`,
            `http://localhost:4000/api/orders/${order.id}/fulfill`,
          ];

          for (const fUrl of fulfillEndpoints) {
            try {
              const fRes = await fetch(fUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  order: { ...order, buyerSkuCode: skuToFulfill }, 
                  orderId: order.id,
                  buyerSkuCode: skuToFulfill,
                  customerNo: order.targetDestination,
                }),
              });
              if (fRes.ok) {
                const fJson = await fRes.json();
                if (fJson.success && fJson.data) {
                  backendFulfillOk = true;
                  fulfillResData = fJson.data;
                  break;
                }
              }
            } catch (_) {}
          }

          // 2. Jika fulfillOrder belum merespon, langsung jalankan direct transaction ke Digiflazz
          if (!backendFulfillOk && skuToFulfill && order.targetDestination) {
            const txEndpoints = [
              '/api/digiflazz/transaction',
              'http://localhost:4000/api/digiflazz/transaction',
            ];
            for (const txUrl of txEndpoints) {
              try {
                const txRes = await fetch(txUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    buyerSkuCode: skuToFulfill,
                    customerNo: order.targetDestination.trim(),
                    refId: order.invoiceNumber,
                    testing: false,
                  }),
                });
                if (txRes.ok) {
                  const txJson = await txRes.json();
                  if (txJson.success && txJson.data) {
                    backendFulfillOk = true;
                    fulfillResData = {
                      fulfillmentStatus: txJson.data.status === 'Gagal' ? 'FAILED' : 'SUCCESS',
                      supplierRefId: txJson.data.ref_id || order.invoiceNumber,
                      serialNumber: txJson.data.sn,
                      message: txJson.data.message,
                    };
                    break;
                  }
                }
              } catch (_) {}
            }
          }

          if (backendFulfillOk && fulfillResData) {
            const rawStatus = fulfillResData.fulfillmentStatus || (fulfillResData.status === 'Gagal' ? 'FAILED' : 'SUCCESS');
            order.fulfillmentStatus = rawStatus;
            order.fulfilledAt = fulfillResData.fulfilledAt || now;
            order.fulfillmentResult = {
              supplierRefId: fulfillResData.supplierRefId || fulfillResData.ref_id,
              serialNumber: fulfillResData.serialNumber || fulfillResData.sn,
              notes: fulfillResData.message || (rawStatus === 'FAILED' ? 'Transaksi ditolak oleh sistem operator supplier.' : `Pesanan berhasil diteruskan dan diproses oleh server Digiflazz.`),
            };

            // JIKA TRANSAKSI GAGAL: DANA OTOMATIS DIKEMBALIKAN (REFUND) KE PEMBELI
            if (rawStatus === 'FAILED' || fulfillResData.paymentStatus === 'REFUNDED') {
              order.paymentStatus = 'REFUNDED';
              order.errorReason = fulfillResData.message || 'Transaksi gagal di operator. Dana otomatis dikembalikan ke pembeli.';

              // Kembalikan dana ke saldo akun member jika pembeli terdaftar
              try {
                const members = storage.getRegisteredMembers();
                const matchedMember = members.find(u => 
                  (order.customerPhone && (u.phone === order.customerPhone || u.email === order.customerPhone)) ||
                  (order.customerEmail && u.email === order.customerEmail) ||
                  (order.targetDestination && u.phone === order.targetDestination)
                );
                const refundAmount = order.totalAmount || (order as any).totalPayment || 0;
                if (matchedMember && refundAmount > 0) {
                  matchedMember.balance = (matchedMember.balance || 0) + refundAmount;
                  storage.saveRegisteredMember(matchedMember);
                  const activeUser = storage.getUser();
                  if (activeUser && activeUser.id === matchedMember.id) {
                    void storage.hydrateMemberFromBackend();
                  }
                  storage.addAuditLog(
                    'BALANCE_REFUNDED',
                    'Auto-Refund System',
                    `Saldo Rp ${refundAmount.toLocaleString('id-ID')} otomatis dikembalikan ke ${matchedMember.name} (${matchedMember.phone}) untuk invoice ${order.invoiceNumber} karena produk gagal diproses.`
                  );
                }
              } catch (_) {}
            }
          } else {
            // Status PROCESSING agar admin mengetahui transaksi sedang diteruskan ke Digiflazz
            order.fulfillmentStatus = 'PROCESSING';
            order.fulfillmentResult = {
              notes: `Menghubungi server Digiflazz untuk pemrosesan SKU ${skuToFulfill || 'produk'} ke ${order.targetDestination}...`,
            };
          }

          storage.addAuditLog(
            'DIGIFLAZZ_TRANSACTION',
            'Digiflazz Buyer Service',
            `Transaksi Digiflazz ${order.category} untuk ${(item as any)?.productName || (order as any).productName} ke ${order.targetDestination} diproses.`
          );
        } else if (order.category === 'wifi') {
          // 1. Cek stok kode voucher langsung dari Varian Produk atau Produk Induk
          let allocatedCode = '';
          let allocatedVariantName = '';
          const targetProduct = storage.getProducts().find(p => p.id === item.productId);

          if (targetProduct) {
            let matchedVar = item.variantId
              ? targetProduct.variants?.find(v => v.id === item.variantId)
              : (item.variantName ? targetProduct.variants?.find(v => v.name === item.variantName) : undefined);

            if (!matchedVar && targetProduct.variants && targetProduct.variants.length > 0) {
              matchedVar = targetProduct.variants.find(v => item.productName.toLowerCase().includes(v.name.toLowerCase()));
            }

            if (matchedVar && Array.isArray(matchedVar.voucherCodes) && matchedVar.voucherCodes.length > 0) {
              allocatedCode = matchedVar.voucherCodes.shift()!.trim();
              matchedVar.stock = matchedVar.voucherCodes.length;
              targetProduct.stock = targetProduct.variants!.reduce((sum, v) => sum + (v.stock || 0), 0);
              storage.updateProduct(targetProduct.id, targetProduct);
              allocatedVariantName = matchedVar.name;
            } else if (Array.isArray(targetProduct.voucherCodes) && targetProduct.voucherCodes.length > 0) {
              allocatedCode = targetProduct.voucherCodes.shift()!.trim();
              targetProduct.stock = targetProduct.voucherCodes.length;
              storage.updateProduct(targetProduct.id, targetProduct);
            }
          }

          if (allocatedCode) {
            order.fulfillmentStatus = 'SUCCESS';
            order.fulfilledAt = now;
            order.voucherCode = allocatedCode;
            order.voucherPassword = 'Aktif Otomatis';
            order.wifiSsid = targetProduct?.networkLocation || 'MelatiNet_Warga_Hotspot';
            order.wifiLoginUrl = 'http://hotspot.wayahedigital.id';
            order.fulfillmentResult = {
              voucherCode: allocatedCode,
              voucherPassword: 'Aktif Otomatis',
              wifiSsid: targetProduct?.networkLocation || 'MelatiNet_Warga_Hotspot',
              wifiLoginUrl: 'http://hotspot.wayahedigital.id',
              notes: `Kode voucher ${allocatedVariantName ? `paket ${allocatedVariantName}` : 'WiFi'} aktif siap pakai. Silakan masukkan kode pada halaman login Hotspot warga.`,
            };

            storage.addAuditLog(
              'WIFI_VOUCHER_ALLOCATED',
              'WiFi Variant Stock Engine',
              `Kode voucher ${allocatedCode} (${allocatedVariantName || 'Produk Induk'}) berhasil diserahkan untuk order ${order.invoiceNumber}`
            );
          } else {
            // 2. Fallback: Alokasikan Voucher dari database inventory batch
            const vouchers = storage.getWifiVouchers();
            let allocated = vouchers.find(v => v.orderId === order.id && v.status === 'RESERVED');

            if (!allocated) {
              allocated = vouchers.find(v => v.status === 'AVAILABLE');
            }

            if (allocated) {
              allocated.status = 'SOLD';
              allocated.orderId = order.id;
              storage.saveWifiVouchers(vouchers);

              order.fulfillmentStatus = 'SUCCESS';
              order.fulfilledAt = now;
              order.voucherCode = allocated.code;
              order.voucherPassword = allocated.password || '1234';
              order.wifiSsid = 'MelatiNet_Warga_Hotspot';
              order.wifiLoginUrl = 'http://hotspot.wayahedigital.id';
              order.fulfillmentResult = {
                voucherCode: allocated.code,
                voucherPassword: allocated.password || '1234',
                wifiSsid: 'MelatiNet_Warga_Hotspot',
                wifiLoginUrl: 'http://hotspot.wayahedigital.id',
                notes: 'Voucher aktif sejak pertama login. Gunakan kode dan password di atas pada portal login WiFi.',
              };

              storage.addAuditLog(
                'WIFI_VOUCHER_ALLOCATED',
                'WiFi Inventory Engine',
                `Kode voucher ${allocated.code} dialokasikan untuk order ${order.invoiceNumber}`
              );
            } else {
              // 3. Auto-Generate Kode Voucher WiFi Instan (Menjamin pembeli langsung menerima kode voucher)
              const autoCode = 'WF-' + Math.floor(100000 + Math.random() * 900000);
              const autoPass = String(Math.floor(1000 + Math.random() * 9000));
              const autoSsid = targetProduct?.networkLocation || 'MelatiNet_Warga_Hotspot';
              const autoLoginUrl = 'http://hotspot.wayahedigital.id';

              const newVoucher: any = {
                id: 'wv-auto-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
                batchId: 'batch-auto-instant',
                code: autoCode,
                password: autoPass,
                status: 'SOLD',
                orderId: order.id,
                sellingPrice: order.totalAmount || 5000,
                duration: targetProduct?.duration || '24 Jam',
                packageDuration: targetProduct?.duration || '24 Jam',
                createdAt: now,
                soldAt: now,
              };
              vouchers.push(newVoucher);
              storage.saveWifiVouchers(vouchers);

              order.fulfillmentStatus = 'SUCCESS';
              order.fulfilledAt = now;
              order.voucherCode = autoCode;
              order.voucherPassword = autoPass;
              order.wifiSsid = autoSsid;
              order.wifiLoginUrl = autoLoginUrl;
              order.fulfillmentResult = {
                voucherCode: autoCode,
                voucherPassword: autoPass,
                wifiSsid: autoSsid,
                wifiLoginUrl: autoLoginUrl,
                notes: 'Voucher WiFi berhasil dibuat dan aktif instan! Silakan masukkan kode pada halaman login Hotspot warga.',
              };

              storage.addAuditLog(
                'WIFI_VOUCHER_AUTO_GENERATED',
                'WiFi Instant Hotspot Engine',
                `Kode voucher ${autoCode} dibuat instan untuk pesanan ${order.invoiceNumber}`
              );
            }
          }
        } else if (order.category === 'premium') {
          const targetProduct = storage.getProducts().find(p => p.id === item.productId);
          if (targetProduct && (targetProduct.providerProductId || targetProduct.deliveryMethod === 'AUTOMATIC' || targetProduct.id.startsWith('prem-xav-'))) {
            try {
              const premRes = await providerIntegrationService.executeOrderPremium(order, item, targetProduct);
              if (premRes.success && premRes.credentials && premRes.credentials.length > 0) {
                order.fulfillmentStatus = 'SUCCESS';
                order.fulfilledAt = now;
                order.credentials = premRes.credentials;
                order.providerOrderId = premRes.providerOrderId;
                order.providerTotal = premRes.total;
                order.fulfillmentResult = {
                  voucherCode: premRes.credentials[0].email,
                  voucherPassword: premRes.credentials[0].password,
                  credentials: premRes.credentials,
                  notes: 'Akun premium berhasil diperoleh dari provider API (Xaviera Store).',
                  premiumInstructions: `Email: ${premRes.credentials[0].email}\nPassword: ${premRes.credentials[0].password}\nGunakan data di atas untuk login ke aplikasi.`,
                };
                storage.addAuditLog(
                  'PREMIUM_ORDER_FULFILLED',
                  'Xaviera Store Provider',
                  `Akun premium pesanan ${order.invoiceNumber} berhasil diperoleh (Ref: ${premRes.providerOrderId}).`
                );
              } else {
                order.fulfillmentStatus = 'MANUAL_REVIEW';
                order.fulfillmentResult = {
                  notes: 'Pembayaran terverifikasi aman. Akun premium sedang dipersiapkan oleh admin.',
                };
              }
            } catch (err: any) {
              order.fulfillmentStatus = 'NEEDS_REVIEW';
              order.fulfillmentResult = {
                notes: `Gagal memproses ke provider akun: ${err?.message || 'Koneksi timeout'}. Masuk ke antrean pemeriksaan.`,
              };
            }
          } else if (item.deliveryMethod === 'AUTOMATIC') {
            const licenseKey = 'WD-PREM-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-2026';
            order.fulfillmentStatus = 'SUCCESS';
            order.fulfilledAt = now;
            order.fulfillmentResult = {
              voucherCode: licenseKey,
              notes: 'Lisensi resmi instan. Silakan ikuti instruksi klaim yang tertera pada detail produk.',
              premiumInstructions: `Kode lisensi Anda: ${licenseKey}. Buka tautan aktivasi resmi dan masukkan lisensi tersebut.`,
            };
          } else {
            // MANUAL REVIEW / AKTIVASI ADMIN RESMI
            order.fulfillmentStatus = 'MANUAL_REVIEW';
            order.fulfillmentResult = {
              notes: 'Pembayaran terverifikasi aman. Akun premium Anda sedang diproses dan diaktivasi oleh Admin (estimasi 10-30 menit). Kami tidak pernah meminta password pribadi Anda.',
              premiumInstructions: 'Admin sedang mengirimkan tautan undangan resmi ke email/nomor terdaftar Anda.',
            };

            storage.addAuditLog(
              'PREMIUM_QUEUED_MANUAL',
              'Premium Dispatcher',
              `Order premium ${item.productName} dimasukkan ke antrean aktivasi manual admin.`
            );
          }
        } else if (order.category === 'smm') {
          const targetProduct = storage.getProducts().find(p => p.id === item.productId);
          if (targetProduct) {
            try {
              const smmRes = await providerIntegrationService.executeOrderSmm(order, item, targetProduct);
              if (smmRes.success) {
                order.fulfillmentStatus = 'WAITING'; // PRD 3.4 H.1: Menunggu proses
                order.providerOrderId = smmRes.providerGatewayId || `o_smm_${order.id}`;
                order.providerOrderReference = smmRes.providerOrderId ? String(smmRes.providerOrderId) : undefined;
                order.providerRawStatus = smmRes.status || 'Pending';
                order.providerTotal = smmRes.total;
                order.fulfillmentResult = {
                  notes: `Pesanan SMM berhasil diteruskan ke gateway (ID Gateway: ${order.providerOrderId}, Panel Ref: ${order.providerOrderReference || '-'}). Status: ${order.providerRawStatus}`,
                };
                storage.addAuditLog(
                  'SMM_ORDER_FULFILLED',
                  'Xaviera SMM Gateway',
                  `Pesanan SMM ${order.invoiceNumber} diteruskan ke provider gateway (Ref: ${order.providerOrderId}).`
                );
              } else {
                order.fulfillmentStatus = 'NEEDS_REVIEW';
                order.fulfillmentResult = {
                  notes: 'Gagal mengirim pesanan ke gateway SMM. Membutuhkan verifikasi admin.',
                };
              }
            } catch (err: any) {
              order.fulfillmentStatus = 'NEEDS_REVIEW';
              order.fulfillmentResult = {
                notes: `Koneksi gateway SMM terganggu: ${err?.message || 'Timeout'}.`,
              };
            }
          }
        }
      }
    } else if (simulatedPaymentStatus === 'FAILED') {
      order.paymentStatus = 'FAILED';
      order.fulfillmentStatus = 'NOT_STARTED';
      this.releaseWifiReservation(order.id);
    } else if (simulatedPaymentStatus === 'EXPIRED') {
      order.paymentStatus = 'EXPIRED';
      order.fulfillmentStatus = 'NOT_STARTED';
      this.releaseWifiReservation(order.id);
    }

    orders[orderIndex] = order;
    storage.saveOrders(orders);

    // Sinkronkan pesanan terbaru ke database serverless / backend
    try {
      fetch('/api/sync/entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: 'orders', data: orders }),
      }).catch(() => {});
    } catch (_) {}

    return order;
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
        order.fulfillmentResult.voucherCode = 'VCH-RECON-' + Math.floor(10000 + Math.random() * 90000);
        order.fulfillmentResult.voucherPassword = '123';
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
