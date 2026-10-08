export type CategoryType = 'pulsa' | 'kuota' | 'wifi' | 'premium' | 'game' | 'smm' | 'gateway_tambahan' | 'ai_gateway';

export type PaymentStatus = 
  | 'UNPAID' 
  | 'PENDING' 
  | 'PAID' 
  | 'FAILED' 
  | 'EXPIRED' 
  | 'REFUND_PENDING' 
  | 'REFUNDED';

export type FulfillmentStatus = 
  | 'NOT_STARTED' 
  | 'QUEUED' 
  | 'WAITING' 
  | 'PROCESSING' 
  | 'SUCCESS' 
  | 'PARTIAL' 
  | 'FAILED' 
  | 'CANCELED' 
  | 'MANUAL_REVIEW' 
  | 'NEEDS_REVIEW';

export type DeliveryMethod = 'AUTOMATIC' | 'MANUAL';

export interface Category {
  id: string;
  name: string;
  slug: CategoryType;
  description: string;
  icon: string;
  color: string;
}

export interface StoreCatalog {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  iconType: 'wifi' | 'smartphone' | 'sparkles' | 'gamepad';
  iconUrl?: string; // Custom uploaded foto / image
  targetTab: string;
  badge?: string;
  isActive?: boolean;
}

export interface ProductVariant {
  id: string;
  name: string; // e.g., "24 Jam Unlimited", "7 Hari Super Speed", "1 Bulan"
  duration?: string; // e.g., "24 Jam", "7 Hari", "30 Hari"
  speed?: string; // e.g., "Up to 10 Mbps"
  supplierPrice?: number;
  localCostAdjustment?: number; // Modal lokal yang disesuaikan admin
  sellingPrice: number;
  discountPrice?: number;
  stock?: number;
  sku?: string;
  badge?: string; // e.g., "Paling Laris", "Hemat 20%"
  description?: string;
  voucherCodes?: string[]; // Daftar kode voucher stok siap jual untuk varian ini
  providerVariantId?: string; // ID varian provider (misal vr_viu1b)
  priceMode?: 'AUTO' | 'MANUAL';
  isActive?: boolean;
  isDeleted?: boolean;
  snk?: string; // Syarat & Ketentuan garansi / klaim
  expiredDays?: number; // Masa berlaku akun / voucher dalam hari
}

export interface Product {
  id: string;
  categoryId: CategoryType;
  provider: string; // Telkomsel, Indosat, Xaviera Store, Digiflazz, etc.
  name: string;
  sku: string;
  supplierSku?: string; // Digiflazz buyer SKU / Provider Product ID
  providerProductId?: string; // ID produk dari provider API (misal p_netflix1)
  providerCode?: string;
  sellerName?: string; // e.g. "Amanah Profesional Reload", "Xaviera Store"
  digiflazzCategory?: string; // "Data", "Games", "Pulsa", "PLN", "Voucher", etc.
  digiflazzType?: string; // "Reguler", "Combo", "Nasional", etc.
  nominal?: number; // Nilai nominal pulsa
  description: string;
  supplierPrice: number; // Harga seller dari API
  rawSellerPrice?: number; // Nilai asli dari API provider
  basePrice?: number; // Alias for supplierPrice
  localCostAdjustment?: number; // Modal lokal yang disesuaikan admin
  sellingPrice: number; // Harga jual website untuk pelanggan
  priceMode?: 'AUTO' | 'MANUAL'; // Otomatis (sesuai margin) atau Manual
  discountPrice?: number;
  quotaDetails?: string; // e.g., "15 GB Utama + 3 GB Malam"
  duration?: string; // e.g., "30 Hari", "2 Jam", "1 Bulan"
  speed?: string; // e.g., "10 Mbps"
  networkLocation?: string; // For WiFi RT/RW Net
  deliveryMethod: DeliveryMethod;
  isActive: boolean;
  isDeleted?: boolean; // Soft delete / pengecualian sinkronisasi
  stock?: number; // Khusus voucher wifi / stok manual / kuota akun
  badge?: string; // e.g., "Terlaris", "Promo", "Instan"
  terms?: string[];
  iconUrl?: string; // Custom logo / icon image URL
  variants?: ProductVariant[];
  hasVariants?: boolean; // Menentukan produk tunggal atau bervarian
  voucherCodes?: string[]; // Daftar kode voucher stok siap jual (mode produk tunggal)
  selectedVariantId?: string;
  selectedVariantName?: string;
  isManualCustom?: boolean;
  isCustomPrice?: boolean;

  // SMM Specific Fields (Xaviera Store SMM)
  smmServiceId?: number; // ID layanan numerik (misal 1234)
  ratePer1000?: number; // Tarif per 1.000 unit
  smmMin?: number; // Minimal pesanan
  smmMax?: number; // Maksimal pesanan
  smmRefill?: boolean; // Penanda dukungan refill
  smmCategory?: string; // Platform / Kategori (Instagram, TikTok, dll)

  // Status Sinkronisasi & Validasi Penjualan
  lastSyncAt?: string;
  needsPriceReview?: boolean; // Jika biaya seller naik melampaui harga jual
  incompleteReason?: string; // Alasan jika produk belum memenuhi syarat jual
}

export interface OrderItem {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  voucherCode?: string;
  provider: string;
  category: CategoryType;
  sellingPrice: number;
  iconUrl?: string;
  deliveryMethod: DeliveryMethod;
  targetNumberOrAccount: string;
  networkLocation?: string;
  customerNote?: string;
}

export interface PaymentAttempt {
  id: string;
  orderId: string;
  paymentMethod: string; // QRIS, BCA_VA, MANDIRI_VA, BRI_VA, ALFAMART
  transactionId?: string;
  snapToken?: string;
  amount: number;
  status: PaymentStatus;
  createdAt: string;
  paidAt?: string;
}

export interface Order {
  id: string;
  invoiceNumber: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  targetDestination: string; // Nomor HP / User ID Akun
  category: CategoryType;
  items: OrderItem[];
  subtotal: number;
  adminFee: number;
  discount: number;
  promoCode?: string;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  paymentMethod?: string;
  deliveryMethod: DeliveryMethod;
  guestAccessToken: string; // Token akses acak keamanan checkout tamu
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  fulfilledAt?: string;
  snapToken?: string;
  qrString?: string;
  isDynamic?: boolean;

  // Gateway specific fields (Terpisah murni)
  pakasirTxnId?: string;
  qiospayRefid?: string;
  paymentLink?: string;
  fee?: number;
  totalPayment?: number;
  expiredAt?: string;
  paymentGatewayProvider?: 'MIDTRANS' | 'PAKASIR' | 'QIOSPAY' | string;
  isSandbox?: boolean;
  
  // Hasil pemenuhan (Top-level & nested)
  voucherCode?: string;
  voucherPassword?: string;
  wifiSsid?: string;
  wifiLoginUrl?: string;
  supplierRefId?: string;
  serialNumber?: string;
  errorReason?: string;
  
  fulfillmentResult?: {
    supplierRefId?: string;
    serialNumber?: string; // Serial number dari Digiflazz (SN Pulsa/Kuota)
    voucherCode?: string;
    voucherPassword?: string;
    wifiSsid?: string;
    wifiLoginUrl?: string;
    premiumInstructions?: string; // Detail aktivasi akun premium
    notes?: string;
    errorReason?: string;
    credentials?: { email: string; password?: string }[];
  };

  // Provider H2H & Gateway Tracking (Xaviera Store, SMM, Digiflazz)
  credentials?: { email: string; password?: string }[]; // Hasil akun premium dari provider
  providerOrderId?: string | number; // ID pesanan di provider (misal order.id atau providerOrderId SMM)
  providerOrderReference?: string; // ID gateway tambahan / referensi
  providerRawStatus?: string; // Status mentah dari provider (Pending, Success, etc.)
  providerTotal?: number; // Total biaya di sisi provider
  lastStatusCheckAt?: string; // Waktu terakhir status diperiksa

  // SMM Specific Order Fields
  smmTarget?: string; // Target link/username media sosial
  smmQty?: number; // Jumlah pesanan layanan SMM
  smmComments?: string; // Komentar baris per baris jika custom comments
}

export interface ApiProviderConfig {
  id: string;
  category: 'premium' | 'smm' | 'game' | 'gateway_tambahan';
  providerName: string;
  apiUrl: string;
  orderUrl?: string;
  statusUrl?: string;
  apiKey: string; // Bearer Token / API Key
  isActive: boolean;
  autoPublish: boolean; // Tayang otomatis di toko jika syarat jual terpenuhi
  marginType?: 'PERCENTAGE' | 'NOMINAL';
  marginValue?: number;
  priceMarginType?: 'PERCENT' | 'NOMINAL';
  priceMarginValue?: number; // e.g. 15% or Rp 5.000
  rounding?: number; // e.g. 500, 1000
  roundingRule?: 'CEIL' | 'ROUND' | 'NONE';
  connectionStatus: 'NOT_TESTED' | 'CONNECTED' | 'FAILED' | 'UNTESTED';
  lastTestedAt?: string;
  lastSyncAt?: string;
  lastSyncStatus?: 'SUCCESS' | 'FAILED' | 'PENDING';
  lastSyncSummary?: string;
}

export interface User {
  id: string;
  name: string;
  username?: string;
  email: string;
  phone: string;
  role: 'CUSTOMER' | 'ADMIN';
  createdAt: string;
  avatar?: string;
  memberTier?: 'REGULER' | 'VIP_GOLD' | 'PRIORITY';
  balance?: number;
  rewardPoints?: number;
  isGmailVerified?: boolean;
}

export interface RegisteredMemberAccount {
  id: string;
  username: string;
  email: string;
  password?: string;
  phone?: string;
  name: string;
  avatar?: string;
  memberTier?: 'REGULER' | 'VIP_GOLD' | 'PRIORITY';
  balance?: number;
  rewardPoints?: number;
  isGmailVerified?: boolean;
  createdAt: string;
}

export interface PromoCode {
  id?: string;
  code: string;
  discountAmount: number;
  minTransaction: number;
  description: string;
  isActive: boolean;
  discountPercentage?: number;
  maxDiscount?: number;
  validUntil?: string;
}

export interface WifiVoucherItem {
  id: string;
  batchName: string;
  location: string;
  packageDuration: string;
  code: string;
  password?: string;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD';
  orderId?: string;
  reservedUntil?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  performedBy: string;
  details: string;
  createdAt: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}

export interface WifiVoucherBatch {
  id: string;
  name: string;
  location: string;
  speedProfile: string;
  createdAt: string;
  productId?: string;
  variantId?: string;
  duration?: string;
  quotaLimit?: string;
  notes?: string;
  vouchers: {
    id: string;
    code: string;
    password?: string;
    status: 'AVAILABLE' | 'USED';
    usedAt?: string;
    orderId?: string;
    createdAt?: string;
  }[];
}

export interface PromoBanner {
  id: string;
  badge: string;
  tagline: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaCategory: string;
  secondaryCtaText?: string;
  secondaryCtaAction?: string;
  imageUrl: string;
  imageTag?: string;
  accentColor?: string;
  isActive: boolean;
  order: number;
  photoLayout?: 'FULL_HOLDER' | 'SPLIT_FULL_HEIGHT'; // FULL_HOLDER: ukurannya sama dengan holder penuh (100% holder)
  showTextOverlay?: boolean; // Tampilkan teks di atas foto (default true)
}

export interface HeroPromoCardItem {
  name: string;
  sub: string;
  price: string;
  discount: string;
}

export interface HeroPromoSlide {
  id: string;
  badge: string;
  badgeColor?: 'amber' | 'sky' | 'emerald' | 'violet' | 'yellow' | 'rose' | string;
  title: string;
  subtitle: string;
  tags: string[];
  ctaText: string;
  ctaCategory?: string; // 'game' | 'kuota' | 'pulsa' | 'premium' | 'ai' | 'wifi'
  secondaryCtaText: string;
  secondaryCtaAction?: string;
  cardTitle: string;
  cardSubtitle: string;
  cardItems: HeroPromoCardItem[];
  serverStatus: string;
  accentGlow?: string;
  isActive?: boolean;
  order?: number;
}


export interface AppSettings {
  siteName: string;
  supportWhatsApp: string;
  supportEmail: string;
  supportHours: string;
  
  // Payment Gateway Config (QIOSPAY / PAKASIR / QRIS)
  paymentGatewayProvider?: 'QIOSPAY' | 'PAKASIR' | 'QRIS' | 'MANUAL';
  isSandbox?: boolean;
  paymentWebhookUrl?: string;
  qiospaySecretKey?: string;
  qiospayMerchantCode?: string;
  qiospayApiKey?: string;
  qiospayNmid?: string;
  qiospayMerchantName?: string;
  qiospayQrString?: string;
  staticQrisString?: string;

  // Pakasir API v2 Config
  pakasirBaseUrl?: string;
  pakasirSlug?: string;
  pakasirApiKey?: string;
  pakasirWebhookSecret?: string;
  pakasirPaymentMethod?: string;
  pakasirWebhookUrl?: string;
  pakasirMerchantName?: string;
  pakasirNmid?: string;
  pakasirQrString?: string;
  pakasirIsSandbox?: boolean;

  // Digiflazz H2H API Config
  digiflazzWebhookUrl?: string;
  digiflazzUser?: string;
  digiflazzUsername: string;
  digiflazzProductionKey?: string;
  digiflazzApiKey: string;
  digiflazzSecretCode?: string;
  digiflazzWebhookSecret?: string;
  digiflazzWhitelistIp?: string;
  digiflazzMode?: 'PRODUCTION' | 'DEVELOPMENT';
  digiflazzAutoFulfill?: boolean;

  // Bot & Automation Notifications (Telegram / WhatsApp)
  telegramBotToken?: string;
  telegramChatId?: string;
  telegramAlertsEnabled?: boolean;
  whatsappBotApiKey?: string;
  whatsappAlertsEnabled?: boolean;
  lowStockThreshold?: number;

  // Admin Authentication Credentials (Editable from Settings)
  adminUsername?: string;
  adminPassword?: string;
  adminName?: string;

  // Website Branding & Logo
  logoUrl?: string;

  // Ngrok Webhooks Tunnel
  ngrokAuthtoken?: string;
  ngrokDomain?: string;
  ngrokPublicUrl?: string;

  // Supabase Database Connection Settings
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  supabaseSecretKey?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
  supabaseDbUrl?: string;

  // MongoDB Database Connection Settings (Legacy / Fallback)
  mongodbUri?: string;
  mongodbDbName?: string;
  mongodbDbNameTrans?: string;

  // Popup Diskon & Promo Spesial
  discountPopup?: DiscountPopupConfig;

  // System Online / Maintenance Status Control (Tombol ON/OFF Running & Stop)
  systemStatus?: 'RUNNING' | 'STOPPED';
  systemMaintenanceMessage?: string;

  // Status ON/OFF per Kategori Produk (Jika false / maintenance, tampil "Maintenance akan segera kembali")
  categoryStatus?: {
    pulsa?: boolean;
    kuota?: boolean;
    game?: boolean;
    premium?: boolean;
    wifi?: boolean;
    smm?: boolean;
    gateway_tambahan?: boolean;
    pln?: boolean;
    [key: string]: boolean | undefined;
  };

  // Google Authenticator (2FA / TOTP)
  googleAuthEnabled?: boolean;
  googleAuthSecret?: string;
  googleAuthAccount?: string;

  // Website Security & Intrusion Detection
  wafProtectionEnabled?: boolean;
  antiBruteForceEnabled?: boolean;
  autoBlockSuspiciousIp?: boolean;

  // Multi-Provider API Integrations Config (Aplikasi Premium, SMM, Game, Gateway Tambahan)
  apiConfigs?: Record<string, ApiProviderConfig>;
  xavieraPremiumToken?: string;
  xavieraSmmToken?: string;
  xavieraApiBaseUrl?: string;

  // Konfigurasi WiFi Hotspot RT/RW Net
  wifiHotspotSsid?: string;
  wifiLoginUrl?: string;
  wifiDefaultPassword?: string;
  wifiPasswordMode?: 'SAME_AS_CODE' | 'RANDOM_PIN' | 'CUSTOM' | 'NO_PASSWORD';
  wifiLoginInstructions?: string;
  wifiContactSupport?: string;
}

export interface SecurityIntrusionLog {
  id: string;
  timestamp: string;
  ipAddress: string;
  threatType: 'SQL_INJECTION' | 'XSS_ATTACK' | 'BRUTE_FORCE' | 'UNAUTHORIZED_ACCESS' | 'RATE_LIMIT_EXCEEDED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: string;
  targetEndpoint: string;
  status: 'BLOCKED' | 'FLAGGED' | 'MITIGATED';
  userAgent?: string;
  actionTaken?: string;
}

export interface DiscountPopupConfig {
  isEnabled: boolean;
  targetAudience: 'NEW_MEMBER' | 'EVENT' | 'ALL';
  title: string;
  tagline: string;
  description: string;
  promoCode: string;
  discountAmount: number;
  bannerUrl?: string;
  badgeText: string;
}

export type AdminRole = 'SUPER_ADMIN' | 'OPERATOR' | 'FINANCE';

export interface AdminAuthSession {
  isAuthenticated: boolean;
  username: string;
  name: string;
  email: string;
  role: AdminRole;
  roleTitle: string;
  avatar?: string;
  token: string;
  loginAt: string;
}

export interface WarrantyItem {
  id: string;
  orderId: string;
  customerName: string;
  customerPhone?: string;
  customerInitials?: string;
  avatarBg?: string;
  product: string;
  productVariant?: string;
  validity?: string;
  progressPercent?: number;
  status: 'Aktif' | 'Kedaluwarsa' | 'Klaim Garansi' | 'Nonaktif' | string;
  issueType?: string;
  complaint?: string;
  screenshotUrl?: string;
  price?: string;
  purchaseDate?: string;
  role?: 'pembeli' | 'admin' | string;
}

export interface ClaimTicket {
  id: string;
  orderId: string;
  orderDate?: string;
  issueDate?: string;
  solutionRequested?: 'Ganti Akun / Profil Baru' | 'Reset Password' | 'Refund' | string;
  product: string;
  productVariant?: string;
  issueType: 'Gagal Login / Password Salah' | 'Masa Aktif Habis Sebelum Waktu' | 'Profil Terkunci / Penuh' | string;
  accountEmail: string;
  whatsapp: string;
  device?: string;
  screenshotUrl?: string;
  screenshotName?: string;
  screenshotSize?: string;
  description?: string;
  submittedAt?: string;
  status: 'Sedang Diproses CS' | 'Selesai' | 'Ditolak' | string;
  slaResponseEstimate?: string;
  adminResponseNote?: string;
  replacementAccountInfo?: string;
  customerName?: string;
  linkedMonitoringId?: string;
}

export interface SavedMonitoringRecord {
  id: string;
  orderId: string;
  product: string;
  orderDate?: string;
  accountEmail: string;
  screenshotUrl?: string;
  screenshotName?: string;
  screenshotSize?: string;
  note?: string;
  savedAt?: string;
  status: 'Tersimpan & Terpantau' | 'Perlu Perhatian' | 'Selesai' | string;
  customerName?: string;
  customerPhone?: string;
  adminNote?: string;
  healthStatus?: 'Normal Aktif' | 'Perlu Reset' | 'Bermasalah' | string;
  linkedClaimTicketId?: string;
}

export interface DispatchedPremiumAccount {
  id: string;
  orderId: string;
  appName: string;
  orderDate?: string;
  accountCredentials: string;
  customerName?: string;
  customerWhatsapp?: string;
  duration?: string;
  note?: string;
  sentAt?: string;
  status: 'Terkirim' | 'Pending' | 'Gagal' | string;
}

export interface WhatsAppNotificationItem {
  id: string;
  type: 'claim' | 'warranty' | 'order' | 'system' | string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  targetNumber: string;
  referenceId?: string;
  customerName?: string;
  productName?: string;
  status: 'Terkirim ke WhatsApp Admin' | 'Pending' | 'Selesai' | string;
  waUrl?: string;
}

