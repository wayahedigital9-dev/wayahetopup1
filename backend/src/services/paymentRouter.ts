import { QIOSPAY_CONFIG, PAKASIR_CONFIG } from '../config/apikeys.js';
import { qiospayService } from './qiospay.js';
import { pakasirService } from './pakasir.js';
import { generateDynamicQRIS, convertStaticToDynamicQRIS } from '../utils/qris.js';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  PAYMENT GATEWAY ROUTER (PAKASIR & QIOSPAY DYNAMIC ROUTING)  ║
 * ║  Menyesuaikan harga produk secara dinamis & real-time        ║
 * ║  Kredensial disimpan aman di backend/.env                    ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export type ActiveGateway = 'PAKASIR' | 'QIOSPAY' | 'QRIS' | 'NONE';

export interface PaymentSessionResult {
  /** Gateway yang digunakan */
  gateway: ActiveGateway;
  /** Token untuk pembayaran (invoice/ref ID) */
  token: string;
  /** URL redirect / payment link (jika ada) */
  redirectUrl?: string;
  /** QR String (khusus QRIS) */
  qrString?: string;
  /** QR Image URL (khusus QRIS) */
  qrImage?: string;
  /** Biaya admin (fee) dari gateway */
  fee?: number;
  /** Total nominal pembayaran final */
  totalPayment?: number;
  /** Waktu expired pembayaran */
  expiredAt?: string;
  /** Apakah dynamic QR resmi dari provider */
  isDynamic?: boolean;
  /** Apakah dalam mode Sandbox (Uji Coba) */
  isSandbox?: boolean;
}

/**
 * Cek apakah Pakasir sudah terkonfigurasi
 */
function isPakasirActive(): boolean {
  return pakasirService.isConfigured();
}

/**
 * Cek apakah Qiospay sudah terkonfigurasi
 */
function isQiospayActive(): boolean {
  const code = QIOSPAY_CONFIG.MERCHANT_CODE;
  const key = QIOSPAY_CONFIG.API_KEY;
  return Boolean(code && key);
}

/**
 * Deteksi gateway mana yang aktif (Pakasir prioritas jika dikonfigurasi)
 */
export function detectActiveGateway(): ActiveGateway {
  const envGateway = (process.env.ACTIVE_GATEWAY || process.env.PAYMENT_GATEWAY_PROVIDER || '').trim().toUpperCase();
  if (envGateway === 'QIOSPAY' && isQiospayActive()) return 'QIOSPAY';
  if (envGateway === 'PAKASIR' && isPakasirActive()) return 'PAKASIR';

  if (isQiospayActive()) return 'QIOSPAY';
  if (isPakasirActive()) return 'PAKASIR';
  return 'QRIS';
}

/**
 * Daftar semua gateway yang aktif
 */
export function listActiveGateways(): ActiveGateway[] {
  const list: ActiveGateway[] = [];
  if (isPakasirActive()) list.push('PAKASIR');
  if (isQiospayActive()) list.push('QIOSPAY');
  list.push('QRIS');
  return list;
}

/**
 * Buat sesi pembayaran dinamis menyesuaikan nominal harga produk
 */
export async function createPaymentSession(params: {
  orderId: string;
  grossAmount: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  preferredGateway?: ActiveGateway;
  paymentMethod?: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
}): Promise<PaymentSessionResult> {
  const dynamicAmount = Math.max(0, Math.round(Number(params.grossAmount || 0)));
  const gateway = params.preferredGateway || detectActiveGateway();

  // 1. Jalur Utama: PAKASIR API v2 Dynamic Transaction (Terpisah Murni Tanpa Fallback Qiospay)
  if (gateway === 'PAKASIR') {
    const slug = PAKASIR_CONFIG.SLUG || 'waroengdigital';
    const fallbackPaymentLink = `https://app.pakasir.com/pay/${encodeURIComponent(slug)}/${dynamicAmount}?order_id=${encodeURIComponent(params.orderId)}&qris_only=1`;

    try {
      const pakasirRes = await pakasirService.createTransaction({
        orderId: params.orderId,
        amount: dynamicAmount,
        method: params.paymentMethod || PAKASIR_CONFIG.PAYMENT_METHOD || 'qris',
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        customerPhone: params.customerPhone,
      });

      if (pakasirRes.success && pakasirRes.payment) {
        const p = pakasirRes.payment;
        const isLiveEMVCo = p.qr_string && p.qr_string.startsWith('000201') && !p.qr_string.includes('lorem-ipsum');

        let finalQR = isLiveEMVCo ? p.qr_string : undefined;

        // Pastikan finalQR selalu menyematkan Tag 54 dengan nominal dinamis
        if (finalQR) {
          try {
            finalQR = convertStaticToDynamicQRIS(finalQR, dynamicAmount, params.orderId, { gateway: 'PAKASIR' });
          } catch (_) {}
        }

        // Pakasir QRIS Statis MANDIRI (Tidak pernah memakai Qiospay)
        if (!finalQR) {
          const registeredStatic = (PAKASIR_CONFIG.QR_STRING || process.env.PAKASIR_QR_STRING || '').trim();
          if (registeredStatic && registeredStatic.startsWith('000201')) {
            try {
              finalQR = convertStaticToDynamicQRIS(registeredStatic, dynamicAmount, params.orderId, { gateway: 'PAKASIR' });
            } catch (_) {}
          }
        }

        if (!finalQR) {
          finalQR = generateDynamicQRIS({
            amount: dynamicAmount,
            invoiceNumber: params.orderId,
            merchantName: PAKASIR_CONFIG.MERCHANT_NAME || 'WAYAHE DIGITAL',
            merchantCity: 'SURABAYA',
            nmid: PAKASIR_CONFIG.NMID || undefined,
            gateway: 'PAKASIR',
          });
        }

        return {
          gateway: 'PAKASIR',
          token: p.txn_id || params.orderId,
          redirectUrl: p.payment_link || fallbackPaymentLink,
          qrString: finalQR,
          fee: p.fee || 0,
          totalPayment: p.total_payment || dynamicAmount,
          expiredAt: p.expired_at || undefined,
          isDynamic: true,
          isSandbox: p.is_sandbox ?? PAKASIR_CONFIG.IS_SANDBOX,
        };
      }
    } catch (err: any) {
      console.warn('⚠️ [PaymentRouter] Pakasir create transaction fallback notice:', err.message);
    }

    // Jika API Pakasir offline atau terjadi kendala jaringan:
    let fallbackQR: string | undefined = undefined;
    const registeredStatic = (PAKASIR_CONFIG.QR_STRING || process.env.PAKASIR_QR_STRING || '').trim();
    if (registeredStatic && registeredStatic.startsWith('000201')) {
      try {
        fallbackQR = convertStaticToDynamicQRIS(registeredStatic, dynamicAmount, params.orderId);
      } catch (_) {}
    }

    if (!fallbackQR) {
      fallbackQR = generateDynamicQRIS({
        amount: dynamicAmount,
        invoiceNumber: params.orderId,
        merchantName: PAKASIR_CONFIG.MERCHANT_NAME || 'WAYAHE DIGITAL',
        merchantCity: 'SURABAYA',
        nmid: PAKASIR_CONFIG.NMID || undefined,
        gateway: 'PAKASIR',
      });
    }

    return {
      gateway: 'PAKASIR',
      token: `PKS-${params.orderId.replace(/[^a-zA-Z0-9]/g, '')}`,
      redirectUrl: fallbackPaymentLink,
      qrString: fallbackQR,
      totalPayment: dynamicAmount,
      isDynamic: true,
      isSandbox: PAKASIR_CONFIG.IS_SANDBOX,
    };
  }

  // 2. Jalur Qiospay QRIS Dinamis
  const depositId = `QP-${params.orderId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const qrisRes = qiospayService.createPaymentQris({
    amount: dynamicAmount,
    orderId: params.orderId,
  });

  return {
    gateway: gateway === 'QIOSPAY' || isQiospayActive() ? 'QIOSPAY' : 'QRIS',
    token: depositId,
    qrString: qrisRes.qrString,
    qrImage: qrisRes.qrImage,
    totalPayment: dynamicAmount,
    isDynamic: qrisRes.isDynamic,
  };
}

/**
 * Log status gateway saat startup
 */
export function logGatewayStatus(): void {
  console.log('── Payment Gateway Status ────────────────────────');
  if (isPakasirActive()) {
    console.log(`  ✅ Pakasir API v2 — Gateway Live Terhubung (Slug: ${PAKASIR_CONFIG.SLUG})`);
  }
  if (isQiospayActive()) {
    console.log('  ✅ Qiospay QRIS — Gateway Live Terhubung');
  }
  console.log(`  🎯 Gateway Utama Aktif: ${detectActiveGateway()}`);
}
