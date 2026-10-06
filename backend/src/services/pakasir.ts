import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PAKASIR_CONFIG } from '../config/apikeys.js';
import { FulfillmentService } from './fulfillment.js';
import { supabaseService } from './supabaseService.js';
import { mongoDbService } from './mongodbService.js';
import { pushNotificationService } from './pushNotificationService.js';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  PAKASIR API v2 PAYMENT SERVICE (PRODUCTION SECURE)           ║
 * ║  Dokumentasi: https://app.pakasir.com/docs                   ║
 * ║  - Backend-only execution (API Key & Secret never leaked)   ║
 * ║  - Idempotent Webhook Verification & Processing             ║
 * ║  - Strict Timing-Safe Secret Validation                     ║
 * ║  - Digiflazz & Product Fulfillment Trigger on Verified Paid ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export interface PakasirCreateTransactionParams {
  orderId: string;
  amount: number;
  method?: string; // e.g. "qris", "bca_va", etc.
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

export interface PakasirCreateResponse {
  success: boolean;
  message?: string;
  payment?: {
    order_id: string;
    txn_id: string | null;
    amount: number;
    fee: number;
    total_payment: number;
    payment_method: string;
    payment_link: string | null;
    qr_string: string | null;
    expired_at: string | null;
    status: string;
    is_sandbox?: boolean;
  };
  detail?: any;
}

export interface PakasirWebhookPayload {
  txn_id: string;
  order_id: string;
  amount: number;
  fee?: number;
  total_payment?: number;
  payment_method?: string;
  is_sandbox?: boolean;
  status: 'completed' | 'pending' | 'failed' | 'expired' | string;
  completed_at?: string;
  expired_at?: string;
  [key: string]: any;
}

function safeCompare(received: string, expected: string): boolean {
  try {
    const a = Buffer.from(String(received || ''));
    const b = Buffer.from(String(expected || ''));
    if (a.length !== b.length || a.length === 0) {
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export class PakasirService {
  private baseUrl: string;
  private slug: string;
  private apiKey: string;
  private webhookSecret: string;
  private isSandbox: boolean;

  constructor() {
    this.baseUrl = PAKASIR_CONFIG.BASE_URL || process.env.PAKASIR_BASE_URL || 'https://app.pakasir.com';
    this.slug = PAKASIR_CONFIG.SLUG || process.env.PAKASIR_SLUG || '';
    this.apiKey = PAKASIR_CONFIG.API_KEY || process.env.PAKASIR_API_KEY || '';
    this.webhookSecret = PAKASIR_CONFIG.WEBHOOK_SECRET || process.env.PAKASIR_WEBHOOK_SECRET || '';
    this.isSandbox = process.env.PAKASIR_IS_SANDBOX !== 'false';
  }

  public refreshConfig(override?: { baseUrl?: string; slug?: string; apiKey?: string; webhookSecret?: string; isSandbox?: boolean }) {
    this.baseUrl = override?.baseUrl || process.env.PAKASIR_BASE_URL || PAKASIR_CONFIG.BASE_URL || 'https://app.pakasir.com';
    this.slug = override?.slug || process.env.PAKASIR_SLUG || PAKASIR_CONFIG.SLUG || '';
    this.apiKey = override?.apiKey || process.env.PAKASIR_API_KEY || PAKASIR_CONFIG.API_KEY || '';
    this.webhookSecret = override?.webhookSecret || process.env.PAKASIR_WEBHOOK_SECRET || PAKASIR_CONFIG.WEBHOOK_SECRET || '';
    this.isSandbox = override?.isSandbox !== undefined ? override.isSandbox : (process.env.PAKASIR_IS_SANDBOX !== 'false');
  }

  public getIsSandbox(): boolean {
    return this.isSandbox;
  }

  public setIsSandbox(sandbox: boolean) {
    this.isSandbox = sandbox;
  }

  public isConfigured(): boolean {
    this.refreshConfig();
    return Boolean(this.slug && this.apiKey);
  }

  public getPublicInfo() {
    this.refreshConfig();
    return {
      isConfigured: Boolean(this.slug && this.apiKey),
      baseUrl: this.baseUrl,
      slug: this.slug ? `${this.slug.substring(0, 3)}***` : '',
      hasApiKey: Boolean(this.apiKey),
      hasWebhookSecret: Boolean(this.webhookSecret),
      paymentMethod: PAKASIR_CONFIG.PAYMENT_METHOD || 'qris',
      isSandbox: this.isSandbox,
    };
  }

  /**
   * 1. CREATE TRANSACTION (POST /api/v2/create-transaction/{slug}/{order_id})
   */
  public async createTransaction(params: PakasirCreateTransactionParams): Promise<PakasirCreateResponse> {
    this.refreshConfig();

    const { orderId, amount, method = 'qris' } = params;

    if (!this.slug || !this.apiKey) {
      console.error('[PAKASIR ERROR] PAKASIR_CONFIG_MISSING: PAKASIR_SLUG atau PAKASIR_API_KEY belum dikonfigurasi di server backend.');
      return {
        success: false,
        message: 'Konfigurasi payment Pakasir belum lengkap di server backend.',
      };
    }

    const cleanOrderId = String(orderId).trim().replace(/[\/\\]/g, '-');
    const cleanMethod = String(method || 'qris').toLowerCase();
    const cleanAmount = Number(amount);

    console.log('[PAKASIR CREATE]');
    console.log(`  order_id: ${cleanOrderId}`);
    console.log(`  amount:   ${cleanAmount}`);
    console.log(`  method:   ${cleanMethod}`);

    const targetUrl = `${this.baseUrl.replace(/\/+$/, '')}/api/v2/create-transaction/${encodeURIComponent(this.slug)}/${encodeURIComponent(cleanOrderId)}`;

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
        },
        body: JSON.stringify({
          method: cleanMethod,
          amount: cleanAmount,
        }),
      });

      const rawText = await response.text();
      let data: any;

      try {
        data = JSON.parse(rawText);
      } catch {
        data = { raw: rawText };
      }

      if (!response.ok) {
        console.error('[PAKASIR RESPONSE ERROR]');
        console.error(`  status:  ${response.status}`);
        console.error(`  payload:`, data);
        return {
          success: false,
          message: data?.message || 'Gagal membuat transaksi Pakasir',
          detail: data,
        };
      }

      console.log('[PAKASIR RESPONSE]');
      console.log(`  txn_id: ${data.txn_id || '-'}`);
      console.log(`  status: ${data.status || 'pending'}`);

      // Standarisasi response (Mendukung baik versi ringkas maupun lengkap)
      const pData = data.payment || data.data || data;
      const txnId = data.txn_id || pData.txn_id || null;
      const paymentLink = data.payment_link || pData.payment_link || data.payment_url || pData.payment_url || null;
      const qrString = data.qr_string || pData.qr_string || null;
      const fee = Number(data.fee || pData.fee || 0);
      const totalPayment = Number(data.total_payment || pData.total_payment || (cleanAmount + fee));
      const expiredAt = data.expires_at || data.expired_at || pData.expires_at || pData.expired_at || null;
      const status = data.status || pData.status || 'pending';
      const isSandbox = Boolean(data.is_sandbox ?? pData.is_sandbox ?? this.isSandbox);

      return {
        success: true,
        payment: {
          order_id: cleanOrderId,
          txn_id: txnId,
          amount: cleanAmount,
          fee,
          total_payment: totalPayment,
          payment_method: data.payment_method || cleanMethod,
          payment_link: paymentLink,
          qr_string: qrString,
          expired_at: expiredAt,
          status,
          is_sandbox: isSandbox,
        },
        detail: data,
      };
    } catch (error: any) {
      console.error('[PAKASIR ERROR] PAKASIR_CREATE_FAILED:', error.message);
      return {
        success: false,
        message: `Koneksi ke Pakasir gagal: ${error.message}`,
      };
    }
  }

  /**
   * 2. VERIFIKASI WEBHOOK SECRET
   */
  public verifyWebhookSecret(receivedSecret: string | null | undefined): boolean {
    this.refreshConfig();
    if (!this.webhookSecret) {
      console.error('[PAKASIR WEBHOOK] PAKASIR_WEBHOOK_SECRET belum dikonfigurasi.');
      return false;
    }
    if (!receivedSecret) {
      return false;
    }
    return safeCompare(receivedSecret.trim(), this.webhookSecret.trim());
  }

  /**
   * 3. PROSES WEBHOOK PAKASIR (IDEMPOTENT & SECURE)
   */
  public async handleWebhook(
    payload: PakasirWebhookPayload,
    receivedSecret: string | null | undefined,
    prisma: PrismaClient,
    fulfillmentService: FulfillmentService
  ): Promise<{ statusCode: number; responseBody: { success: boolean; message?: string; received?: boolean; error?: string } }> {
    this.refreshConfig();

    // 1. Verifikasi X-Secret
    if (!this.verifyWebhookSecret(receivedSecret)) {
      console.warn('[PAKASIR WEBHOOK] REJECTED: WEBHOOK_SECRET_INVALID');
      return {
        statusCode: 401,
        responseBody: { success: false, error: 'WEBHOOK_SECRET_INVALID', message: 'Unauthorized webhook secret' },
      };
    }

    const { txn_id, order_id, amount, status, completed_at } = payload;

    console.log('[PAKASIR WEBHOOK]');
    console.log(`  order_id: ${order_id}`);
    console.log(`  txn_id:   ${txn_id}`);
    console.log(`  amount:   ${amount}`);
    console.log(`  status:   ${status}`);

    if (!txn_id || !order_id || typeof amount === 'undefined' || !status) {
      console.warn('[PAKASIR WEBHOOK] REJECTED: INVALID_PAYLOAD');
      return {
        statusCode: 400,
        responseBody: { success: false, error: 'INVALID_PAYLOAD', message: 'Payload tidak lengkap' },
      };
    }

    // 2. Cari order dari Database (Prisma, Supabase, MongoDB, State)
    const cleanOrderId = String(order_id).trim();
    const altOrderId = cleanOrderId.replace(/-/g, '/');
    let order: any = null;

    try {
      order = await prisma.order.findFirst({
        where: {
          OR: [
            { id: cleanOrderId },
            { invoiceNumber: cleanOrderId },
            { invoiceNumber: altOrderId },
          ],
        },
        include: { items: { include: { product: true } } },
      });
    } catch (_) {}

    if (!order) {
      try {
        order = await supabaseService.getOrder(cleanOrderId) || await supabaseService.getOrder(altOrderId);
      } catch (_) {}
    }

    if (!order) {
      try {
        const state = await mongoDbService.getAllState();
        const ordersList = Array.isArray(state?.orders)
          ? state.orders
          : (state?.orders ? Object.values(state.orders) : []);
        order = ordersList.find(
          (o: any) => 
            o.id === cleanOrderId || 
            o.invoiceNumber?.toLowerCase() === cleanOrderId.toLowerCase() ||
            o.invoiceNumber?.toLowerCase() === altOrderId.toLowerCase() ||
            (o.invoiceNumber && o.invoiceNumber.replace(/[\/\\]/g, '-') === cleanOrderId)
        );
      } catch (_) {}
    }

    if (!order) {
      console.warn(`[PAKASIR WEBHOOK] REJECTED: ORDER_NOT_FOUND (${cleanOrderId})`);
      return {
        statusCode: 404,
        responseBody: { success: false, error: 'ORDER_NOT_FOUND', message: 'Order tidak ditemukan di database' },
      };
    }

    // 3. Verifikasi Keamanan Transaksi
    // (a) Cocokkan Pakasir txn_id jika sebelumnya sudah tercatat
    if (order.pakasirTxnId && order.pakasirTxnId !== txn_id) {
      console.warn(`[PAKASIR WEBHOOK] REJECTED: TRANSACTION_ID_MISMATCH (Expected: ${order.pakasirTxnId}, Received: ${txn_id})`);
      return {
        statusCode: 400,
        responseBody: { success: false, error: 'TRANSACTION_ID_MISMATCH', message: 'Transaction ID mismatch' },
      };
    }

    // (b) Cocokkan amount order dengan payload amount
    const orderAmount = Number(order.totalAmount || order.total_amount || order.amount || order.subtotal || 0);
    const webhookAmount = Number(amount);

    if (orderAmount > 0 && webhookAmount > 0 && Math.abs(orderAmount - webhookAmount) > 5) {
      console.warn(`[PAKASIR WEBHOOK] REJECTED: PAYMENT_AMOUNT_MISMATCH (Order: ${orderAmount}, Received: ${webhookAmount})`);
      return {
        statusCode: 400,
        responseBody: { success: false, error: 'PAYMENT_AMOUNT_MISMATCH', message: 'Payment amount mismatch' },
      };
    }

    // 4. Handle Status Transaksi
    if (status === 'completed' || status === 'paid' || status === 'settlement' || status === 'SUCCESS') {
      const isAlreadyPaid = order.paymentStatus === 'PAID' || order.payment_status === 'PAID';

      if (isAlreadyPaid) {
        console.log(`[PAKASIR WEBHOOK] IDEMPOTENT: Order ${cleanOrderId} sudah berstatus PAID sebelumnya. Skip duplicate fulfillment.`);
        return {
          statusCode: 200,
          responseBody: { success: true, received: true, message: 'Order already processed (idempotent)' },
        };
      }

      console.log(`[PAYMENT VERIFIED] order_id: ${cleanOrderId} (Amount: Rp ${webhookAmount.toLocaleString('id-ID')})`);

      const paidTimestamp = completed_at ? new Date(completed_at) : new Date();

      // (a) Update ke Prisma Database
      try {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            paidAt: paidTimestamp,
            paymentMethod: payload.payment_method || order.paymentMethod || 'QRIS (Pakasir)',
            fulfillmentStatus: 'PROCESSING',
          },
        }).catch(() => {});
      } catch (_) {}

      // (b) Update ke Supabase
      try {
        await supabaseService.updateOrderStatus(
          order.id,
          'PAID',
          'PROCESSING',
          undefined,
          {
            pakasir_txn_id: txn_id,
            completed_at: paidTimestamp.toISOString(),
            raw_webhook: payload,
            payment_method: payload.payment_method || 'QRIS (Pakasir)',
          }
        );
      } catch (_) {}

      // (c) Update ke MongoDB / Local Memory State
      try {
        await mongoDbService.updateOrder(order.id, {
          paymentStatus: 'PAID',
          paidAt: paidTimestamp.toISOString(),
          fulfillmentStatus: 'PROCESSING',
          paymentMethod: payload.payment_method || 'QRIS (Pakasir)',
          pakasirTxnId: txn_id,
          rawWebhook: payload,
        });
      } catch (_) {}

      // (d) Kirim Notifikasi Web Push ke Admin Status Bar
      try {
        pushNotificationService.sendPaymentSuccessNotification({
          id: order.id,
          invoiceNumber: order.invoiceNumber,
          productName: order.productName || (order.items && order.items[0]?.productName) || 'Produk Digital',
          totalAmount: orderAmount || webhookAmount,
          paymentMethod: payload.payment_method || 'QRIS (Pakasir)',
          paidAt: paidTimestamp.toISOString(),
        }).catch(() => {});
      } catch (_) {}

      // (e) Jalankan Pemenuhan Produk (Digiflazz / Voucher / Wifi)
      try {
        console.log(`[FULFILLMENT START] Memproses pengiriman produk untuk order ${order.invoiceNumber || order.id}...`);
        await fulfillmentService.fulfillOrder(order.id);
        console.log(`[FULFILLMENT COMPLETE] Order ${order.invoiceNumber || order.id} sukses diproses.`);
      } catch (fulfillErr: any) {
        console.error(`[FULFILLMENT ERROR] Gagal memenuhi produk order ${order.id}:`, fulfillErr.message);
      }

      return {
        statusCode: 200,
        responseBody: { success: true, received: true, message: 'Payment successfully processed and verified' },
      };
    } else if (status === 'failed' || status === 'cancelled') {
      try {
        await prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: 'FAILED', fulfillmentStatus: 'FAILED' },
        }).catch(() => {});
      } catch (_) {}

      try {
        await supabaseService.updateOrderStatus(order.id, 'FAILED', 'FAILED', 'Pembayaran dibatalkan atau gagal di Pakasir');
      } catch (_) {}

      return {
        statusCode: 200,
        responseBody: { success: true, received: true, message: 'Status updated to FAILED' },
      };
    } else if (status === 'expired') {
      try {
        await prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: 'EXPIRED', fulfillmentStatus: 'FAILED' },
        }).catch(() => {});
      } catch (_) {}

      try {
        await supabaseService.updateOrderStatus(order.id, 'EXPIRED', 'FAILED', 'Waktu pembayaran Pakasir habis (Expired)');
      } catch (_) {}

      return {
        statusCode: 200,
        responseBody: { success: true, received: true, message: 'Status updated to EXPIRED' },
      };
    }

    return {
      statusCode: 200,
      responseBody: { success: true, received: true, message: `Webhook received with status ${status}` },
    };
  }

  /**
   * 4. CHECK ORDER STATUS DARI DATABASE (GET /api/payment/pakasir/status/:orderId)
   */
  public async getOrderStatus(
    orderIdentifier: string, 
    prisma: PrismaClient,
    fulfillmentService?: FulfillmentService
  ): Promise<any> {
    const cleanId = String(orderIdentifier).trim();

    let order: any = null;

    try {
      order = await prisma.order.findFirst({
        where: {
          OR: [
            { id: cleanId },
            { invoiceNumber: cleanId },
          ],
        },
        include: { items: true },
      });
    } catch (_) {}

    if (!order) {
      try {
        const supa = await supabaseService.getOrder(cleanId);
        if (supa) order = supa;
      } catch (_) {}
    }

    if (!order) {
      try {
        const state = await mongoDbService.getAllState();
        const ordersList = Array.isArray(state?.orders)
          ? state.orders
          : (state?.orders ? Object.values(state.orders) : []);
        order = ordersList.find(
          (o: any) => o.id === cleanId || o.invoiceNumber?.toLowerCase() === cleanId.toLowerCase()
        );
      } catch (_) {}
    }

    if (!order) {
      return {
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: 'Order tidak ditemukan',
      };
    }

    const paymentStatus = String(order.paymentStatus || order.payment_status || 'PENDING').toLowerCase();
    const fulfillmentStatus = String(order.fulfillmentStatus || order.fulfillment_status || 'waiting_payment').toLowerCase();
    const amount = Number(order.totalAmount || order.total_amount || order.subtotal || 0);

    let currentPaymentStatus = paymentStatus === 'paid' ? 'paid' : (paymentStatus === 'unpaid' ? 'pending' : paymentStatus);
    let currentFulfillmentStatus = fulfillmentStatus;

    // Active Remote Verification ke Pakasir API v2 jika order masih pending
    if (currentPaymentStatus !== 'paid' && this.slug && this.apiKey) {
      try {
        const txnIdToCheck = order.pakasirTxnId || order.invoiceNumber || order.id;
        const statusUrl = `${this.baseUrl.replace(/\/+$/, '')}/api/v2/transaction-status/${encodeURIComponent(this.slug)}/${encodeURIComponent(txnIdToCheck)}`;
        const statusRes = await fetch(statusUrl, {
          method: 'GET',
          headers: {
            'X-Api-Key': this.apiKey,
          },
        });
        if (statusRes.ok) {
          const statusData: any = await statusRes.json().catch(() => ({}));
          const remoteStatus = String(statusData?.status || statusData?.data?.status || '').toLowerCase();
          if (remoteStatus === 'completed' || remoteStatus === 'paid') {
            console.log(`✅ [Pakasir] Transaksi ${order.invoiceNumber || order.id} terkonfirmasi LUNAS dari remote API Pakasir!`);
            currentPaymentStatus = 'paid';
            currentFulfillmentStatus = 'processing';

            if (fulfillmentService) {
              await this.handleWebhook({
                txn_id: statusData?.txn_id || txnIdToCheck,
                order_id: order.invoiceNumber || order.id,
                amount,
                fee: Number(order.fee || 0),
                total_payment: Number(order.totalPayment || amount),
                status: 'completed',
                completed_at: new Date().toISOString(),
              }, this.webhookSecret, prisma, fulfillmentService);
            } else {
              try {
                await prisma.order.update({
                  where: { id: order.id },
                  data: { paymentStatus: 'PAID', fulfillmentStatus: 'PROCESSING', paidAt: new Date() },
                }).catch(() => {});
                await supabaseService.updateOrderStatus(order.id, 'PAID', 'PROCESSING', 'Pembayaran terverifikasi via remote API Pakasir');
              } catch (_) {}
            }
          }
        }
      } catch (err: any) {
        console.warn('⚠️ [Pakasir] Active status check warning:', err.message);
      }
    }

    return {
      success: true,
      order: {
        order_id: order.invoiceNumber || order.id,
        id: order.id,
        payment_status: currentPaymentStatus,
        fulfillment_status: currentFulfillmentStatus,
        amount,
        fee: Number(order.fee || order.adminFee || 0),
        total_payment: Number(order.totalPayment || order.totalAmount || amount),
        payment_link: order.paymentLink || order.payment_link || null,
        qr_string: order.qrString || order.qr_string || null,
        paid_at: order.paidAt || order.paid_at || null,
        fulfilled_at: order.fulfilledAt || order.fulfilled_at || null,
        serial_number: order.serialNumber || order.serial_number || null,
      },
    };
  }

  /**
   * 4. SIMULASI PEMBAYARAN SANDBOX (POST https://app.pakasir.com/api/paymentsimulation)
   */
  public async simulatePayment(params: {
    orderId: string;
    amount: number;
  }): Promise<{ success: boolean; message: string; data?: any }> {
    this.refreshConfig();

    if (!this.slug || !this.apiKey) {
      return {
        success: false,
        message: 'PAKASIR_SLUG dan PAKASIR_API_KEY belum dikonfigurasi.',
      };
    }

    const cleanOrderId = String(params.orderId).trim().replace(/[\/\\]/g, '-');
    const cleanAmount = Number(params.amount);

    console.log('[PAKASIR SIMULATE PAYMENT]');
    console.log(`  project:  ${this.slug}`);
    console.log(`  order_id: ${cleanOrderId}`);
    console.log(`  amount:   ${cleanAmount}`);

    const targetUrl = `${this.baseUrl.replace(/\/+$/, '')}/api/paymentsimulation`;

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project: this.slug,
          order_id: cleanOrderId,
          amount: cleanAmount,
          api_key: this.apiKey,
        }),
      });

      const data: any = await response.json().catch(() => ({}));
      console.log('[PAKASIR SIMULATE RESPONSE]:', data);

      if (response.ok && data?.success) {
        return {
          success: true,
          message: 'Simulasi pembayaran Sandbox Pakasir berhasil dikirim.',
          data,
        };
      }

      return {
        success: data?.success || false,
        message: data?.message || 'Simulasi pembayaran Pakasir selesai diproses.',
        data,
      };
    } catch (err: any) {
      console.error('[PAKASIR SIMULATE ERROR]:', err.message);
      return {
        success: false,
        message: `Gagal memanggil API simulasi Pakasir: ${err.message}`,
      };
    }
  }
}

export const pakasirService = new PakasirService();
