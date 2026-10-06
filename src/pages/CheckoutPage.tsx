import React, { useState } from 'react';
import { 
  ArrowLeft, 
  ShieldCheck, 
  Tag, 
  Zap, 
  Check, 
  AlertTriangle, 
  CreditCard, 
  HelpCircle,
  Clock,
  User,
  Phone,
  Mail,
  Receipt,
  QrCode
} from 'lucide-react';
import { Product, Order, PromoCode } from '../types';
import { formatRupiah } from '../utils/operator';
import { apiAdapter } from '../services/apiAdapter';
import { storage } from '../services/storage';
import { ProductLogo } from '../components/ProductLogo';

interface CheckoutPageProps {
  product: Product;
  targetDestination: string;
  onBack: () => void;
  onOrderCreated: (order: Order, snapToken: string) => void;
  onShowToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const getGameMeta = (product: Product | null) => {
  if (!product) return { isGame: false, isMLBB: false, isFreeFire: false, isGenshin: false, isValorant: false, isPubg: false };
  const prov = (product.provider || '').toLowerCase();
  const name = (product.name || '').toLowerCase();
  const cat = (product.categoryId || '').toLowerCase();
  const isGame = cat === 'game' || prov.includes('legend') || prov.includes('free fire') || prov.includes('genshin') || prov.includes('valorant') || prov.includes('pubg') || name.includes('diamond') || name.includes('mobile legend');

  const isMLBB = isGame && (prov.includes('mobile legend') || prov.includes('mlbb') || name.includes('mobile legend') || name.includes('mlbb') || name.includes('diamond pass'));
  const isFreeFire = isGame && (prov.includes('free fire') || prov.includes('ff') || name.includes('free fire'));
  const isGenshin = isGame && (prov.includes('genshin') || name.includes('genshin') || name.includes('genesis'));
  const isValorant = isGame && (prov.includes('valorant') || name.includes('valorant') || name.includes('point valorant'));
  const isPubg = isGame && (prov.includes('pubg') || name.includes('pubg') || name.includes(' uc'));

  return { isGame, isMLBB, isFreeFire, isGenshin, isValorant, isPubg };
};

export function CheckoutPage({
  product,
  targetDestination,
  onBack,
  onOrderCreated,
  onShowToast,
}: CheckoutPageProps) {
  const [destination, setDestination] = useState(targetDestination);
  // Game-specific inputs
  const [gameUserId, setGameUserId] = useState('');
  const [gameZoneId, setGameZoneId] = useState('');
  const [genshinServer, setGenshinServer] = useState('os_asia');
  // SMM-specific inputs
  const [smmQty, setSmmQty] = useState<number>(product?.smmMin || 100);
  const [smmComments, setSmmComments] = useState<string>('');

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  
  // Promo code
  const [promoCodeInput, setPromoCodeInput] = useState('WAYAHEHEMAT');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoError, setPromoError] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isAgreed, setIsAgreed] = useState(true);

  const settings = storage.getSettings();
  const isPakasir = settings.paymentGatewayProvider === 'PAKASIR';
  const isSystemStopped = settings.systemStatus === 'STOPPED';

  const gameMeta = getGameMeta(product);

  // Apply default promo code on load if valid & parse targetDestination for MLBB
  React.useEffect(() => {
    handleApplyPromo('WAYAHEHEMAT');
    if (targetDestination) {
      if (gameMeta.isMLBB) {
        const match = targetDestination.match(/^([0-9]+)\s*(?:\((.+?)\))?$/);
        if (match) {
          setGameUserId(match[1] || '');
          setGameZoneId(match[2] || '');
        } else {
          setGameUserId(targetDestination);
        }
      } else {
        setGameUserId(targetDestination);
      }
    }
  }, []);

  const handleApplyPromo = (codeToApply?: string) => {
    const code = (codeToApply || promoCodeInput).trim().toUpperCase();
    if (!code) {
      setAppliedPromo(null);
      setPromoError('');
      return;
    }
    const promos = storage.getPromos();
    const matched = promos.find(p => p.code.toUpperCase() === code && p.isActive);

    if (matched) {
      if (matched.validUntil && new Date(matched.validUntil).getTime() < Date.now()) {
        setPromoError(`Kode voucher ${code} sudah kedaluwarsa.`);
        setAppliedPromo(null);
        return;
      }
      if (product.sellingPrice < (matched.minTransaction || 0)) {
        setPromoError(`Minimal transaksi untuk kode ${code} adalah ${formatRupiah(matched.minTransaction)}`);
        setAppliedPromo(null);
      } else {
        setAppliedPromo(matched);
        setPromoError('');
        const effectiveDisc = matched.discountPercentage && matched.discountPercentage > 0
          ? (matched.maxDiscount
              ? Math.min(matched.maxDiscount, Math.round((product.sellingPrice * matched.discountPercentage) / 100))
              : Math.round((product.sellingPrice * matched.discountPercentage) / 100))
          : (matched.discountAmount || 0);
        onShowToast('Voucher Terpasang!', `Berhasil mendapatkan diskon ${formatRupiah(effectiveDisc)}`, 'success');
      }
    } else {
      setPromoError('Kode voucher tidak valid atau telah berakhir.');
      setAppliedPromo(null);
    }
  };

  const effectiveSellingRate = product.ratePer1000 || product.sellingPrice;
  const baseProductPrice = product.categoryId === 'smm'
    ? Math.ceil((effectiveSellingRate * (smmQty || product.smmMin || 100)) / 1000)
    : product.sellingPrice;

  const discountAmount = appliedPromo
    ? (appliedPromo.discountPercentage && appliedPromo.discountPercentage > 0
        ? (appliedPromo.maxDiscount
            ? Math.min(appliedPromo.maxDiscount, Math.round((baseProductPrice * appliedPromo.discountPercentage) / 100))
            : Math.round((baseProductPrice * appliedPromo.discountPercentage) / 100))
        : (appliedPromo.discountAmount || 0))
    : 0;
  const adminFee = 0;
  const grandTotal = Math.max(0, baseProductPrice - discountAmount + adminFee);

  const handleCreateOrderAndPay = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSystemStopped) {
      onShowToast(
        'Sistem Transaksi Dijeda',
        settings.systemMaintenanceMessage || 'Sistem transaksi sedang dijeda sementara oleh Administrator untuk pemeliharaan rutin. Silakan coba kembali nanti.',
        'warning'
      );
      return;
    }

    let finalDestination = destination.trim();

    if (product.categoryId === 'smm') {
      const minVal = product.smmMin || 100;
      const maxVal = product.smmMax || 50000;
      if (!smmQty || smmQty < minVal || smmQty > maxVal) {
        onShowToast('Jumlah Tidak Valid', `Jumlah pesanan SMM harus antara ${minVal.toLocaleString('id-ID')} dan ${maxVal.toLocaleString('id-ID')} unit.`, 'error');
        return;
      }
      if (!finalDestination || finalDestination.length < 3) {
        onShowToast('Target Kosong', 'Harap masukkan username atau tautan profil/konten target.', 'error');
        return;
      }
    } else if (gameMeta.isMLBB) {
      const uId = gameUserId.trim();
      const zId = gameZoneId.trim();
      if (!uId) {
        onShowToast('User ID Kosong', 'Mohon masukkan User ID Mobile Legends Anda.', 'error');
        return;
      }
      if (!zId) {
        onShowToast('Zone ID Kosong', 'Mohon masukkan Zone ID (Server ID) Mobile Legends Anda.', 'error');
        return;
      }
      finalDestination = `${uId} (${zId})`;
    } else if (gameMeta.isGenshin) {
      const uId = gameUserId.trim() || destination.trim();
      if (!uId) {
        onShowToast('UID Kosong', 'Mohon masukkan UID Genshin Impact Anda.', 'error');
        return;
      }
      finalDestination = `${uId} [${genshinServer}]`;
    } else if (gameMeta.isGame) {
      const uId = gameUserId.trim() || destination.trim();
      if (!uId) {
        onShowToast('ID Game Kosong', 'Mohon masukkan ID Akun Game tujuan.', 'error');
        return;
      }
      finalDestination = uId;
    } else {
      if (!finalDestination || finalDestination.length < 3) {
        onShowToast(
          product.categoryId === 'pulsa' || product.categoryId === 'kuota' ? 'Nomor HP Kosong' : 'Data Tujuan Kosong',
          'Mohon masukkan nomor tujuan atau identitas akun yang valid.',
          'error'
        );
        const inputEl = document.getElementById('checkout-destination-input');
        if (inputEl) inputEl.focus();
        return;
      }
    }

    if (!isAgreed) {
      onShowToast('Persetujuan Diperlukan', 'Harap centang persetujuan kebenaran data tujuan transaksi.', 'warning');
      return;
    }

    setIsLoading(true);

    try {
      // Backend creates order with server-calculated price
      const { order, snapToken } = await apiAdapter.createOrder({
        productId: product.id,
        variantId: product.selectedVariantId,
        variantName: product.selectedVariantName,
        targetDestination: finalDestination,
        customerName: customerName || 'Pelanggan Wayahe',
        customerPhone: finalDestination,
        customerEmail: customerEmail || undefined,
        promoCode: appliedPromo?.code,
        customerNote: customerNote || undefined,
        smmQty: product.categoryId === 'smm' ? smmQty : undefined,
        smmComments: product.categoryId === 'smm' ? smmComments : undefined,
      });

      setIsLoading(false);
      onShowToast('Sesi Pembayaran Dibuat', `Invoice ${order.invoiceNumber} siap dibayar`, 'info');
      onOrderCreated(order, snapToken);
    } catch (err: any) {
      setIsLoading(false);
      onShowToast('Gagal Membuat Pesanan', err.message || 'Terjadi kesalahan sistem', 'error');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft size={16} />
        <span>Kembali ke Katalog</span>
      </button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Konfirmasi & Checkout Pesanan
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Periksa kembali data tujuan dan rincian harga sebelum melakukan pembayaran.
        </p>
      </div>

      <form onSubmit={handleCreateOrderAndPay} className="space-y-6">
        {/* 1. Ringkasan Produk Terpilih */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Produk yang Dibeli
          </h2>
          <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
            <div className="flex items-start gap-3.5">
              <ProductLogo
                provider={product.provider}
                name={product.name}
                category={product.categoryId}
                iconUrl={product.iconUrl}
                size="lg"
              />
              <div>
                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                  {product.provider}
                </span>
                <h3 className="font-bold text-base text-slate-900 mt-1">
                  {product.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {product.description}
                </p>
                {product.duration && (
                  <div className="flex items-center gap-1 text-xs text-slate-600 mt-2">
                    <Clock size={13} className="text-slate-400" />
                    <span>Durasi: {product.duration}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] text-slate-500 block">
                {product.categoryId === 'smm' ? 'Subtotal Produk' : 'Harga'}
              </span>
              <span className="text-base font-extrabold text-slate-900">
                {formatRupiah(baseProductPrice)}
              </span>
              {product.categoryId === 'smm' && (
                <span className="text-[10px] text-slate-400 block">
                  ({formatRupiah(effectiveSellingRate)} / 1.000)
                </span>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>Metode Pemenuhan:</span>
            <span className="font-semibold text-slate-700">
              {product.deliveryMethod === 'AUTOMATIC' ? 'Otomatis (Instan)' : 'Aktivasi Manual Terverifikasi'}
            </span>
          </div>
        </div>

        {/* 2. Data Tujuan & Penerima Sesuai Produk */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Data Tujuan & Penerima
          </h2>

          {gameMeta.isMLBB ? (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                ID Akun Mobile Legends *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={gameUserId}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setGameUserId(val);
                      setDestination(val ? (gameZoneId ? `${val} (${gameZoneId})` : val) : '');
                    }}
                    placeholder="User ID (cth: 12345678)"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-sm text-black bg-white"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={gameZoneId}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setGameZoneId(val);
                      setDestination(gameUserId ? (val ? `${gameUserId} (${val})` : gameUserId) : val);
                    }}
                    placeholder="(Zone ID)"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-sm text-black bg-white text-center"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                💡 Contoh: User ID <strong>12345678</strong> dan Zone ID <strong>(1234)</strong>. Bisa dicek langsung pada menu profil dalam game Mobile Legends Anda.
              </p>
            </div>
          ) : gameMeta.isFreeFire ? (
            <div>
              <label htmlFor="checkout-destination-input" className="block text-xs font-bold text-slate-800 mb-1.5">
                Player ID Free Fire *
              </label>
              <input
                id="checkout-destination-input"
                type="text"
                inputMode="numeric"
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Contoh: 1234567890"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-sm text-black bg-white"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Player ID dapat dilihat di menu Profil game Free Fire Anda.
              </p>
            </div>
          ) : gameMeta.isGenshin ? (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                UID & Server Genshin Impact *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={gameUserId || destination}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setGameUserId(val);
                      setDestination(val);
                    }}
                    placeholder="UID Akun (cth: 800123456)"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-sm text-black bg-white"
                  />
                </div>
                <div>
                  <select
                    value={genshinServer}
                    onChange={(e) => setGenshinServer(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-xs text-black bg-white"
                  >
                    <option value="os_asia">Server Asia</option>
                    <option value="os_usa">Server America</option>
                    <option value="os_euro">Server Europe</option>
                    <option value="os_cht">Server TW/HK/MO</option>
                  </select>
                </div>
              </div>
            </div>
          ) : gameMeta.isGame ? (
            <div>
              <label htmlFor="checkout-destination-input" className="block text-xs font-bold text-slate-800 mb-1.5">
                User ID / ID Akun Game *
              </label>
              <input
                id="checkout-destination-input"
                type="text"
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder={gameMeta.isValorant ? 'Riot ID & Tagline (cth: Player#ID1)' : 'Masukkan User ID Akun Game'}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-sm text-black bg-white"
              />
            </div>
          ) : product.categoryId === 'pulsa' || product.categoryId === 'kuota' ? (
            <div>
              <label htmlFor="checkout-destination-input" className="block text-xs font-bold text-slate-800 mb-1.5">
                Nomor HP Tujuan Isi Ulang *
              </label>
              <input
                id="checkout-destination-input"
                type="tel"
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-sm text-black bg-white"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Pastikan nomor handphone aktif dan benar. Pengisian nomor yang salah tidak dapat dibatalkan setelah diproses.
              </p>
            </div>
          ) : product.categoryId === 'smm' ? (
            <div className="space-y-3">
              <div>
                <label htmlFor="checkout-destination-input" className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                  <span>Username / Link Akun Target *</span>
                  <span className="text-[10px] text-teal-600 font-semibold">Layanan SMM</span>
                </label>
                <input
                  id="checkout-destination-input"
                  type="text"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Contoh: https://instagram.com/username atau @username"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-sm text-black bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                  <span>Jumlah Pesanan (Unit) *</span>
                  <span className="text-[10px] text-slate-500">
                    Min: {(product.smmMin || 100).toLocaleString('id-ID')} | Max: {(product.smmMax || 50000).toLocaleString('id-ID')}
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min={product.smmMin || 100}
                    max={product.smmMax || 50000}
                    step={10}
                    value={smmQty || ''}
                    onChange={(e) => setSmmQty(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-sm text-black bg-white"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-semibold">
                    unit
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Tarif: {formatRupiah(effectiveSellingRate)} / 1.000 unit. Subtotal: <strong className="text-indigo-600">{formatRupiah(baseProductPrice)}</strong>
                </p>
              </div>

              {product.name.toLowerCase().includes('comment') && (
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    Komentar Custom (1 baris per komentar)
                  </label>
                  <textarea
                    rows={3}
                    value={smmComments}
                    onChange={(e) => setSmmComments(e.target.value)}
                    placeholder="Tuliskan komentar di sini (pisahkan tiap komentar dengan baris baru)..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono text-black bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>
          ) : product.categoryId === 'premium' ? (
            <div>
              <label htmlFor="checkout-destination-input" className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                <span>Email / No. WhatsApp Pembeli *</span>
                <span className="text-[10px] text-emerald-600 font-semibold">Akses Login Resmi</span>
              </label>
              <input
                id="checkout-destination-input"
                type="text"
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Contoh: user@gmail.com atau 08123456789"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-sm text-black bg-white"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Data akun (Email & Password resmi) otomatis diserahkan di layar invoice segera setelah pembayaran Anda lunas.
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor="checkout-destination-input" className="block text-xs font-bold text-slate-800 mb-1.5">
                {product.categoryId === 'wifi' ? 'Nama Pengguna / Catatan Penerima' : 'Nomor / Akun Tujuan *'}
              </label>
              <input
                id="checkout-destination-input"
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder={product.categoryId === 'wifi' ? 'Nama Anda (opsional)' : 'Contoh: No. Meter PLN / ID Pelanggan'}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-sm text-black bg-white"
              />
            </div>
          )}

          {/* Data Tambahan (Nama & Catatan Pembeli - Tanpa Meminta Nomor WhatsApp) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label htmlFor="checkout-name-input" className="block text-xs font-medium text-slate-700 mb-1">
                Nama Lengkap / Panggilan (Opsional)
              </label>
              <input
                id="checkout-name-input"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nama Anda"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-black bg-white"
              />
            </div>

            <div>
              <label htmlFor="checkout-note-input" className="block text-xs font-medium text-slate-700 mb-1">
                Catatan Pesanan (Opsional)
              </label>
              <input
                id="checkout-note-input"
                type="text"
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="Catatan untuk penjual"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-black bg-white"
              />
            </div>
          </div>
        </div>

        {/* 3. Kupon Diskon Promo */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Tag size={14} className="text-teal-600" />
            Kode Diskon / Promo
          </h2>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Masukkan kode promo (misal: WAYAHEHEMAT)"
              value={promoCodeInput}
              onChange={(e) => setPromoCodeInput(e.target.value)}
              className="flex-1 px-4 py-2 rounded-xl border border-slate-300 text-xs uppercase font-bold tracking-wider focus:outline-none focus:ring-2 focus:ring-teal-500 text-black bg-white"
            />
            <button
              type="button"
              onClick={() => handleApplyPromo()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shrink-0"
            >
              Terapkan
            </button>
          </div>

          {promoError && (
            <p className="text-xs text-rose-600 font-medium">{promoError}</p>
          )}

          {appliedPromo && (
            <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex items-center justify-between text-xs text-emerald-900 font-medium">
              <span className="flex items-center gap-1.5">
                <Check size={14} className="text-emerald-600" />
                Diskon {formatRupiah(appliedPromo.discountAmount)} aktif ({appliedPromo.code})
              </span>
              <button
                type="button"
                onClick={() => {
                  setAppliedPromo(null);
                  setPromoCodeInput('');
                }}
                className="text-xs text-emerald-700 underline font-semibold hover:text-emerald-900"
              >
                Hapus
              </button>
            </div>
          )}
        </div>

        {/* 4. Rincian Pembayaran */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Rincian Pembayaran
          </h2>

          <div className="flex justify-between text-xs text-slate-600">
            <span>Harga Produk</span>
            <span>{formatRupiah(product.sellingPrice)}</span>
          </div>

          {appliedPromo && (
            <div className="flex justify-between text-xs text-teal-600 font-semibold">
              <span>Potongan Promo ({appliedPromo.code})</span>
              <span>-{formatRupiah(appliedPromo.discountAmount)}</span>
            </div>
          )}

          <div className="flex justify-between text-xs text-slate-600">
            <span>Biaya Layanan</span>
            <span className="text-teal-600 font-semibold">Rp 0 (Gratis)</span>
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
            <div>
              <span className="text-xs font-bold text-slate-500 block">Total Tagihan</span>
              <span className="text-xs text-slate-400">Termasuk PPN jika berlaku</span>
            </div>
            <span className="text-2xl font-extrabold text-indigo-600">
              {formatRupiah(grandTotal)}
            </span>
          </div>
        </div>

        {/* 5. Pilihan Metode Pembayaran Otomatis */}
        <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                <QrCode size={20} />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Metode Pembayaran
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-bold text-white">
                    {isPakasir ? 'QRIS Dinamis (Pakasir API v2)' : 'QRIS Dinamis (Qiospay)'}
                  </span>
                  <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    Otomatis Muncul
                  </span>
                </div>
              </div>
            </div>
            <span className="text-[11px] font-bold text-teal-300 bg-teal-950/80 border border-teal-800 px-2.5 py-1 rounded-lg">
              Bebas Biaya Admin
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Barcode QRIS nominal dinamis akan muncul otomatis seketika setelah klik tombol bayar. Kompatibel dengan semua aplikasi mobile banking (BCA, Mandiri, BRI, BNI) & e-wallet (GoPay, OVO, Dana, ShopeePay, LinkAja).
          </p>
        </div>

        {/* 6. Konfirmasi Data Tujuan Checkbox */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <input
            id="checkout-confirm-agreement"
            type="checkbox"
            checked={isAgreed}
            onChange={(e) => setIsAgreed(e.target.checked)}
            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 shrink-0"
          />
          <label htmlFor="checkout-confirm-agreement" className="text-xs text-amber-950 font-medium leading-relaxed">
            Saya memastikan bahwa data nomor tujuan <strong>{destination || '(belum diisi)'}</strong> sudah benar. Saya memahami transaksi produk digital yang telah sukses tidak dapat dibatalkan.
          </label>
        </div>

        {/* Peringatan Sistem Sedang Dijeda (STOPPED) */}
        {isSystemStopped && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 text-rose-900 animate-fadeIn">
            <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-extrabold uppercase tracking-wide text-rose-700 block">
                Sistem Transaksi Sedang Dijeda Sementara
              </span>
              <p className="text-rose-800 leading-relaxed font-medium">
                {settings.systemMaintenanceMessage || 'Administrator sedang melakukan pemeliharaan rutin. Transaksi ditutup sementara dan akan segera dibuka kembali.'}
              </p>
            </div>
          </div>
        )}

        {/* Tombol Lanjut Bayar */}
        <button
          type="submit"
          disabled={isLoading || isSystemStopped}
          id="checkout-submit-pay-button"
          className={`w-full py-3.5 px-6 font-bold rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${
            isSystemStopped
              ? 'bg-rose-900/40 text-rose-200 border border-rose-800/60 cursor-not-allowed shadow-none'
              : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white shadow-indigo-600/20 cursor-pointer'
          }`}
        >
          {isLoading ? (
            <span>Membuat Sesi Pembayaran...</span>
          ) : isSystemStopped ? (
            <>
              <AlertTriangle size={18} className="text-rose-400" />
              <span>Transaksi Sedang Dijeda Sementara</span>
            </>
          ) : (
            <>
              <CreditCard size={18} />
              <span>Bayar Sekarang ({formatRupiah(grandTotal)})</span>
            </>
          )}
        </button>

        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck size={14} className="text-[#84A951]" />
          <span>Transaksi aman dan terverifikasi otomatis 24 jam</span>
        </div>
      </form>
    </div>
  );
}
