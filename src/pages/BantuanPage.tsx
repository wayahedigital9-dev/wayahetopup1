import React, { useState } from 'react';
import { 
  HelpCircle, 
  Search, 
  MessageCircle, 
  Mail, 
  Clock, 
  ShieldCheck, 
  FileText, 
  ChevronDown, 
  ChevronUp,
  Headphones,
  Lock
} from 'lucide-react';
import { storage } from '../services/storage';

export function BantuanPage() {
  const [activeTab, setActiveTab] = useState<'FAQ' | 'KONTAK' | 'SYARAT' | 'PRIVASI'>('FAQ');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const settings = storage.getSettings();

  const faqs = [
    {
      kategori: 'Pembayaran',
      q: 'Metode pembayaran apa saja yang didukung oleh WayaheDigital?',
      a: 'Kami menerima pembayaran instan melalui QRIS (dapat dipindai oleh GoPay, OVO, Dana, LinkAja, ShopeePay, BCA Mobile, Livin by Mandiri, BRImo), Virtual Account Bank (BCA, Mandiri, BRI, BNI, Permata), dan gerai ritel modern via payment gateway terverifikasi.',
    },
    {
      kategori: 'Transaksi',
      q: 'Bagaimana jika pembayaran sudah sukses tetapi pulsa atau kuota belum masuk?',
      a: 'Pertama, periksa status transaksi di menu "Cek Transaksi" dengan nomor invoice dan nomor HP Anda. Jika status menunjukkan pemenuhan sedang diproses oleh supplier Digiflazz, mohon tunggu 1-3 menit. Jika terjadi timeout pada jaringan supplier, sistem akan merekonsiliasi transaksi secara otomatis atau dialihkan ke tim bantuan kami.',
    },
    {
      kategori: 'Voucher WiFi',
      q: 'Bagaimana jika voucher WiFi RT/RW Net tidak bisa login di captive portal?',
      a: 'Pastikan Anda telah terhubung ke sinyal hotspot WiFi yang tepat di lokasi yang dipilih. Periksa penulisan huruf besar/kecil pada kode voucher. Jika muncul pesan "User already logged in", pastikan voucher tidak sedang digunakan di perangkat lain. Hubungi nomor pengelola jaringan di invoice jika memerlukan reset binding MAC address.',
    },
    {
      kategori: 'Premium Digital',
      q: 'Apakah WayaheDigital membutuhkan password akun pribadi saya?',
      a: 'TIDAK. Kami memegang prinsip zero-credential policy. Kami tidak pernah meminta password akun pribadi pelanggan. Produk premium diserahkan melalui kode voucher resmi, link aktivasi resmi, atau undangan resmi.',
    },
    {
      kategori: 'Keamanan',
      q: 'Apakah data nomor telepon dan transaksi saya aman?',
      a: 'Sangat aman. Seluruh data transaksi dienkripsi dan kami tidak pernah menjual atau membagikan nomor telepon Anda ke pihak ketiga manapun untuk keperluan spam promosi.',
    },
  ];

  const filteredFaqs = faqs.filter(f => 
    f.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.a.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.kategori.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <HelpCircle size={18} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Pusat Bantuan & Kebijakan
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-500">
          Temukan jawaban pertanyaan umum, hubungi customer service kami, atau baca ketentuan layanan resmi.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4 sm:gap-8 text-xs sm:text-sm font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('FAQ')}
          className={`pb-3 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'FAQ'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Tanya Jawab (FAQ)
        </button>
        <button
          onClick={() => setActiveTab('KONTAK')}
          className={`pb-3 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'KONTAK'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Hubungi Customer Service
        </button>
        <button
          onClick={() => setActiveTab('SYARAT')}
          className={`pb-3 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'SYARAT'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Syarat & Ketentuan
        </button>
        <button
          onClick={() => setActiveTab('PRIVASI')}
          className={`pb-3 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'PRIVASI'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Kebijakan Privasi
        </button>
      </div>

      {/* 1. Tab FAQ */}
      {activeTab === 'FAQ' && (
        <div className="space-y-6">
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari pertanyaan seputar pembayaran, voucher, atau pulsa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-3">
            {filteredFaqs.map((faq, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 font-bold text-sm text-slate-900 hover:text-indigo-600 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
                      {faq.kategori}
                    </span>
                    <span>{faq.q}</span>
                  </div>
                  {expandedFaq === idx ? (
                    <ChevronUp size={18} className="text-indigo-600 shrink-0" />
                  ) : (
                    <ChevronDown size={18} className="text-slate-400 shrink-0" />
                  )}
                </button>

                {expandedFaq === idx && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Tab Kontak Support */}
      {activeTab === 'KONTAK' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Headphones size={18} className="text-teal-600" />
              Kontak Layanan Resmi
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Tim support kami berdedikasi melayani pertanyaan dan bantuan rekonsiliasi pembayaran pada jam kerja operasional.
            </p>

            <div className="space-y-3 pt-2">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                <MessageCircle size={20} className="text-emerald-600 shrink-0" />
                <div>
                  <span className="text-[11px] text-slate-500 block">WhatsApp Customer Care:</span>
                  <span className="text-sm font-bold text-slate-800">{settings.supportWhatsApp}</span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                <Mail size={20} className="text-indigo-600 shrink-0" />
                <div>
                  <span className="text-[11px] text-slate-500 block">Email Resmi:</span>
                  <span className="text-sm font-bold text-slate-800">{settings.supportEmail}</span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                <Clock size={20} className="text-amber-600 shrink-0" />
                <div>
                  <span className="text-[11px] text-slate-500 block">Jam Operasional Pelayanan:</span>
                  <span className="text-xs font-semibold text-slate-800">{settings.supportHours}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-indigo-50/60 rounded-2xl p-6 border border-indigo-200 space-y-4 text-xs text-indigo-950">
            <h4 className="font-bold text-sm text-indigo-900 flex items-center gap-2">
              <ShieldCheck size={18} className="text-teal-600" />
              Tips Saat Menghubungi Dukungan
            </h4>
            <ul className="space-y-2.5 text-slate-700 list-disc pl-4 leading-relaxed">
              <li>Lampirkan <strong>Nomor Invoice</strong> (contoh: INV/20260916/WD/1001) agar staf dapat langsung mengecek status transaksi.</li>
              <li>Sertakan bukti transfer atau screenshot QRIS jika pembayaran Virtual Account mengalami keterlambatan webhook.</li>
              <li>Jangan pernah memberikan password pribadi akun Anda kepada siapa pun, termasuk staf kami.</li>
            </ul>
          </div>
        </div>
      )}

      {/* 3. Tab Syarat & Ketentuan */}
      {activeTab === 'SYARAT' && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-5 text-xs text-slate-700 leading-relaxed">
          <h2 className="text-base font-extrabold text-slate-900">
            Syarat dan Ketentuan Layanan WayaheDigital
          </h2>
          <p>
            Selamat datang di WayaheDigital. Dengan melakukan transaksi di platform kami, Anda setuju untuk terikat pada ketentuan berikut:
          </p>

          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">1. Ketentuan Transaksi Pulsa & Paket Data</h3>
            <p>
              Pelanggan bertanggung jawab penuh atas kebenaran nomor telepon tujuan yang dimasukkan. Transaksi pengisian yang telah berhasil dikirimkan oleh supplier Digiflazz tidak dapat dibatalkan atau ditarik kembali.
            </p>

            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">2. Ketentuan Voucher WiFi RT/RW Net</h3>
            <p>
              Voucher WiFi RT/RW Net hanya berlaku pada jaringan hotspot mitra di lokasi yang tertera. Masa aktif voucher berjalan terhitung sejak pertama kali kode voucher berhasil login di captive portal.
            </p>

            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">3. Pembayaran dan Payment Gateway</h3>
            <p>
              Seluruh pembayaran diproses melalui payment gateway terverifikasi. Sesi pembayaran memiliki batas waktu kedaluwarsa. Transaksi yang dibayarkan setelah batas kedaluwarsa akan masuk ke tahap rekonsiliasi manual admin.
            </p>

            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">4. Kebijakan Pengembalian Dana (Refund)</h3>
            <p>
              Pengembalian dana hanya diberikan apabila transaksi telah terdebet dari rekening pembeli namun produk tidak dapat dipenuhi secara permanen akibat kendala stok atau gangguan supplier yang tidak dapat diperbaiki.
            </p>
          </div>
        </div>
      )}

      {/* 4. Tab Kebijakan Privasi */}
      {activeTab === 'PRIVASI' && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-5 text-xs text-slate-700 leading-relaxed">
          <h2 className="text-base font-extrabold text-slate-900">
            Kebijakan Privasi Pengguna
          </h2>
          <p>
            WayaheDigital menghargai dan melindungi hak privasi setiap pelanggan:
          </p>

          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">1. Informasi yang Kami Kumpulkan</h3>
            <p>
              Kami hanya mengumpulkan informasi yang diperlukan untuk pemenuhan transaksi, yaitu nomor telepon tujuan pengisian, alamat email (jika dicantumkan), serta catatan teknis pembayaran.
            </p>

            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">2. Keamanan Kredensial Pengguna</h3>
            <p>
              Kami TIDAK PERNAH meminta, menyimpan, atau mencatat kata sandi akun pribadi (seperti password Spotify, Google, atau email pribadi). Aktivasi produk pihak ketiga dijalankan melalui API resmi atau tautan undangan legal.
            </p>

            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">3. Perlindungan Terhadap Pihak Ketiga</h3>
            <p>
              Kami tidak menjual, menyewakan, atau memperdagangkan data pribadi Anda kepada pihak mana pun untuk keperluan iklan atau pemasaran spam.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
