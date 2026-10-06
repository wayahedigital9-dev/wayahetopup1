import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
import * as dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config();

const sampleProducts = [
  // ── 3. VOUCHER WIFI (MELATINET / HOTSPOT) ─────────────────────────
  {
    id: 'prod-wifi-1jam',
    categoryId: 'WIFI' as const,
    provider: 'MelatiNet',
    name: 'Voucher WiFi MelatiNet 1 Jam',
    sku: 'WIFI-MELATI-1H',
    supplierSku: null,
    nominal: null,
    description: 'Akses internet hotspot tanpa batas kecepatan up to 10 Mbps selama 1 jam.',
    supplierPrice: 1000,
    sellingPrice: 2000,
    discountPrice: null,
    quotaDetails: 'Unlimited Quota',
    duration: '1 Jam',
    speed: 'Up to 10 Mbps',
    networkLocation: 'Area Melati RT 01-05',
    deliveryMethod: 'AUTOMATIC' as const,
    isActive: true,
    stock: 0,
    badge: 'HEMAT',
  },
  {
    id: 'prod-wifi-6jam',
    categoryId: 'WIFI' as const,
    provider: 'MelatiNet',
    name: 'Voucher WiFi MelatiNet 6 Jam',
    sku: 'WIFI-MELATI-6H',
    supplierSku: null,
    nominal: null,
    description: 'Akses internet super cepat up to 10 Mbps selama 6 jam aktif setelah login.',
    supplierPrice: 3000,
    sellingPrice: 5000,
    discountPrice: null,
    quotaDetails: 'Unlimited Quota',
    duration: '6 Jam',
    speed: 'Up to 10 Mbps',
    networkLocation: 'Area Melati RT 01-05',
    deliveryMethod: 'AUTOMATIC' as const,
    isActive: true,
    stock: 0,
    badge: null,
  },
  {
    id: 'prod-wifi-24jam',
    categoryId: 'WIFI' as const,
    provider: 'MelatiNet',
    name: 'Voucher WiFi MelatiNet 24 Jam (1 Hari)',
    sku: 'WIFI-MELATI-24H',
    supplierSku: null,
    nominal: null,
    description: 'Akses internet stabil & kencang up to 20 Mbps selama 24 Jam.',
    supplierPrice: 6000,
    sellingPrice: 10000,
    discountPrice: 9000,
    quotaDetails: 'Unlimited Quota',
    duration: '24 Jam',
    speed: 'Up to 20 Mbps',
    networkLocation: 'Area Melati & Sekitarnya',
    deliveryMethod: 'AUTOMATIC' as const,
    isActive: true,
    stock: 0,
    badge: 'POPULER',
  },
  {
    id: 'prod-wifi-7hari',
    categoryId: 'WIFI' as const,
    provider: 'MelatiNet',
    name: 'Voucher WiFi MelatiNet Mingguan (7 Hari)',
    sku: 'WIFI-MELATI-7D',
    supplierSku: null,
    nominal: null,
    description: 'Paket WiFi hemat 7 hari nonstop kecepatan up to 20 Mbps.',
    supplierPrice: 20000,
    sellingPrice: 35000,
    discountPrice: null,
    quotaDetails: 'Unlimited Quota',
    duration: '7 Hari',
    speed: 'Up to 20 Mbps',
    networkLocation: 'Area Melati & Sekitarnya',
    deliveryMethod: 'AUTOMATIC' as const,
    isActive: true,
    stock: 0,
    badge: null,
  },
  {
    id: 'prod-wifi-30hari',
    categoryId: 'WIFI' as const,
    provider: 'MelatiNet',
    name: 'Voucher WiFi MelatiNet Bulanan (30 Hari)',
    sku: 'WIFI-MELATI-30D',
    supplierSku: null,
    nominal: null,
    description: 'Paket WiFi MelatiNet 30 Hari kecepatan up to 30 Mbps untuk kerja & streaming.',
    supplierPrice: 60000,
    sellingPrice: 100000,
    discountPrice: 95000,
    quotaDetails: 'Unlimited Quota',
    duration: '30 Hari',
    speed: 'Up to 30 Mbps',
    networkLocation: 'Area Melati & Sekitarnya',
    deliveryMethod: 'AUTOMATIC' as const,
    isActive: true,
    stock: 0,
    badge: 'PRIORITAS',
  },

  // ── 4. AKUN PREMIUM DIGITAL ───────────────────────────────────────
  {
    id: 'prod-prem-netflix-1m',
    categoryId: 'PREMIUM' as const,
    provider: 'Netflix',
    name: 'Netflix Premium 4K UHD 1 Bulan (1 Profil)',
    sku: 'PREM-NETFLIX-1M',
    supplierSku: null,
    nominal: null,
    description: 'Akun Netflix Premium 1 Profil Privat 4K Ultra HD garansi 30 hari penuh.',
    supplierPrice: 28000,
    sellingPrice: 35000,
    discountPrice: null,
    quotaDetails: '1 Profil Privat + PIN',
    duration: '30 Hari',
    speed: '4K Ultra HD',
    networkLocation: 'Global',
    deliveryMethod: 'AUTOMATIC' as const,
    isActive: true,
    stock: 15,
    badge: 'BEST SELLER',
  },
  {
    id: 'prod-prem-spotify-1m',
    categoryId: 'PREMIUM' as const,
    provider: 'Spotify',
    name: 'Spotify Premium Individual 1 Bulan',
    sku: 'PREM-SPOTIFY-1M',
    supplierSku: null,
    nominal: null,
    description: 'Spotify Premium Individual akun pribadi bebas iklan dan download lagu offline.',
    supplierPrice: 16000,
    sellingPrice: 22000,
    discountPrice: null,
    quotaDetails: 'Individual Plan',
    duration: '30 Hari',
    speed: 'High Quality Audio 320kbps',
    networkLocation: 'Indonesia',
    deliveryMethod: 'AUTOMATIC' as const,
    isActive: true,
    stock: 25,
    badge: 'POPULER',
  },
  {
    id: 'prod-prem-yt-1m',
    categoryId: 'PREMIUM' as const,
    provider: 'YouTube',
    name: 'YouTube Premium 1 Bulan (No Ads + YT Music)',
    sku: 'PREM-YT-1M',
    supplierSku: null,
    nominal: null,
    description: 'Nonton YouTube tanpa jeda iklan, background play, dan gratis YouTube Music.',
    supplierPrice: 12000,
    sellingPrice: 18000,
    discountPrice: null,
    quotaDetails: 'Akun Pribadi',
    duration: '30 Hari',
    speed: 'Full HD / 4K',
    networkLocation: 'Indonesia',
    deliveryMethod: 'AUTOMATIC' as const,
    isActive: true,
    stock: 30,
    badge: null,
  },
  {
    id: 'prod-prem-canva-1m',
    categoryId: 'PREMIUM' as const,
    provider: 'Canva',
    name: 'Canva Pro Edu / Team 1 Bulan',
    sku: 'PREM-CANVA-1M',
    supplierSku: null,
    nominal: null,
    description: 'Akses semua template premium, penghapus background, dan jutaan aset desain grafis.',
    supplierPrice: 8000,
    sellingPrice: 15000,
    discountPrice: null,
    quotaDetails: 'Akses Pro Lengkap',
    duration: '30 Hari',
    speed: 'Cloud Storage 100GB',
    networkLocation: 'Global',
    deliveryMethod: 'AUTOMATIC' as const,
    isActive: true,
    stock: 40,
    badge: 'HEMAT',
  },
];

const samplePromoCodes = [
  {
    id: 'promo-diskon-2rb',
    code: 'DISKON2RB',
    discountAmount: 2000,
    minTransaction: 10000,
    description: 'Potongan Rp 2.000 untuk transaksi minimal Rp 10.000',
    isActive: true,
  },
  {
    id: 'promo-wayahe-hemat',
    code: 'WAYAHEHEMAT',
    discountAmount: 5000,
    minTransaction: 25000,
    description: 'Spesial hemat Rp 5.000 untuk pembelian paket kuota & WiFi',
    isActive: true,
  },
  {
    id: 'promo-barusikat',
    code: 'BARUSIKAT',
    discountAmount: 10000,
    minTransaction: 50000,
    description: 'Diskon jumbo Rp 10.000 untuk akun premium & paket bulanan',
    isActive: true,
  },
];

const sampleUsers = [
  {
    id: 'usr-admin-01',
    name: 'Administrator WayaheDigital',
    email: 'admin@wayahedigital.id',
    phone: '081234567890',
    password: '$2b$10$SampleHashedPasswordForAdminSecurity12345',
    role: 'ADMIN' as const,
  },
  {
    id: 'usr-cust-01',
    name: 'Budi Santoso',
    email: 'budi.santoso@gmail.com',
    phone: '085712345678',
    password: null,
    role: 'CUSTOMER' as const,
  },
];

const sampleWifiBatches: Array<{
  id: string;
  name: string;
  location: string;
  speedProfile: string;
  duration: string;
}> = [];

const sampleWifiVouchers: Array<{
  id: string;
  batchId: string;
  location: string;
  packageDuration: string;
  code: string;
  password?: string;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD';
}> = [];

export async function seedDatabase() {
  console.log('🌱 [Seed] Menyiapkan sample plans & data untuk database & Drizzle Studio...');

  // 1. Simpan ke File DB (Fallback JSON Store)
  const dbFile = path.join(process.cwd(), 'data', 'db.json');
  try {
    let currentDbState: any = {
      orders: {},
      qiospayEvents: {},
      auditLogs: [],
      products: {},
      wifiVoucherItems: {},
      digiflazzLogs: [],
      users: {},
      promoCodes: {},
    };

    if (fs.existsSync(dbFile)) {
      try {
        currentDbState = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
      } catch (_) {}
    }

    // Masukkan products
    for (const p of sampleProducts) {
      currentDbState.products[p.id] = { ...p, createdAt: new Date(), updatedAt: new Date() };
    }

    // Masukkan promoCodes
    for (const promo of samplePromoCodes) {
      currentDbState.promoCodes[promo.code] = { ...promo, createdAt: new Date() };
    }

    // Masukkan users
    for (const u of sampleUsers) {
      currentDbState.users[u.id] = { ...u, createdAt: new Date(), updatedAt: new Date() };
    }

    // Masukkan vouchers
    for (const v of sampleWifiVouchers) {
      currentDbState.wifiVoucherItems[v.id] = { ...v, createdAt: new Date(), updatedAt: new Date() };
    }

    fs.mkdirSync(path.dirname(dbFile), { recursive: true });
    fs.writeFileSync(dbFile, JSON.stringify(currentDbState, null, 2), 'utf8');
    console.log(`✅ [File DB] Berhasil menyemai ${sampleProducts.length} plans & produk ke: data/db.json`);
  } catch (err: any) {
    console.warn('⚠️ Gagal menyimpan ke File DB:', err.message);
  }

  // 2. Coba simpan ke PostgreSQL via Drizzle jika koneksi PostgreSQL aktif
  if (process.env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 3000,
    });

    try {
      const client = await pool.connect();
      console.log('🔌 [PostgreSQL] Terhubung ke database PostgreSQL. Memasukkan sample data...');
      const db = drizzle(pool, { schema });

      // Upsert Users
      for (const u of sampleUsers) {
        await db.insert(schema.users).values(u).onConflictDoNothing();
      }

      // Upsert Products
      for (const p of sampleProducts) {
        await db.insert(schema.products).values(p).onConflictDoUpdate({
          target: schema.products.sku,
          set: {
            name: p.name,
            sellingPrice: p.sellingPrice,
            supplierPrice: p.supplierPrice,
            description: p.description,
            duration: p.duration,
            speed: p.speed,
            badge: p.badge,
            isActive: p.isActive,
          },
        });
      }

      // Upsert Promo Codes
      for (const pr of samplePromoCodes) {
        await db.insert(schema.promoCodes).values(pr).onConflictDoNothing();
      }

      // Upsert Wifi Batches & Items
      for (const b of sampleWifiBatches) {
        await db.insert(schema.wifiVoucherBatches).values(b).onConflictDoNothing();
      }
      for (const vi of sampleWifiVouchers) {
        await db.insert(schema.wifiVoucherItems).values(vi).onConflictDoNothing();
      }

      // Audit Log
      await db.insert(schema.auditLogs).values({
        action: 'DATABASE_SEEDED',
        performedBy: 'System Seeder',
        details: `Berhasil menambahkan ${sampleProducts.length} produk & paket ke database.`,
      });

      client.release();
      await pool.end();
      console.log(`🎉 [PostgreSQL] Sukses menyemai ${sampleProducts.length} plans ke PostgreSQL!`);
    } catch (pgErr: any) {
      console.log('ℹ️ [PostgreSQL Info] Server PostgreSQL lokal tidak aktif atau URL belum terjangkau.');
      console.log('   Data sample tetap aman tersimpan di Resilient File Store (data/db.json).');
      try {
        await pool.end();
      } catch (_) {}
    }
  }

}

// Eksekusi jika dijalankan langsung via CLI (npx tsx src/db/seed.ts)
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed Error:', err);
      process.exit(1);
    });
}
