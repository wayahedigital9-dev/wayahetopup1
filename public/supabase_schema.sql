-- =========================================================================
-- WAYAHEDIGITAL - COMPREHENSIVE SUPABASE DATABASE MIGRATION SCRIPT
-- Jalankan skrip ini di: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- =========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================================
-- 1. ENUM TYPES (Optional / Safe Creation)
-- =========================================================================
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('CUSTOMER', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE category_type AS ENUM ('pulsa', 'kuota', 'wifi', 'premium', 'game');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('UNPAID', 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE fulfillment_status AS ENUM ('NOT_STARTED', 'QUEUED', 'PROCESSING', 'SUCCESS', 'FAILED', 'MANUAL_REVIEW');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =========================================================================
-- 2. TABEL USERS & AUTHENTICATION
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    name TEXT NOT NULL,
    password TEXT,
    role TEXT DEFAULT 'CUSTOMER',
    member_tier TEXT DEFAULT 'MEMBER',
    "memberTier" TEXT DEFAULT 'MEMBER',
    balance INTEGER DEFAULT 0,
    reward_points INTEGER DEFAULT 0,
    "rewardPoints" INTEGER DEFAULT 0,
    raw_data JSONB,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS member_tier TEXT DEFAULT 'MEMBER';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "memberTier" TEXT DEFAULT 'MEMBER';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS balance INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reward_points INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "rewardPoints" INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS raw_data JSONB;

-- =========================================================================
-- 3. TABEL PRODUCTS & CATALOG
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "categoryId" TEXT NOT NULL,
    category_id TEXT,
    provider TEXT NOT NULL,
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    "supplierSku" TEXT,
    supplier_sku TEXT,
    "sellerName" TEXT,
    seller_name TEXT,
    "digiflazzCategory" TEXT,
    digiflazz_category TEXT,
    "digiflazzType" TEXT,
    digiflazz_type TEXT,
    nominal INTEGER,
    description TEXT,
    "supplierPrice" INTEGER NOT NULL DEFAULT 0,
    supplier_price INTEGER DEFAULT 0,
    "sellingPrice" INTEGER NOT NULL DEFAULT 0,
    selling_price INTEGER DEFAULT 0,
    "discountPrice" INTEGER,
    discount_price INTEGER,
    "quotaDetails" TEXT,
    quota_details TEXT,
    duration TEXT,
    speed TEXT,
    "networkLocation" TEXT,
    network_location TEXT,
    "deliveryMethod" TEXT DEFAULT 'AUTOMATIC',
    delivery_method TEXT DEFAULT 'AUTOMATIC',
    "isActive" BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    stock INTEGER DEFAULT 0,
    badge TEXT,
    "iconUrl" TEXT,
    icon_url TEXT,
    raw_data JSONB,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS supplier_price INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "supplierPrice" INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS selling_price INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "sellingPrice" INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT TRUE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS raw_data JSONB;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "iconUrl" TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS icon_url TEXT;

-- =========================================================================
-- 4. TABEL ORDERS & TRANSACTIONS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "invoiceNumber" TEXT UNIQUE,
    invoice_number TEXT,
    "userId" TEXT,
    user_id TEXT,
    "customerName" TEXT,
    customer_name TEXT,
    "customerEmail" TEXT,
    customer_email TEXT,
    "customerPhone" TEXT,
    customer_phone TEXT,
    "targetDestination" TEXT,
    target_destination TEXT,
    category TEXT NOT NULL DEFAULT 'pulsa',
    subtotal INTEGER NOT NULL DEFAULT 0,
    "adminFee" INTEGER DEFAULT 0,
    admin_fee INTEGER DEFAULT 0,
    discount INTEGER DEFAULT 0,
    "promoCode" TEXT,
    promo_code TEXT,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER DEFAULT 0,
    "paymentStatus" TEXT DEFAULT 'UNPAID',
    payment_status TEXT DEFAULT 'UNPAID',
    "fulfillmentStatus" TEXT DEFAULT 'NOT_STARTED',
    fulfillment_status TEXT DEFAULT 'NOT_STARTED',
    "paymentMethod" TEXT DEFAULT 'QRIS',
    payment_method TEXT DEFAULT 'QRIS',
    "deliveryMethod" TEXT DEFAULT 'AUTOMATIC',
    delivery_method TEXT DEFAULT 'AUTOMATIC',
    "guestAccessToken" TEXT DEFAULT gen_random_uuid()::text,
    guest_access_token TEXT,
    "idempotencyKey" TEXT,
    idempotency_key TEXT,
    "snapToken" TEXT,
    snap_token TEXT,
    "qrString" TEXT,
    qr_string TEXT,
    "isDynamic" BOOLEAN DEFAULT TRUE,
    is_dynamic BOOLEAN DEFAULT TRUE,
    items JSONB DEFAULT '[]'::jsonb,
    raw_data JSONB,
    "paidAt" TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    "fulfilledAt" TIMESTAMPTZ,
    fulfilled_at TIMESTAMPTZ,
    "supplierRefId" TEXT,
    supplier_ref_id TEXT,
    "serialNumber" TEXT,
    serial_number TEXT,
    "voucherCode" TEXT,
    voucher_code TEXT,
    "voucherPassword" TEXT,
    voucher_password TEXT,
    "wifiSsid" TEXT,
    wifi_ssid TEXT,
    "wifiLoginUrl" TEXT,
    wifi_login_url TEXT,
    "premiumNotes" TEXT,
    premium_notes TEXT,
    "errorReason" TEXT,
    error_reason TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "customerName" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "customerPhone" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "customerEmail" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "targetDestination" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS target_destination TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "totalAmount" INTEGER DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_amount INTEGER DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT DEFAULT 'UNPAID';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'UNPAID';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "fulfillmentStatus" TEXT DEFAULT 'NOT_STARTED';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_status TEXT DEFAULT 'NOT_STARTED';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT DEFAULT 'QRIS';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'QRIS';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "deliveryMethod" TEXT DEFAULT 'AUTOMATIC';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'AUTOMATIC';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "guestAccessToken" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS guest_access_token TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items JSONB;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS raw_data JSONB;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "snapToken" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS snap_token TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "qrString" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS qr_string TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "isDynamic" BOOLEAN DEFAULT TRUE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS qiospay_refid TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS qiospay_nmid TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS qiospay_issuer TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS qiospay_paid_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "qiospayRefid" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "qiospayNmid" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "qiospayIssuer" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "qiospayPaidAt" TIMESTAMPTZ;

-- Pakasir API v2 Fields
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "orderId" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS product_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "productId" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fee NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_payment NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "totalPayment" NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pakasir_txn_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "pakasirTxnId" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_link TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "paymentLink" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "expiredAt" TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS raw_payment_response JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS raw_webhook JSONB DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_pakasir_txn_id ON public.orders(pakasir_txn_id) WHERE pakasir_txn_id IS NOT NULL;

-- =========================================================================
-- 5. TABEL ORDER ITEMS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.order_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "orderId" TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    provider TEXT NOT NULL,
    category TEXT NOT NULL,
    "sellingPrice" INTEGER NOT NULL DEFAULT 0,
    "deliveryMethod" TEXT DEFAULT 'AUTOMATIC',
    "targetNumberOrAccount" TEXT NOT NULL,
    "networkLocation" TEXT,
    "customerNote" TEXT,
    "iconUrl" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- 6. TABEL PAYMENT ATTEMPTS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.payment_attempts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "orderId" TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    "paymentMethod" TEXT NOT NULL,
    "transactionId" TEXT,
    "snapToken" TEXT,
    amount INTEGER NOT NULL,
    status TEXT DEFAULT 'PENDING',
    "rawPayload" JSONB,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- 7. TABEL WIFI VOUCHER BATCHES & ITEMS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.wifi_voucher_batches (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    "speedProfile" TEXT NOT NULL,
    duration TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wifi_batches (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    package_duration TEXT,
    price NUMERIC DEFAULT 0,
    vouchers JSONB DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wifi_voucher_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "batchId" TEXT REFERENCES public.wifi_voucher_batches(id) ON DELETE SET NULL,
    location TEXT NOT NULL,
    "packageDuration" TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    password TEXT,
    status TEXT DEFAULT 'AVAILABLE',
    "orderId" TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
    "reservedUntil" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- 8. TABEL PROMO CODES & BANNERS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.promo_codes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT UNIQUE NOT NULL,
    "discountAmount" INTEGER NOT NULL,
    "minTransaction" INTEGER DEFAULT 0,
    description TEXT,
    "isActive" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.promo_banners (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    badge TEXT DEFAULT 'PROMO',
    tagline TEXT,
    title TEXT NOT NULL,
    subtitle TEXT,
    "ctaText" TEXT DEFAULT 'Beli Sekarang',
    "ctaCategory" TEXT DEFAULT 'pulsa',
    "secondaryCtaText" TEXT,
    "secondaryCtaAction" TEXT,
    "imageUrl" TEXT NOT NULL,
    "imageTag" TEXT,
    "accentColor" TEXT,
    "isActive" BOOLEAN DEFAULT TRUE,
    "order" INTEGER DEFAULT 0,
    "photoLayout" TEXT DEFAULT 'FULL_HOLDER',
    "showTextOverlay" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- 9. TABEL WARRANTY & CS HUB (Warranties, Claims, Monitoring, Dispatched)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.warranties (
    id TEXT PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT DEFAULT '',
    "customerInitials" TEXT DEFAULT 'WD',
    "avatarBg" TEXT DEFAULT 'bg-[#e4dfff] text-[#160066]',
    product TEXT NOT NULL,
    "productVariant" TEXT DEFAULT 'Akun Digital',
    validity TEXT DEFAULT '30 Hari Garansi',
    "progressPercent" NUMERIC DEFAULT 100,
    status TEXT NOT NULL DEFAULT 'Aktif',
    "issueType" TEXT DEFAULT 'Normal / Tanpa Kendala',
    complaint TEXT DEFAULT '',
    "screenshotUrl" TEXT DEFAULT '',
    price TEXT DEFAULT '',
    "purchaseDate" TEXT,
    role TEXT DEFAULT 'pembeli',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.claims (
    id TEXT PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "orderDate" TEXT,
    "issueDate" TEXT,
    "solutionRequested" TEXT DEFAULT 'Ganti Akun / Profil Baru',
    product TEXT NOT NULL,
    "productVariant" TEXT DEFAULT 'Akun Digital',
    "issueType" TEXT NOT NULL,
    "accountEmail" TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    device TEXT DEFAULT 'Desktop & Mobile',
    "screenshotUrl" TEXT DEFAULT '',
    "screenshotName" TEXT DEFAULT '',
    "screenshotSize" TEXT DEFAULT '',
    description TEXT,
    "submittedAt" TEXT,
    status TEXT NOT NULL DEFAULT 'Sedang Diproses CS',
    "slaResponseEstimate" TEXT DEFAULT '< 15 Menit',
    "adminResponseNote" TEXT,
    "replacementAccountInfo" TEXT,
    "customerName" TEXT,
    "linkedMonitoringId" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.monitoring (
    id TEXT PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    product TEXT NOT NULL,
    "orderDate" TEXT,
    "accountEmail" TEXT NOT NULL,
    "screenshotUrl" TEXT DEFAULT '',
    "screenshotName" TEXT DEFAULT '',
    "screenshotSize" TEXT DEFAULT '',
    note TEXT,
    "savedAt" TEXT,
    status TEXT NOT NULL DEFAULT 'Tersimpan & Terpantau',
    "customerName" TEXT,
    "customerPhone" TEXT,
    "adminNote" TEXT,
    "healthStatus" TEXT DEFAULT 'Normal Aktif',
    "linkedClaimTicketId" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dispatched_accounts (
    id TEXT PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "orderDate" TEXT,
    "accountCredentials" TEXT NOT NULL,
    "customerName" TEXT,
    "customerWhatsapp" TEXT,
    duration TEXT,
    note TEXT,
    "sentAt" TEXT,
    status TEXT NOT NULL DEFAULT 'Terkirim',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'claim',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp TEXT,
    read BOOLEAN DEFAULT FALSE,
    "targetNumber" TEXT NOT NULL,
    "referenceId" TEXT,
    "customerName" TEXT,
    "productName" TEXT,
    status TEXT NOT NULL DEFAULT 'Terkirim ke WhatsApp Admin',
    "waUrl" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- 10. TABEL GLOBAL SETTINGS & AUDIT LOGS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.digiflazz_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "orderId" TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
    "buyerSkuCode" TEXT NOT NULL,
    "customerNo" TEXT NOT NULL,
    "refId" TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL,
    rc TEXT,
    sn TEXT,
    message TEXT,
    "requestBody" JSONB,
    "responseBody" JSONB,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    action TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    details TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.qiospay_events (
    nmid TEXT NOT NULL,
    refid TEXT NOT NULL,
    payload JSONB NOT NULL,
    "receivedAt" TIMESTAMPTZ DEFAULT NOW(),
    "verificationStatus" TEXT DEFAULT 'unverified',
    amount INTEGER,
    type TEXT,
    issuer TEXT,
    PRIMARY KEY (nmid, refid)
);

-- =========================================================================
-- 11. INDEXES OPTIMIZATION
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products("categoryId", provider);
CREATE INDEX IF NOT EXISTS idx_products_isActive ON public.products("isActive");
CREATE INDEX IF NOT EXISTS idx_orders_invoice ON public.orders("invoiceNumber");
CREATE INDEX IF NOT EXISTS idx_orders_target ON public.orders("targetDestination");
CREATE INDEX IF NOT EXISTS idx_orders_phone ON public.orders("customerPhone");
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders("paymentStatus", "fulfillmentStatus");
CREATE INDEX IF NOT EXISTS idx_warranties_orderId ON public.warranties("orderId");
CREATE INDEX IF NOT EXISTS idx_claims_orderId ON public.claims("orderId");
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.claims(status);
CREATE INDEX IF NOT EXISTS idx_monitoring_orderId ON public.monitoring("orderId");
CREATE INDEX IF NOT EXISTS idx_dispatched_orderId ON public.dispatched_accounts("orderId");
CREATE INDEX IF NOT EXISTS idx_qiospay_received ON public.qiospay_events("receivedAt");

-- =========================================================================
-- 12. REPLICA IDENTITY FULL (Wajib untuk Supabase Realtime WebSocket)
-- =========================================================================
ALTER TABLE public.users REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER TABLE public.payment_attempts REPLICA IDENTITY FULL;
ALTER TABLE public.wifi_voucher_batches REPLICA IDENTITY FULL;
ALTER TABLE public.wifi_voucher_items REPLICA IDENTITY FULL;
ALTER TABLE public.promo_codes REPLICA IDENTITY FULL;
ALTER TABLE public.promo_banners REPLICA IDENTITY FULL;
ALTER TABLE public.warranties REPLICA IDENTITY FULL;
ALTER TABLE public.claims REPLICA IDENTITY FULL;
ALTER TABLE public.monitoring REPLICA IDENTITY FULL;
ALTER TABLE public.dispatched_accounts REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.app_settings REPLICA IDENTITY FULL;
ALTER TABLE public.digiflazz_logs REPLICA IDENTITY FULL;
ALTER TABLE public.audit_logs REPLICA IDENTITY FULL;
ALTER TABLE public.qiospay_events REPLICA IDENTITY FULL;

-- =========================================================================
-- 13. ROW LEVEL SECURITY (RLS) & UNIFIED ACCESS POLICIES
-- =========================================================================
DO $$
DECLARE
    pol record;
    tbl text;
BEGIN
    -- 1. Bersihkan semua policy lama di public schema agar tidak ada konflik/penolakan
    FOR pol IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;

    -- 2. Pastikan RLS aktif dan berikan hak akses penuh kepada anon, authenticated, dan service_role
    FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('CREATE POLICY "Allow all on %I" ON public.%I FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true)', tbl, tbl);
    END LOOP;
END $$;

-- =========================================================================
-- 14. STORAGE BUCKETS SETUP (Public Uploads & Assets)
-- =========================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public) 
    VALUES 
        ('proof-uploads', 'proof-uploads', true),
        ('store-assets', 'store-assets', true),
        ('banners', 'banners', true)
    ON CONFLICT (id) DO UPDATE SET public = true;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
    EXECUTE 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Public Access Bucket Proofs" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Public Access Bucket Objects" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Public Access Objects" ON storage.objects';
    EXECUTE 'CREATE POLICY "Public Access Objects" ON storage.objects FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true)';
  END IF;
EXCEPTION WHEN others THEN null;
END $$;

-- =========================================================================
-- 15. PUBLIKASI REALTIME SUPABASE
-- =========================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Enable REPLICA IDENTITY FULL & Add to Publication
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN 
    SELECT unnest(ARRAY[
      'products', 'orders', 'order_items', 'payment_attempts',
      'wifi_voucher_batches', 'wifi_batches', 'wifi_voucher_items', 'promo_codes',
      'promo_banners', 'warranties', 'claims', 'monitoring',
      'dispatched_accounts', 'notifications', 'app_settings',
      'settings', 'users', 'admin_push_subscriptions',
      'audit_logs', 'digiflazz_logs', 'qiospay_events'
    ])
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      BEGIN
        EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', tbl);
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      EXCEPTION 
        WHEN duplicate_object THEN NULL;
        WHEN others THEN NULL;
      END;
    END IF;
  END LOOP;
END $$;

-- 15b. PENGATURAN STATUS KATEGORI & SEED DEFAULT SETTINGS
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS "categoryStatus" JSONB DEFAULT '{"pulsa":true,"kuota":true,"game":true,"premium":true,"wifi":true,"smm":true,"gateway_tambahan":true,"pln":true}'::jsonb;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "categoryStatus" JSONB DEFAULT '{"pulsa":true,"kuota":true,"game":true,"premium":true,"wifi":true,"smm":true,"gateway_tambahan":true,"pln":true}'::jsonb;

INSERT INTO public.app_settings (key, value, "updatedAt")
VALUES ('main_settings', '{"siteName":"WayaheDigital","activeGateway":"QIOSPAY"}'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value, updated_at)
VALUES ('main_settings', '{"siteName":"WayaheDigital","activeGateway":"QIOSPAY"}'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

-- 16. RELOAD SCHEMA CACHE SUPABASE POSTGREST
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- =========================================================================
-- 17. HELPER FUNCTION: EXECUTE SQL VIA RPC (Khusus Admin / Service Role)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
  RETURN jsonb_build_object('success', true, 'message', 'SQL executed successfully');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role, postgres;

-- Selesai! Seluruh struktur database WayaheDigital siap digunakan di Supabase.

