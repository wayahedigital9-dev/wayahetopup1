// Default comprehensive SQL schema for Supabase migration
// Digunakan saat offline atau ketika endpoint backend tidak tersedia
export const DEFAULT_SUPABASE_SQL_SCHEMA = `-- =========================================================================
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
    "isActive" BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    stock INTEGER DEFAULT 10,
    badge TEXT,
    "iconUrl" TEXT,
    icon_url TEXT,
    raw_data JSONB,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "supplierSku" TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS supplier_sku TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "sellerName" TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS seller_name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "digiflazzCategory" TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS digiflazz_category TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "digiflazzType" TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS digiflazz_type TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "supplierPrice" INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS supplier_price INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "sellingPrice" INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS selling_price INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "discountPrice" INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS discount_price INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "quotaDetails" TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS quota_details TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "networkLocation" TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS network_location TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "deliveryMethod" TEXT DEFAULT 'AUTOMATIC';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'AUTOMATIC';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "iconUrl" TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS icon_url TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS raw_data JSONB;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- =========================================================================
-- 4. TABEL ORDERS & TRANSAKSI
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "invoiceNumber" TEXT UNIQUE NOT NULL,
    invoice_number TEXT,
    "userId" TEXT,
    user_id TEXT,
    "customerName" TEXT,
    customer_name TEXT,
    "customerPhone" TEXT,
    customer_phone TEXT,
    "customerEmail" TEXT,
    customer_email TEXT,
    "targetDestination" TEXT,
    target_destination TEXT,
    category TEXT,
    subtotal INTEGER DEFAULT 0,
    "adminFee" INTEGER DEFAULT 0,
    admin_fee INTEGER DEFAULT 0,
    discount INTEGER DEFAULT 0,
    "promoCode" TEXT,
    promo_code TEXT,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER DEFAULT 0,
    "paymentStatus" TEXT DEFAULT 'PENDING',
    payment_status TEXT DEFAULT 'PENDING',
    "fulfillmentStatus" TEXT DEFAULT 'NOT_STARTED',
    fulfillment_status TEXT DEFAULT 'NOT_STARTED',
    "paymentMethod" TEXT DEFAULT 'QRIS',
    payment_method TEXT DEFAULT 'QRIS',
    "deliveryMethod" TEXT DEFAULT 'AUTOMATIC',
    delivery_method TEXT DEFAULT 'AUTOMATIC',
    "guestAccessToken" TEXT DEFAULT gen_random_uuid()::text,
    guest_access_token TEXT,
    "supplierRefId" TEXT,
    supplier_ref_id TEXT,
    "supplierStatus" TEXT,
    supplier_status TEXT,
    "supplierMessage" TEXT,
    supplier_message TEXT,
    sn TEXT,
    items JSONB,
    raw_data JSONB,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "customerName" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "customerPhone" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "customerEmail" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "targetDestination" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS target_destination TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "adminFee" INTEGER DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS admin_fee INTEGER DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "promoCode" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS promo_code TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "totalAmount" INTEGER DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_amount INTEGER DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT DEFAULT 'PENDING';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PENDING';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "fulfillmentStatus" TEXT DEFAULT 'NOT_STARTED';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_status TEXT DEFAULT 'NOT_STARTED';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT DEFAULT 'QRIS';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'QRIS';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "deliveryMethod" TEXT DEFAULT 'AUTOMATIC';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'AUTOMATIC';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "guestAccessToken" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS guest_access_token TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "supplierRefId" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS supplier_ref_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "supplierStatus" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS supplier_status TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "supplierMessage" TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS supplier_message TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sn TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items JSONB;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS raw_data JSONB;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- =========================================================================
-- 5. TABEL PENGATURAN SISTEM (app_settings & settings)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    "categoryStatus" JSONB DEFAULT '{"pulsa":true,"kuota":true,"game":true,"premium":true,"wifi":true,"smm":true,"gateway_tambahan":true,"pln":true}'::jsonb,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS "categoryStatus" JSONB DEFAULT '{"pulsa":true,"kuota":true,"game":true,"premium":true,"wifi":true,"smm":true,"gateway_tambahan":true,"pln":true}'::jsonb;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    "categoryStatus" JSONB DEFAULT '{"pulsa":true,"kuota":true,"game":true,"premium":true,"wifi":true,"smm":true,"gateway_tambahan":true,"pln":true}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "categoryStatus" JSONB DEFAULT '{"pulsa":true,"kuota":true,"game":true,"premium":true,"wifi":true,"smm":true,"gateway_tambahan":true,"pln":true}'::jsonb;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- =========================================================================
-- 6. TABEL LAYANAN, VOUCHER, KLAIM & NOTIFIKASI
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.wifi_voucher_batches (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    "speedProfile" TEXT,
    speed_profile TEXT,
    duration TEXT,
    price INTEGER DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wifi_batches (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    package_duration TEXT,
    price INTEGER DEFAULT 0,
    vouchers JSONB DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.warranties (
    id TEXT PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT DEFAULT '',
    product TEXT NOT NULL,
    validity TEXT DEFAULT '30 Hari Garansi',
    status TEXT NOT NULL DEFAULT 'Aktif',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.claims (
    id TEXT PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    product TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "accountEmail" TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Sedang Diproses CS',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.monitoring (
    id TEXT PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    product TEXT NOT NULL,
    "accountEmail" TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Tersimpan & Terpantau',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dispatched_accounts (
    id TEXT PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "accountCredentials" TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Terkirim',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'claim',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    "targetNumber" TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Terkirim ke WhatsApp Admin',
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_push_subscriptions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    admin_user_id TEXT DEFAULT 'admin',
    token TEXT UNIQUE NOT NULL,
    installation_id TEXT,
    device_name TEXT DEFAULT 'Perangkat Admin',
    platform TEXT DEFAULT 'Web',
    user_agent TEXT,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.promo_banners (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    image TEXT NOT NULL,
    link TEXT,
    "isActive" BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wifi_voucher_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wifi_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatched_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all users" ON public.users;
CREATE POLICY "Allow all users" ON public.users FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all products" ON public.products;
CREATE POLICY "Allow all products" ON public.products FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all orders" ON public.orders;
CREATE POLICY "Allow all orders" ON public.orders FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all app_settings" ON public.app_settings;
CREATE POLICY "Allow all app_settings" ON public.app_settings FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all settings" ON public.settings;
CREATE POLICY "Allow all settings" ON public.settings FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all wifi_voucher_batches" ON public.wifi_voucher_batches;
CREATE POLICY "Allow all wifi_voucher_batches" ON public.wifi_voucher_batches FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all warranties" ON public.warranties;
CREATE POLICY "Allow all warranties" ON public.warranties FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all claims" ON public.claims;
CREATE POLICY "Allow all claims" ON public.claims FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all monitoring" ON public.monitoring;
CREATE POLICY "Allow all monitoring" ON public.monitoring FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all dispatched_accounts" ON public.dispatched_accounts;
CREATE POLICY "Allow all dispatched_accounts" ON public.dispatched_accounts FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all notifications" ON public.notifications;
CREATE POLICY "Allow all notifications" ON public.notifications FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all admin_push_subscriptions" ON public.admin_push_subscriptions;
CREATE POLICY "Allow all admin_push_subscriptions" ON public.admin_push_subscriptions FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all promo_banners" ON public.promo_banners;
CREATE POLICY "Allow all promo_banners" ON public.promo_banners FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

-- Safely add tables to supabase_realtime publication
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN 
    SELECT unnest(ARRAY[
      'products', 'orders', 'app_settings', 'settings',
      'wifi_voucher_batches', 'warranties', 'claims', 'monitoring',
      'dispatched_accounts', 'notifications', 'promo_banners', 'users'
    ])
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      EXCEPTION 
        WHEN duplicate_object THEN NULL;
        WHEN others THEN NULL;
      END;
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
`;
