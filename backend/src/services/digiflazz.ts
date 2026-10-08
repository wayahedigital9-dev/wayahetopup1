import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { DIGIFLAZZ_CONFIG } from '../config/apikeys.js';
import { outboundIpService } from './outboundIpService.js';

export interface DigiflazzConfig {
  username: string;
  apiKey: string;
  baseUrl: string;
  webhookUrl?: string;
  webhookSecret?: string;
  testing?: boolean;
  allowedCallbackUrls?: string[];
}

export interface CreateDigiflazzTransactionParams {
  buyerSkuCode: string;
  customerNo: string;
  refId: string;
  maxPrice?: number;
  callbackUrl?: string;
  allowDot?: boolean;
  testing?: boolean;
}

export interface DigiflazzTransactionData {
  ref_id: string;
  customer_no: string;
  buyer_sku_code: string;
  message: string;
  status: 'Pending' | 'Sukses' | 'Gagal' | string;
  rc: string;
  sn?: string;
  buyer_last_saldo?: number;
  price?: number;
  tele?: string;
  wa?: string;
}

export interface DigiflazzTransactionResponse {
  data: DigiflazzTransactionData;
}

/**
 * Validasi dan Whitelist Callback URL untuk multi-webhook Digiflazz.
 * Mencegah callback sembarangan yang disuntikkan dari input luar/browser tidak terpercaya.
 */
export function resolveDigiflazzCallbackUrl(callbackUrl?: string): string | undefined {
  const defaultWebhook = DIGIFLAZZ_CONFIG.WEBHOOK_URL?.trim();
  const allowedList = (DIGIFLAZZ_CONFIG.ALLOWED_CALLBACK_URLS || [])
    .map(u => u?.trim())
    .filter(Boolean);

  if (callbackUrl && callbackUrl.trim()) {
    const candidate = callbackUrl.trim();

    // Whitelist check
    const isWhitelisted =
      allowedList.includes(candidate) ||
      (defaultWebhook && candidate === defaultWebhook);

    if (isWhitelisted) {
      return candidate;
    }

    console.warn(
      `⚠️ [DIGIFLAZZ SECURITY] Unverified callbackUrl '${candidate}' is not in ALLOWED_CALLBACK_URLS whitelist. Falling back to server default.`
    );
  }

  // Gunakan webhook server default jika ada
  return defaultWebhook || undefined;
}

/**
 * Hitung Signature Transaksi Digiflazz: MD5(username + apiKey + ref_id)
 */
export function generateDigiflazzTransactionSign(username: string, apiKey: string, refId: string): string {
  const raw = `${username}${apiKey}${refId}`;
  return crypto.createHash('md5').update(raw).digest('hex');
}

/**
 * Verifikasi signature Webhook Digiflazz (X-Hub-Signature: sha1=HASH) terhadap RAW body
 */
export function verifyDigiflazzWebhookSignature(
  rawBody: Buffer | string | undefined,
  signatureHeader?: string,
  secretOverride?: string
): { valid: boolean; reason?: string } {
  const secret = secretOverride || DIGIFLAZZ_CONFIG.WEBHOOK_SECRET;

  // Jika secret tidak dikonfigurasi, lewati verifikasi dengan catatan
  if (!secret) {
    return { valid: true, reason: 'No secret configured on server' };
  }

  // Jika header signature tidak dikirim oleh Digiflazz
  if (!signatureHeader) {
    if (DIGIFLAZZ_CONFIG.ENFORCE_SIGNATURE) {
      return { valid: false, reason: 'Missing X-Hub-Signature header while signature enforcement is ON' };
    }
    console.warn('⚠️ [DIGIFLAZZ WEBHOOK NOTICE] X-Hub-Signature header not present. Continuing with payload processing.');
    return { valid: true, reason: 'Signature header absent but not strictly enforced' };
  }

  if (!rawBody) {
    return { valid: false, reason: 'Missing raw request body for signature verification' };
  }

  try {
    const rawBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
    const expectedHash = crypto.createHmac('sha1', secret).update(rawBuffer).digest('hex');
    const expectedSignature = `sha1=${expectedHash}`;

    const sigBuffer = Buffer.from(signatureHeader.trim());
    const expBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length === expBuffer.length && crypto.timingSafeEqual(sigBuffer, expBuffer)) {
      return { valid: true };
    }

    return { valid: false, reason: 'Signature mismatch' };
  } catch (err: any) {
    return { valid: false, reason: `Verification error: ${err.message}` };
  }
}

/**
 * Eksekusi Transaksi ke Digiflazz Buyer API
 * POST https://api.digiflazz.com/v1/transaction
 * Mendukung parameter:
 * - username
 * - buyer_sku_code
 * - customer_no
 * - ref_id
 * - sign
 * - testing
 * - max_price
 * - cb_url
 * - allow_dot
 */
export async function createDigiflazzTransaction(
  params: CreateDigiflazzTransactionParams
): Promise<DigiflazzTransactionResponse> {
  const username = DIGIFLAZZ_CONFIG.USERNAME;
  const apiKey = DIGIFLAZZ_CONFIG.API_KEY;
  const baseUrl = DIGIFLAZZ_CONFIG.BASE_URL;

  if (!username || !apiKey) {
    throw new Error('Kredensial Digiflazz (username / key sesuai mode) belum dikonfigurasi pada pengaturan server.');
  }

  if (!params.buyerSkuCode || !params.customerNo || !params.refId) {
    throw new Error('buyer_sku_code, customer_no, dan ref_id wajib diisi untuk transaksi Digiflazz.');
  }

  const sign = generateDigiflazzTransactionSign(username, apiKey, params.refId);
  const cbUrl = resolveDigiflazzCallbackUrl(params.callbackUrl);
  const isTesting = params.testing !== undefined ? Boolean(params.testing) : DIGIFLAZZ_CONFIG.TESTING;

  const payload: Record<string, any> = {
    username,
    buyer_sku_code: params.buyerSkuCode,
    customer_no: params.customerNo,
    ref_id: params.refId,
    sign,
    testing: isTesting,
  };

  // Masukkan cb_url HANYA jika nilainya ada (tidak kosong / undefined)
  if (cbUrl) {
    payload.cb_url = cbUrl;
  }

  if (params.maxPrice !== undefined && params.maxPrice > 0) {
    payload.max_price = params.maxPrice;
  }

  if (params.allowDot !== undefined) {
    payload.allow_dot = params.allowDot;
  }

  // Logging aman (JANGAN log API key atau secret)
  console.log('[DIGIFLAZZ REQUEST]', {
    ref_id: params.refId,
    buyer_sku_code: params.buyerSkuCode,
    customer_no: params.customerNo,
    callback_url: cbUrl || '(using default dashboard webhook)',
    testing: isTesting,
  });

  const client = outboundIpService.getHttpClient(undefined, 25000);

  try {
    let json: any;
    try {
      const response = await client.post(`${baseUrl}/transaction`, payload, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });
      json = response.data;
    } catch (httpErr: any) {
      if (httpErr.response?.data?.data) {
        json = httpErr.response.data;
      } else {
        console.error(`[DIGIFLAZZ HTTP ERROR]:`, httpErr.message);
        throw new Error(`Digiflazz HTTP Error (${httpErr.response?.status || 'Network'}): ${httpErr.message}`);
      }
    }

    // Digiflazz membungkus respon dalam object data
    const data = json?.data;
    if (!data) {
      throw new Error(`Digiflazz Response Format Error: properti 'data' tidak ditemukan dalam respon.`);
    }

    // Logging respon Digiflazz
    console.log('[DIGIFLAZZ RESPONSE]', {
      ref_id: data.ref_id,
      status: data.status,
      rc: data.rc,
      message: data.message,
    });

    return json as DigiflazzTransactionResponse;
  } catch (error: any) {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      console.error('[DIGIFLAZZ TIMEOUT] Permintaan transaksi timeout setelah 25 detik.');
      throw new Error('Koneksi ke Digiflazz timeout (melebihi 25 detik). Silakan periksa status transaksi beberapa saat lagi.');
    }
    throw error;
  }
}

export class DigiflazzService {
  private config: DigiflazzConfig;

  constructor() {
    this.config = {
      username: DIGIFLAZZ_CONFIG.USERNAME,
      apiKey: DIGIFLAZZ_CONFIG.API_KEY,
      baseUrl: DIGIFLAZZ_CONFIG.BASE_URL,
      webhookUrl: DIGIFLAZZ_CONFIG.WEBHOOK_URL,
      webhookSecret: DIGIFLAZZ_CONFIG.WEBHOOK_SECRET,
      testing: DIGIFLAZZ_CONFIG.TESTING,
      allowedCallbackUrls: DIGIFLAZZ_CONFIG.ALLOWED_CALLBACK_URLS,
    };
  }

  generateTransactionSign(refId: string): string {
    return generateDigiflazzTransactionSign(this.config.username, this.config.apiKey, refId);
  }

  generateGeneralSign(cmd: string): string {
    const raw = `${this.config.username}${this.config.apiKey}${cmd}`;
    return crypto.createHash('md5').update(raw).digest('hex');
  }

  /**
   * Topup Pulsa / Paket Data via Digiflazz (memanggil createDigiflazzTransaction)
   */
  async topupTransaction(params: CreateDigiflazzTransactionParams): Promise<DigiflazzTransactionResponse> {
    return createDigiflazzTransaction(params);
  }

  /**
   * Cek Status Transaksi ke Digiflazz
   */
  async checkTransactionStatus(params: {
    buyerSkuCode: string;
    customerNo: string;
    refId: string;
  }): Promise<DigiflazzTransactionResponse> {
    return createDigiflazzTransaction({
      buyerSkuCode: params.buyerSkuCode,
      customerNo: params.customerNo,
      refId: params.refId,
    });
  }

  refreshConfig(overrides?: Partial<DigiflazzConfig>) {
    this.config = {
      username: overrides?.username !== undefined ? overrides.username : DIGIFLAZZ_CONFIG.USERNAME,
      apiKey: overrides?.apiKey !== undefined ? overrides.apiKey : DIGIFLAZZ_CONFIG.API_KEY,
      baseUrl: overrides?.baseUrl || DIGIFLAZZ_CONFIG.BASE_URL,
      webhookUrl: overrides?.webhookUrl || DIGIFLAZZ_CONFIG.WEBHOOK_URL,
      webhookSecret: overrides?.webhookSecret !== undefined ? overrides.webhookSecret : DIGIFLAZZ_CONFIG.WEBHOOK_SECRET,
      testing: overrides?.testing !== undefined ? overrides.testing : DIGIFLAZZ_CONFIG.TESTING,
      allowedCallbackUrls: overrides?.allowedCallbackUrls || DIGIFLAZZ_CONFIG.ALLOWED_CALLBACK_URLS,
    };
  }

  /**
   * Cek Saldo Buyer Digiflazz secara Realtime
   */
  async checkBalance(credentials?: { username?: string; apiKey?: string }): Promise<{ deposit: number; username: string }> {
    const username = (credentials?.username || this.config.username || '').trim();
    const apiKey = (credentials?.apiKey || this.config.apiKey || '').trim();

    if (!username || username.startsWith('YOUR_') || !apiKey) {
      throw new Error('Kredensial Digiflazz belum valid. Isi DIGIFLAZZ_USERNAME asli dari member.digiflazz.com dan Production API Key.');
    }

    const sign = crypto.createHash('md5').update(`${username}${apiKey}depo`).digest('hex');

    const client = outboundIpService.getHttpClient(undefined, 12000);

    try {
      const response = await client.post(`${this.config.baseUrl}/cek-saldo`, {
        cmd: 'deposit',
        username,
        sign,
      });

      const data = response.data?.data;
      if (!data || data.deposit === undefined) {
        throw new Error(data?.message || 'Respon saldo Digiflazz tidak valid.');
      }
      return { deposit: Number(data.deposit), username };
    } catch (error: any) {
      const respData = error.response?.data?.data || error.response?.data;
      const errMsg = respData?.message || error.message;
      throw new Error(`Koneksi Saldo Digiflazz: ${errMsg}`);
    }
  }

  /**
   * Mengambil daftar produk resmi secara realtime dari Digiflazz Buyer API
   * POST https://api.digiflazz.com/v1/price-list
   */
  async fetchPriceList(credentials?: { username?: string; apiKey?: string; cmd?: 'prepaid' | 'pasca'; allowCache?: boolean }): Promise<DigiflazzPriceListItem[]> {
    const username = (credentials?.username || this.config.username || '').trim();
    const apiKey = (credentials?.apiKey || this.config.apiKey || '').trim();
    const cmd = credentials?.cmd || 'prepaid';

    if (!username || username.startsWith('YOUR_') || !apiKey) {
      throw new Error('Kredensial Digiflazz belum valid. Isi DIGIFLAZZ_USERNAME asli dari member.digiflazz.com dan Production API Key.');
    }

    const sign = crypto.createHash('md5').update(`${username}${apiKey}pricelist`).digest('hex');
    const cacheFile = path.join(process.cwd(), 'data', 'digiflazz-pricelist-cache.json');

    const getCachedPricelist = (): DigiflazzPriceListItem[] | null => {
      if (credentials?.allowCache === false) return null;
      try {
        if (fs.existsSync(cacheFile)) {
          const raw = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
          if (Array.isArray(raw) && raw.length > 0) {
            return raw as DigiflazzPriceListItem[];
          }
        }
      } catch (_) {}
      return null;
    };

    const client = outboundIpService.getHttpClient(undefined, 25000);

    try {
      const response = await client.post(`${this.config.baseUrl}/price-list`, {
        cmd,
        username,
        sign,
      });

      const data = response.data?.data;
      if (Array.isArray(data) && data.length > 0) {
        // Simpan ke cache disk untuk antisipasi limitasi Digiflazz
        if (credentials?.allowCache !== false) {
          try {
            fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), 'utf8');
          } catch (_) {}
        }
        return data as DigiflazzPriceListItem[];
      }

      // Jika Digiflazz memberikan limitasi (rc 83) atau pesan limit, gunakan cache lokal jika ada
      const cached = getCachedPricelist();
      if (cached) {
        console.log(`ℹ️ [DIGIFLAZZ PRICELIST] Rate limit/respon non-array dari Digiflazz (${data?.message || 'Limitasi'}), menggunakan ${cached.length} produk dari cache lokal.`);
        return cached;
      }

      throw new Error(data?.message || 'Respon daftar produk Digiflazz tidak valid.');
    } catch (error: any) {
      const cached = getCachedPricelist();
      if (cached) {
        console.log(`ℹ️ [DIGIFLAZZ PRICELIST] Error koneksi Digiflazz (${error.message}), menggunakan cache lokal (${cached.length} produk).`);
        return cached;
      }
      throw error;
    }
  }
}

export interface DigiflazzPriceListItem {
  product_name: string;
  category: string;
  brand: string;
  type: string;
  seller_name: string;
  price: number;
  buyer_sku_code: string;
  buyer_product_status: boolean;
  seller_product_status: boolean;
  unlimited_stock: boolean;
  stock: number;
  multi: boolean;
  start_cut_off: string;
  end_cut_off: string;
  desc?: string;
}

export function transformDigiflazzProduct(raw: DigiflazzPriceListItem, existingCustomPrice?: number): any {
  const catLower = (raw.category || '').toLowerCase();
  let categoryId = 'kuota';
  if (catLower === 'pulsa') categoryId = 'pulsa';
  else if (catLower === 'data') categoryId = 'kuota';
  else if (catLower === 'games' || catLower === 'game') categoryId = 'game';
  else if (catLower === 'pln') categoryId = 'pln';
  else if (catLower === 'voucher') categoryId = 'voucher';
  else if (catLower === 'streaming') categoryId = 'streaming';
  else if (catLower === 'tv') categoryId = 'tv';
  else if (catLower.includes('masa aktif')) categoryId = 'pulsa';
  else if (catLower.includes('sms') || catLower.includes('telpon')) categoryId = 'pulsa';
  else categoryId = catLower;

  const cost = Number(raw.price) || 0;
  
  // Hitung margin wajar (+Rp 500 s/d +Rp 2500)
  let defaultMargin = 750;
  if (cost <= 10000) defaultMargin = 500;
  else if (cost <= 50000) defaultMargin = 1000;
  else if (cost <= 100000) defaultMargin = 1500;
  else defaultMargin = 2500;

  // Bulatkan harga jual ke kelipatan 100
  const calculatedSelling = Math.ceil((cost + defaultMargin) / 100) * 100;
  const sellingPrice = (existingCustomPrice && existingCustomPrice > cost) ? existingCustomPrice : calculatedSelling;

  const cleanSku = String(raw.buyer_sku_code || '').trim();
  const id = `df-${cleanSku.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;

  return {
    id,
    name: raw.product_name,
    categoryId,
    provider: raw.brand || 'Digiflazz',
    sku: cleanSku,
    supplierSku: cleanSku,
    sellerName: raw.seller_name,
    digiflazzCategory: raw.category,
    digiflazzType: raw.type,
    supplierPrice: cost,
    basePrice: cost,
    sellingPrice,
    description: raw.desc || `${raw.product_name} - ${raw.brand} ${raw.category}`,
    quotaDetails: raw.desc || `${raw.brand} ${raw.category}`,
    deliveryMethod: 'AUTOMATIC',
    isActive: Boolean(raw.buyer_product_status && raw.seller_product_status),
    stock: raw.unlimited_stock ? 9999 : (raw.stock || 0),
    isDigiflazzSynced: true,
    lastSyncedAt: new Date().toISOString(),
  };
}

export const digiflazzService = new DigiflazzService();
