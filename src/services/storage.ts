import { 
  Order, 
  Product, 
  WifiVoucherItem, 
  WifiVoucherBatch,
  AppSettings,
  AdminAuthSession,
  PromoBanner,
  PromoCode, 
  User, 
  AuditLog, 
  PaymentStatus, 
  FulfillmentStatus,
  StoreCatalog,
  DiscountPopupConfig,
  RegisteredMemberAccount
} from '../types';
import { 
  INITIAL_PRODUCTS, 
  INITIAL_ORDERS, 
  INITIAL_PROMOS, 
  INITIAL_WIFI_VOUCHERS 
} from '../data/mockData';

const STORAGE_KEYS = {
  PRODUCTS: 'wd_products_v1',
  ORDERS: 'wd_orders_v1',
  PROMOS: 'wd_promos_v1',
  WIFI_VOUCHERS: 'wd_wifi_vouchers_v1',
  WIFI_BATCHES: 'wd_wifi_batches_v1',
  USER: 'wd_user_session_v1',
  AUDIT_LOGS: 'wd_audit_logs_v1',
  ADMIN_SETTINGS: 'wd_admin_settings_v1',
  ADMIN_AUTH: 'wd_admin_auth_session_v1',
  BANNERS: 'wd_promo_banners_v1',
  CATALOGS: 'wd_store_catalogs_v1',
  REGISTERED_MEMBERS: 'wd_registered_members_v1',
};

export const INITIAL_CATALOGS: StoreCatalog[] = [
  {
    id: 'wifi',
    title: 'Voucher WiFi',
    subtitle: 'Hotspot RT/RW Net',
    description: 'Voucher internet hotspot warga stabil, hemat & login otomatis tanpa kuota',
    iconType: 'wifi',
    iconUrl: '',
    targetTab: 'wifi',
    badge: 'Hotspot Desa',
    isActive: true,
  },
  {
    id: 'pulsa-kuota',
    title: 'Pulsa & Kuota',
    subtitle: 'Semua Operator',
    description: 'Isi ulang pulsa reguler & kuota internet semua operator Indonesia otomatis 24 jam',
    iconType: 'smartphone',
    iconUrl: '',
    targetTab: 'pulsa',
    badge: 'Instan 24 Jam',
    isActive: true,
  },
  {
    id: 'game',
    title: 'Top Up Game',
    subtitle: 'Diamond & Voucher',
    description: 'Diamond Mobile Legends, Free Fire, UC PUBG dan voucher game favorit diproses kilat',
    iconType: 'gamepad',
    iconUrl: '',
    targetTab: 'pulsa',
    badge: 'Top Up Kilat',
    isActive: true,
  },
];

export const INITIAL_BANNERS: PromoBanner[] = [
  {
    id: 'banner-cyber-drop',
    badge: '🔥 CYBER DROP DEALS',
    tagline: 'Flash deals diskon s/d 50%',
    title: 'MEGA CYBER DROP',
    subtitle: 'Flash deals diskon s/d 50% & 2x Double NEXA Points untuk game favorit dan paket internet malam ini.',
    ctaText: 'Klaim Sekarang',
    ctaCategory: 'game',
    secondaryCtaText: 'Lacak Pesanan',
    secondaryCtaAction: 'transaksi',
    imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
    imageTag: '🔥 MEGA CYBER DROP',
    accentColor: '#00F5D4',
    isActive: true,
    order: 1,
  },
  {
    id: 'banner-game',
    badge: 'FESTIVAL TOP UP KILAT',
    tagline: 'Garansi 100% Legal & Aman',
    title: 'Top Up Game & Diamond Kilat',
    subtitle: 'Diskon Spesial Diamond Mobile Legends, Free Fire, PUBG & Steam Wallet. Proses otomatis 5-15 detik!',
    ctaText: 'Serbu Promo Game',
    ctaCategory: 'game',
    secondaryCtaText: 'Lacak Pesanan',
    secondaryCtaAction: 'transaksi',
    imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
    imageTag: '🎮 MLBB • FF • PUBG • VALORANT',
    accentColor: '#8B5CF6',
    isActive: true,
    order: 2,
  },
  {
    id: 'banner-kuota',
    badge: 'HARGA AGEN DISTRIBUTOR',
    tagline: 'Koneksi Lancar Kerja & Hiburan',
    title: 'Paket Data Kuota Sakti 24 Jam',
    subtitle: 'Telkomsel, Indosat Ooredoo, XL Axiata, Tri & Smartfren bebas FUP tanpa pembagian waktu malam.',
    ctaText: 'Isi Kuota Sekarang',
    ctaCategory: 'kuota',
    secondaryCtaText: 'Lacak Pesanan',
    secondaryCtaAction: 'transaksi',
    imageUrl: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=1200&q=80',
    imageTag: '📱 TSEL • INDOSAT • XL • AXIS • TRI',
    accentColor: '#FFB800',
    isActive: true,
    order: 3,
  },
  {
    id: 'banner-wifi',
    badge: 'INTERNET MERAKYAT',
    tagline: 'Kolaborasi Mitra Pengusaha Lokal',
    title: 'Voucher WiFi RT/RW Net Desa',
    subtitle: 'Akses hotspot warga berkecepatan tinggi tanpa batasan kuota, mulai Rp 2.000 / hari. Langsung aktif!',
    ctaText: 'Pilih Lokasi WiFi',
    ctaCategory: 'wifi',
    secondaryCtaText: 'Lacak Pesanan',
    secondaryCtaAction: 'transaksi',
    imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=80',
    imageTag: '📡 VOUCHER WIFI RT/RW NET',
    accentColor: '#00F5D4',
    isActive: true,
    order: 4,
  },
];

export const DEFAULT_DISCOUNT_POPUP: DiscountPopupConfig = {
  isEnabled: true,
  targetAudience: 'NEW_MEMBER',
  title: 'Diskon Spesial Pengguna & Member Baru!',
  tagline: '🎉 Promo Selamat Datang Eksklusif',
  description: 'Daftar & checkout sekarang! Dapatkan potongan langsung Rp 5.000 untuk seluruh voucher WiFi, paket data kuota, dan voucher game.',
  promoCode: 'MEMBERBARU',
  discountAmount: 5000,
  bannerUrl: 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?auto=format&fit=crop&w=800&q=80',
  badgeText: 'HEMAT RP 5.000',
};

const DEFAULT_SETTINGS: AppSettings = {
  siteName: 'WayaheDigital',
  supportWhatsApp: '0812-3456-7890',
  supportEmail: 'bantuan@wayahedigital.id',
  supportHours: 'Setiap Hari, 06:00 - 23:00 WIB',
  
  // Payment Gateway (Default Kredensial Resmi WayaheDigital)
  paymentGatewayProvider: 'QIOSPAY',
  isSandbox: false,
  paymentWebhookUrl: '',
  qiospayMerchantCode: '',
  qiospayApiKey: '',
  qiospaySecretKey: '',
  qiospayNmid: '',
  qiospayMerchantName: 'WAYAHE DIGITAL',
  qiospayQrString: '',
  staticQrisString: '',
  pakasirBaseUrl: 'https://app.pakasir.com',
  pakasirSlug: '',
  pakasirApiKey: '',
  pakasirWebhookSecret: '',
  pakasirPaymentMethod: 'qris',
  pakasirWebhookUrl: '',
  pakasirMerchantName: 'WAYAHE DIGITAL',
  pakasirNmid: '',
  pakasirQrString: '',
  pakasirIsSandbox: true,

  // Digiflazz H2H (API Keys dikelola aman di Backend .env)
  digiflazzWebhookUrl: '',
  digiflazzUser: '',
  digiflazzUsername: '',
  digiflazzProductionKey: '',
  digiflazzApiKey: '',
  digiflazzSecretCode: '',
  digiflazzWebhookSecret: '',
  digiflazzWhitelistIp: '',
  digiflazzMode: 'DEVELOPMENT',
  digiflazzAutoFulfill: true,

  // Bot & Automation Notifications (Dikelola aman di Backend .env)
  telegramBotToken: '',
  telegramChatId: '',
  telegramAlertsEnabled: true,
  whatsappBotApiKey: '',
  whatsappAlertsEnabled: false,
  lowStockThreshold: 5,

  // Admin Authentication Credentials (Dapat diubah di Pengaturan Admin)
  adminUsername: 'admin',
  adminPassword: 'admin123',
  adminName: 'Bahrul Ulum',

  // Website Logo
  logoUrl: '',

  // Ngrok Webhooks Tunnel
  ngrokAuthtoken: '',
  ngrokDomain: '',
  ngrokPublicUrl: '',

  // Supabase Database Connection Settings
  supabaseUrl: '',
  supabasePublishableKey: '',
  supabaseSecretKey: '',
  supabaseAnonKey: '',
  supabaseServiceRoleKey: '',
  supabaseDbUrl: '',

  // MongoDB Database Connection Settings (Legacy / Fallback)
  mongodbUri: '',
  mongodbDbName: '',
  mongodbDbNameTrans: '',

  // Popup Diskon & Promo
  discountPopup: DEFAULT_DISCOUNT_POPUP,

  // Status ON/OFF per Kategori Produk (Default Semua Aktif / ON)
  categoryStatus: {
    pulsa: true,
    kuota: true,
    game: true,
    premium: true,
    wifi: true,
    smm: true,
    gateway_tambahan: true,
    pln: true,
  },
};

const INITIAL_BATCHES: WifiVoucherBatch[] = [];

function notifyStorageSynced() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wayahe_storage_synced'));
  }
}

async function fetchWithTimeout(url: string, options?: RequestInit, timeoutMs = 2500): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

function getAdminHeaders(): Record<string, string> {
  const tok = (import.meta as any)?.env?.VITE_ADMIN_TOKEN as string | undefined;
  return tok ? { 'X-Admin-Token': tok.trim() } : {};
}

function withAdminHeaders(opts?: RequestInit): RequestInit | undefined {
  if (!opts) return undefined;
  const h = getAdminHeaders();
  if (!Object.keys(h).length) return opts;
  const cur = (opts.headers || {}) as Record<string, string>;
  return { ...opts, headers: { ...cur, ...h } };
}

async function fetchWithFallback(endpoint: string, options?: RequestInit): Promise<Response> {
  const opts = withAdminHeaders(options);
  // 1. Try relative path (Vite proxy / standard deployment / Vercel Serverless) with short 2.5s timeout
  try {
    const res = await fetchWithTimeout(endpoint, opts, 2500);
    const contentType = res.headers.get('content-type') || '';
    // Jika response HTML (misal index.html dari rewrite Vercel), jangan gunakan sebagai response API
    if (!contentType.includes('text/html') && (res.ok || res.status < 500)) {
      return res;
    }
  } catch (_) {}

  // 2. Try direct host with port 4000 for LAN/mobile device
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    try {
      const directUrl = `${window.location.protocol}//${window.location.hostname}:4000${endpoint}`;
      const res = await fetchWithTimeout(directUrl, opts, 2000);
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && (res.ok || res.status < 500)) {
        return res;
      }
    } catch (_) {}
  }

  // 3. Fallback to localhost:4000 with 1.5s timeout (hanya jika di local machine)
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    try {
      return await fetchWithTimeout(`http://localhost:4000${endpoint}`, opts, 1500);
    } catch (_) {}
  }

  return new Response(JSON.stringify({ error: 'Backend unreachable' }), { 
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

function pushEntityToBackend(entity: string, data: any) {
  // Run strictly in background without blocking UI
  setTimeout(() => {
    try {
      fetchWithFallback('/api/sync/entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify({ entity, data }),
      }).catch(() => {});
    } catch (_) {}
  }, 10);
}

let syncIntervalStarted = false;

export const isDefaultMockDigiflazz = (p: any): boolean => {
  if (!p) return false;
  if (p.categoryId === 'wifi' || p.categoryId === 'premium') return false;
  // Real synced Digiflazz products are kept!
  if (p.isDigiflazzSynced) return false;
  const id = String(p.id || '');
  const mockPrefixes = ['tsel-', 'isat-', 'xl-', 'axis-', 'tri-', 'smart-', 'data-', 'game-', 'pulsa-'];
  if (mockPrefixes.some(pref => id.startsWith(pref))) return true;
  return false;
};

export const INITIAL_PREMIUM_PRODUCTS: Product[] = [
  // 1. STREAMING
  {
    id: 'prm-netflix-4k',
    categoryId: 'premium',
    digiflazzCategory: 'Streaming',
    provider: 'Netflix',
    name: 'Netflix Premium UHD 4K',
    sku: 'PRM-NETFLIX-4K',
    description: '1 Bulan Ultra HD 4K, 1 Profil Private PIN, Garansi Penuh Anti On-Screen Sharing.',
    supplierPrice: 18000,
    basePrice: 18000,
    sellingPrice: 24500,
    duration: '1 Bulan',
    deliveryMethod: 'MANUAL',
    isActive: true,
    stock: 50,
    badge: '4K UHD',
    iconUrl: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'prm-disney-hotstar',
    categoryId: 'premium',
    digiflazzCategory: 'Streaming',
    provider: 'Disney+ Hotstar',
    name: 'Disney+ Hotstar Premium Max',
    sku: 'PRM-DISNEY-MAX',
    description: 'Akses All Film Marvel, Pixar & Disney, 4K UHD, Audio Dolby Atmos, 1 Akun Private.',
    supplierPrice: 19000,
    basePrice: 19000,
    sellingPrice: 26000,
    duration: '1 Bulan',
    deliveryMethod: 'MANUAL',
    isActive: true,
    stock: 35,
    badge: '4K DOLBY',
    iconUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'prm-viu-vip',
    categoryId: 'premium',
    digiflazzCategory: 'Streaming',
    provider: 'Viu',
    name: 'Viu Premium VIP Total',
    sku: 'PRM-VIU-VIP',
    description: 'Tanpa Iklan, Akses All Drama Asia VIP, Kualitas 1080p FHD, Support TV & Mobile.',
    supplierPrice: 8500,
    basePrice: 8500,
    sellingPrice: 13000,
    duration: '1 Bulan',
    deliveryMethod: 'MANUAL',
    isActive: true,
    stock: 30,
    badge: 'FAMILY SAFE',
    iconUrl: 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'prm-vidio-plat',
    categoryId: 'premium',
    digiflazzCategory: 'Streaming',
    provider: 'Vidio',
    name: 'Vidio Platinum All Screen',
    sku: 'PRM-VIDIO-PLAT',
    description: 'Nonton All Original Series, Drama Korea, Sports, BRI Liga 1, Tanpa Iklan.',
    supplierPrice: 15000,
    basePrice: 15000,
    sellingPrice: 19500,
    duration: '1 Bulan',
    deliveryMethod: 'MANUAL',
    isActive: true,
    stock: 40,
    badge: 'LIGA 1 INDO',
    iconUrl: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'prm-youtube-prem',
    categoryId: 'premium',
    digiflazzCategory: 'Streaming',
    provider: 'YouTube',
    name: 'YouTube Premium Family/Indiv',
    sku: 'PRM-YOUTUBE-PREM',
    description: 'Bebas Iklan Video, Putar di Latar Belakang (PIP), Termasuk YouTube Music Bebas Iklan.',
    supplierPrice: 9000,
    basePrice: 9000,
    sellingPrice: 14500,
    duration: '1 Bulan',
    deliveryMethod: 'MANUAL',
    isActive: true,
    stock: 40,
    badge: 'BEBAS IKLAN',
    iconUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=200&q=80',
  },

  // 2. MUSIK
  {
    id: 'prm-spotify-ind',
    categoryId: 'premium',
    digiflazzCategory: 'Musik',
    provider: 'Spotify',
    name: 'Spotify Individual Premium',
    sku: 'PRM-SPOTIFY-IND',
    description: 'Akun Baru / Perpanjang Resmi, Bebas Iklan, Download Offline Musik & Podcast.',
    supplierPrice: 7000,
    basePrice: 7000,
    sellingPrice: 10900,
    duration: '1 Bulan',
    deliveryMethod: 'MANUAL',
    isActive: true,
    stock: 45,
    badge: 'RESMI',
    iconUrl: 'https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'prm-apple-music',
    categoryId: 'premium',
    digiflazzCategory: 'Musik',
    provider: 'Apple Music',
    name: 'Apple Music Lossless Hi-Fi',
    sku: 'PRM-APPLE-MUSIC',
    description: 'Kualitas Audio Hi-Res Lossless & Spatial Audio Dolby Atmos, Akses 100jt Lagu Bebas Iklan.',
    supplierPrice: 11000,
    basePrice: 11000,
    sellingPrice: 15500,
    duration: '1 Bulan',
    deliveryMethod: 'MANUAL',
    isActive: true,
    stock: 25,
    badge: 'LOSSLESS',
    iconUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=200&q=80',
  },

  // 3. EDITING
  {
    id: 'prm-canva-pro',
    categoryId: 'premium',
    digiflazzCategory: 'Editing',
    provider: 'Canva',
    name: 'Canva Pro Designer Tim',
    sku: 'PRM-CANVA-PRO',
    description: 'Akses 100M+ Elemen & Template, Brand Kit, Hapus Background 1 Klik, Cloud 1TB.',
    supplierPrice: 8000,
    basePrice: 8000,
    sellingPrice: 12000,
    duration: '1 Bulan',
    deliveryMethod: 'MANUAL',
    isActive: true,
    stock: 60,
    badge: 'PRO DESIGN',
    iconUrl: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'prm-capcut-pro',
    categoryId: 'premium',
    digiflazzCategory: 'Editing',
    provider: 'CapCut',
    name: 'CapCut Pro Video Creator',
    sku: 'PRM-CAPCUT-PRO',
    description: 'Buka Semua Efek Pro, Hapus Watermark, Fitur AI Auto Caption & Color Grading Full.',
    supplierPrice: 9500,
    basePrice: 9500,
    sellingPrice: 14000,
    duration: '1 Bulan',
    deliveryMethod: 'MANUAL',
    isActive: true,
    stock: 40,
    badge: 'TRENDING',
    iconUrl: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'prm-lightroom-prem',
    categoryId: 'premium',
    digiflazzCategory: 'Editing',
    provider: 'Adobe Lightroom',
    name: 'Lightroom Premium All Presets',
    sku: 'PRM-LIGHTROOM-PREM',
    description: 'Fitur Selective Edits, Healing Brush, Geometry, All Premium Presets & RAW Editor.',
    supplierPrice: 12000,
    basePrice: 12000,
    sellingPrice: 16500,
    duration: '1 Bulan',
    deliveryMethod: 'MANUAL',
    isActive: true,
    stock: 30,
    badge: 'FOTOGRAFI',
    iconUrl: 'https://images.unsplash.com/photo-1542744094-24638eff58bb?auto=format&fit=crop&w=200&q=80',
  },

  // 4. VPN
  {
    id: 'prm-nord-vpn',
    categoryId: 'premium',
    digiflazzCategory: 'VPN',
    provider: 'NordVPN',
    name: 'NordVPN Premium Ultra Fast',
    sku: 'PRM-NORD-VPN',
    description: 'Server 60+ Negara, Fitur Threat Protection, Anti DNS Leak, Koneksi Super Cepat & Stabil.',
    supplierPrice: 15000,
    basePrice: 15000,
    sellingPrice: 19900,
    duration: '1 Bulan',
    deliveryMethod: 'MANUAL',
    isActive: true,
    stock: 35,
    badge: 'PRIVATE IP',
    iconUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'prm-express-vpn',
    categoryId: 'premium',
    digiflazzCategory: 'VPN',
    provider: 'ExpressVPN',
    name: 'ExpressVPN High Bandwidth',
    sku: 'PRM-EXPRESS-VPN',
    description: 'Protokol Lightway Super Kencang, Akses Global Tanpa Batas, Enkripsi Militer AES-256.',
    supplierPrice: 18000,
    basePrice: 18000,
    sellingPrice: 24000,
    duration: '1 Bulan',
    deliveryMethod: 'MANUAL',
    isActive: true,
    stock: 25,
    badge: 'SPEED TEST 1',
    iconUrl: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=200&q=80',
  },

  // 5. AI & TOOLS / AI
  {
    id: 'prm-chatgpt-plus',
    categoryId: 'premium',
    digiflazzCategory: 'AI & Tools',
    provider: 'ChatGPT',
    name: 'ChatGPT Plus GPT-4o 1 Bln',
    sku: 'PRM-CHATGPT-PLUS',
    description: 'Akses GPT-4o Unlimited, DALL-E 3, Canvas, Code Interpreter & Voice Chat.',
    supplierPrice: 35000,
    basePrice: 35000,
    sellingPrice: 45000,
    duration: '1 Bulan',
    deliveryMethod: 'MANUAL',
    isActive: true,
    stock: 25,
    badge: 'AI PRO',
    iconUrl: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'prm-claude-pro',
    categoryId: 'premium',
    digiflazzCategory: 'AI & Tools',
    provider: 'Claude',
    name: 'Claude Pro Sonnet 3.5 AI',
    sku: 'PRM-CLAUDE-PRO',
    description: 'Anthropic Claude 3.5 Sonnet, 200K Context Window, Fitur Artifacts & Analisis Dokumen.',
    supplierPrice: 38000,
    basePrice: 38000,
    sellingPrice: 48000,
    duration: '1 Bulan',
    deliveryMethod: 'MANUAL',
    isActive: true,
    stock: 20,
    badge: 'SMART AI',
    iconUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&q=80',
  },

  // 6. APLIKASI PREMIUM / AKUN PREMIUM
  {
    id: 'prm-office-365',
    categoryId: 'premium',
    digiflazzCategory: 'Aplikasi Premium',
    provider: 'Microsoft 365',
    name: 'Microsoft 365 + OneDrive 1TB',
    sku: 'PRM-OFFICE-365',
    description: 'Word, Excel, PowerPoint, Outlook Resmi + 1 TB Penyimpanan Cloud OneDrive Aman.',
    supplierPrice: 22000,
    basePrice: 22000,
    sellingPrice: 28500,
    duration: '1 Tahun',
    deliveryMethod: 'MANUAL',
    isActive: true,
    stock: 30,
    badge: 'OFFICE ORIGINAL',
    iconUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'prm-google-one-2tb',
    categoryId: 'premium',
    digiflazzCategory: 'Aplikasi Premium',
    provider: 'Google One',
    name: 'Google One 2TB Cloud Storage',
    sku: 'PRM-GOOGLE-ONE-2TB',
    description: 'Penyimpanan Google Drive, Gmail, & Google Photos 2.000 GB, Legal via Invite Family.',
    supplierPrice: 25000,
    basePrice: 25000,
    sellingPrice: 32000,
    duration: '1 Bulan',
    deliveryMethod: 'MANUAL',
    isActive: true,
    stock: 25,
    badge: 'CLOUD 2TB',
    iconUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=200&q=80',
  },

  // 7. LAINNYA
  {
    id: 'prm-duolingo-super',
    categoryId: 'premium',
    digiflazzCategory: 'Lainnya',
    provider: 'Duolingo',
    name: 'Duolingo Super Unlimited Nyawa',
    sku: 'PRM-DUOLINGO-SUPER',
    description: 'Belajar Bahasa Asing Tanpa Iklan, Heart Unlimited, Latihan Kesalahan Khusus & Tes Kilat.',
    supplierPrice: 7500,
    basePrice: 7500,
    sellingPrice: 11500,
    duration: '1 Bulan',
    deliveryMethod: 'MANUAL',
    isActive: true,
    stock: 45,
    badge: 'EDUKASI',
    iconUrl: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'prm-grammarly-prem',
    categoryId: 'premium',
    digiflazzCategory: 'Lainnya',
    provider: 'Grammarly',
    name: 'Grammarly Premium AI Writing',
    sku: 'PRM-GRAMMARLY-PREM',
    description: 'Pengecekan Grammar Tingkat Lanjut, Tone Detector, Plagiarism Checker, & AI Rewrite.',
    supplierPrice: 14000,
    basePrice: 14000,
    sellingPrice: 18500,
    duration: '1 Bulan',
    deliveryMethod: 'MANUAL',
    isActive: true,
    stock: 30,
    badge: 'PRO WRITER',
    iconUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=200&q=80',
  }
];

export const INITIAL_AI_TOKEN_PRODUCTS: Product[] = [
  {
    id: 'clv-coding-high',
    categoryId: 'gateway_tambahan',
    provider: 'Clouvia Router AI',
    name: 'Clouvia API Key (Model coding-high)',
    sku: 'CLV-CODING-HIGH',
    providerProductId: 'coding-high',
    providerCode: 'clouvia',
    sellerName: 'Clouvia Router Official',
    digiflazzCategory: 'AI Gateway',
    description: 'API Key resmi Clouvia Router (https://router.clouvia.id/v1) khusus model coding-high. Arsitektur teknis super cepat & solutif.',
    supplierPrice: 15000,
    basePrice: 15000,
    sellingPrice: 19900,
    duration: 'Aktif 1 Bulan',
    deliveryMethod: 'AUTOMATIC',
    isActive: true,
    stock: 999,
    badge: 'CODING-HIGH',
    iconUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'clv-token-balance-10',
    categoryId: 'gateway_tambahan',
    provider: 'Clouvia Router AI',
    name: 'Clouvia Router AI $10 Credit',
    sku: 'CLV-TOKEN-10USD',
    providerProductId: 'router-10usd',
    providerCode: 'clouvia',
    sellerName: 'Clouvia Router Official',
    digiflazzCategory: 'AI Gateway',
    description: 'Saldo $10 Clouvia API Router. Akses multi-LLM: coding-high, GPT-4o, Claude 3.5 & DeepSeek via baseURL router.clouvia.id/v1.',
    supplierPrice: 35000,
    basePrice: 35000,
    sellingPrice: 45000,
    duration: 'Aktif 3 Bulan',
    deliveryMethod: 'AUTOMATIC',
    isActive: true,
    stock: 500,
    badge: 'MULTI-LLM',
    iconUrl: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'ai-openai-5usd',
    categoryId: 'premium',
    provider: 'OpenAI',
    name: 'API Key OpenAI $5 Credit',
    sku: 'AI-OAI-5USD',
    description: 'Saldo resmi $5 OpenAI API. Support GPT-4o, GPT-4o-mini, DALL-E 3, Embeddings. Instan aktif.',
    supplierPrice: 20000,
    basePrice: 20000,
    sellingPrice: 25000,
    duration: 'Aktif 3 Bulan',
    deliveryMethod: 'AUTOMATIC',
    isActive: true,
    stock: 99,
    badge: 'GPT-4o',
    iconUrl: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'ai-openai-20usd',
    categoryId: 'premium',
    provider: 'OpenAI',
    name: 'API Key OpenAI $20 Credit',
    sku: 'AI-OAI-20USD',
    description: 'Saldo resmi $20 OpenAI API. Akses GPT-4o rate limit tier 1, siap pakai web/bot.',
    supplierPrice: 75000,
    basePrice: 75000,
    sellingPrice: 89000,
    duration: 'Aktif 3 Bulan',
    deliveryMethod: 'AUTOMATIC',
    isActive: true,
    stock: 50,
    badge: 'BEST SELLER',
    iconUrl: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'ai-claude-10usd',
    categoryId: 'premium',
    provider: 'Claude',
    name: 'API Key Claude 3.5 Sonnet $10',
    sku: 'AI-CLAUDE-10USD',
    description: 'API Key Anthropic Claude 3.5 Sonnet & Haiku. Pemikiran kode & analisis nomor 1 di dunia.',
    supplierPrice: 40000,
    basePrice: 40000,
    sellingPrice: 49000,
    duration: 'Aktif 3 Bulan',
    deliveryMethod: 'AUTOMATIC',
    isActive: true,
    stock: 40,
    badge: 'CLAUDE 3.5',
    iconUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'ai-deepseek-20m',
    categoryId: 'premium',
    provider: 'DeepSeek',
    name: 'DeepSeek R1 / V3 (20 Juta Token)',
    sku: 'AI-DEEPSEEK-20M',
    description: '20.000.000 Token DeepSeek R1 & V3 reasoning model. Super hemat & performa setara o1.',
    supplierPrice: 15000,
    basePrice: 15000,
    sellingPrice: 19500,
    duration: 'Aktif 6 Bulan',
    deliveryMethod: 'AUTOMATIC',
    isActive: true,
    stock: 120,
    badge: 'SUPER HEMAT',
    iconUrl: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'ai-gemini-pro',
    categoryId: 'premium',
    provider: 'Google Gemini',
    name: 'Gemini 1.5 Pro Token Key ($15)',
    sku: 'AI-GEMINI-15USD',
    description: 'API Key Google Gemini 1.5 Pro 2M Context Window & Flash. Super cepat integrasi web app.',
    supplierPrice: 32000,
    basePrice: 32000,
    sellingPrice: 39000,
    duration: 'Aktif 3 Bulan',
    deliveryMethod: 'AUTOMATIC',
    isActive: true,
    stock: 60,
    badge: '2M CONTEXT',
    iconUrl: 'https://images.unsplash.com/photo-1633419461186-7d40a38105ec?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'ai-midjourney-fast',
    categoryId: 'premium',
    provider: 'Midjourney',
    name: 'Midjourney Fast API Key (15 Jam)',
    sku: 'AI-MIDJOURNEY-15H',
    description: 'API Key Midjourney v6.1 Fast GPU. Generate gambar realistis resolusi ultra tinggi via REST API.',
    supplierPrice: 65000,
    basePrice: 65000,
    sellingPrice: 79000,
    duration: 'Aktif 1 Bulan',
    deliveryMethod: 'AUTOMATIC',
    isActive: true,
    stock: 35,
    badge: 'IMAGE AI',
    iconUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=200&q=80',
  }
];

function cleanSupabaseUrl(rawUrl?: string): string {
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

export const storage = {
  // ── CLOUD SYNC INITIALIZER ──
  async initCloudSync(): Promise<void> {
    const performSync = async () => {
      try {
        const res = await fetchWithFallback('/api/sync/state');
        if (!res.ok) return;
        const json = await res.json();
        if (!json.success || !json.data) return;

        const cloud = json.data;
        let hasUpdates = false;

        if (Array.isArray(cloud.products) && cloud.products.length > 0) {
          const cleanedCloud = cloud.products.filter((p: any) => !isDefaultMockDigiflazz(p));
          const current = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
          const next = JSON.stringify(cleanedCloud);
          if (current !== next) {
            localStorage.setItem(STORAGE_KEYS.PRODUCTS, next);
            hasUpdates = true;
          }
        }
        if (Array.isArray(cloud.orders) && cloud.orders.length > 0) {
          const current = localStorage.getItem(STORAGE_KEYS.ORDERS);
          const next = JSON.stringify(cloud.orders);
          if (current !== next) {
            localStorage.setItem(STORAGE_KEYS.ORDERS, next);
            hasUpdates = true;
          }
        }
        if (Array.isArray(cloud.users) && cloud.users.length > 0) {
          const current = localStorage.getItem(STORAGE_KEYS.REGISTERED_MEMBERS);
          const next = JSON.stringify(cloud.users);
          if (current !== next) {
            localStorage.setItem(STORAGE_KEYS.REGISTERED_MEMBERS, next);
            hasUpdates = true;
          }
        }
        if (Array.isArray(cloud.wifiBatches) && cloud.wifiBatches.length > 0) {
          const current = localStorage.getItem(STORAGE_KEYS.WIFI_BATCHES);
          const next = JSON.stringify(cloud.wifiBatches);
          if (current !== next) {
            localStorage.setItem(STORAGE_KEYS.WIFI_BATCHES, next);
            hasUpdates = true;
          }
        }
        if (Array.isArray(cloud.promos) && cloud.promos.length > 0) {
          const current = localStorage.getItem(STORAGE_KEYS.PROMOS);
          const next = JSON.stringify(cloud.promos);
          if (current !== next) {
            localStorage.setItem(STORAGE_KEYS.PROMOS, next);
            hasUpdates = true;
          }
        }
        if (Array.isArray(cloud.banners) && cloud.banners.length > 0) {
          const current = localStorage.getItem(STORAGE_KEYS.BANNERS);
          const next = JSON.stringify(cloud.banners);
          if (current !== next) {
            localStorage.setItem(STORAGE_KEYS.BANNERS, next);
            hasUpdates = true;
          }
        }
        if (Array.isArray(cloud.catalogs) && cloud.catalogs.length > 0) {
          const current = localStorage.getItem(STORAGE_KEYS.CATALOGS);
          const next = JSON.stringify(cloud.catalogs);
          if (current !== next) {
            localStorage.setItem(STORAGE_KEYS.CATALOGS, next);
            hasUpdates = true;
          }
        }
        if (cloud.settings && Object.keys(cloud.settings).length > 0) {
          const curStr = localStorage.getItem(STORAGE_KEYS.ADMIN_SETTINGS);
          const current = curStr ? JSON.parse(curStr) : {};
          const mergedSettings = { ...DEFAULT_SETTINGS, ...current, ...cloud.settings };
          const nextStr = JSON.stringify(mergedSettings);
          if (curStr !== nextStr) {
            localStorage.setItem(STORAGE_KEYS.ADMIN_SETTINGS, nextStr);
            hasUpdates = true;
          }
        }

        if (hasUpdates && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('wayahe_storage_synced'));
        }
      } catch (_) {}
    };

    // Immediate sync on load
    await performSync();

    // Background sync interval (every 30 seconds) to keep devices updated without causing UI flickering
    if (!syncIntervalStarted && typeof window !== 'undefined') {
      syncIntervalStarted = true;
      setInterval(performSync, 30000);
    }
  },

  getProducts(): Product[] {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    const hasPurged = localStorage.getItem('wd_df_defaults_purged_v2');

    const defaultSeed = [...INITIAL_PRODUCTS, ...INITIAL_PREMIUM_PRODUCTS, ...INITIAL_AI_TOKEN_PRODUCTS];

    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(defaultSeed));
      localStorage.setItem('wd_df_defaults_purged_v2', 'true');
      return defaultSeed;
    }
    try {
      let stored: Product[] = JSON.parse(raw);
      
      // Auto-purge default mock Digiflazz products once or when found
      if (!hasPurged || stored.some(isDefaultMockDigiflazz)) {
        stored = stored.filter(p => !isDefaultMockDigiflazz(p));
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(stored));
        localStorage.setItem('wd_df_defaults_purged_v2', 'true');
        pushEntityToBackend('products', stored);
      }

      // Ensure initial premium and AI tokens are present if user hasn't added them yet
      const storedIds = new Set(stored.map(p => p.id));
      const missingDefaults = [...INITIAL_PREMIUM_PRODUCTS, ...INITIAL_AI_TOKEN_PRODUCTS].filter(p => !storedIds.has(p.id));
      if (missingDefaults.length > 0) {
        stored = [...stored, ...missingDefaults];
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(stored));
      }

      const initialMap = new Map(defaultSeed.map(p => [p.id, p]));
      
      // Merge initial stock and digiflazz metadata only if missing in stored items
      const updated = stored.map(p => {
        const init = initialMap.get(p.id);
        const baseCost = p.basePrice !== undefined ? Number(p.basePrice) : (p.supplierPrice !== undefined ? Number(p.supplierPrice) : (init?.supplierPrice ?? 0));
        if (init) {
          return {
            ...init,
            ...p,
            basePrice: baseCost,
            supplierPrice: baseCost,
            stock: p.stock !== undefined ? p.stock : init.stock,
            sellerName: p.sellerName !== undefined ? p.sellerName : init.sellerName,
            digiflazzCategory: p.digiflazzCategory !== undefined ? p.digiflazzCategory : init.digiflazzCategory,
            digiflazzType: p.digiflazzType !== undefined ? p.digiflazzType : init.digiflazzType,
            supplierSku: p.supplierSku !== undefined ? p.supplierSku : init.supplierSku,
          };
        }
        if (p.categoryId === 'wifi') {
          const isMockCode = (c: string) => c.startsWith('WF2H-MLT') || c.startsWith('WF6H-MLT') || c.startsWith('WF24-MLT') || c.startsWith('WF3D-MLT') || c.startsWith('WF7D-MLT');
          let currentCodes = Array.isArray(p.voucherCodes) ? p.voucherCodes : [];
          if (currentCodes.some(isMockCode)) {
            currentCodes = currentCodes.filter(c => !isMockCode(c));
          }
          let currentVariants = p.variants;
          if (Array.isArray(currentVariants)) {
            currentVariants = currentVariants.map(v => {
              const vCodes = Array.isArray(v.voucherCodes) ? v.voucherCodes.filter(c => !isMockCode(c)) : [];
              return { ...v, voucherCodes: vCodes, stock: vCodes.length };
            });
          }
          return {
            ...p,
            basePrice: baseCost,
            supplierPrice: baseCost,
            voucherCodes: currentCodes,
            stock: currentCodes.length,
            variants: currentVariants,
          };
        }

        return {
          ...p,
          basePrice: baseCost,
          supplierPrice: baseCost,
        };
      });

      return updated.filter(p => !isDefaultMockDigiflazz(p));
    } catch {
      return defaultSeed;
    }
  },

  clearDigiflazzProducts(): Product[] {
    const products = this.getProducts();
    const isDfItem = (p: Product) => 
      p.categoryId === 'pulsa' || 
      p.categoryId === 'kuota' || 
      p.categoryId === 'game' || 
      !!p.digiflazzCategory || 
      !!p.sellerName || 
      (p.sku && p.sku.startsWith('DF-'));
    
    const remaining = products.filter(p => !isDfItem(p));
    this.saveProducts(remaining);
    localStorage.setItem('wd_df_defaults_purged_v2', 'true');
    return remaining;
  },

  saveProducts(products: Product[]): void {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    pushEntityToBackend('products', products);
    notifyStorageSynced();
  },

  getOrders(): Order[] {
    const raw = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(INITIAL_ORDERS));
      return INITIAL_ORDERS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_ORDERS;
    }
  },

  saveOrders(orders: Order[]): void {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    pushEntityToBackend('orders', orders);
    notifyStorageSynced();
  },

  deleteOrder(orderId: string): Order[] {
    const orders = this.getOrders().filter(o => o.id !== orderId && o.invoiceNumber !== orderId);
    this.saveOrders(orders);
    return orders;
  },

  deleteOrders(orderIds: string[]): Order[] {
    const set = new Set(orderIds);
    const orders = this.getOrders().filter(o => !set.has(o.id) && !set.has(o.invoiceNumber));
    this.saveOrders(orders);
    return orders;
  },

  getOrderById(orderId: string): Order | undefined {
    const orders = this.getOrders();
    return orders.find(o => o.id === orderId || o.invoiceNumber === orderId);
  },

  getWifiVouchers(): WifiVoucherItem[] {
    const raw = localStorage.getItem(STORAGE_KEYS.WIFI_VOUCHERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.WIFI_VOUCHERS, JSON.stringify([]));
      return [];
    }
    try {
      const parsed: WifiVoucherItem[] = JSON.parse(raw);
      const isMockItem = (v: WifiVoucherItem) =>
        ['v-001', 'v-002', 'v-003', 'v-004', 'v-005'].includes(v.id) ||
        (v.batchName && v.batchName.includes('Sept-1')) ||
        (v.code && (v.code.startsWith('WIFI2-') || v.code.startsWith('WIFI6-') || v.code.startsWith('WIFI24-58210') || v.code.startsWith('WIFI24-33109')));
      
      if (parsed.some(isMockItem)) {
        const clean = parsed.filter(v => !isMockItem(v));
        localStorage.setItem(STORAGE_KEYS.WIFI_VOUCHERS, JSON.stringify(clean));
        return clean;
      }
      return parsed;
    } catch {
      return [];
    }
  },

  saveWifiVouchers(vouchers: WifiVoucherItem[]): void {
    localStorage.setItem(STORAGE_KEYS.WIFI_VOUCHERS, JSON.stringify(vouchers));
    pushEntityToBackend('wifiVouchers', vouchers);
  },

  getPromos(): PromoCode[] {
    const raw = localStorage.getItem(STORAGE_KEYS.PROMOS);
    let list: PromoCode[] = INITIAL_PROMOS;
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PROMOS, JSON.stringify(INITIAL_PROMOS));
      list = INITIAL_PROMOS;
    } else {
      try {
        list = JSON.parse(raw);
      } catch {
        list = INITIAL_PROMOS;
      }
    }

    // Pastikan kode promo dari Pengaturan Popup Diskon otomatis terdaftar & valid di checkout
    try {
      const settings = this.getSettings();
      if (settings.discountPopup?.isEnabled && settings.discountPopup.promoCode) {
        const codeUpper = settings.discountPopup.promoCode.trim().toUpperCase();
        if (codeUpper && !list.some(p => p.code.toUpperCase() === codeUpper)) {
          list = [
            ...list,
            {
              id: 'promo-popup-special',
              code: codeUpper,
              discountAmount: settings.discountPopup.discountAmount || 5000,
              discountPercentage: 0,
              maxDiscount: settings.discountPopup.discountAmount || 5000,
              minTransaction: 5000,
              validUntil: '2030-12-31T23:59:59Z',
              description: settings.discountPopup.title || 'Diskon Spesial Promo',
              isActive: true,
            }
          ];
        }
      }
    } catch {
      // ignore
    }

    return list;
  },

  savePromos(promos: PromoCode[]): void {
    localStorage.setItem(STORAGE_KEYS.PROMOS, JSON.stringify(promos));
    pushEntityToBackend('promos', promos);
    notifyStorageSynced();
  },

  getUser(): User | null {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  saveUser(user: User | null): void {
    if (!user) {
      localStorage.removeItem(STORAGE_KEYS.USER);
    } else {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    }
    notifyStorageSynced();
  },

  getRegisteredMembers(): RegisteredMemberAccount[] {
    const raw = localStorage.getItem(STORAGE_KEYS.REGISTERED_MEMBERS);
    if (!raw) {
      const defaultMembers: RegisteredMemberAccount[] = [
        {
          id: 'usr-member-1',
          username: 'member',
          email: 'member@wayahedigital.id',
          password: 'member123',
          phone: '081234567890',
          name: 'Member Wayahe',
          avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=member',
          memberTier: 'VIP_GOLD',
          balance: 25000,
          rewardPoints: 500,
          isGmailVerified: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'usr-member-2',
          username: 'wayahe',
          email: 'wayahe@gmail.com',
          password: '123456',
          phone: '085712345678',
          name: 'Wayahe Digital',
          avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=wayahe',
          memberTier: 'VIP_GOLD',
          balance: 50000,
          rewardPoints: 1000,
          isGmailVerified: true,
          createdAt: new Date().toISOString(),
        }
      ];
      localStorage.setItem(STORAGE_KEYS.REGISTERED_MEMBERS, JSON.stringify(defaultMembers));
      return defaultMembers;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveRegisteredMember(member: RegisteredMemberAccount): void {
    const members = this.getRegisteredMembers();
    const existingIndex = members.findIndex(
      m => m.id === member.id || 
           m.username.toLowerCase() === member.username.toLowerCase() || 
           m.email.toLowerCase() === member.email.toLowerCase()
    );
    if (existingIndex >= 0) {
      members[existingIndex] = { ...members[existingIndex], ...member };
    } else {
      members.push(member);
    }
    localStorage.setItem(STORAGE_KEYS.REGISTERED_MEMBERS, JSON.stringify(members));
    pushEntityToBackend('users', members);
    notifyStorageSynced();
  },

  saveRegisteredMembers(members: RegisteredMemberAccount[]): void {
    localStorage.setItem(STORAGE_KEYS.REGISTERED_MEMBERS, JSON.stringify(members));
    pushEntityToBackend('users', members);
    notifyStorageSynced();
  },

  deleteRegisteredMember(memberId: string): RegisteredMemberAccount[] {
    const clean = memberId.trim().toLowerCase();
    const members = this.getRegisteredMembers().filter(m => 
      m.id !== memberId && 
      m.username.toLowerCase() !== clean && 
      m.email.toLowerCase() !== clean
    );
    this.saveRegisteredMembers(members);
    return members;
  },

  findRegisteredMemberByUsername(username: string): RegisteredMemberAccount | undefined {
    const clean = (username || '').trim().toLowerCase();
    if (!clean) return undefined;
    return this.getRegisteredMembers().find(m => (m.username || '').toLowerCase() === clean);
  },

  findRegisteredMemberByEmail(email: string): RegisteredMemberAccount | undefined {
    const clean = (email || '').trim().toLowerCase();
    if (!clean) return undefined;
    return this.getRegisteredMembers().find(m => (m.email || '').toLowerCase() === clean);
  },

  findRegisteredMemberByPhone(phone: string): RegisteredMemberAccount | undefined {
    const digits = (phone || '').replace(/[^0-9]/g, '');
    if (digits.length < 8) return undefined;
    const norm = digits.startsWith('62') ? '0' + digits.slice(2) : digits;
    return this.getRegisteredMembers().find(m => {
      const mDigits = (m.phone || '').replace(/[^0-9]/g, '');
      const mNorm = mDigits.startsWith('62') ? '0' + mDigits.slice(2) : mDigits;
      return mNorm === norm;
    });
  },

  findRegisteredMember(identifier: string): RegisteredMemberAccount | undefined {
    const cleanId = (identifier || '').trim().toLowerCase();
    if (!cleanId) return undefined;

    // 1. Cek Username
    const byUsername = this.findRegisteredMemberByUsername(cleanId);
    if (byUsername) return byUsername;

    // 2. Cek Email
    if (cleanId.includes('@')) {
      const byEmail = this.findRegisteredMemberByEmail(cleanId);
      if (byEmail) return byEmail;
    }

    // 3. Cek No. HP jika pola input adalah digit/nomor telepon
    const digits = cleanId.replace(/[^0-9]/g, '');
    if (digits.length >= 8 && (/^(08|628|\+628|[0-9]{9,})/.test(cleanId) || !cleanId.includes('@'))) {
      const byPhone = this.findRegisteredMemberByPhone(cleanId);
      if (byPhone) return byPhone;
    }

    return undefined;
  },

  async hydrateSettingsFromBackend(): Promise<AppSettings | null> {
    try {
      const res = await fetch('/api/sync/state', { cache: 'no-store' as any, headers: { ...getAdminHeaders() } as any });
      if (!res.ok) return null;
      const json = await res.json().catch(() => null);
      const remote: AppSettings | undefined = json?.data?.settings;
      if (!remote || typeof remote !== 'object') return null;
      const local = this.getSettings();
      // Hanya merge field dari remote yang TIDAK kosong agar tidak menghapus data tersimpan
      const validRemote: Record<string, any> = {};
      for (const [k, v] of Object.entries(remote)) {
        if (v !== '' && v !== null && v !== undefined) {
          validRemote[k] = v;
        }
      }
      const merged: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...local,
        ...validRemote,
        discountPopup: {
          ...DEFAULT_DISCOUNT_POPUP,
          ...(local.discountPopup || {}),
          ...(remote.discountPopup || {}),
        },
      } as AppSettings;
      if (merged.supabaseUrl) {
        merged.supabaseUrl = cleanSupabaseUrl(merged.supabaseUrl);
      }
      // Silently repair localStorage so next reload tidak butuh fetch lagi
      try { localStorage.setItem(STORAGE_KEYS.ADMIN_SETTINGS, JSON.stringify(merged)); } catch (_) {}
      return merged;
    } catch { return null; }
  },

  getSettings(): AppSettings {
    const raw = localStorage.getItem(STORAGE_KEYS.ADMIN_SETTINGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.ADMIN_SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
      return DEFAULT_SETTINGS;
    }
    try {
      const parsed = JSON.parse(raw);
      const settings: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        discountPopup: {
          ...DEFAULT_DISCOUNT_POPUP,
          ...(parsed.discountPopup || {})
        }
      };
      if (settings.supabaseUrl) {
        settings.supabaseUrl = cleanSupabaseUrl(settings.supabaseUrl);
      }
      return settings;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings: AppSettings): void {
    const prev = this.getSettings();
    // Non-destructive merge: jangan hilangkan konfigurasi penting yang sudah tersimpan sebelumnya
    const merged: AppSettings = {
      ...prev,
      ...settings,
      supabaseUrl: cleanSupabaseUrl(settings.supabaseUrl || prev.supabaseUrl),
      supabasePublishableKey: settings.supabasePublishableKey || prev.supabasePublishableKey || '',
      supabaseSecretKey: settings.supabaseSecretKey || prev.supabaseSecretKey || '',
      supabaseAnonKey: settings.supabasePublishableKey || prev.supabasePublishableKey || '',
      supabaseServiceRoleKey: settings.supabaseSecretKey || prev.supabaseSecretKey || '',
      pakasirSlug: settings.pakasirSlug || prev.pakasirSlug || '',
      pakasirApiKey: settings.pakasirApiKey || prev.pakasirApiKey || '',
      pakasirWebhookSecret: settings.pakasirWebhookSecret || prev.pakasirWebhookSecret || '',
      qiospayMerchantCode: settings.qiospayMerchantCode || prev.qiospayMerchantCode || '',
      qiospayApiKey: settings.qiospayApiKey || prev.qiospayApiKey || '',
      qiospaySecretKey: settings.qiospaySecretKey || prev.qiospaySecretKey || '',
      digiflazzUser: settings.digiflazzUser || prev.digiflazzUser || '',
      digiflazzUsername: settings.digiflazzUsername || prev.digiflazzUsername || '',
      digiflazzProductionKey: settings.digiflazzProductionKey || prev.digiflazzProductionKey || '',
      digiflazzApiKey: settings.digiflazzApiKey || prev.digiflazzApiKey || '',
      digiflazzSecretCode: settings.digiflazzSecretCode || prev.digiflazzSecretCode || '',
      digiflazzWebhookSecret: settings.digiflazzWebhookSecret || prev.digiflazzWebhookSecret || '',
    };
    localStorage.setItem(STORAGE_KEYS.ADMIN_SETTINGS, JSON.stringify(merged));
    pushEntityToBackend('settings', merged);
    notifyStorageSynced();
    try {
      fetchWithFallback('/api/settings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      }).catch(() => {});
    } catch (_) {}
  },

  getVoucherBatches(): WifiVoucherBatch[] {
    const raw = localStorage.getItem(STORAGE_KEYS.WIFI_BATCHES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.WIFI_BATCHES, JSON.stringify([]));
      return [];
    }
    try {
      const parsed: WifiVoucherBatch[] = JSON.parse(raw);
      const isMockBatch = (b: WifiVoucherBatch) =>
        ['batch-1', 'batch-2'].includes(b.id) ||
        (b.name && (b.name.includes('Batch 24 Jam Hotspot RT/RW') || b.name.includes('Batch Harian Hotspot RT/RW')));
      
      if (parsed.some(isMockBatch)) {
        const clean = parsed.filter(b => !isMockBatch(b));
        localStorage.setItem(STORAGE_KEYS.WIFI_BATCHES, JSON.stringify(clean));
        return clean;
      }
      return parsed;
    } catch {
      return [];
    }
  },

  saveVoucherBatches(batches: WifiVoucherBatch[]): void {
    localStorage.setItem(STORAGE_KEYS.WIFI_BATCHES, JSON.stringify(batches));
    pushEntityToBackend('wifiBatches', batches);
    notifyStorageSynced();
  },

  updateOrder(orderId: string, updates: Partial<Order>): Order | undefined {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === orderId || o.invoiceNumber === orderId);
    if (idx !== -1) {
      orders[idx] = { ...orders[idx], ...updates, updatedAt: new Date().toISOString() };
      this.saveOrders(orders);
      return orders[idx];
    }
    return undefined;
  },

  addProduct(product: Product): Product {
    const products = this.getProducts();
    const updated = [product, ...products];
    this.saveProducts(updated);
    return product;
  },

  updateProduct(productId: string, updates: Partial<Product>): Product | undefined {
    const products = this.getProducts();
    const idx = products.findIndex(p => p.id === productId || p.sku === productId);
    if (idx !== -1) {
      const current = products[idx];
      const baseCost = updates.basePrice !== undefined 
        ? Number(updates.basePrice) 
        : (updates.supplierPrice !== undefined ? Number(updates.supplierPrice) : (current.basePrice ?? current.supplierPrice ?? 0));

      products[idx] = { 
        ...current, 
        ...updates,
        basePrice: baseCost,
        supplierPrice: baseCost,
        sellingPrice: updates.sellingPrice !== undefined ? Number(updates.sellingPrice) : current.sellingPrice,
      };
      this.saveProducts(products);
      return products[idx];
    }
    return undefined;
  },

  deleteProduct(productId: string): boolean {
    const products = this.getProducts();
    const updated = products.filter(p => p.id !== productId);
    if (updated.length !== products.length) {
      this.saveProducts(updated);
      return true;
    }
    return false;
  },

  softDeleteProduct(productId: string): boolean {
    const products = this.getProducts();
    const idx = products.findIndex(p => p.id === productId || p.sku === productId);
    if (idx !== -1) {
      const prodName = products[idx].name;
      products[idx] = { ...products[idx], isDeleted: true, isActive: false };
      this.saveProducts(products);
      this.addAuditLog('PRODUCT_DELETED', 'Admin Catalog', `Produk ${prodName} diarsipkan/dihapus lokal (pengecualian sinkronisasi aktif).`);
      return true;
    }
    return false;
  },

  restoreProduct(productId: string): boolean {
    const products = this.getProducts();
    const idx = products.findIndex(p => p.id === productId || p.sku === productId);
    if (idx !== -1) {
      const prodName = products[idx].name;
      products[idx] = { ...products[idx], isDeleted: false, isActive: true };
      this.saveProducts(products);
      this.addAuditLog('PRODUCT_RESTORED', 'Admin Catalog', `Produk ${prodName} dipulihkan ke katalog aktif.`);
      return true;
    }
    return false;
  },

  getAuditLogs(): AuditLog[] {
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    if (!raw) {
      const initialLogs: AuditLog[] = [
        {
          id: 'log-1',
          action: 'SINKRONISASI_KATALOG',
          performedBy: 'System (Digiflazz Service)',
          details: 'Katalog pulsa dan paket data berhasil disinkronkan.',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'log-2',
          action: 'PENGATURAN_HARGA',
          performedBy: 'Admin Utama',
          details: 'Penyesuaian margin penjualan produk kuota Telkomsel.',
          createdAt: new Date(Date.now() - 7200000).toISOString(),
        },
      ];
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(initialLogs));
      return initialLogs;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  addAuditLog(action: string, performedBy: string, details: string): void {
    const logs = this.getAuditLogs();
    const newLog: AuditLog = {
      id: 'log-' + Date.now(),
      action,
      performedBy,
      details,
      createdAt: new Date().toISOString(),
    };
    logs.unshift(newLog);
    const sliced = logs.slice(0, 100);
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(sliced));
    pushEntityToBackend('auditLogs', sliced);
  },

  getAdminSession(): AdminAuthSession | null {
    const raw = localStorage.getItem(STORAGE_KEYS.ADMIN_AUTH);
    if (!raw) return null;
    try {
      const session = JSON.parse(raw) as AdminAuthSession;
      return session.isAuthenticated ? session : null;
    } catch {
      return null;
    }
  },

  saveAdminSession(session: AdminAuthSession | null): void {
    if (!session) {
      localStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH);
    } else {
      localStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, JSON.stringify(session));
    }
  },

  // Banner & Iklan Management
  getBanners(): PromoBanner[] {
    const raw = localStorage.getItem(STORAGE_KEYS.BANNERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.BANNERS, JSON.stringify(INITIAL_BANNERS));
      return INITIAL_BANNERS;
    }
    try {
      const parsed: PromoBanner[] = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return INITIAL_BANNERS;
      }
      // Sanitize any legacy MELATI NET text
      let hasLegacy = false;
      const sanitized = parsed.map(b => {
        if (b.imageTag && (b.imageTag.includes('MELATI NET') || b.imageTag.includes('WARGANET') || b.imageTag.includes('GRIYANET'))) {
          hasLegacy = true;
          return { ...b, imageTag: '📡 VOUCHER WIFI RT/RW NET' };
        }
        return b;
      });
      if (hasLegacy) {
        localStorage.setItem(STORAGE_KEYS.BANNERS, JSON.stringify(sanitized));
      }
      return sanitized.filter(b => b.ctaCategory !== 'premium' && b.id !== 'banner-license');
    } catch {
      return INITIAL_BANNERS.filter(b => b.ctaCategory !== 'premium' && b.id !== 'banner-license');
    }
  },

  saveBanners(banners: PromoBanner[]): void {
    localStorage.setItem(STORAGE_KEYS.BANNERS, JSON.stringify(banners));
    pushEntityToBackend('banners', banners);
    notifyStorageSynced();
  },

  updateBanner(bannerId: string, updates: Partial<PromoBanner>): PromoBanner | undefined {
    const banners = this.getBanners();
    const idx = banners.findIndex(b => b.id === bannerId);
    if (idx !== -1) {
      banners[idx] = { ...banners[idx], ...updates };
      this.saveBanners(banners);
      return banners[idx];
    }
    return undefined;
  },

  addBanner(newBanner: Omit<PromoBanner, 'id'>): PromoBanner {
    const banners = this.getBanners();
    const banner: PromoBanner = {
      ...newBanner,
      id: 'banner-' + Date.now(),
    };
    banners.unshift(banner);
    this.saveBanners(banners);
    return banner;
  },

  deleteBanner(bannerId: string): void {
    const banners = this.getBanners();
    const filtered = banners.filter(b => b.id !== bannerId);
    this.saveBanners(filtered);
  },

  // Store Catalogs (Interactive Categories on storefront)
  getCatalogs(): StoreCatalog[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CATALOGS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.CATALOGS, JSON.stringify(INITIAL_CATALOGS));
        return INITIAL_CATALOGS;
      }
      const parsed: StoreCatalog[] = JSON.parse(data);
      return parsed.filter(c => c.id !== 'premium' && c.targetTab !== 'premium');
    } catch {
      return INITIAL_CATALOGS;
    }
  },

  saveCatalogs(catalogs: StoreCatalog[]): void {
    localStorage.setItem(STORAGE_KEYS.CATALOGS, JSON.stringify(catalogs));
    pushEntityToBackend('catalogs', catalogs);
    notifyStorageSynced();
  },

  updateCatalog(catalogId: string, updated: Partial<StoreCatalog>): StoreCatalog | null {
    const list = this.getCatalogs();
    const idx = list.findIndex(c => c.id === catalogId);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updated };
      this.saveCatalogs(list);
      return list[idx];
    }
    return null;
  },

  deleteCatalog(catalogId: string): void {
    const filtered = this.getCatalogs().filter(c => c.id !== catalogId);
    this.saveCatalogs(filtered);
  },

  resetCatalogs(): StoreCatalog[] {
    this.saveCatalogs(INITIAL_CATALOGS);
    return INITIAL_CATALOGS;
  },

  // Reset database demo
  resetToDemo(): void {
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.ORDERS);
    localStorage.removeItem(STORAGE_KEYS.WIFI_VOUCHERS);
    localStorage.removeItem(STORAGE_KEYS.PROMOS);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH);
    localStorage.removeItem(STORAGE_KEYS.BANNERS);
    localStorage.removeItem(STORAGE_KEYS.CATALOGS);
  }
};

// Automatically trigger cloud sync once on startup
if (typeof window !== 'undefined') {
  storage.initCloudSync();
}
