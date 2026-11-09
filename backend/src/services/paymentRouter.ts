import { QIOSPAY_CONFIG } from '../config/apikeys.js';
import { qiospayService } from './qiospay.js';
import { mongoDbService } from './mongodbService.js';

/**
 * ╔═════════════════════════════════════════════════════════════╗
 * ║  PAYMENT GATEWAY ROUTER (QIOSPAY)                          ║
 * ║  Satu gateway tunggal: Qiospay QRIS + VA                   ║
 * ╚═════════════════════════════════════════════════════════════╝
 */

export type ActiveGateway = 'QIOSPAY' | 'QRIS' | 'NONE';

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
  /** Metode yang dikirim ke gateway (mis. 'qris' atau method VA Qiospay). */
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

  return channels;
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
 * Deteksi gateway mana yang aktif
 */
export function detectActiveGateway(): ActiveGateway {
  const envGateway = (process.env.ACTIVE_GATEWAY || process.env.PAYMENT_GATEWAY_PROVIDER || '').trim().toUpperCase();
  if (envGateway === 'QIOSPAY' && isQiospayActive()) return 'QIOSPAY';

  if (isQiospayActive()) return 'QIOSPAY';
  return 'QRIS';
}

/**
 * Daftar semua gateway yang aktif
 */
export function listActiveGateways(): ActiveGateway[] {
  const list: ActiveGateway[] = [];
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

  // Channel yang diminta pembeli. 'va:<kode bank>' = VA Qiospay.
  const requestedMethod = String(params.paymentMethod || '').trim().toLowerCase();
  const qiospayVaMatch = requestedMethod.match(/^va:(\d+)$/);

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

  // 1. Jalur Qiospay QRIS Dinamis
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
  if (isQiospayActive()) {
    console.log('  ✅ Qiospay QRIS — Gateway Live Terhubung');
  }
  console.log(`  🎯 Gateway Utama Aktif: ${detectActiveGateway()}`);
}
