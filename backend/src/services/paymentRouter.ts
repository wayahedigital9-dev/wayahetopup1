import { QIOSPAY_CONFIG, PAKASIR_CONFIG } from '../config/apikeys.js';
import { qiospayService } from './qiospay.js';
import { mongoDbService } from './mongodbService.js';
import { pakasirService } from './pakasir.js';

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
  /** Nomor Virtual Account (bila pembeli memilih channel VA) */
  vaNumber?: string;
  /** Kode bank VA (mis. 009) */
  vaBankCode?: string;
  /** Nama bank VA (mis. BNI) */
  vaBankName?: string;
  /** Referensi unik transaksi di sisi partner (dipakai untuk pencocokan callback VA) */
  partnerReff?: string;
}

/** Satu channel pembayaran yang boleh dipilih pembeli (daftar berasal dari SERVER). */
export interface PaymentChannel {
  id: string;
  gateway: ActiveGateway;
  kind: 'QRIS' | 'VA';
  label: string;
  bankName?: string;
  bankCode?: string;
  /** Metode yang dikirim ke gateway (mis. 'qris' atau method VA Pakasir). */
  method: string;
  minAmount: number;
  /** true bila channel ini belum bisa dipakai karena kredensial/aktivasi belum ada */
  unavailable?: boolean;
  unavailableReason?: string;
}

/**
 * Daftar channel pembayaran untuk checkout. Diambil dari SERVER supaya UI tidak
 * pernah menampilkan channel yang providernya belum siap, dan harga/fee satu sumber.
 * VA Qiospay butuh User ID mitra + us_apikey (VA H2H disetujui); selama belum ada,
 * channel VA ditandai belum tersedia (bukan disembunyikan diam-diam).
 */
export function listPaymentChannels(): PaymentChannel[] {
  const channels: PaymentChannel[] = [];

  if (isQiospayActive()) {
    channels.push({
      id: 'qiospay_qris', gateway: 'QIOSPAY', kind: 'QRIS', label: 'QRIS (semua e-wallet & m-banking)',
      method: 'qris', minAmount: 1,
    });
    const vaReady = qiospayService.isVaConfigured();
    for (const bank of qiospayService.listVaBanks()) {
      channels.push({
        id: `qiospay_va_${bank.code}`, gateway: 'QIOSPAY', kind: 'VA', label: `Virtual Account ${bank.name}`,
        bankName: bank.name, bankCode: bank.code, method: `va:${bank.code}`, minAmount: 10000,
        unavailable: !vaReady,
        unavailableReason: vaReady ? undefined : 'VA H2H Qiospay belum diaktifkan/kredensial belum diisi',
      });
    }
  }

  if (isPakasirActive()) {
    channels.push({ id: 'pakasir_qris', gateway: 'PAKASIR', kind: 'QRIS', label: 'QRIS (Pakasir)', method: 'qris', minAmount: 1 });
    for (const method of pakasirVaMethods()) {
      const bankName = method.replace(/_va$/i, '').toUpperCase();
      channels.push({
        id: `pakasir_${method}`, gateway: 'PAKASIR', kind: 'VA', label: `Virtual Account ${bankName} (Pakasir)`,
        bankName, method, minAmount: 10000,
      });
    }
  }

  return channels;
}

/**
 * Method VA Pakasir bersifat CONFIG-DRIVEN (PAKASIR_VA_METHODS) karena daftar
 * resminya tidak tersedia untuk diperiksa otomatis. Default kosong: bila akun
 * Pakasir belum mendukung VA, channel-nya tidak ditawarkan sama sekali.
 */
export function pakasirVaMethods(): string[] {
  return String(process.env.PAKASIR_VA_METHODS || '')
    .split(',').map((m) => m.trim().toLowerCase()).filter((m) => m && m.endsWith('_va'));
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

  // Channel yang diminta pembeli. 'va:<kode bank>' = VA Qiospay; '<bank>_va' = VA Pakasir.
  const requestedMethod = String(params.paymentMethod || '').trim().toLowerCase();
  const qiospayVaMatch = requestedMethod.match(/^va:(\d+)$/);
  const pakasirVaMethod = requestedMethod.endsWith('_va') ? requestedMethod : '';

  // 0. Jalur Qiospay VIRTUAL ACCOUNT (channel 'va:<kode bank>') — ditangani LEBIH DULU,
  //    terlepas dari gateway QRIS yang aktif, supaya permintaan VA tidak pernah jatuh ke jalur QRIS.
  if (qiospayVaMatch) {
    const bankCode = qiospayVaMatch[1];
    const vaRes = await qiospayService.createVirtualAccount({
      orderId: params.orderId,
      amount: dynamicAmount,
      bankCode,
      customerId: params.orderId,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      customerEmail: params.customerEmail,
    });
    if (vaRes.status !== 'success' || !vaRes.virtualAccount) {
      // Jangan pernah menampilkan nomor VA karangan: gagalkan checkout dengan jelas.
      throw new Error(vaRes.message || 'Virtual Account Qiospay gagal dibuat. Tidak ada pembayaran yang dibuat; silakan pilih QRIS atau coba lagi.');
    }
    return {
      gateway: 'QIOSPAY',
      token: vaRes.partnerReff,
      partnerReff: vaRes.partnerReff,
      vaNumber: vaRes.virtualAccount,
      vaBankCode: vaRes.bankCode,
      vaBankName: vaRes.bankName,
      fee: vaRes.additionalfee || 0,
      totalPayment: vaRes.amount || dynamicAmount,
      isDynamic: true,
    };
  }

  // 1. Jalur Utama: PAKASIR API v2 Dynamic Transaction (Terpisah Murni Tanpa Fallback Qiospay)
  if (gateway === 'PAKASIR') {
    const slug = PAKASIR_CONFIG.SLUG || 'waroengdigital';
    // Tautan cadangan hanya berlaku untuk QRIS; VA tidak boleh diarahkan ke QRIS.
    const fallbackPaymentLink = `https://app.pakasir.com/pay/${encodeURIComponent(slug)}/${dynamicAmount}?order_id=${encodeURIComponent(params.orderId)}&qris_only=1`;

    try {
      const pakasirRes = await pakasirService.createTransaction({
        orderId: params.orderId,
        amount: dynamicAmount,
        method: pakasirVaMethod || requestedMethod || PAKASIR_CONFIG.PAYMENT_METHOD || 'qris',
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        customerPhone: params.customerPhone,
      });

      if (pakasirRes.success && pakasirRes.payment) {
        const p: any = pakasirRes.payment;
        const finalQR = p.qr_string && p.qr_string.startsWith('000201') && !p.qr_string.includes('lorem-ipsum')
          ? p.qr_string
          : undefined;
        // Nomor VA dari Pakasir (bila channel yang dipilih adalah VA).
        const vaNumber = String(p.va_number || p.payment_number || p.pay_code || '').trim() || undefined;
        if (!finalQR && !p.payment_link && !vaNumber) {
          throw new Error('Pakasir tidak mengembalikan QRIS, nomor VA, atau tautan pembayaran yang valid.');
        }

        return {
          gateway: 'PAKASIR',
          token: p.txn_id || params.orderId,
          redirectUrl: vaNumber ? undefined : (p.payment_link || fallbackPaymentLink),
          qrString: finalQR,
          vaNumber,
          vaBankCode: p.bank_code || undefined,
          vaBankName: (p.bank_name || (pakasirVaMethod ? pakasirVaMethod.replace(/_va$/i, '').toUpperCase() : undefined)) || undefined,
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

    // A payment gateway failure must never produce a locally fabricated QRIS.
    // The caller can retry safely; no customer is shown an untracked payment.
    throw new Error('Pakasir gagal membuat transaksi. Tidak ada pembayaran yang dibuat; silakan coba lagi.');
  }

  // 2. Jalur Qiospay QRIS Dinamis
  const depositId = `QP-${params.orderId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const savedSettings = await mongoDbService.getSettingsFromDatabase();
  const staticQrString = String(savedSettings.qiospayQrString || savedSettings.staticQrisString || '').trim();
  if (!staticQrString) throw new Error('QRIS Qiospay asli belum tersimpan di dashboard admin.');
  const qrisRes = qiospayService.createPaymentQris({
    amount: dynamicAmount, orderId: params.orderId, staticQrString,
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
