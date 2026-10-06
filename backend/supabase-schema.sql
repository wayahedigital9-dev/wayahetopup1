-- ============================================================
-- WAYAHEDIGITAL SUPABASE DATABASE SCHEMA MIGRATION
-- Copy & Paste script ini ke Supabase Dashboard -> SQL Editor -> Run
-- ============================================================

-- 1. TABEL PENGGUNA & MEMBER (users)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  phone TEXT,
  name TEXT,
  username TEXT,
  password TEXT,
  role TEXT DEFAULT 'CUSTOMER',
  member_tier TEXT DEFAULT 'MEMBER',
  balance NUMERIC DEFAULT 0,
  reward_points INTEGER DEFAULT 0,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2. TABEL KATALOG PRODUK (products)
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  category_id TEXT,
  provider TEXT,
  name TEXT NOT NULL,
  sku TEXT,
  nominal NUMERIC,
  supplier_price NUMERIC DEFAULT 0,
  selling_price NUMERIC NOT NULL,
  delivery_method TEXT DEFAULT 'AUTOMATIC',
  is_active BOOLEAN DEFAULT true,
  stock INTEGER DEFAULT 10,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 3. TABEL TRANSAKSI & PESANAN (orders)
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  target_destination TEXT,
  category TEXT,
  subtotal NUMERIC DEFAULT 0,
  admin_fee NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  promo_code TEXT,
  total_amount NUMERIC NOT NULL,
  payment_status TEXT DEFAULT 'PENDING',
  fulfillment_status TEXT DEFAULT 'NOT_STARTED',
  payment_method TEXT DEFAULT 'QRIS',
  delivery_method TEXT,
  guest_access_token TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS qiospay_refid TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS qiospay_nmid TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS qiospay_issuer TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS qiospay_paid_at TIMESTAMPTZ;

-- Pakasir API v2 Gateway Fields
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS product_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fee NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_payment NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pakasir_txn_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_link TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS qr_string TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS raw_payment_response JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS raw_webhook JSONB DEFAULT '{}'::jsonb;

-- Indexes for fast Lookup and Uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_pakasir_txn_id ON public.orders(pakasir_txn_id) WHERE pakasir_txn_id IS NOT NULL;

-- 3b. TABEL QIOSPAY EVENTS (qiospay_events)
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

-- 4. TABEL BATCH VOUCHER WIFI (wifi_batches)
CREATE TABLE IF NOT EXISTS public.wifi_batches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  package_duration TEXT NOT NULL,
  price NUMERIC NOT NULL,
  vouchers JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 5. TABEL PENGATURAN SISTEM (settings)
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- AKTIFKAN RLS (Row Level Security) DENGAN AKSES AMAN
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wifi_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Kebijakan Akses Baca & Tulis
CREATE POLICY IF NOT EXISTS "Public Read Products" ON public.products FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public Read Settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Service Role Full Access Orders" ON public.orders FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "Service Role Full Access Users" ON public.users FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "Service Role Full Access Products" ON public.products FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "Service Role Full Access Settings" ON public.settings FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "Service Role Full Access Wifi" ON public.wifi_batches FOR ALL USING (true);

-- Indexes untuk pencarian instan
CREATE INDEX IF NOT EXISTS idx_orders_invoice ON public.orders(invoice_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
