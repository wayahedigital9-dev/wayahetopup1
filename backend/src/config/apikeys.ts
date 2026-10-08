import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * ┌──────────────────────────────────────────────────────────────┐
 * │  BAGIAN 2: API KEY SETTINGS                                  │
 * │  Semua API key pihak ketiga dikumpulkan di sini              │
 * │  ⚠️  WAJIB diisi dengan key asli dari dashboard provider     │
 * └──────────────────────────────────────────────────────────────┘
 */

// ── 2a. QIOSPAY (QRIS Payment Gateway & Callback Webhook) ────
export const QIOSPAY_CONFIG = {
  MERCHANT_CODE: process.env.QIOSPAY_MERCHANT_CODE || process.env.QIOSPAY_MERCHANT_KEY || '',
  API_KEY: process.env.QIOSPAY_API_KEY || process.env.QIOSPAY_MERCHANT_KEY || '',
  EXPECTED_NMID: process.env.QIOSPAY_EXPECTED_NMID || process.env.QIOSPAY_NMID || '',
  CALLBACK_SECRET: process.env.CALLBACK_SECRET || process.env.QIOSPAY_SECRET_KEY || '',
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || process.env.ADMIN_API_KEY || '',
  SECRET_KEY: process.env.CALLBACK_SECRET || process.env.QIOSPAY_SECRET_KEY || '',
  NMID: process.env.QIOSPAY_EXPECTED_NMID || process.env.QIOSPAY_NMID || '',
  MERCHANT_NAME: process.env.QIOSPAY_MERCHANT_NAME || 'WAYAHE DIGITAL',
  QR_STRING: process.env.QIOSPAY_QRIS_STRING || process.env.QIOSPAY_QR_STRING || process.env.STATIC_QRIS_STRING || '',
  QRIS_STRING: process.env.QIOSPAY_QRIS_STRING || process.env.QIOSPAY_QR_STRING || process.env.STATIC_QRIS_STRING || '',
  LOCAL_DYNAMIC_CONFIRMED: process.env.QIOSPAY_LOCAL_DYNAMIC_CONFIRMED !== 'false',
};

// ── 2b. DIGIFLAZZ (Pulsa & Paket Data) ─────────────────────────
// Dapatkan dari: https://member.digiflazz.com → API → Buyer
export const DIGIFLAZZ_CONFIG = {
  USERNAME: process.env.DIGIFLAZZ_USERNAME || process.env.DIGIFLAZZ_USER || '',
  API_KEY: process.env.DIGIFLAZZ_API_KEY || process.env.DIGIFLAZZ_PRODUCTION_KEY || '',
  SECRET_CODE: process.env.DIGIFLAZZ_WEBHOOK_SECRET || process.env.DIGIFLAZZ_SECRET_CODE || '',
  WEBHOOK_SECRET: process.env.DIGIFLAZZ_WEBHOOK_SECRET || process.env.DIGIFLAZZ_SECRET_CODE || '',
  WEBHOOK_URL: process.env.DIGIFLAZZ_WEBHOOK_URL || '',
  WHITELIST_IP: process.env.DIGIFLAZZ_WHITELIST_IP || '',
  OUTBOUND_PROXY: process.env.DIGIFLAZZ_OUTBOUND_PROXY || process.env.HTTP_PROXY || process.env.HTTPS_PROXY || '',
  BASE_URL: process.env.DIGIFLAZZ_BASE_URL || 'https://api.digiflazz.com/v1',
  TESTING: process.env.DIGIFLAZZ_TESTING === 'true',
  ALLOWED_CALLBACK_URLS: Array.from(new Set([
    'https://wayahetopup.my.id/api/webhooks/digiflazz',
    process.env.DIGIFLAZZ_WEBHOOK_URL,
    ...(process.env.DIGIFLAZZ_ALLOWED_CALLBACK_URLS ? process.env.DIGIFLAZZ_ALLOWED_CALLBACK_URLS.split(',') : [])
  ].map(u => u?.trim()).filter(Boolean) as string[])),
  ENFORCE_SIGNATURE: process.env.DIGIFLAZZ_ENFORCE_SIGNATURE === 'true',
};

// ── 2c. NGROK (Webhook Tunnel) ─────────────────────────────────
// Dapatkan dari: https://dashboard.ngrok.com → Your Authtoken
export const NGROK_CONFIG = {
  AUTHTOKEN: process.env.NGROK_AUTHTOKEN || '',
  DOMAIN: process.env.NGROK_DOMAIN || '',
};

// ── 2d. TELEGRAM & WHATSAPP BOT NOTIFICATION ──────────────────
export const BOT_CONFIG = {
  TELEGRAM_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
  WHATSAPP_API_KEY: process.env.WHATSAPP_BOT_API_KEY || '',
  WHATSAPP_NUMBER: process.env.WHATSAPP_BOT_NUMBER || '',
};

// ── 2e. PAKASIR API v2 (Multi-channel & QRIS Gateway) ────────
export const PAKASIR_CONFIG = {
  BASE_URL: process.env.PAKASIR_BASE_URL || 'https://app.pakasir.com',
  SLUG: process.env.PAKASIR_SLUG || '',
  API_KEY: process.env.PAKASIR_API_KEY || '',
  WEBHOOK_SECRET: process.env.PAKASIR_WEBHOOK_SECRET || '',
  PAYMENT_METHOD: process.env.PAKASIR_PAYMENT_METHOD || 'qris',
  IS_SANDBOX: process.env.PAKASIR_IS_SANDBOX !== 'false', // Default true jika mode Sandbox, false jika Real
  MERCHANT_NAME: process.env.PAKASIR_MERCHANT_NAME || 'WAYAHE DIGITAL',
  NMID: process.env.PAKASIR_NMID || '',
  QR_STRING: process.env.PAKASIR_QR_STRING || '',
};

// ── 2f. INTERNAL SECRETS ───────────────────────────────────────
export const INTERNAL_SECRETS = {
  CRON_SECRET: process.env.CRON_SECRET || '',
  ADMIN_API_KEY: process.env.ADMIN_API_KEY || '',
};

/**
 * Helper: Validasi apakah semua API key penting sudah diisi
 * Panggil saat server startup untuk warning jika ada yang kosong
 */
export function validateApiKeys(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!DIGIFLAZZ_CONFIG.USERNAME) missing.push('DIGIFLAZZ_USERNAME');
  if (!DIGIFLAZZ_CONFIG.API_KEY) missing.push('DIGIFLAZZ_API_KEY');

  if (missing.length > 0) {
    console.warn('⚠️  [API CONFIG] API key berikut BELUM diisi di file .env:');
    missing.forEach(key => console.warn(`   ❌ ${key}`));
    console.warn('   Silakan isi di file backend/.env (lihat .env.example untuk panduan)');
  } else {
    console.log('✅ [API CONFIG] Semua API key sudah terkonfigurasi (Qiospay QRIS & Digiflazz)');
  }

  return { valid: missing.length === 0, missing };
}

export default {
  QIOSPAY: QIOSPAY_CONFIG,
  PAKASIR: PAKASIR_CONFIG,
  DIGIFLAZZ: DIGIFLAZZ_CONFIG,
  NGROK: NGROK_CONFIG,
  BOT: BOT_CONFIG,
  INTERNAL: INTERNAL_SECRETS,
  validate: validateApiKeys,
};
