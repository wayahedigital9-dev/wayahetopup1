# WayaheDigital ⚡
> **"Kebutuhan digitalmu, dalam satu tempat."**

Platform e-commerce modern, cepat, dan terpercaya untuk transaksi **pulsa all-operator**, **paket data / kuota internet**, **voucher WiFi RT/RW Net**, dan **produk premium digital** (Spotify, Netflix, Canva, YouTube Premium, dll).

Dilengkapi dengan antarmuka berbahasa Indonesia yang responsif, terintegrasi dengan **Qiospay QRIS Gateway**, **Digiflazz Buyer API**, sistem inventori batch voucher WiFi, proteksi idempotensi transaksi, worker pemenuhan latar belakang, serta pelacak invoice terenkripsi token.

---

## 🏗️ Arsitektur Teknologi

* **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide React, Vite.
* **Backend API**: Node.js, Express, TypeScript, Helmet, Express Rate Limit.
* **Database & ORM**: PostgreSQL dengan Prisma & Drizzle ORM.
* **Payment Gateway**: Qiospay QRIS (Get Mutasi & Callback Accept API).
* **Supplier Pulsa & Kuota**: Digiflazz Buyer API (MD5 transaction signature).
* **Worker & Background Jobs**: Worker pemenuhan otomatis dan rekonsiliasi periodik transaksi menggantung.
* **Mode Demo / Preview**: Adapter mock development terisolasi dengan simulator pembayaran QRIS dan pengujian kegagalan/sukses tanpa uang riil.

---

## 📁 Struktur Folder Proyek

```
wayahedigital/
├── backend/                        # Layanan Backend API & Worker
│   ├── prisma/
│   │   └── schema.prisma           # Skema database PostgreSQL
│   ├── src/
│   │   ├── services/
│   │   │   ├── paymentRouter.ts    # Integrasi Qiospay QRIS & Dynamic QRIS Engine
│   │   │   ├── digiflazz.ts        # Integrasi Digiflazz Buyer API & MD5 sign
│   │   │   ├── fulfillment.ts      # Engine pemenuhan pesanan multi-kategori
│   │   │   └── ngrok.ts            # Ngrok tunnel manager
│   │   ├── config/
│   │   │   ├── apikeys.ts          # Konfigurasi aman seluruh API Keys
│   │   │   └── console.js          # Pengaturan console & database URL
│   │   ├── index.ts                # Server API Express, rate limiting, routing
│   │   └── worker.ts               # Background worker & job rekonsiliasi
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── src/                            # Frontend Web Application (React + Vite)
│   ├── components/                 # Komponen UI (Navbar, Footer, Modal, StatusBadge, Toast, dll.)
│   ├── data/                       # Mock data awal (katalog, promo, voucher WiFi)
│   ├── pages/                      # Halaman web (Beranda, Pulsa, Kuota, WiFi, Premium, Checkout, Transaksi, Akun, Bantuan, Admin)
│   ├── services/
│   │   ├── apiAdapter.ts           # Adapter mock & state machine transisi pembayaran
│   │   └── storage.ts              # Lapisan penyimpanan lokal (localStorage engine)
│   ├── types/                      # Definisi TypeScript domain models
│   ├── utils/                      # Helper deteksi prefix operator & format rupiah
│   ├── App.tsx                     # Entry point routing & modal orchestrator
│   └── main.tsx
│
├── metadata.json                   # Konfigurasi metadata aplikasi AI Studio
└── README.md                       # Panduan instalasi dan operasional
```

---

## 🚀 Panduan Instalasi & Menjalankan

### 1. Prasyarat Sistem
Pastikan perangkat Anda telah terpasang:
- **Node.js**: Versi `>= 18.x` atau `>= 20.x`
- **npm** atau **yarn** atau **pnpm**
- **PostgreSQL**: Versi `>= 14.x` (Lokal atau Cloud seperti Supabase/Neon/RDS)

---

### 2. Konfigurasi Environment Variable

#### Backend (`/backend/.env`)
Salin file percontohan dan sesuaikan kredensial Anda:
```bash
cd backend
cp .env.example .env
```
Isi variabel berikut:
```env
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Koneksi PostgreSQL
DATABASE_URL="postgresql://postgres:password123@localhost:5432/wayahedigital_db?schema=public"

# Kredensial Qiospay QRIS Payment Gateway
QIOSPAY_MERCHANT_CODE="YOUR_MERCHANT_CODE"
QIOSPAY_API_KEY="YOUR_API_KEY"
QIOSPAY_EXPECTED_NMID="ID10200211... (Opsional)"
CALLBACK_SECRET="mysecret"
ADMIN_TOKEN="admintoken"

# Kredensial Digiflazz Buyer
DIGIFLAZZ_USERNAME="username_digiflazz_anda"
DIGIFLAZZ_API_KEY="api_key_digiflazz_anda"
DIGIFLAZZ_BASE_URL="https://api.digiflazz.com/v1"
```

---

### 3. Migrasi Database Prisma

Jalankan perintah prisma di direktori `backend/`:
```bash
cd backend

# Install dependencies
npm install

# Buat tabel di PostgreSQL sesuai schema.prisma
npx prisma migrate dev --name init_wayahedigital

# Generate Prisma Client
npx prisma generate
```

---

### 4. Menjalankan Aplikasi

#### Menjalankan Frontend
Pada root direktori:
```bash
npm install
npm run dev
```
Aplikasi frontend akan aktif di `http://localhost:3000`.

#### Menjalankan Backend API
Buka terminal baru di direktori `backend/`:
```bash
cd backend
npm run dev
```
Backend API akan aktif di `http://localhost:4000`.

#### Menjalankan Worker Pemenuhan & Rekonsiliasi
Buka terminal terpisah untuk menjalankan background worker:
```bash
cd backend
npm run worker
```

---

### 5. Setup Webhook Gateway & Tunnel Ngrok

Untuk menerima notifikasi status deposit/pembayaran instan:
1. Jalankan ngrok tunnel melalui tombol di tab Bot Setting & API pada Panel Admin (`/owner`).
2. Masukkan Webhook URL pada dashboard Qiospay:
   ```
   https://[domain-ngrok-anda]/api/callback/accept/[secret_key]
   ```

---

## 🔒 Fitur Keamanan & Kualitas Produksi

1. **Anti-Manipulasi Harga**: Total tagihan dan diskon dihitung secara ketat di sisi server/backend berdasarkan data master produk, bukan menerima nominal dari client.
2. **Idempotensi Transaksi**: Permintaan checkout ganda atau duplikasi webhook tidak akan memicu pemenuhan berulang.
3. **Privasi Data Pelanggan**:
   - Transaksi tamu diproteksi menggunakan kombinasi nomor invoice dan token akses acak (`guestAccessToken`) atau validasi nomor telepon tujuan.
   - Tidak menampilkan data pembayaran sensitif pada invoice.
4. **Alokasi Voucher WiFi RT/RW Net Aman**: Menggunakan mekanisme reservasi sementara selama 15 menit agar kode voucher yang sama tidak terjual ganda pada saat bersamaan.
5. **Mode Demo Khusus Development**: Memungkinkan eksplorasi menyeluruh langsung dari antarmuka browser.
