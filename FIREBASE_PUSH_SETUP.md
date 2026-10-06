# Panduan Lengkap Web Push Notification WayaheDigital (FCM HTTP v1)

Sistem Web Push Notification WayaheDigital menggunakan teknologi resmi **Firebase Cloud Messaging (FCM HTTP v1 API)** dan **Service Worker PWA** standar industri.

Dengan sistem ini, **HP Admin (Android & iPhone/iPad iOS 16.4+)** akan menerima notifikasi suara dan getar langsung di **Status Bar / Lock Screen** saat:
1. 🛒 **Pelanggan Membuat Pesanan Baru**:
   - Judul: `Pesanan Baru`
   - Isi: `Pesanan #INV/20260918/WD/8821 — Telkomsel 10GB — Rp25.000`
2. 💰 **Pembayaran Berhasil / Terverifikasi (QRIS / Mutasi / Callback)**:
   - Judul: `Pembayaran Berhasil`
   - Isi: `Pesanan #INV/20260918/WD/8821 telah dibayar sebesar Rp25.000`
3. 🔍 **Mengklik Notifikasi**:
   - Langsung membuka detail transaksi pada Dashboard Admin.

---

## Langkah 1: Buat Proyek di Firebase Console

1. Buka [Firebase Console](https://console.firebase.google.com/) dan login dengan akun Google Anda.
2. Klik **Add project** (Tambah proyek), beri nama misalnya `wayahedigital-push`.
3. Nonaktifkan Google Analytics (opsional), lalu klik **Create project**.

---

## Langkah 2: Dapatkan Kredensial Frontend (Web App & VAPID Key)

1. Di Firebase Console, klik ikon **Web (`</>`)** pada halaman Project Overview.
2. Beri nama App `WayaheDigital Web`, klik **Register app**.
3. Salin konfigurasi `firebaseConfig`:
   - `apiKey`
   - `projectId`
   - `messagingSenderId`
   - `appId`
4. Buka **Project Settings (Ikon Gerigi)** → Tab **Cloud Messaging**.
5. Gulir ke bagian **Web configuration** → **Web Push certificates** → Klik **Generate key pair**.
6. Salin **Key pair (VAPID Key)** tersebut.
7. Masukkan ke file `.env` di root project:

```env
VITE_FIREBASE_API_KEY="AIzaSy..."
VITE_FIREBASE_PROJECT_ID="wayahedigital-push"
VITE_FIREBASE_MESSAGING_SENDER_ID="123456789012"
VITE_FIREBASE_APP_ID="1:123456789012:web:abcdef123456"
VITE_FIREBASE_VAPID_KEY="BNX..."
```

---

## Langkah 3: Dapatkan Kredensial Backend (Firebase Admin SDK)

1. Di Firebase Console, buka **Project Settings (Ikon Gerigi)** → Tab **Service accounts**.
2. Pastikan opsi **Node.js** terpilih, lalu klik tombol **Generate new private key** (Buat kunci pribadi baru).
3. File JSON akan terunduh (misal: `serviceAccountKey.json`).
4. Buka file JSON tersebut, lalu masukkan nilainya ke file `backend/.env`:

```env
FIREBASE_PROJECT_ID="wayahedigital-push"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@wayahedigital-push.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----"
```

*(Atau Anda juga bisa memasukkan seluruh isi JSON dalam satu baris ke `FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'`)*

---

## Langkah 4: Cara Aktivasi & Pengujian di HP Admin

### A. Di HP Android (Google Chrome / Brave / Edge)
1. Buka link admin website WayaheDigital di Chrome HP Anda (misal: `https://tokoanda.com/owner` atau localhost via tunnel).
2. Masuk ke menu **Pengaturan API** → Tab **Web Push FCM** (atau klik menu **Notifikasi HP** di sidebar).
3. Klik tombol **"Aktifkan Notifikasi di HP / Perangkat Ini"**.
4. Tekan **"Allow" / "Izinkan"** pada jendela popup izin notifikasi browser.
5. Klik tombol **"🔔 Kirim Tes Notifikasi ke HP Admin"** untuk menguji suara & pop-up notifikasi di status bar.

### B. Di iPhone / iPad (Apple iOS 16.4+)
1. Buka link website di browser **Safari iPhone**.
2. Tekan ikon **Share** (kotak dengan panah ke atas di bilah navigasi Safari).
3. Gulir ke bawah dan pilih **"Add to Home Screen" (Tambahkan ke Layar Utama)**.
4. Buka aplikasi WayaheDigital dari ikon baru di Layar Utama HP iPhone Anda.
5. Masuk ke menu **Pengaturan API** → **Web Push FCM**.
6. Klik **"Aktifkan Notifikasi di HP / Perangkat Ini"** dan pilih **"Allow"**.

---

## Keunggulan Implementasi Ini:
- 🚀 **100% Backend-Driven**: Pesanan baru memicu push dari Express API, dan pembayaran memicu push saat status diverifikasi lunas (`PAID`).
- 🛡️ **Penyimpanan Database**: Subscription token perangkat disimpan di PostgreSQL / Prisma, Supabase, dan MongoDB (bukan localStorage).
- 🧹 **Auto-Cleanup**: Token yang expired atau di-uninstall oleh user otomatis dibersihkan dari database tanpa error.
- 🔒 **Aman & Terenkripsi**: Private key tersimpan di backend dan tidak pernah dikirim ke browser.
