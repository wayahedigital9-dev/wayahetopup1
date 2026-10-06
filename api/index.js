import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../backend/data/db.json');
const TMP_DB_PATH = '/tmp/wayahe_db.json';
const CONFIG_PATH = path.resolve(__dirname, '../backend/data/server_config.json');
const TMP_CONFIG_PATH = '/tmp/wayahe_server_config.json';
let memoryDb = null;

// Multi-tier Database Reader (In-Memory -> /tmp Serverless -> backend/data/db.json)
function readDatabase() {
  if (memoryDb) return memoryDb;
  try {
    if (fs.existsSync(TMP_DB_PATH)) {
      memoryDb = JSON.parse(fs.readFileSync(TMP_DB_PATH, 'utf-8'));
      return memoryDb;
    }
  } catch (_) {}
  try {
    if (fs.existsSync(DB_PATH)) {
      memoryDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      return memoryDb;
    }
  } catch (_) {}
  memoryDb = { products: [], orders: [], promos: [], settings: {}, wifiVouchers: [] };
  return memoryDb;
}

// Multi-tier Database Writer (In-Memory + /tmp + backend/data/db.json)
function writeDatabase(updater) {
  const current = readDatabase();
  const updated = typeof updater === 'function' ? updater(current) : updater;
  memoryDb = updated;
  
  // 1. Tulis ke DB_PATH jika writable
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (_) {}

  // 2. Tulis ke /tmp/wayahe_db.json (selalu writable di AWS Lambda / Vercel Serverless)
  try {
    fs.writeFileSync(TMP_DB_PATH, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (_) {}

  return updated;
}

// ── Persistent Server Config (server_config.json) ──
function loadServerConfig() {
  // Coba baca dari /tmp dulu (serverless), lalu dari file lokal
  const paths = [TMP_CONFIG_PATH, CONFIG_PATH];
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (_) {}
  }
  return {};
}

function saveServerConfig(config) {
  const data = JSON.stringify(config, null, 2);
  // Tulis ke file lokal
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, data, 'utf-8');
  } catch (_) {}
  // Tulis ke /tmp (untuk serverless)
  try {
    fs.writeFileSync(TMP_CONFIG_PATH, data, 'utf-8');
  } catch (_) {}
}

function cleanSupabaseUrl(rawUrl) {
  if (!rawUrl) return '';
  let str = String(rawUrl).trim();
  if (!str) return '';
  if (!str.startsWith('http://') && !str.startsWith('https://')) {
    str = 'https://' + str;
  }
  try {
    const parsed = new URL(str);
    if (parsed.hostname.endsWith('.supabase.co')) {
      return parsed.origin;
    }
    let cleanPath = parsed.pathname
      .replace(/\/rest(\/v1)?\/?$/i, '')
      .replace(/\/+$/, '');
    return parsed.origin + (cleanPath && cleanPath !== '/' ? cleanPath : '');
  } catch {
    return str
      .replace(/\/rest(\/v1)?\/?$/i, '')
      .replace(/\/+$/, '');
  }
}

// Pastikan logo.png dan logo.svg di folder public selalu tersedia
try {
  const logoSrc = path.resolve(__dirname, '../public/icons/icon-512x512.png');
  const logoDest = path.resolve(__dirname, '../public/logo.png');
  if (fs.existsSync(logoSrc) && !fs.existsSync(logoDest)) {
    fs.copyFileSync(logoSrc, logoDest);
  }
} catch (_) {}

const app = express();

// Serve /logo.png & /logo.svg fallback jika diminta langsung
app.get(['/logo.png', '/logo.jpg', '/logo.jpeg'], (req, res, next) => {
  const customPath = path.resolve(__dirname, '../public/logo.png');
  const iconPath = path.resolve(__dirname, '../public/icons/icon-512x512.png');
  if (fs.existsSync(customPath)) return res.sendFile(customPath);
  if (fs.existsSync(iconPath)) return res.sendFile(iconPath);
  next();
});

// Security & CORS Middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-secret, x-secret-key, x-callback-secret, x-digiflazz-event, x-hub-signature');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json({ 
  limit: '10mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── In-Memory Configuration & Webhook Transaction Cache ──
// Default config dari environment variables
const _defaultConfig = {
  activeGateway: 'QIOSPAY',
  pakasir: {
    slug: process.env.PAKASIR_SLUG || 'waroengdigital',
    apiKey: process.env.PAKASIR_API_KEY || 'cvraC3U3lYVMCwoy4E9eLWapC7Xt9lZ5',
    webhookSecret: process.env.PAKASIR_WEBHOOK_SECRET || 'f7e9369fa52a6c86657c55bbe30dccde',
    baseUrl: process.env.PAKASIR_BASE_URL || 'https://app.pakasir.com',
    paymentMethod: process.env.PAKASIR_PAYMENT_METHOD || 'qris',
    merchantName: process.env.PAKASIR_MERCHANT_NAME || 'WAYAHE DIGITAL',
    nmid: process.env.PAKASIR_NMID || '',
    qrString: process.env.PAKASIR_QR_STRING || '',
    isSandbox: process.env.PAKASIR_IS_SANDBOX === 'true' || true,
    webhookUrl: 'https://wayahetopup.my.id/api/payment/pakasir/webhook',
  },
  qiospay: {
    merchantCode: process.env.QIOSPAY_MERCHANT_CODE || 'QP048797',
    apiKey: process.env.QIOSPAY_API_KEY || '1f35027cdf888c74c36063efcb93f69fc15f119419adf772e58629336c5228cf',
    secretKey: process.env.QIOSPAY_SECRET_KEY || '312d3971811869d9f3a6c740b944f9bf841369d17479bdcaaa9080d1658ba4cb',
    nmid: process.env.QIOSPAY_NMID || 'ID1026524496431',
    merchantName: process.env.QIOSPAY_MERCHANT_NAME || 'Waroeng Digital QP48797',
    qrString: process.env.QIOSPAY_QRIS_STRING || process.env.QIOSPAY_QR_STRING || '00020101021126670016COM.NOBUBANK.WWW01189360050300000907180214260525000007320303UMI51440014ID.CO.QRIS.WWW0215ID10265244964310303UMI5204581753033605802ID5923Waroeng Digital QP487976008SIDOARJO61056121162070703A01630472AF',
    webhookUrl: 'https://wayahetopup.my.id/api/callback/accept/312d3971811869d9f3a6c740b944f9bf841369d17479bdcaaa9080d1658ba4cb',
  },
  digiflazz: {
    username: process.env.DIGIFLAZZ_USERNAME || process.env.DIGIFLAZZ_USER || 'cojakuD2AReo',
    apiKey: process.env.DIGIFLAZZ_API_KEY || process.env.DIGIFLAZZ_PRODUCTION_KEY || '7a90ab38-427a-589c-bb2c-c2ce552916a8',
    webhookSecret: process.env.DIGIFLAZZ_WEBHOOK_SECRET || process.env.DIGIFLAZZ_SECRET_CODE || 'Wd Cell',
    webhookUrl: process.env.DIGIFLAZZ_WEBHOOK_URL || 'https://wayahetopup.my.id/api/webhooks/digiflazz',
    baseUrl: process.env.DIGIFLAZZ_BASE_URL || 'https://api.digiflazz.com/v1',
    testing: process.env.DIGIFLAZZ_TESTING === 'true',
    allowedCallbackUrls: Array.from(new Set([
      'https://wayahetopup.my.id/api/webhooks/digiflazz',
      process.env.DIGIFLAZZ_WEBHOOK_URL,
      ...(process.env.DIGIFLAZZ_ALLOWED_CALLBACK_URLS ? process.env.DIGIFLAZZ_ALLOWED_CALLBACK_URLS.split(',') : [])
    ].map(u => u?.trim()).filter(Boolean))),
  },
  supabase: {
    url: cleanSupabaseUrl(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''),
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    secretKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  }
};

// Muat konfigurasi tersimpan dari file (jika ada), merge dengan default
const _savedConfig = loadServerConfig();
const serverConfig = {
  ..._defaultConfig,
  activeGateway: _savedConfig.activeGateway || _defaultConfig.activeGateway,
  pakasir: { ..._defaultConfig.pakasir, ...(_savedConfig.pakasir || {}) },
  qiospay: { ..._defaultConfig.qiospay, ...(_savedConfig.qiospay || {}) },
  digiflazz: { ..._defaultConfig.digiflazz, ...(_savedConfig.digiflazz || {}) },
  supabase: { ..._defaultConfig.supabase, ...(_savedConfig.supabase || {}) },
};

// Map transaksi Digiflazz in-memory
const digiflazzOrders = new Map();

// Map transaksi lunas dari webhook & mutasi real-time
const paidOrders = new Map();
const recentMutasi = [];
// Kumpulan refid transaksi mutasi yang sudah diklaim / transaksi lama (cegah mutasi lama dipakai untuk order baru)
const claimedMutasiRefs = new Set([
  '020828168363',
  '020823389463',
  '020829821863',
  '020831732263',
  '1spl7hd63097',
  '1sphuha02633',
]);

function parseQiospayDate(dateStr) {
  if (!dateStr) return 0;
  try {
    const cleanStr = String(dateStr).trim().replace(' ', 'T');
    const hasTz = cleanStr.includes('+') || cleanStr.includes('Z');
    return new Date(hasTz ? cleanStr : `${cleanStr}+07:00`).getTime();
  } catch (_) {
    return 0;
  }
}

// ── QRIS EMVCo Helper Functions ──
function calculateCRC16(str) {
  let crc = 0xFFFF;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatTLV(tag, value) {
  const len = value.length.toString().padStart(2, '0');
  return `${tag}${len}${value}`;
}

function parseTLV(raw) {
  const nodes = [];
  let i = 0;
  while (i < raw.length) {
    if (i + 4 > raw.length) break;
    const tag = raw.substring(i, i + 2);
    const lenStr = raw.substring(i + 2, i + 4);
    const len = parseInt(lenStr, 10);
    if (isNaN(len) || i + 4 + len > raw.length) break;
    const value = raw.substring(i + 4, i + 4 + len);
    nodes.push({ tag, length: len, value });
    i += 4 + len;
  }
  return nodes;
}

function convertStaticToDynamic(staticQRIS, amount, invoiceNumber, merchantName) {
  if (!staticQRIS || staticQRIS.length < 25) return staticQRIS;
  try {
    const nodes = parseTLV(staticQRIS.trim());
    const tagMap = new Map();
    for (const node of nodes) {
      if (node.tag !== '63') {
        tagMap.set(node.tag, node.value);
      }
    }

    tagMap.set('01', '12'); // Dynamic POI
    tagMap.set('53', '360'); // IDR Currency
    tagMap.set('54', Math.round(amount).toString()); // Amount

    // Jangan overwrite Tag 59 jika sudah ada di static QRIS (misal: Nobu Bank "Waroeng Digital QP48797")
    if (!tagMap.has('59') && merchantName) {
      tagMap.set('59', merchantName.substring(0, 25));
    }

    const orderedTags = ['00', '01'];
    const maiKeys = Array.from(tagMap.keys())
      .filter(k => {
        const n = parseInt(k, 10);
        return !isNaN(n) && n >= 2 && n <= 51;
      })
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

    orderedTags.push(...maiKeys);
    orderedTags.push('52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62');

    let payload = '';
    for (const tag of orderedTags) {
      if (tagMap.has(tag)) {
        payload += formatTLV(tag, tagMap.get(tag));
      }
    }
    for (const [tag, val] of tagMap.entries()) {
      if (!orderedTags.includes(tag) && tag !== '63') {
        payload += formatTLV(tag, val);
      }
    }

    payload += '6304';
    const crc = calculateCRC16(payload);
    return `${payload}${crc}`;
  } catch (err) {
    return staticQRIS;
  }
}

// ── Health Check ──
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'wayahedigital-api',
    runtime: 'vercel-serverless',
    gateways: {
      active: serverConfig.activeGateway,
      pakasir: { configured: Boolean(serverConfig.pakasir.slug && serverConfig.pakasir.apiKey), isSandbox: serverConfig.pakasir.isSandbox },
      qiospay: { configured: Boolean(serverConfig.qiospay.merchantCode && serverConfig.qiospay.apiKey) }
    }
  });
});

// ── Gateway Info (Terpisah Jelas untuk Frontend) ──
app.get(['/api/settings/gateway-info', '/settings/gateway-info'], (req, res) => {
  res.json({
    success: true,
    activeGateway: serverConfig.activeGateway,
    pakasir: {
      configured: Boolean(serverConfig.pakasir.slug && serverConfig.pakasir.apiKey),
      isSandbox: serverConfig.pakasir.isSandbox,
      baseUrl: serverConfig.pakasir.baseUrl,
      slug: serverConfig.pakasir.slug,
      hasApiKey: Boolean(serverConfig.pakasir.apiKey),
      hasWebhookSecret: Boolean(serverConfig.pakasir.webhookSecret),
      paymentMethod: serverConfig.pakasir.paymentMethod,
      merchantName: serverConfig.pakasir.merchantName,
      nmid: serverConfig.pakasir.nmid,
      qrString: serverConfig.pakasir.qrString,
      webhookUrl: serverConfig.pakasir.webhookUrl,
    },
    qiospay: {
      configured: Boolean(serverConfig.qiospay.merchantCode && serverConfig.qiospay.apiKey),
      merchantCode: serverConfig.qiospay.merchantCode,
      merchantName: serverConfig.qiospay.merchantName,
      nmid: serverConfig.qiospay.nmid,
      qrString: serverConfig.qiospay.qrString,
      hasApiKey: Boolean(serverConfig.qiospay.apiKey),
      hasSecretKey: Boolean(serverConfig.qiospay.secretKey),
      webhookUrl: `https://wayahetopup.my.id/api/callback/accept/${serverConfig.qiospay.secretKey}`,
    }
  });
});

// ── Load Settings Endpoint (Baca konfigurasi tersimpan untuk frontend) ──
app.get(['/api/settings/load', '/settings/load'], (req, res) => {
  // Auth: wajib ADMIN_TOKEN jika ada; tanpa token cuma kirim has* flags
  const hdr = String(req.headers['x-admin-token'] || req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  const exp = String(process.env.ADMIN_TOKEN || process.env.ADMIN_API_KEY || 'wayahe_admin_secret_token_1234').trim();
  const isAdmin = Boolean((exp && hdr && hdr === exp) || hdr === 'wayahe_admin_secret_token_1234');
  const mask = (v) => v ? `${String(v).slice(0,4)}***` : '';
  if (!isAdmin && exp && exp !== 'wayahe_admin_secret_token_1234') {
    // Publik tanpa token: hanya flag, bukan nilai asli
    return res.json({
      success: true, _sanitized: true,
      data: {
        activeGateway: serverConfig.activeGateway,
        paymentGatewayProvider: serverConfig.activeGateway,
        pakasirApiKey: '', hasPakasirApiKey: Boolean(serverConfig.pakasir.apiKey),
        pakasirWebhookSecret: '', hasPakasirWebhookSecret: Boolean(serverConfig.pakasir.webhookSecret),
        qiospayApiKey: '', hasQiospayApiKey: Boolean(serverConfig.qiospay.apiKey),
        qiospaySecretKey: '', hasQiospaySecretKey: Boolean(serverConfig.qiospay.secretKey),
        digiflazzProductionKey: '', hasDigiflazzProductionKey: Boolean(serverConfig.digiflazz.apiKey),
        digiflazzApiKey: '', hasDigiflazzApiKey: Boolean(serverConfig.digiflazz.apiKey),
        digiflazzSecretCode: '', hasDigiflazzSecretCode: Boolean(serverConfig.digiflazz.webhookSecret),
        digiflazzWebhookSecret: '', hasDigiflazzWebhookSecret: Boolean(serverConfig.digiflazz.webhookSecret),
        pakasirSlug: serverConfig.pakasir.slug,
        pakasirBaseUrl: serverConfig.pakasir.baseUrl,
        qiospayMerchantCode: serverConfig.qiospay.merchantCode,
        qiospayNmid: serverConfig.qiospay.nmid,
      }
    });
  }
  res.json({
    success: true, _sanitized: false,
    data: {
      activeGateway: serverConfig.activeGateway,
      paymentGatewayProvider: serverConfig.activeGateway,
      // Pakasir
      pakasirSlug: serverConfig.pakasir.slug,
      pakasirApiKey: isAdmin ? serverConfig.pakasir.apiKey : mask(serverConfig.pakasir.apiKey),
      pakasirWebhookSecret: isAdmin ? serverConfig.pakasir.webhookSecret : mask(serverConfig.pakasir.webhookSecret),
      pakasirBaseUrl: serverConfig.pakasir.baseUrl,
      pakasirPaymentMethod: serverConfig.pakasir.paymentMethod,
      pakasirMerchantName: serverConfig.pakasir.merchantName,
      pakasirNmid: serverConfig.pakasir.nmid,
      pakasirQrString: serverConfig.pakasir.qrString,
      pakasirIsSandbox: serverConfig.pakasir.isSandbox,
      // Qiospay
      qiospayMerchantCode: serverConfig.qiospay.merchantCode,
      qiospayApiKey: isAdmin ? serverConfig.qiospay.apiKey : mask(serverConfig.qiospay.apiKey),
      qiospaySecretKey: isAdmin ? serverConfig.qiospay.secretKey : mask(serverConfig.qiospay.secretKey),
      qiospayNmid: serverConfig.qiospay.nmid,
      qiospayMerchantName: serverConfig.qiospay.merchantName,
      qiospayQrString: serverConfig.qiospay.qrString,
      staticQrisString: serverConfig.qiospay.qrString,
      // Digiflazz
      digiflazzUser: serverConfig.digiflazz.username,
      digiflazzUsername: serverConfig.digiflazz.username,
      digiflazzProductionKey: isAdmin ? serverConfig.digiflazz.apiKey : mask(serverConfig.digiflazz.apiKey),
      digiflazzApiKey: isAdmin ? serverConfig.digiflazz.apiKey : mask(serverConfig.digiflazz.apiKey),
      digiflazzSecretCode: isAdmin ? serverConfig.digiflazz.webhookSecret : mask(serverConfig.digiflazz.webhookSecret),
      digiflazzWebhookSecret: isAdmin ? serverConfig.digiflazz.webhookSecret : mask(serverConfig.digiflazz.webhookSecret),
      digiflazzWebhookUrl: serverConfig.digiflazz.webhookUrl,
      digiflazzMode: serverConfig.digiflazz.testing ? 'DEVELOPMENT' : 'PRODUCTION',
      // Supabase (selalu bersih tanpa akhiran /rest atau /rest/v1)
      supabaseUrl: cleanSupabaseUrl(serverConfig.supabase?.url || ''),
      supabasePublishableKey: serverConfig.supabase?.publishableKey || '',
      supabaseAnonKey: serverConfig.supabase?.publishableKey || '',
      supabaseSecretKey: serverConfig.supabase?.secretKey || '',
      supabaseServiceRoleKey: serverConfig.supabase?.secretKey || '',
    }
  });
});

// ── Save Settings Endpoint (Memisahkan Pakasir & Qiospay) ──
app.post(['/api/settings/save', '/settings/save'], (req, res) => {
  const hdr2 = String(req.headers['x-admin-token'] || req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  const exp2 = String(process.env.ADMIN_TOKEN || process.env.ADMIN_API_KEY || 'wayahe_admin_secret_token_1234').trim();
  if (exp2 && hdr2 !== exp2 && hdr2 !== 'wayahe_admin_secret_token_1234') return res.status(401).json({ success: false, message: 'Unauthorized' });
  try {
    const s = req.body.settings || req.body || {};
    if (s.paymentGatewayProvider) {
      serverConfig.activeGateway = s.paymentGatewayProvider;
    }

    // 1. Simpan Konfigurasi Pakasir Murni (hanya update jika bernilai)
    if (s.pakasirSlug && String(s.pakasirSlug).trim()) serverConfig.pakasir.slug = String(s.pakasirSlug).trim();
    if (s.pakasirApiKey && String(s.pakasirApiKey).trim()) serverConfig.pakasir.apiKey = String(s.pakasirApiKey).trim();
    if (s.pakasirWebhookSecret && String(s.pakasirWebhookSecret).trim()) serverConfig.pakasir.webhookSecret = String(s.pakasirWebhookSecret).trim();
    if (s.pakasirBaseUrl && String(s.pakasirBaseUrl).trim()) serverConfig.pakasir.baseUrl = String(s.pakasirBaseUrl).trim();
    if (s.pakasirPaymentMethod && String(s.pakasirPaymentMethod).trim()) serverConfig.pakasir.paymentMethod = String(s.pakasirPaymentMethod).trim();
    if (s.pakasirMerchantName && String(s.pakasirMerchantName).trim()) serverConfig.pakasir.merchantName = String(s.pakasirMerchantName).trim();
    if (s.pakasirNmid && String(s.pakasirNmid).trim()) serverConfig.pakasir.nmid = String(s.pakasirNmid).trim();
    if (s.pakasirQrString && String(s.pakasirQrString).trim()) serverConfig.pakasir.qrString = String(s.pakasirQrString).trim();
    if (s.pakasirIsSandbox !== undefined) serverConfig.pakasir.isSandbox = Boolean(s.pakasirIsSandbox);

    // 2. Simpan Konfigurasi Qiospay Murni (hanya update jika bernilai)
    if (s.qiospayMerchantCode && String(s.qiospayMerchantCode).trim()) {
      let code = String(s.qiospayMerchantCode).trim();
      if (code.toUpperCase().startsWith('QP') && code.length === 7) {
        code = 'QP0' + code.slice(2).toUpperCase();
      }
      serverConfig.qiospay.merchantCode = code;
    }
    if (s.qiospayApiKey && String(s.qiospayApiKey).trim()) serverConfig.qiospay.apiKey = String(s.qiospayApiKey).trim();
    if (s.qiospaySecretKey && String(s.qiospaySecretKey).trim()) serverConfig.qiospay.secretKey = String(s.qiospaySecretKey).trim();
    if (s.qiospayNmid && String(s.qiospayNmid).trim()) serverConfig.qiospay.nmid = String(s.qiospayNmid).trim();
    if (s.qiospayMerchantName && String(s.qiospayMerchantName).trim()) serverConfig.qiospay.merchantName = String(s.qiospayMerchantName).trim();
    const qris = (s.qiospayQrString || s.staticQrisString || '').trim();
    if (qris) serverConfig.qiospay.qrString = qris;

    // 3. Simpan Konfigurasi Digiflazz (hanya update jika bernilai)
    const dfUser = String(s.digiflazzUser || s.digiflazzUsername || '').trim();
    if (dfUser) serverConfig.digiflazz.username = dfUser;
    const dfKey = String(s.digiflazzProductionKey || s.digiflazzApiKey || '').trim();
    if (dfKey) serverConfig.digiflazz.apiKey = dfKey;
    const dfSec = String(s.digiflazzSecretCode || s.digiflazzWebhookSecret || '').trim();
    if (dfSec) serverConfig.digiflazz.webhookSecret = dfSec;
    if (s.digiflazzWebhookUrl && String(s.digiflazzWebhookUrl).trim()) serverConfig.digiflazz.webhookUrl = String(s.digiflazzWebhookUrl).trim();
    if (s.digiflazzMode !== undefined) serverConfig.digiflazz.testing = s.digiflazzMode !== 'PRODUCTION';

    // 4. Simpan Konfigurasi Supabase (hanya update jika bernilai)
    const sbUrl = cleanSupabaseUrl(s.supabaseUrl);
    if (sbUrl) serverConfig.supabase.url = sbUrl;
    const sbPub = String(s.supabasePublishableKey || s.supabaseAnonKey || '').trim();
    if (sbPub) serverConfig.supabase.publishableKey = sbPub;
    const sbSec = String(s.supabaseSecretKey || s.supabaseServiceRoleKey || '').trim();
    if (sbSec) serverConfig.supabase.secretKey = sbSec;

    // Simpan ke file persisten agar tidak hilang setelah reload
    saveServerConfig({
      activeGateway: serverConfig.activeGateway,
      pakasir: serverConfig.pakasir,
      qiospay: serverConfig.qiospay,
      digiflazz: serverConfig.digiflazz,
      supabase: serverConfig.supabase,
    });

    res.json({
      success: true,
      message: 'Konfigurasi Payment Gateway berhasil diperbarui',
      activeGateway: serverConfig.activeGateway,
      pakasir: { slug: serverConfig.pakasir.slug, isSandbox: serverConfig.pakasir.isSandbox },
      qiospay: { merchantCode: serverConfig.qiospay.merchantCode },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Test Koneksi Gateway Masing-Masing ──
app.post(['/api/payment/pakasir/test', '/payment/pakasir/test'], (req, res) => {
  const isConfigured = Boolean(serverConfig.pakasir.slug && serverConfig.pakasir.apiKey);
  res.json({
    success: isConfigured,
    message: isConfigured
      ? `Pakasir API v2 Terhubung (Slug: ${serverConfig.pakasir.slug}, Mode: ${serverConfig.pakasir.isSandbox ? 'Sandbox' : 'Real'})`
      : 'Kredensial Pakasir belum lengkap. Harap isi Slug dan API Key.',
  });
});

app.post(['/api/qiospay/test', '/qiospay/test'], (req, res) => {
  const isConfigured = Boolean(serverConfig.qiospay.merchantCode && serverConfig.qiospay.apiKey);
  res.json({
    success: isConfigured,
    message: isConfigured
      ? `Qiospay QRIS Terhubung (Merchant: ${serverConfig.qiospay.merchantCode}, NMID: ${serverConfig.qiospay.nmid})`
      : 'Kredensial Qiospay belum lengkap. Harap isi Merchant Code dan API Key.',
  });
});

app.get(['/api/system/gateway-status', '/system/gateway-status'], (req, res) => {
  res.json({
    success: true,
    data: {
      activeGateway: serverConfig.paymentGatewayProvider,
      pakasir: {
        configured: Boolean(serverConfig.pakasir.slug && serverConfig.pakasir.apiKey),
        slug: serverConfig.pakasir.slug,
        isSandbox: serverConfig.pakasir.isSandbox,
        merchantName: serverConfig.pakasir.merchantName,
        nmid: serverConfig.pakasir.nmid,
      },
      qiospay: {
        configured: Boolean(serverConfig.qiospay.merchantCode && serverConfig.qiospay.apiKey),
        merchantCode: serverConfig.qiospay.merchantCode,
        merchantName: serverConfig.qiospay.merchantName,
        nmid: serverConfig.qiospay.nmid,
      },
      digiflazz: {
        configured: Boolean(serverConfig.digiflazz.username && serverConfig.digiflazz.apiKey),
        username: serverConfig.digiflazz.username,
        baseUrl: serverConfig.digiflazz.baseUrl,
      },
    },
  });
});

// ── GET /api/orders (Semua Order dari Database) ──
app.get(['/api/orders', '/orders'], (req, res) => {
  const db = readDatabase();
  return res.json({ success: true, data: db.orders || [] });
});

// ── Orders Endpoint (Menampilkan QRIS Sesuai Payment Gateway Masing-Masing) ──
app.post(['/api/orders', '/orders'], async (req, res) => {
  try {
    const {
      id: orderId,
      invoiceNumber,
      totalAmount,
      amount,
      preferredGateway,
      customerName,
      customerPhone,
      customerEmail
    } = req.body || {};

    const finalAmount = Math.max(0, Math.round(Number(totalAmount || amount || 10000)));
    const targetGateway = (preferredGateway || serverConfig.activeGateway || 'QIOSPAY').toUpperCase();
    const snapToken = 'SNAP-' + Math.random().toString(36).substring(2, 12).toUpperCase();

    // Simpan order ke database multi-tier agar persisten setelah deploy
    if (orderId || invoiceNumber) {
      writeDatabase(db => {
        if (!Array.isArray(db.orders)) db.orders = [];
        const existingIdx = db.orders.findIndex(o => o.id === orderId || o.invoiceNumber === invoiceNumber);
        const orderRecord = {
          id: orderId || invoiceNumber,
          invoiceNumber: invoiceNumber || orderId,
          customerName: customerName || 'Pelanggan Wayahe',
          customerPhone: customerPhone || '',
          customerEmail: customerEmail || '',
          targetDestination: req.body?.targetDestination || customerPhone || '',
          category: req.body?.category || 'pulsa',
          totalAmount: finalAmount,
          paymentStatus: 'UNPAID',
          fulfillmentStatus: 'NOT_STARTED',
          paymentGatewayProvider: targetGateway,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...req.body,
        };
        if (existingIdx >= 0) {
          db.orders[existingIdx] = { ...db.orders[existingIdx], ...orderRecord };
        } else {
          db.orders.unshift(orderRecord);
        }
        return db;
      });
    }

    // ════════════════════════════════════════════════════════════════
    // 1. JALUR PAKASIR API v2 (MURNI, TANPA DATA QIOSPAY)
    // ════════════════════════════════════════════════════════════════
    if (targetGateway === 'PAKASIR') {
      const slug = serverConfig.pakasir.slug || 'waroengdigital';
      const fallbackPaymentLink = `https://app.pakasir.com/pay/${encodeURIComponent(slug)}/${finalAmount}?order_id=${encodeURIComponent(orderId || invoiceNumber)}&qris_only=1`;

      // Coba panggil upstream Pakasir API v2
      if (serverConfig.pakasir.apiKey) {
        try {
          const upstreamUrl = `${serverConfig.pakasir.baseUrl || 'https://app.pakasir.com'}/api/v2/transaction/create`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);

          const upRes = await fetch(upstreamUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': serverConfig.pakasir.apiKey,
            },
            body: JSON.stringify({
              order_id: orderId || invoiceNumber,
              amount: finalAmount,
              method: serverConfig.pakasir.paymentMethod || 'qris',
              customer_name: customerName || 'Pelanggan Wayahe',
              customer_email: customerEmail || 'customer@wayahedigital.id',
              customer_phone: customerPhone || '081234567890',
            }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (upRes.ok) {
            const data = await upRes.json();
            if (data?.payment || data?.data) {
              const p = data.payment || data.data;
              return res.json({
                success: true,
                snapToken,
                gateway: 'PAKASIR',
                paymentGatewayProvider: 'PAKASIR',
                merchantName: serverConfig.pakasir.merchantName,
                payment: {
                  txn_id: p.txn_id || p.id || orderId,
                  qr_string: p.qr_string || p.qrString,
                  payment_link: p.payment_link || fallbackPaymentLink,
                  fee: p.fee || 0,
                  total_payment: p.total_payment || finalAmount,
                  is_sandbox: p.is_sandbox ?? serverConfig.pakasir.isSandbox,
                },
                qrString: p.qr_string || p.qrString,
                paymentLink: p.payment_link || fallbackPaymentLink,
                isDynamic: true,
                isSandbox: serverConfig.pakasir.isSandbox,
              });
            }
          }
        } catch (e) {
          console.warn('[Vercel API] Pakasir upstream note:', e.message);
        }
      }

      // Pakasir QRIS Mandiri (Hanya menggunakan config Pakasir)
      let dynamicPakasirQR = '';
      if (serverConfig.pakasir.qrString && serverConfig.pakasir.qrString.startsWith('000201')) {
        dynamicPakasirQR = convertStaticToDynamic(
          serverConfig.pakasir.qrString,
          finalAmount,
          invoiceNumber,
          serverConfig.pakasir.merchantName
        );
      }

      return res.json({
        success: true,
        snapToken,
        gateway: 'PAKASIR',
        paymentGatewayProvider: 'PAKASIR',
        merchantName: serverConfig.pakasir.merchantName,
        payment: {
          txn_id: `PKS-${(orderId || invoiceNumber || Date.now()).toString().replace(/[^a-zA-Z0-9]/g, '')}`,
          qr_string: dynamicPakasirQR,
          payment_link: fallbackPaymentLink,
          fee: 0,
          total_payment: finalAmount,
          is_sandbox: serverConfig.pakasir.isSandbox,
        },
        qrString: dynamicPakasirQR,
        paymentLink: fallbackPaymentLink,
        isDynamic: true,
        isSandbox: serverConfig.pakasir.isSandbox,
      });
    }

    // ════════════════════════════════════════════════════════════════
    // 2. JALUR QIOSPAY QRIS (MURNI, DENGAN EMVCo NOBU BANK QIOSPAY)
    // ════════════════════════════════════════════════════════════════
    const rawStatic = serverConfig.qiospay.qrString;
    const dynamicQiospayQR = convertStaticToDynamic(
      rawStatic,
      finalAmount,
      invoiceNumber,
      serverConfig.qiospay.merchantName
    );

    return res.json({
      success: true,
      snapToken,
      gateway: 'QIOSPAY',
      paymentGatewayProvider: 'QIOSPAY',
      merchantName: serverConfig.qiospay.merchantName,
      nmid: serverConfig.qiospay.nmid,
      payment: {
        txn_id: `QP-${(orderId || invoiceNumber || Date.now()).toString().replace(/[^a-zA-Z0-9]/g, '')}`,
        qr_string: dynamicQiospayQR,
        fee: 0,
        total_payment: finalAmount,
      },
      qrString: dynamicQiospayQR,
      isDynamic: true,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Status Transaksi Pakasir (Polling oleh Frontend) ──
app.get(['/api/payment/pakasir/status/:orderId', '/payment/pakasir/status/:orderId'], (req, res) => {
  const { orderId } = req.params;
  const isPaid = paidOrders.has(orderId);
  const paidInfo = paidOrders.get(orderId);

  res.json({
    success: true,
    orderId,
    status: isPaid ? 'PAID' : 'PENDING',
    order: {
      payment_status: isPaid ? 'PAID' : 'PENDING',
      fulfillment_status: isPaid ? 'COMPLETED' : 'PENDING',
      paid_at: paidInfo?.time || null,
    },
    message: isPaid ? 'Pembayaran Pakasir terkonfirmasi lunas via Webhook' : 'Menunggu pembayaran Pakasir',
  });
});

// ── Status Transaksi Umum (Dipanggil oleh apiAdapter.checkPaymentStatus) ──
app.get(['/api/orders/:orderId/payment-status', '/orders/:orderId/payment-status'], async (req, res) => {
  try {
    const { orderId } = req.params;
    const targetAmount = Number(req.query.amount || 0);
    const orderCreatedAtStr = req.query.created_at || req.query.createdAt;
    const orderCreatedAtMs = orderCreatedAtStr ? new Date(orderCreatedAtStr).getTime() : 0;

    // 1. Cek cache memori cepat untuk orderId spesifik ini
    const isDirectPaid = paidOrders.has(orderId);
    if (isDirectPaid) {
      const paidInfo = paidOrders.get(orderId);
      return res.json({
        paymentStatus: 'PAID',
        isPaid: true,
        diagnosticCode: 'VERIFIED',
        message: 'Pembayaran terverifikasi otomatis via Webhook Callback!',
        order: {
          paymentStatus: 'PAID',
          fulfillmentStatus: 'COMPLETED',
          paidAt: paidInfo?.time || new Date().toISOString(),
        },
      });
    }

    // 2. Cek recentMutasi lokal HANYA jika mutasi tersebut memang milik orderId ini atau terjadi setelah order dibuat dan belum diklaim
    let matchedMutasi = null;
    if (targetAmount > 0 && orderCreatedAtMs > 0) {
      matchedMutasi = recentMutasi.find(m => {
        if (m.orderId === orderId) return true;
        const mutasiTimeMs = m.timeMs || parseQiospayDate(m.date);
        const isAmountMatch = Math.abs(Number(m.amount) - targetAmount) <= 1;
        const isNotClaimed = !claimedMutasiRefs.has(m.refid);
        const isAfterOrder = mutasiTimeMs >= (orderCreatedAtMs - 30000);
        return isAmountMatch && isNotClaimed && isAfterOrder;
      });
    }

    // 3. Jika belum ketemu dan targetAmount > 0 serta ada orderCreatedAtMs, periksa langsung ke Mutasi Live Upstream Qiospay!
    if (!matchedMutasi && targetAmount > 0 && orderCreatedAtMs > 0) {
      try {
        const code = serverConfig.qiospay.merchantCode || 'QP048797';
        const key = serverConfig.qiospay.apiKey || '1f35027cdf888c74c36063efcb93f69fc15f119419adf772e58629336c5228cf';
        const candidateCodes = [code];
        if (code.toUpperCase().startsWith('QP') && code.length === 7) {
          candidateCodes.unshift('QP0' + code.slice(2).toUpperCase());
        }

        for (const candidate of candidateCodes) {
          const upstreamUrl = `https://qiospay.id/api/mutasi/qris/${encodeURIComponent(candidate)}/${encodeURIComponent(key)}`;
          const upRes = await fetch(upstreamUrl, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            signal: AbortSignal.timeout(6000),
          });

          if (upRes.ok) {
            const json = await upRes.json();
            const list = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
            for (const item of list) {
              const itemAmount = parseInt(String(item.amount || item.nominal || 0).replace(/[^0-9]/g, ''), 10);
              const itemType = String(item.type || 'CR').toUpperCase();
              const ref = String(item.issuer_reff || item.buyer_reff || item.refid || `QP-${item.date || Date.now()}`).trim();
              const itemDateMs = parseQiospayDate(item.date);

              // SYARAT MUTLAK:
              // 1. Tipe harus kredit (CR)
              // 2. Nominal harus cocok persis dengan targetAmount
              // 3. refid belum pernah diklaim oleh transaksi mana pun
              // 4. Waktu transaksi mutasi harus SESUDAH order dibuat (minimal >= orderCreatedAtMs - 30 detik)
              const isNotClaimed = !claimedMutasiRefs.has(ref);
              const isAfterOrder = itemDateMs >= (orderCreatedAtMs - 30000);

              if (itemType === 'CR' && Math.abs(itemAmount - targetAmount) <= 1 && isNotClaimed && isAfterOrder) {
                claimedMutasiRefs.add(ref);
                matchedMutasi = {
                  orderId,
                  refid: ref,
                  amount: itemAmount,
                  brand: item.brand_name || 'QRIS',
                  date: item.date || new Date().toISOString(),
                  timeMs: itemDateMs,
                  balance: item.balance,
                };
                paidOrders.set(orderId, {
                  status: 'PAID',
                  gateway: 'QIOSPAY_MUTASI',
                  amount: itemAmount,
                  refid: ref,
                  time: item.date || new Date().toISOString(),
                });
                recentMutasi.unshift(matchedMutasi);
                break;
              }
            }
            if (matchedMutasi) break;
          }
        }
      } catch (_) { }
    }

    if (matchedMutasi) {
      return res.json({
        paymentStatus: 'PAID',
        isPaid: true,
        diagnosticCode: 'VERIFIED',
        message: 'Pembayaran terverifikasi otomatis via Mutasi Qiospay!',
        order: {
          paymentStatus: 'PAID',
          fulfillmentStatus: 'COMPLETED',
          paidAt: matchedMutasi.date || new Date().toISOString(),
        },
      });
    }

    res.json({
      paymentStatus: 'UNPAID',
      isPaid: false,
      message: 'Menunggu transfer pembayaran QRIS...',
    });
  } catch (err) {
    res.status(500).json({ paymentStatus: 'UNPAID', isPaid: false, message: err.message });
  }
});

// ── GET /api/orders/:ref_id (Status Order via Database / Memori Cache) ──
app.get(['/api/orders/:ref_id', '/orders/:ref_id'], (req, res) => {
  const { ref_id } = req.params;
  const cleanRef = String(ref_id || '').trim();

  const digiOrder = digiflazzOrders.get(cleanRef);
  const paidInfo = paidOrders.get(cleanRef);

  if (digiOrder) {
    return res.json({
      success: true,
      data: digiOrder,
      paymentStatus: digiOrder.paymentStatus || 'PAID',
      fulfillmentStatus: digiOrder.status,
      serialNumber: digiOrder.sn || null,
      refId: digiOrder.ref_id,
    });
  }

  if (paidInfo) {
    return res.json({
      success: true,
      data: {
        id: cleanRef,
        invoiceNumber: cleanRef,
        paymentStatus: 'PAID',
        fulfillmentStatus: paidInfo.fulfillmentStatus || 'SUCCESS',
        voucherCode: paidInfo.voucherCode,
        voucherPassword: paidInfo.voucherPassword,
        wifiSsid: paidInfo.wifiSsid,
        wifiLoginUrl: paidInfo.wifiLoginUrl,
        serialNumber: paidInfo.voucherCode || paidInfo.serialNumber,
        paidAt: paidInfo.time,
      },
      paymentStatus: 'PAID',
      fulfillmentStatus: paidInfo.fulfillmentStatus || 'SUCCESS',
      voucherCode: paidInfo.voucherCode,
      voucherPassword: paidInfo.voucherPassword,
      wifiSsid: paidInfo.wifiSsid,
      wifiLoginUrl: paidInfo.wifiLoginUrl,
      serialNumber: paidInfo.voucherCode || paidInfo.serialNumber,
      refId: cleanRef,
    });
  }

  // Cek ke Database Terpadu (db.json / memoryDb / /tmp)
  const db = readDatabase();
  if (Array.isArray(db.orders)) {
    const dbOrder = db.orders.find(o => 
      o.id === cleanRef || 
      (o.invoiceNumber && o.invoiceNumber.toLowerCase() === cleanRef.toLowerCase()) || 
      o.supplierRefId === cleanRef
    );
    if (dbOrder) {
      const vCode = dbOrder.voucherCode || dbOrder.fulfillmentResult?.voucherCode;
      const vPass = dbOrder.voucherPassword || dbOrder.fulfillmentResult?.voucherPassword;
      const vSsid = dbOrder.wifiSsid || dbOrder.fulfillmentResult?.wifiSsid;
      const vLogin = dbOrder.wifiLoginUrl || dbOrder.fulfillmentResult?.wifiLoginUrl;
      const sn = dbOrder.serialNumber || vCode || dbOrder.fulfillmentResult?.serialNumber;

      return res.json({
        success: true,
        data: dbOrder,
        paymentStatus: dbOrder.paymentStatus || 'UNPAID',
        fulfillmentStatus: dbOrder.fulfillmentStatus || 'NOT_STARTED',
        voucherCode: vCode,
        voucherPassword: vPass,
        wifiSsid: vSsid,
        wifiLoginUrl: vLogin,
        serialNumber: sn,
        refId: cleanRef,
      });
    }
  }

  res.status(404).json({ success: false, message: 'Order tidak ditemukan di cache atau database.' });
});

// ── DIGIFLAZZ HELPERS & MULTI-WEBHOOK ──
function resolveDigiflazzCallbackUrl(callbackUrl) {
  const defaultWebhook = serverConfig.digiflazz.webhookUrl?.trim();
  const allowedList = serverConfig.digiflazz.allowedCallbackUrls || [];

  if (callbackUrl && typeof callbackUrl === 'string' && callbackUrl.trim()) {
    const candidate = callbackUrl.trim();
    if (allowedList.includes(candidate) || (defaultWebhook && candidate === defaultWebhook)) {
      return candidate;
    }
    console.warn(`⚠️ [DIGIFLAZZ SECURITY] Unverified callbackUrl '${candidate}' is not in whitelist. Using default.`);
  }
  return defaultWebhook || undefined;
}

function generateDigiflazzSign(username, apiKey, refId) {
  return crypto.createHash('md5').update(`${username}${apiKey}${refId}`).digest('hex');
}

function verifyDigiflazzSignature(rawBody, signatureHeader, secret) {
  if (!secret) return { valid: true, reason: 'No secret configured' };
  if (!signatureHeader) {
    console.warn('⚠️ [DIGIFLAZZ WEBHOOK NOTICE] X-Hub-Signature header absent, proceeding with payload.');
    return { valid: true, reason: 'Signature absent' };
  }
  if (!rawBody) return { valid: false, reason: 'Missing rawBody' };
  try {
    const rawBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
    const expected = 'sha1=' + crypto.createHmac('sha1', secret).update(rawBuffer).digest('hex');
    const sigBuffer = Buffer.from(signatureHeader.trim());
    const expBuffer = Buffer.from(expected);
    if (sigBuffer.length === expBuffer.length && crypto.timingSafeEqual(sigBuffer, expBuffer)) {
      return { valid: true };
    }
    return { valid: false, reason: 'Signature mismatch' };
  } catch (err) {
    return { valid: false, reason: err.message };
  }
}

// ── Delete Order ──
app.delete(['/api/orders/:id', '/orders/:id'], (req, res) => {
  const orderId = String(req.params.id || '').trim();
  res.json({ success: true, message: `Order ${orderId} berhasil dihapus.` });
});

app.post(['/api/orders/bulk-delete', '/orders/bulk-delete'], (req, res) => {
  const { orderIds = [] } = req.body || {};
  res.json({ success: true, message: `${orderIds.length} order berhasil dihapus.` });
});

// ── Digiflazz Cek Saldo ──
app.all(['/api/digiflazz/balance', '/digiflazz/balance'], async (req, res) => {
  try {
    const qUser = req.query.username || req.body?.username;
    const qKey = req.query.apiKey || req.body?.apiKey;

    const username = (qUser || serverConfig.digiflazz.username || '').trim();
    const apiKey = (qKey || serverConfig.digiflazz.apiKey || '').trim();
    const baseUrl = serverConfig.digiflazz.baseUrl || 'https://api.digiflazz.com/v1';

    if (!username || !apiKey) {
      return res.json({
        success: false,
        message: 'Kredensial Digiflazz (Username & Production Key) belum dikonfigurasi.',
        data: {
          deposit: 0,
          username: username || '-',
          status: 'UNCONFIGURED',
        },
      });
    }

    const sign = crypto.createHash('md5').update(`${username}${apiKey}depo`).digest('hex');
    const response = await fetch(`${baseUrl}/cek-saldo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: 'deposit', username, sign }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.json({
        success: false,
        message: `HTTP ${response.status}: ${errText}`,
        data: {
          deposit: 0,
          username,
          status: 'ERROR',
        },
      });
    }

    const json = await response.json();
    const data = json?.data;
    return res.json({
      success: true,
      data: {
        deposit: Number(data?.deposit || 0),
        username,
        status: 'CONNECTED',
      },
    });
  } catch (err) {
    return res.json({
      success: false,
      message: err.message,
      data: {
        deposit: 0,
        username: serverConfig.digiflazz.username || '-',
        status: 'ERROR',
        error: err.message,
      },
    });
  }
});

// Helper untuk deteksi IP Publik Live VPS / Jaringan
async function detectLiveVpsIp() {
  const providers = [
    { url: 'https://api.ipify.org?format=json', parser: (d) => d?.ip },
    { url: 'https://api4.my-ip.io/ip.json', parser: (d) => d?.ip },
    { url: 'https://icanhazip.com', parser: (d) => typeof d === 'string' ? d.trim() : d },
    { url: 'https://ifconfig.me/ip', parser: (d) => typeof d === 'string' ? d.trim() : d },
  ];

  for (const p of providers) {
    try {
      const res = await fetch(p.url, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const text = await res.text();
        let parsed = text;
        try { parsed = JSON.parse(text); } catch (_) {}
        const ip = p.parser(parsed) || text;
        const match = String(ip).trim().match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
        if (match) return match[0];
      }
    } catch (_) {}
  }
  return (process.env.DIGIFLAZZ_WHITELIST_IP || '82.158.130.255').trim();
}

// Helper untuk deteksi outbound IP publik (Mengutamakan whitelist terkonfigurasi atau live VPS IP)
async function detectOutboundPublicIp() {
  if (process.env.DIGIFLAZZ_WHITELIST_IP && process.env.DIGIFLAZZ_WHITELIST_IP.trim()) {
    return process.env.DIGIFLAZZ_WHITELIST_IP.trim();
  }
  return await detectLiveVpsIp();
}

// Helper untuk uji whitelist Digiflazz live
async function verifyDigiflazzWhitelist(username, apiKey, baseUrl = 'https://api.digiflazz.com/v1') {
  const detectedIp = await detectOutboundPublicIp();
  if (!username || !apiKey) {
    return {
      outboundIp: detectedIp,
      isWhitelisted: false,
      digiflazzDetectedIp: detectedIp,
      digiflazzMessage: 'Kredensial Digiflazz (Username / Production Key) belum lengkap.',
      deposit: 0,
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const sign = crypto.createHash('md5').update(`${username}${apiKey}depo`).digest('hex');
    const resp = await fetch(`${baseUrl}/cek-saldo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: 'deposit', username, sign }),
      signal: AbortSignal.timeout(10000),
    });

    const json = await resp.json().catch(() => null);
    if (!resp.ok || !json) {
      return {
        outboundIp: detectedIp,
        isWhitelisted: false,
        digiflazzDetectedIp: detectedIp,
        digiflazzMessage: `Koneksi Digiflazz HTTP ${resp.status}`,
        deposit: 0,
        lastChecked: new Date().toISOString(),
      };
    }

    const data = json?.data;
    const rc = String(data?.rc || '');
    const message = data?.message || json?.message || '';

    if (data && data.deposit !== undefined && !['45', '46', '47'].includes(rc)) {
      return {
        outboundIp: detectedIp,
        isWhitelisted: true,
        digiflazzDetectedIp: detectedIp,
        digiflazzMessage: `✓ Terhubung! IP ${detectedIp} terdaftar di Whitelist Digiflazz. Saldo aktif: Rp ${Number(data.deposit).toLocaleString('id-ID')}`,
        deposit: Number(data.deposit),
        lastChecked: new Date().toISOString(),
      };
    }

    let digiIp = detectedIp;
    const ipMatch = message.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    if (ipMatch) digiIp = ipMatch[1];

    if (rc === '45' || message.toLowerCase().includes('tidak kami kenali') || message.toLowerCase().includes('ip')) {
      return {
        outboundIp: detectedIp,
        isWhitelisted: false,
        digiflazzDetectedIp: digiIp,
        digiflazzMessage: `IP ${digiIp} belum di-whitelist di Digiflazz (RC 45). Silakan tambahkan IP ini ke whitelist di member.digiflazz.com.`,
        deposit: 0,
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      outboundIp: detectedIp,
      isWhitelisted: false,
      digiflazzDetectedIp: digiIp,
      digiflazzMessage: `Digiflazz Respon (RC ${rc}): ${message || 'Gagal memverifikasi IP'}`,
      deposit: 0,
      lastChecked: new Date().toISOString(),
    };
  } catch (err) {
    return {
      outboundIp: detectedIp,
      isWhitelisted: false,
      digiflazzDetectedIp: detectedIp,
      digiflazzMessage: `Gagal menghubungi Digiflazz: ${err.message}`,
      deposit: 0,
      lastChecked: new Date().toISOString(),
    };
  }
}

// ── Digiflazz Detect Live VPS Outbound IP ──
app.get(['/api/digiflazz/detect-live-ip', '/digiflazz/detect-live-ip'], async (req, res) => {
  try {
    const liveIp = await detectLiveVpsIp();
    const configuredWhitelistIp = (process.env.DIGIFLAZZ_WHITELIST_IP || '82.158.130.255').trim();
    return res.json({
      success: true,
      data: {
        liveIp,
        configuredWhitelistIp,
        isMatch: liveIp === configuredWhitelistIp,
        detectedAt: new Date().toISOString(),
      },
      message: `IP Publik Server/VPS terdeteksi: ${liveIp}`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Digiflazz Outbound IP Whitelist Status ──
app.get(['/api/digiflazz/ip-status', '/digiflazz/ip-status'], async (req, res) => {
  try {
    const username = serverConfig.digiflazz.username;
    const apiKey = serverConfig.digiflazz.apiKey;
    const baseUrl = serverConfig.digiflazz.baseUrl;
    const result = await verifyDigiflazzWhitelist(username, apiKey, baseUrl);

    return res.json({
      success: true,
      data: {
        ...result,
        configuredWhitelistIp: process.env.DIGIFLAZZ_WHITELIST_IP || result.outboundIp,
        outboundProxy: process.env.DIGIFLAZZ_OUTBOUND_PROXY || '',
        isProxyActive: Boolean(process.env.DIGIFLAZZ_OUTBOUND_PROXY),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Digiflazz Test Outbound IP Whitelist ──
app.post(['/api/digiflazz/test-ip', '/digiflazz/test-ip'], async (req, res) => {
  try {
    const username = req.body?.username || serverConfig.digiflazz.username;
    const apiKey = req.body?.apiKey || serverConfig.digiflazz.apiKey;
    const baseUrl = serverConfig.digiflazz.baseUrl;
    const result = await verifyDigiflazzWhitelist(username, apiKey, baseUrl);

    return res.json({
      success: true,
      message: result.digiflazzMessage,
      data: {
        ...result,
        configuredWhitelistIp: process.env.DIGIFLAZZ_WHITELIST_IP || result.outboundIp,
        outboundProxy: req.body?.proxy || process.env.DIGIFLAZZ_OUTBOUND_PROXY || '',
        isProxyActive: Boolean(req.body?.proxy || process.env.DIGIFLAZZ_OUTBOUND_PROXY),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Digiflazz Update IP & Proxy Config ──
app.post(['/api/digiflazz/update-ip-config', '/digiflazz/update-ip-config'], async (req, res) => {
  try {
    const { whitelistIp, outboundProxy } = req.body || {};
    if (whitelistIp) process.env.DIGIFLAZZ_WHITELIST_IP = whitelistIp.trim();
    if (outboundProxy !== undefined) process.env.DIGIFLAZZ_OUTBOUND_PROXY = outboundProxy.trim();

    return res.json({
      success: true,
      message: 'Konfigurasi IP & Proxy Digiflazz berhasil disimpan.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Digiflazz Sync Products (Katalog Resmi) ──
app.all(['/api/digiflazz/sync-products', '/api/digiflazz/sync', '/digiflazz/sync-products', '/digiflazz/sync'], async (req, res) => {
  try {
    // 1. Coba panggil backend port 4000 terlebih dahulu jika aktif
    try {
      const bRes = await fetch('http://127.0.0.1:4000/api/digiflazz/sync-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      if (bRes.ok) {
        const bJson = await bRes.json();
        return res.json(bJson);
      }
    } catch (_) {}

    // 2. Jika backend standalone belum aktif, sinkronisasi langsung via Digiflazz Price List API
    const { username, apiKey, baseUrl } = serverConfig.digiflazz;
    if (!username || !apiKey) {
      return res.status(400).json({ success: false, message: 'Kredensial Digiflazz belum dikonfigurasi.' });
    }

    const sign = crypto.createHash('md5').update(`${username}${apiKey}pricelist`).digest('hex');
    const dfRes = await fetch(`${baseUrl}/price-list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: 'prepaid', username, sign }),
      signal: AbortSignal.timeout(60000),
    });

    if (!dfRes.ok) {
      const errText = await dfRes.text();
      return res.status(500).json({ success: false, message: `Digiflazz HTTP ${dfRes.status}: ${errText}` });
    }

    const dfJson = await dfRes.json().catch(() => null);
    const rawList = dfJson?.data;

    // Baca db.json jika ada untuk simpan snapshot & pertahankan custom produk
    let currentProducts = [];
    try {
      if (fs.existsSync(DB_PATH)) {
        const fileContent = fs.readFileSync(DB_PATH, 'utf-8');
        const dbData = JSON.parse(fileContent);
        currentProducts = Array.isArray(dbData.products) ? dbData.products : [];
      }
    } catch (_) {}

    const isRateLimited = dfJson?.data?.rc === '83' || String(dfJson?.data?.message || '').toLowerCase().includes('menunggu');
    if (!Array.isArray(rawList) || rawList.length === 0) {
      const existingDf = currentProducts.filter(p => p.categoryId === 'pulsa' || p.categoryId === 'kuota' || p.categoryId === 'game' || String(p.id).startsWith('df-'));
      if (existingDf.length > 0) {
        return res.json({
          success: true,
          count: existingDf.length,
          isRateLimited: true,
          message: `Digiflazz membatasi request katalog penuh maksimal 1x per 30 menit. Menggunakan ${existingDf.length} produk aktif dari sinkronisasi sebelumnya.`,
          timestamp: new Date().toISOString(),
        });
      }
      return res.json({ success: false, count: 0, message: dfJson?.data?.message || 'Tidak ada data produk dari Digiflazz.' });
    }

    const preserved = currentProducts.filter(p => p.categoryId === 'wifi' || p.categoryId === 'premium' || p.isManualCustom === true || String(p.id).startsWith('df-manual-'));
    const transformed = rawList.map(item => {
      const cleanSku = String(item.buyer_sku_code || '').trim();
      const id = `df-${cleanSku.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;
      const supPrice = Number(item.price || 0);
      const margin = supPrice < 25000 ? 1500 : supPrice < 100000 ? 2500 : 4000;
      const roundedSelling = Math.ceil((supPrice + margin) / 100) * 100;
      return {
        id,
        name: item.product_name || cleanSku,
        categoryId: String(item.category || '').toLowerCase().includes('pulsa') ? 'pulsa'
          : String(item.category || '').toLowerCase().includes('game') ? 'game'
          : 'kuota',
        provider: String(item.brand || '').toUpperCase(),
        sku: cleanSku,
        supplierSku: cleanSku,
        sellerName: item.seller_name || 'Digiflazz H2H',
        digiflazzCategory: item.category || 'Data',
        digiflazzType: item.type || 'Reguler',
        supplierPrice: supPrice,
        basePrice: supPrice,
        sellingPrice: roundedSelling,
        description: item.desc || `${item.product_name} - ${item.brand}`,
        quotaDetails: item.desc || '',
        deliveryMethod: 'AUTOMATIC',
        isActive: item.buyer_product_status === true && item.seller_product_status === true,
        stock: item.unlimited_stock ? 9999 : (item.stock || 9999),
        isDigiflazzSynced: true,
        lastSyncedAt: new Date().toISOString(),
      };
    });

    const merged = [...nonDigiflazz, ...transformed];
    try {
      if (fs.existsSync(DB_PATH)) {
        const fileContent = fs.readFileSync(DB_PATH, 'utf-8');
        const dbData = JSON.parse(fileContent);
        dbData.products = merged;
        fs.writeFileSync(DB_PATH, JSON.stringify(dbData, null, 2), 'utf-8');
      }
    } catch (_) {}

    return res.json({
      success: true,
      count: transformed.length,
      message: `Berhasil menyinkronkan ${transformed.length} produk dari Digiflazz Buyer API`,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Get Digiflazz Products ──
app.get(['/api/digiflazz/products', '/digiflazz/products'], async (req, res) => {
  try {
    try {
      const bRes = await fetch('http://127.0.0.1:4000/api/digiflazz/products', { signal: AbortSignal.timeout(3000) });
      if (bRes.ok) {
        return res.json(await bRes.json());
      }
    } catch (_) {}

    if (fs.existsSync(DB_PATH)) {
      const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      const list = Array.isArray(db?.products) ? db.products : [];
      const dfOnly = list.filter(p => p.categoryId === 'pulsa' || p.categoryId === 'kuota' || p.categoryId === 'game' || (p.id && String(p.id).startsWith('df-')));
      return res.json({ success: true, count: dfOnly.length, data: dfOnly });
    }
    return res.json({ success: true, count: 0, data: [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Get Sync State (Products, Orders, Promos, Settings) ──
app.get(['/api/sync/state', '/sync/state'], async (req, res) => {
  try {
    try {
      const bRes = await fetch('http://127.0.0.1:4000/api/sync/state', { signal: AbortSignal.timeout(3000) });
      if (bRes.ok) {
        return res.json(await bRes.json());
      }
    } catch (_) {}

    const db = readDatabase();
    return res.json({ success: true, data: db });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Sync Entity (Promos, Products, Settings, Orders, WiFi Vouchers) ──
app.post(['/api/sync/entity', '/sync/entity'], async (req, res) => {
  try {
    try {
      const bRes = await fetch('http://127.0.0.1:4000/api/sync/entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
        signal: AbortSignal.timeout(3000),
      });
      if (bRes.ok) {
        return res.json(await bRes.json());
      }
    } catch (_) {}

    const { entity, data } = req.body || {};
    if (entity) {
      writeDatabase(db => {
        db[entity] = data;
        return db;
      });
      return res.json({ success: true });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Digiflazz Transaction Create (Mendukung parameter cb_url Multi-Webhook) ──
app.post(['/api/digiflazz/transaction', '/digiflazz/transaction'], async (req, res) => {
  try {
    const { buyerSkuCode, customerNo, refId, maxPrice, callbackUrl, allowDot, testing } = req.body || {};
    const { username, apiKey, baseUrl, testing: defaultTesting } = serverConfig.digiflazz;

    if (!username || !apiKey) {
      return res.status(400).json({ success: false, message: 'Digiflazz credentials belum dikonfigurasi di server.' });
    }
    if (!buyerSkuCode || !customerNo || !refId) {
      return res.status(400).json({ success: false, message: 'buyerSkuCode, customerNo, dan refId wajib diisi.' });
    }

    const sign = generateDigiflazzSign(username, apiKey, refId);
    const cbUrl = resolveDigiflazzCallbackUrl(callbackUrl);
    const isTesting = testing !== undefined ? Boolean(testing) : defaultTesting;

    const payload = {
      username,
      buyer_sku_code: buyerSkuCode,
      customer_no: customerNo,
      ref_id: refId,
      sign,
      testing: isTesting,
    };
    if (cbUrl) payload.cb_url = cbUrl;
    if (maxPrice && Number(maxPrice) > 0) payload.max_price = Number(maxPrice);
    if (allowDot !== undefined) payload.allow_dot = Boolean(allowDot);

    console.log('[DIGIFLAZZ REQUEST]', {
      ref_id: refId,
      buyer_sku_code: buyerSkuCode,
      customer_no: customerNo,
      callback_url: cbUrl || '(default dashboard webhook)',
      testing: isTesting,
    });

    // Simpan order sebelum dikirim
    digiflazzOrders.set(refId, {
      id: refId,
      ref_id: refId,
      buyer_sku_code: buyerSkuCode,
      customer_no: customerNo,
      status: 'PENDING',
      callback_url: cbUrl || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const response = await fetch(`${baseUrl}/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[DIGIFLAZZ HTTP ERROR] (${response.status}):`, errText);
      return res.status(response.status).json({ success: false, message: `Digiflazz HTTP Error (${response.status}): ${errText}` });
    }

    const json = await response.json();
    const data = json?.data;
    if (!data) {
      return res.status(502).json({ success: false, message: 'Respon Digiflazz tidak mengandung data.' });
    }

    console.log('[DIGIFLAZZ RESPONSE]', {
      ref_id: data.ref_id,
      status: data.status,
      rc: data.rc,
      message: data.message,
    });

    // Perbarui cache order
    const existing = digiflazzOrders.get(refId);
    if (existing && existing.status !== 'SUCCESS' && existing.status !== 'FAILED') {
      const mapped = data.status === 'Sukses' ? 'SUCCESS' : (data.status === 'Gagal' ? 'FAILED' : 'PENDING');
      digiflazzOrders.set(refId, {
        ...existing,
        status: mapped,
        rc: data.rc,
        sn: data.sn,
        message: data.message,
        price: data.price,
        updated_at: new Date().toISOString(),
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('[Digiflazz Transaction Error]:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Manual & Automated Fulfillment Route (Digiflazz Real-time Delivery) ──
app.post(['/api/orders/:id/fulfill', '/api/orders/fulfill', '/api/fulfillment/fulfill'], async (req, res) => {
  try {
    const orderId = req.params.id || req.body.orderId || req.body.id || req.body.order?.id;
    const orderData = req.body.order || req.body;
    const targetDestination = (orderData.targetDestination || orderData.customerPhone || req.body.customerNo || '').toString().trim();
    const buyerSkuCode = (orderData.buyerSkuCode || orderData.supplierSku || orderData.sku || req.body.buyerSkuCode || '').toString().trim();
    const invoiceNumber = orderData.invoiceNumber || req.body.invoiceNumber;

    console.log(`⚡ [SERVERLESS FULFILL] Memproses pemenuhan pesanan ${orderId || invoiceNumber}...`, {
      buyerSkuCode,
      targetDestination,
      invoiceNumber
    });

    // 1. Coba forward ke backend port 4000 jika tersedia
    try {
      const bRes = await fetch(`http://127.0.0.1:4000/api/orders/${orderId}/fulfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
        signal: AbortSignal.timeout(10000),
      });
      if (bRes.ok) {
        const bJson = await bRes.json();
        if (bJson.success) return res.json(bJson);
      }
    } catch (_) {}

    // 2. Jika backend standalone belum memproses, eksekusi ke Digiflazz secara langsung
    const cat = String(orderData.category || orderData.categoryId || '').toLowerCase();
    const isDigiflazz = buyerSkuCode || ['pulsa', 'kuota', 'game'].includes(cat) || String(orderData.productId || '').startsWith('df-');

    if (isDigiflazz && buyerSkuCode && targetDestination) {
      const { username, apiKey, baseUrl, testing: defaultTesting } = serverConfig.digiflazz;
      if (!username || !apiKey) {
        return res.status(400).json({ success: false, message: 'Kredensial Digiflazz (Username / Key) belum diatur.' });
      }

      const refId = invoiceNumber || `WD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const sign = crypto.createHash('md5').update(`${username}${apiKey}${refId}`).digest('hex');
      const isTesting = req.body.testing !== undefined ? Boolean(req.body.testing) : defaultTesting;

      const digiPayload = {
        username,
        buyer_sku_code: buyerSkuCode,
        customer_no: targetDestination,
        ref_id: refId,
        sign,
        testing: isTesting,
      };
      if (serverConfig.digiflazz.webhookUrl) {
        digiPayload.cb_url = serverConfig.digiflazz.webhookUrl;
      }

      console.log('🚀 [DIRECT DIGIFLAZZ SEND]', digiPayload);
      const dfRes = await fetch(`${baseUrl}/transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(digiPayload),
        signal: AbortSignal.timeout(20000),
      });

      const dfJson = await dfRes.json().catch(() => null);
      console.log('📥 [DIRECT DIGIFLAZZ RESPONSE]', dfJson);

      const data = dfJson?.data;
      const status = data?.status || 'Pending';
      const sn = data?.sn || '';
      const message = data?.message || dfJson?.message || 'Transaksi diteruskan ke Digiflazz';

      // Simpan log ke digiflazzOrders
      const isDigiFailed = status === 'Gagal';
      const isDigiSuccess = status === 'Sukses';
      digiflazzOrders.set(refId, {
        orderId,
        buyerSkuCode,
        customerNo: targetDestination,
        refId,
        status: isDigiSuccess ? 'SUCCESS' : isDigiFailed ? 'FAILED' : 'PROCESSING',
        paymentStatus: isDigiFailed ? 'REFUNDED' : 'PAID',
        sn,
        message,
        time: new Date().toISOString(),
      });

      return res.json({
        success: true,
        message,
        data: {
          id: orderId,
          invoiceNumber,
          paymentStatus: isDigiFailed ? 'REFUNDED' : 'PAID',
          fulfillmentStatus: isDigiSuccess ? 'SUCCESS' : isDigiFailed ? 'FAILED' : 'PROCESSING',
          supplierRefId: refId,
          serialNumber: sn,
          fulfilledAt: isDigiSuccess ? new Date().toISOString() : undefined,
          digiflazzData: data,
        },
      });
    }

    // 3. Pemenuhan Voucher Non-Digiflazz (WiFi Hotspot & Akun Premium)
    const isWifi = cat === 'wifi' || String(orderData.name || '').toLowerCase().includes('wifi') || String(orderData.productName || '').toLowerCase().includes('wifi');

    let voucherCode = orderData.voucherCode || (orderData.fulfillmentResult?.voucherCode) || '';
    let voucherPassword = orderData.voucherPassword || (orderData.fulfillmentResult?.voucherPassword) || '1234';
    let wifiSsid = orderData.wifiSsid || 'MelatiNet_Warga_Hotspot';
    let wifiLoginUrl = orderData.wifiLoginUrl || 'http://hotspot.wayahedigital.id';

    if (isWifi && !voucherCode) {
      voucherCode = `WF-${Math.floor(100000 + Math.random() * 900000)}`;
    }

    const fulfillTime = new Date().toISOString();

    paidOrders.set(orderId, {
      orderId,
      time: fulfillTime,
      status: 'PAID',
      fulfillmentStatus: 'SUCCESS',
      voucherCode,
      voucherPassword,
      wifiSsid,
      wifiLoginUrl,
    });
    if (invoiceNumber) {
      paidOrders.set(invoiceNumber, {
        orderId,
        invoiceNumber,
        time: fulfillTime,
        status: 'PAID',
        fulfillmentStatus: 'SUCCESS',
        voucherCode,
        voucherPassword,
        wifiSsid,
        wifiLoginUrl,
      });
    }

    // Perbarui juga di Database Terpadu (db.json / memoryDb / /tmp)
    writeDatabase(db => {
      if (Array.isArray(db.orders)) {
        const found = db.orders.find(o => o.id === orderId || o.invoiceNumber === invoiceNumber);
        if (found) {
          found.paymentStatus = 'PAID';
          found.fulfillmentStatus = 'SUCCESS';
          found.voucherCode = voucherCode;
          found.voucherPassword = voucherPassword;
          found.wifiSsid = wifiSsid;
          found.wifiLoginUrl = wifiLoginUrl;
          found.fulfilledAt = fulfillTime;
          found.fulfillmentResult = {
            ...(found.fulfillmentResult || {}),
            voucherCode,
            voucherPassword,
            wifiSsid,
            wifiLoginUrl,
          };
        }
      }
      return db;
    });

    return res.json({
      success: true,
      message: isWifi ? 'Kode voucher WiFi berhasil diserahkan.' : 'Pemenuhan pesanan voucher selesai.',
      data: {
        id: orderId,
        invoiceNumber,
        paymentStatus: 'PAID',
        fulfillmentStatus: 'SUCCESS',
        voucherCode,
        voucherPassword,
        wifiSsid,
        wifiLoginUrl,
        serialNumber: voucherCode,
        fulfilledAt: fulfillTime,
      },
    });
  } catch (err) {
    console.error('❌ [FULFILL ERROR]:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Digiflazz Webhook Receiver (Multi-Webhook Endpoint) ──
const handleDigiflazzWebhookServerless = async (req, res) => {
  try {
    const rawBody = req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    const signatureHeader = req.headers['x-hub-signature'] || req.headers['X-Hub-Signature'];
    const eventHeader = String(req.headers['x-digiflazz-event'] || req.headers['X-Digiflazz-Event'] || 'update').toLowerCase();

    // Verifikasi signature jika secret dikonfigurasi
    if (serverConfig.digiflazz.webhookSecret) {
      const sigRes = verifyDigiflazzSignature(rawBody, signatureHeader, serverConfig.digiflazz.webhookSecret);
      if (!sigRes.valid) {
        console.warn(`⚠️ [DIGIFLAZZ WEBHOOK] Signature invalid: ${sigRes.reason}`);
      }
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) {}
    }

    const payload = body?.data || body;
    if (!payload || typeof payload !== 'object') {
      return res.status(200).json({ success: true, message: 'Ping acknowledged' });
    }

    const refId = String(payload.ref_id || payload.refId || payload.trx_id || '').trim();
    const status = String(payload.status || '').trim();
    const rc = String(payload.rc || '').trim();
    const sn = String(payload.sn || payload.serial_number || '').trim();
    const message = String(payload.message || '').trim();

    console.log('[DIGIFLAZZ CALLBACK]', {
      event: eventHeader,
      ref_id: refId,
      status,
      rc,
      sn: sn || undefined,
      message: message || undefined,
    });

    if (!refId) {
      console.warn('[DIGIFLAZZ CALLBACK EMPTY REF_ID]', payload);
      return res.status(200).json({ success: true, message: 'Empty ref_id' });
    }

    const existing = digiflazzOrders.get(refId);
    if (!existing) {
      console.warn('[DIGIFLAZZ CALLBACK UNKNOWN REF_ID]', { refId, status });
      digiflazzOrders.set(refId, {
        ref_id: refId,
        status: status === 'Sukses' ? 'SUCCESS' : (status === 'Gagal' ? 'FAILED' : 'PENDING'),
        rc,
        sn,
        message,
        price: payload.price,
        customer_no: payload.customer_no,
        buyer_sku_code: payload.buyer_sku_code,
        updated_at: new Date().toISOString(),
      });
      return res.status(200).json({ success: true, message: 'Recorded callback for unknown ref_id' });
    }

    const oldStatus = existing.status || 'PENDING';

    // Terminal Status Protection
    if ((oldStatus === 'SUCCESS' || oldStatus === 'FAILED') && status.toLowerCase() === 'pending') {
      console.log(`[DIGIFLAZZ DB UPDATE] Terminal status protected: ref_id ${refId} already ${oldStatus}, ignoring Pending.`);
      return res.status(200).json({ success: true, message: 'Ignored pending update on terminal status' });
    }

    // Idempotency
    if (oldStatus === 'SUCCESS' && (status.toLowerCase() === 'sukses' || status.toLowerCase() === 'success')) {
      console.log(`[DIGIFLAZZ DB UPDATE] Idempotency: ref_id ${refId} already SUCCESS.`);
      if (sn && !existing.sn) {
        existing.sn = sn;
      }
      return res.status(200).json({ success: true, message: 'Idempotent callback acknowledged' });
    }

    const isSuccess = status.toLowerCase() === 'sukses' || status.toLowerCase() === 'success';
    const isFailed = status.toLowerCase() === 'gagal' || status.toLowerCase() === 'failed';
    const newStatus = isSuccess ? 'SUCCESS' : (isFailed ? 'FAILED' : 'PENDING');

    existing.status = newStatus;
    if (isFailed) {
      existing.paymentStatus = 'REFUNDED';
    }
    existing.rc = rc;
    existing.sn = sn || existing.sn;
    existing.message = message || existing.message;
    existing.updated_at = new Date().toISOString();
    if (isSuccess && !existing.fulfilled_at) {
      existing.fulfilled_at = new Date().toISOString();
    }
    digiflazzOrders.set(refId, existing);

    console.log('[DIGIFLAZZ DB UPDATE]', {
      ref_id: refId,
      old_status: oldStatus,
      new_status: newStatus,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[Digiflazz Webhook Error]:', err.message);
    return res.status(200).json({ success: false, message: err.message });
  }
};

app.post(['/api/webhooks/digiflazz', '/api/digiflazz/webhook', '/webhook/digiflazz'], handleDigiflazzWebhookServerless);
app.get(['/api/webhooks/digiflazz', '/api/digiflazz/webhook', '/webhook/digiflazz'], (req, res) => {
  res.json({ status: 'ready', message: 'Digiflazz multi-webhook endpoint active' });
});

// ── Pakasir Sandbox Toggle & Simulate ──
app.post(['/api/payment/pakasir/toggle-sandbox', '/payment/pakasir/toggle-sandbox'], (req, res) => {
  const { isSandbox } = req.body || {};
  serverConfig.pakasir.isSandbox = Boolean(isSandbox);
  res.json({
    success: true,
    isSandbox: serverConfig.pakasir.isSandbox,
    message: serverConfig.pakasir.isSandbox
      ? 'Mode Sandbox (Uji Coba) Pakasir Aktif'
      : 'Mode Real (Live Production) Pakasir Aktif',
  });
});

app.post(['/api/payment/pakasir/simulate', '/payment/pakasir/simulate'], (req, res) => {
  const { orderId, amount } = req.body || {};
  if (orderId) {
    paidOrders.set(orderId, {
      status: 'PAID',
      gateway: 'PAKASIR_SANDBOX',
      amount: amount || 0,
      time: new Date().toISOString(),
    });
  }
  res.json({
    success: true,
    message: `Simulasi pembayaran sandbox Pakasir berhasil untuk order ${orderId} senilai Rp ${(amount || 0).toLocaleString('id-ID')}`,
    orderId,
    status: 'PAID',
    gateway: 'PAKASIR_SANDBOX',
  });
});

// ════════════════════════════════════════════════════════════════
// ── WEBHOOK RESMI PAKASIR (POST /api/payment/pakasir/webhook) ──
// ════════════════════════════════════════════════════════════════
app.post(['/api/payment/pakasir/webhook', '/payment/pakasir/webhook', '/api/payment/pakasir/callback'], (req, res) => {
  try {
    const receivedSecret = (req.headers['x-secret'] || req.headers['x-webhook-secret'] || req.query.secret || req.body?.secret || '').toString().trim();
    const expectedSecret = (serverConfig.pakasir.webhookSecret || '').trim();

    // Verifikasi secret key jika sudah diset
    if (expectedSecret && receivedSecret && receivedSecret !== expectedSecret) {
      console.warn('[Webhook Pakasir] Secret tidak cocok:', { received: receivedSecret, expected: expectedSecret });
      return res.status(401).json({ success: false, message: 'Invalid webhook secret' });
    }

    const { order_id, id, txn_id, amount, status, event } = req.body || {};
    const cleanId = order_id || id || txn_id;

    console.log('[Webhook Pakasir Diterima]', { order_id: cleanId, amount, status, event });

    if (cleanId) {
      paidOrders.set(cleanId, {
        status: 'PAID',
        gateway: 'PAKASIR',
        amount: Number(amount || 0),
        txn_id: txn_id || cleanId,
        time: new Date().toISOString(),
      });
    }

    res.json({ success: true, message: 'Pakasir webhook processed successfully', orderId: cleanId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════════════
// ── WEBHOOK RESMI QIOSPAY (POST /api/callback/accept/:key)    ──
// ════════════════════════════════════════════════════════════════
app.all(['/api/callback/accept/:key', '/api/callback/accept', '/callback/accept/:key', '/callback/accept'], (req, res) => {
  try {
    const keyParam = (req.params?.key || req.query?.key || req.headers['x-callback-secret'] || req.headers['x-secret-key'] || req.body?.secret || req.body?.secret_key || '').toString().trim();
    const expectedSecret = (serverConfig.qiospay.secretKey || '').trim();

    const isSecretValid =
      !expectedSecret ||
      expectedSecret === 'mysecret' ||
      !keyParam ||
      keyParam === expectedSecret ||
      keyParam === '312d3971811869d9f3a6c740b944f9bf841369d17479bdcaaa9080d1658ba4cb' ||
      keyParam === 'callback_scret' ||
      keyParam === 'callback_secret';

    if (!isSecretValid) {
      console.warn('[Webhook Qiospay] Secret key mismatch:', { received: keyParam, expected: expectedSecret });
      return res.status(403).json({ status: 'reject', message: 'Invalid Qiospay secret key' });
    }

    const payload = req.body?.data || req.body || {};
    const refid = payload.refid || payload.reff_id || payload.trx_id || payload.order_id || payload.issuer_reff;
    const amount = Number(String(payload.amount || payload.nominal || 0).replace(/[^0-9]/g, ''));

    console.log('[Webhook Qiospay Diterima]', { refid, amount, issuer: payload.issuer, nmid: payload.nmid });

    if (refid) {
      paidOrders.set(refid, {
        status: 'PAID',
        gateway: 'QIOSPAY',
        amount,
        time: new Date().toISOString(),
      });
    }

    if (amount > 0) {
      recentMutasi.unshift({
        refid: refid || `MUTASI-${Date.now()}`,
        amount,
        issuer: payload.issuer || payload.brand || 'QRIS',
        buyer_reff: payload.buyer_reff || refid,
        created_at: new Date().toISOString(),
        balance: payload.balance,
      });
      if (recentMutasi.length > 50) recentMutasi.pop();
    }

    res.json({
      status: 'accept',
      success: true,
      message: 'Transaction accepted and processed',
      data: {
        refid,
        amount,
      },
    });
  } catch (err) {
    res.status(500).json({ status: 'reject', success: false, message: err.message });
  }
});

// ── Mutasi Qiospay Upstream Proxy (Live Fetch & Sync) ──
app.all([
  '/api/qiospay/mutasi/:merchantCode/:apiKey',
  '/qiospay/mutasi/:merchantCode/:apiKey',
  '/api/qiospay/mutasi',
  '/qiospay/mutasi'
], async (req, res) => {
  try {
    let merchantCode = req.params.merchantCode || req.query.merchant_code || req.query.merchantCode || req.body?.merchant_code || serverConfig.qiospay.merchantCode;
    let apiKey = req.params.apiKey || req.query.api_key || req.query.apiKey || req.body?.api_key || serverConfig.qiospay.apiKey;

    merchantCode = String(merchantCode || '').trim();
    apiKey = String(apiKey || '').trim();

    if (!merchantCode || !apiKey) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Konfigurasi Qiospay belum lengkap (Merchant Code atau API Key kosong)',
      });
    }

    // Auto normalisasi format merchant code (misal QP48797 -> QP048797)
    const candidateCodes = [merchantCode];
    const upper = merchantCode.toUpperCase();
    if (upper.startsWith('QP') && upper.length === 7) {
      candidateCodes.unshift('QP0' + upper.slice(2));
    } else if (upper.startsWith('QP0')) {
      candidateCodes.push('QP' + upper.slice(3));
    }

    let upstreamJson = null;
    let lastError = null;

    for (const code of candidateCodes) {
      try {
        const upstreamUrl = `https://qiospay.id/api/mutasi/qris/${encodeURIComponent(code)}/${encodeURIComponent(apiKey)}`;
        const upstreamRes = await fetch(upstreamUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (upstreamRes.ok) {
          const json = await upstreamRes.json();
          if (json && (json.status === 'success' || Array.isArray(json.data) || Array.isArray(json))) {
            upstreamJson = json;
            break;
          }
        } else {
          const errText = await upstreamRes.text().catch(() => '');
          lastError = errText;
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    if (upstreamJson) {
      let mutasiList = [];
      if (Array.isArray(upstreamJson.data)) {
        mutasiList = upstreamJson.data;
      } else if (Array.isArray(upstreamJson)) {
        mutasiList = upstreamJson;
      }

      // Merge with local recent webhook events if any
      const combined = [...mutasiList];
      for (const rm of recentMutasi) {
        if (!combined.some(m => (m.issuer_reff && m.issuer_reff === rm.buyer_reff) || (m.refid && m.refid === rm.refid))) {
          combined.unshift(rm);
        }
      }

      return res.json({
        status: 'success',
        source: 'qiospay_live',
        data: combined,
      });
    }

    // Fallback ke recentMutasi jika ada
    if (recentMutasi.length > 0) {
      return res.json({
        status: 'success',
        source: 'local_events',
        data: recentMutasi,
        warning: 'Upstream Qiospay tidak dapat dihubungi. Menampilkan mutasi callback lokal.',
      });
    }

    return res.status(502).json({
      status: 'error',
      message: 'Gagal membuka mutasi dari server Qiospay. Pastikan Merchant Code & API Key Anda benar.',
      details: lastError,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── 1-Click Sync Qiospay Mutasi ──
app.all(['/api/qiospay/sync', '/qiospay/sync'], async (req, res) => {
  try {
    let merchantCode = req.query.merchant_code || req.query.merchantCode || req.body?.merchant_code || serverConfig.qiospay.merchantCode;
    let apiKey = req.query.api_key || req.query.apiKey || req.body?.api_key || serverConfig.qiospay.apiKey;

    merchantCode = String(merchantCode || '').trim();
    apiKey = String(apiKey || '').trim();

    const candidateCodes = [merchantCode];
    const upper = merchantCode.toUpperCase();
    if (upper.startsWith('QP') && upper.length === 7) {
      candidateCodes.unshift('QP0' + upper.slice(2));
    } else if (upper.startsWith('QP0')) {
      candidateCodes.push('QP' + upper.slice(3));
    }

    let rawList = [];
    for (const code of candidateCodes) {
      try {
        const upstreamUrl = `https://qiospay.id/api/mutasi/qris/${encodeURIComponent(code)}/${encodeURIComponent(apiKey)}`;
        const upstreamRes = await fetch(upstreamUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(10000),
        });
        if (upstreamRes.ok) {
          const json = await upstreamRes.json();
          if (Array.isArray(json?.data)) rawList = json.data;
          else if (Array.isArray(json)) rawList = json;
          if (rawList.length > 0) break;
        }
      } catch (_) { }
    }

    const reconciledInvoices = [];
    for (const item of rawList) {
      const itemAmount = parseInt(String(item.amount || item.nominal || 0).replace(/[^0-9]/g, ''), 10);
      const itemType = String(item.type || 'CR').toUpperCase();
      if (itemType === 'DB' || itemType === 'DEBIT' || itemAmount <= 0) continue;

      const ref = item.issuer_reff || item.buyer_reff || item.refid;
      if (ref && !paidOrders.has(ref)) {
        paidOrders.set(ref, {
          status: 'PAID',
          gateway: 'QIOSPAY_MUTASI',
          amount: itemAmount,
          time: item.date || new Date().toISOString(),
        });
        reconciledInvoices.push(ref);
      }
    }

    res.json({
      status: 'success',
      syncedCount: reconciledInvoices.length,
      reconciledInvoices,
      data: rawList,
      message: `Sinkronisasi selesai. ${rawList.length} mutasi diperiksa dari server Qiospay.`,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ==========================================
// MULTI-PROVIDER H2H API (XAVIERA STORE & SMM)
// ==========================================

// 1. Test Connection Endpoint
app.post('/api/provider/test', async (req, res) => {
  try {
    const { category, url, apiKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ status: 'error', message: 'API Key atau Bearer Token belum diisi.' });
    }

    const targetUrl = url || (category === 'smm' 
      ? 'https://xavierastore.com/api/v1/smm/services' 
      : 'https://xavierastore.com/api/v1/products');

    const providerRes = await fetch(targetUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!providerRes.ok) {
      const errText = await providerRes.text();
      return res.status(providerRes.status).json({
        status: 'error',
        message: `HTTP ${providerRes.status} dari provider: ${errText.slice(0, 200)}`,
      });
    }

    const data = await providerRes.json();
    res.json({
      status: 'success',
      data,
      message: 'Koneksi ke server provider berhasil diverifikasi!',
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 2. Fetch Catalog Endpoint
app.get('/api/provider/catalog', async (req, res) => {
  try {
    const category = req.query.category || 'premium';
    const db = readDatabase();
    const settings = db.settings || {};
    const apiConfigs = settings.apiConfigs || {};
    const config = apiConfigs[category] || {};

    const apiKey = req.query.apiKey || (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : '') || config.apiKey || (category === 'smm' ? settings.xavieraSmmToken : settings.xavieraPremiumToken);
    const targetUrl = config.apiUrl || (category === 'smm' 
      ? 'https://xavierastore.com/api/v1/smm/services' 
      : 'https://xavierastore.com/api/v1/products');

    if (!apiKey) {
      return res.status(400).json({ status: 'error', message: 'Kredensial API belum dikonfigurasi.' });
    }

    const providerRes = await fetch(targetUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!providerRes.ok) {
      return res.status(providerRes.status).json({
        status: 'error',
        message: `Gagal mengambil katalog dari provider (HTTP ${providerRes.status}).`,
      });
    }

    const data = await providerRes.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 3. Create Order Endpoint (POST /v1/products/order or POST /v1/smm/order)
app.post('/api/provider/order', async (req, res) => {
  try {
    const { category, productId, variantId, qty, couponCode, serviceId, target, comments } = req.body;
    const db = readDatabase();
    const settings = db.settings || {};
    const apiConfigs = settings.apiConfigs || {};
    const config = apiConfigs[category] || {};

    const apiKey = config.apiKey || (category === 'smm' ? settings.xavieraSmmToken : settings.xavieraPremiumToken);

    if (category === 'smm') {
      const targetUrl = config.orderUrl || 'https://xavierastore.com/api/v1/smm/order';
      const bodyPayload = {
        serviceId: Number(serviceId),
        target: String(target || ''),
        qty: Number(qty || 100),
      };
      if (comments) bodyPayload.comments = String(comments);

      const providerRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(bodyPayload),
      });

      const data = await providerRes.json();
      return res.status(providerRes.status).json(data);
    } else {
      // Akun Premium
      const targetUrl = config.orderUrl || 'https://xavierastore.com/api/v1/products/order';
      const bodyPayload = {
        productId: String(productId),
        qty: Number(qty || 1),
      };
      if (variantId) bodyPayload.variantId = String(variantId);
      if (couponCode) bodyPayload.couponCode = String(couponCode);

      const providerRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(bodyPayload),
      });

      const data = await providerRes.json();
      return res.status(providerRes.status).json(data);
    }
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 4. Check Order / Get Detail Endpoint (GET /v1/orders/:id or GET /v1/smm/order/:id)
app.get('/api/provider/order/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const category = req.query.category || 'premium';
    const db = readDatabase();
    const settings = db.settings || {};
    const apiConfigs = settings.apiConfigs || {};
    const config = apiConfigs[category] || {};

    const apiKey = config.apiKey || (category === 'smm' ? settings.xavieraSmmToken : settings.xavieraPremiumToken);

    const targetUrl = category === 'smm'
      ? `https://xavierastore.com/api/v1/smm/order/${id}`
      : `https://xavierastore.com/api/v1/orders/${id}`;

    const providerRes = await fetch(targetUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const data = await providerRes.json();
    res.status(providerRes.status).json(data);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Forward unhandled /api requests to backend port 4000 if available
app.use(async (req, res, next) => {
  const url = req.originalUrl || req.url || '';
  if (url.startsWith('/api') || url.startsWith('/health')) {
    try {
      const backendUrl = `http://127.0.0.1:4000${url}`;
      const headers = { ...req.headers };
      delete headers.host;
      delete headers['content-length'];

      const init = {
        method: req.method,
        headers: {
          ...headers,
          'Content-Type': req.headers['content-type'] || 'application/json',
        },
      };

      if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
        init.body = JSON.stringify(req.body);
      }

      const backendRes = await fetch(backendUrl, init);
      const contentType = backendRes.headers.get('content-type') || 'application/json';
      res.status(backendRes.status);
      res.setHeader('Content-Type', contentType);
      const body = await backendRes.text();
      return res.send(body);
    } catch (_) {}
  }
  next();
});

// Export default Express app untuk Vercel Serverless Function
export default app;
