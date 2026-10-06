import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  QrCode, 
  ArrowRight, 
  Check, 
  Tag, 
  Clock, 
  Smartphone, 
  Mail, 
  Sparkles,
  Zap,
  Info
} from 'lucide-react';
import { Product, Order, PromoCode } from '../types';
import { formatRupiah } from '../utils/operator';
import { ProductLogo } from '../components/ProductLogo';
import { storage } from '../services/storage';
import { apiAdapter } from '../services/apiAdapter';

interface QuickBuyModalProps {
  product: Product | null;
  initialDestination?: string;
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: (order: Order, snapToken: string) => void;
  onOpenFullCheckout: (product: Product, targetDestination: string) => void;
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

export function QuickBuyModal({
  product,
  initialDestination = '',
  isOpen,
  onClose,
  onOrderCreated,
  onOpenFullCheckout,
  onShowToast,
}: QuickBuyModalProps) {
  const [destination, setDestination] = useState<string>(initialDestination);
  const [selectedVariantId, setSelectedVariantId] = useState<string>(product?.selectedVariantId || '');
  // Game-specific inputs
  const [gameUserId, setGameUserId] = useState<string>('');
  const [gameZoneId, setGameZoneId] = useState<string>('');
  const [genshinServer, setGenshinServer] = useState<string>('os_asia');
  // SMM-specific inputs
  const [smmQty, setSmmQty] = useState<number>(product?.smmMin || 100);
  const [smmComments, setSmmComments] = useState<string>('');

  const [customerName, setCustomerName] = useState<string>('');
  const [promoCodeInput, setPromoCodeInput] = useState<string>('WAYAHEHEMAT');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoError, setPromoError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const gameMeta = getGameMeta(product);

  const calculateDiscount = (promo: PromoCode, price: number): number => {
    let disc = 0;
    if (promo.discountPercentage && promo.discountPercentage > 0) {
      disc = Math.round((price * promo.discountPercentage) / 100);
      if (promo.maxDiscount && promo.maxDiscount > 0) {
        disc = Math.min(disc, promo.maxDiscount);
      }
    } else {
      disc = promo.discountAmount || 0;
    }
    return Math.min(disc, price);
  };

  const handleApplyPromo = (codeToApply?: string) => {
    const code = (codeToApply !== undefined ? codeToApply : promoCodeInput).trim().toUpperCase();
    if (!code) {
      setAppliedPromo(null);
      setPromoError('');
      return;
    }
    const promos = storage.getPromos();
    const matched = promos.find(p => p.code.toUpperCase() === code && p.isActive);

    if (matched && product) {
      if (matched.validUntil) {
        const exp = new Date(matched.validUntil).getTime();
        if (!isNaN(exp) && Date.now() > exp) {
          setPromoError(`Kode promo ${code} sudah kadaluwarsa.`);
          setAppliedPromo(null);
          return;
        }
      }
      if (product.sellingPrice < matched.minTransaction) {
        setPromoError(`Min. transaksi ${formatRupiah(matched.minTransaction)} untuk kode ${code}`);
        setAppliedPromo(null);
      } else {
        setAppliedPromo(matched);
        setPromoCodeInput(matched.code);
        setPromoError('');
      }
    } else {
      setPromoError('Kode promo tidak valid atau tidak aktif.');
      setAppliedPromo(null);
    }
  };

  // Auto apply default promo & parse initialDestination on modal open
  useEffect(() => {
    if (isOpen && product) {
      setErrorMessage('');
      setIsLoading(false);
      const meta = getGameMeta(product);

      if (product.hasVariants && product.variants && product.variants.length > 0) {
        setSelectedVariantId(product.selectedVariantId || product.variants[0].id);
      } else {
        setSelectedVariantId('');
      }

      if (initialDestination) {
        setDestination(initialDestination);
        if (meta.isMLBB) {
          const match = initialDestination.match(/^([0-9]+)\s*(?:\((.+?)\))?$/);
          if (match) {
            setGameUserId(match[1] || '');
            setGameZoneId(match[2] || '');
          } else {
            setGameUserId(initialDestination);
          }
        } else {
          setGameUserId(initialDestination);
        }
      } else if (!destination) {
        const savedOrders = storage.getOrders();
        if (savedOrders.length > 0 && !meta.isGame) {
          const prior = savedOrders[0].targetDestination || savedOrders[0].customerPhone || '';
          setDestination(prior);
        }
      }
      handleApplyPromo('WAYAHEHEMAT');
    }
  }, [isOpen, product, initialDestination]);

  if (!isOpen || !product) return null;

  const activeVariant = product.hasVariants && product.variants && product.variants.length > 0
    ? (product.variants.find(v => v.id === selectedVariantId) || product.variants[0])
    : null;

  const effectiveSellingRate = product.ratePer1000 || (activeVariant ? activeVariant.sellingPrice : product.sellingPrice);
  const basePrice = product.categoryId === 'smm'
    ? Math.ceil((effectiveSellingRate * (smmQty || product.smmMin || 100)) / 1000)
    : (activeVariant ? activeVariant.sellingPrice : product.sellingPrice);

  const discountAmount = appliedPromo ? calculateDiscount(appliedPromo, basePrice) : 0;
  const adminFee = 0;
  const grandTotal = Math.max(0, basePrice - discountAmount + adminFee);

  const handlePayNow = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    let finalDest = destination.trim();

    if (product.categoryId === 'smm') {
      const minVal = product.smmMin || 100;
      const maxVal = product.smmMax || 50000;
      if (!smmQty || smmQty < minVal || smmQty > maxVal) {
        setErrorMessage(`Jumlah pesanan SMM harus berada di antara ${minVal.toLocaleString('id-ID')} dan ${maxVal.toLocaleString('id-ID')} unit.`);
        return;
      }
      if (!finalDest || finalDest.length < 3) {
        setErrorMessage('Harap masukkan username atau tautan profil/konten target.');
        return;
      }
    } else if (gameMeta.isMLBB) {
      const uId = gameUserId.trim();
      const zId = gameZoneId.trim();
      if (!uId) {
        setErrorMessage('Harap masukkan User ID Mobile Legends Anda.');
        return;
      }
      if (!zId) {
        setErrorMessage('Harap masukkan Zone ID (Server ID) Mobile Legends Anda.');
        return;
      }
      finalDest = `${uId} (${zId})`;
    } else if (gameMeta.isGenshin) {
      const uId = gameUserId.trim() || destination.trim();
      if (!uId) {
        setErrorMessage('Harap masukkan UID Genshin Impact.');
        return;
      }
      finalDest = `${uId} [${genshinServer}]`;
    } else if (gameMeta.isGame) {
      const uId = gameUserId.trim() || destination.trim();
      if (!uId) {
        setErrorMessage('Harap masukkan ID Akun Game tujuan.');
        return;
      }
      finalDest = uId;
    } else {
      if (!finalDest || finalDest.length < 3) {
        setErrorMessage(
          product.categoryId === 'pulsa' || product.categoryId === 'kuota'
            ? 'Harap masukkan nomor handphone tujuan yang valid.'
            : 'Harap masukkan identitas nomor atau akun tujuan.'
        );
        return;
      }
    }

    setIsLoading(true);

    try {
      const currentUser = storage.getUser();
      const { order, snapToken } = await apiAdapter.createOrder({
        productId: product.id,
        variantId: activeVariant?.id,
        variantName: activeVariant?.name,
        targetDestination: finalDest,
        customerName: customerName.trim() || currentUser?.name || 'Pelanggan Wayahe',
        customerPhone: currentUser?.phone || finalDest,
        customerEmail: currentUser?.email,
        promoCode: appliedPromo?.code,
        smmQty: product.categoryId === 'smm' ? smmQty : undefined,
        smmComments: product.categoryId === 'smm' ? smmComments : undefined,
      });

      setIsLoading(false);
      onClose();
      onShowToast('Sesi Pembayaran Dibuat', `Invoice ${order.invoiceNumber} siap dibayar via QRIS`, 'success');
      onOrderCreated(order, snapToken);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Gagal membuat sesi pembayaran.');
      onShowToast('Gagal Membuat Pesanan', err.message || 'Terjadi kendala teknis', 'error');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[9990] overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        id="quick-buy-modal"
        className="bg-[#1C1612] rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-[#3E342B] text-[#FAF4EB]"
        role="dialog"
        aria-labelledby="quick-buy-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-[#D4A359]/20 via-[#251E18] to-[#1C1612] p-4 sm:p-5 border-b border-[#3E342B] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#D4A359]/20 border border-[#D4A359]/40 flex items-center justify-center text-[#D4A359]">
              <QrCode size={20} />
            </div>
            <div>
              <h2 id="quick-buy-title" className="font-extrabold text-base tracking-tight text-[#FAF4EB]">
                Beli & Bayar Instan QRIS
              </h2>
              <p className="text-[11px] text-[#A89F91]">
                Scan QRIS langsung aktif detik itu juga
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#A89F91] hover:text-[#FAF4EB] p-2 rounded-xl hover:bg-[#2B231D] transition-colors cursor-pointer"
            aria-label="Tutup popup"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handlePayNow} className="p-5 space-y-4">
          {/* 1. Ringkasan Produk Terpilih */}
          <div className="bg-[#241D17] rounded-2xl p-3.5 border border-[#3E342B]/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-1 rounded-xl bg-[#181411] border border-[#3E342B] shrink-0">
                <ProductLogo
                  provider={product.provider}
                  name={product.name}
                  category={product.categoryId}
                  iconUrl={product.iconUrl}
                  size="sm"
                  className="rounded-lg"
                />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-[#D4A359] uppercase tracking-wider block">
                  {product.provider}
                </span>
                <h3 className="font-bold text-sm text-[#FAF4EB] truncate">
                  {product.name}
                </h3>
                {product.duration && (
                  <span className="text-[10px] text-[#A89F91] flex items-center gap-1">
                    <Clock size={10} />
                    {product.duration}
                  </span>
                )}
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] text-[#A89F91] block">
                {product.categoryId === 'smm' ? 'Estimasi Total' : 'Harga'}
              </span>
              <span className="text-sm font-extrabold text-[#D4A359]">
                {formatRupiah(basePrice)}
              </span>
              {product.categoryId === 'smm' && (
                <span className="text-[9px] text-[#A89F91] block">
                  ({formatRupiah(effectiveSellingRate)} / 1.000)
                </span>
              )}
            </div>
          </div>

          {/* Pilihan Varian / Paket Lisensi Akun Premium (Bisa disinkronkan dari admin dashboard) */}
          {product.hasVariants && product.variants && product.variants.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#D5CEBF] flex items-center justify-between">
                <span>Pilih Varian / Masa Aktif *</span>
                <span className="text-[10px] text-[#D4A359]">{product.variants.length} Opsi Tersedia</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {product.variants.map((v) => {
                  const isSel = (activeVariant?.id === v.id);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSel
                          ? 'border-[#D4A359] bg-[#D4A359]/15 text-[#FAF4EB] shadow-xs ring-1 ring-[#D4A359]/30'
                          : 'border-[#3E342B] bg-[#181411] text-[#A89F91] hover:border-[#D4A359]/50 hover:text-[#FAF4EB]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 w-full">
                        <span className="text-xs font-bold truncate">{v.name}</span>
                        {v.duration && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/50 text-[#D4A359] font-mono shrink-0">
                            {v.duration}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1 pt-1 border-t border-[#3E342B]/40">
                        <span className="text-[10px] text-[#A89F91]">Harga</span>
                        <span className="text-xs font-extrabold text-[#D4A359]">{formatRupiah(v.sellingPrice)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Input Identitas / Nomor Tujuan Sesuai Kategori Produk */}
          {gameMeta.isMLBB ? (
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#D5CEBF] flex items-center justify-between">
                <span>ID Akun Mobile Legends *</span>
                <span className="text-[10px] text-[#84A951] font-normal flex items-center gap-1">
                  <ShieldCheck size={11} />
                  <span>Proses Otomatis</span>
                </span>
              </label>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    required
                    value={gameUserId}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setGameUserId(val);
                      setDestination(val ? (gameZoneId ? `${val} (${gameZoneId})` : val) : '');
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="User ID (cth: 12345678)"
                    className="w-full px-4 py-3 rounded-xl bg-[#14100D] border-2 border-[#3E342B] focus:border-[#D4A359] focus:ring-2 focus:ring-[#D4A359]/20 text-sm font-bold text-[#FAF4EB] placeholder-[#A89F91]/40 font-mono transition-all"
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
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="(Zone ID)"
                    className="w-full px-3 py-3 rounded-xl bg-[#14100D] border-2 border-[#3E342B] focus:border-[#D4A359] focus:ring-2 focus:ring-[#D4A359]/20 text-sm font-bold text-[#FAF4EB] placeholder-[#A89F91]/40 font-mono text-center transition-all"
                  />
                </div>
              </div>

              <p className="text-[11px] text-[#A89F91] flex items-center gap-1.5">
                <Info size={12} className="text-[#D4A359] shrink-0" />
                <span>Contoh: User ID <strong>12345678</strong> dan Zone ID <strong>(1234)</strong> di profil game MLBB Anda.</span>
              </p>
            </div>
          ) : gameMeta.isFreeFire ? (
            <div className="space-y-1.5">
              <label htmlFor="quick-destination-input" className="block text-xs font-bold uppercase tracking-wider text-[#D5CEBF] flex items-center justify-between">
                <span>Player ID Free Fire *</span>
                <span className="text-[10px] text-[#84A951] font-normal flex items-center gap-1">
                  <ShieldCheck size={11} />
                  <span>Proses Otomatis</span>
                </span>
              </label>
              <input
                id="quick-destination-input"
                type="text"
                inputMode="numeric"
                autoFocus
                required
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value.replace(/[^0-9]/g, ''));
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="Contoh Player ID: 1234567890"
                className="w-full px-4 py-3 rounded-xl bg-[#14100D] border-2 border-[#3E342B] focus:border-[#D4A359] focus:ring-2 focus:ring-[#D4A359]/20 text-sm font-bold text-[#FAF4EB] placeholder-[#A89F91]/40 font-mono transition-all"
              />
              <p className="text-[11px] text-[#A89F91] flex items-center gap-1.5">
                <Info size={12} className="text-[#D4A359] shrink-0" />
                <span>Player ID dapat dilihat di menu Profil game Free Fire.</span>
              </p>
            </div>
          ) : gameMeta.isGenshin ? (
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#D5CEBF] flex items-center justify-between">
                <span>UID & Server Genshin Impact *</span>
                <span className="text-[10px] text-[#84A951] font-normal flex items-center gap-1">
                  <ShieldCheck size={11} />
                  <span>Proses Otomatis</span>
                </span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    required
                    value={gameUserId || destination}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setGameUserId(val);
                      setDestination(val);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="UID Akun (cth: 800123456)"
                    className="w-full px-4 py-3 rounded-xl bg-[#14100D] border-2 border-[#3E342B] focus:border-[#D4A359] text-sm font-bold text-[#FAF4EB] placeholder-[#A89F91]/40 font-mono"
                  />
                </div>
                <div>
                  <select
                    value={genshinServer}
                    onChange={(e) => setGenshinServer(e.target.value)}
                    className="w-full px-3 py-3 rounded-xl bg-[#14100D] border-2 border-[#3E342B] focus:border-[#D4A359] text-xs font-bold text-[#FAF4EB]"
                  >
                    <option value="os_asia">Asia</option>
                    <option value="os_usa">America</option>
                    <option value="os_euro">Europe</option>
                    <option value="os_cht">TW/HK/MO</option>
                  </select>
                </div>
              </div>
            </div>
          ) : gameMeta.isGame ? (
            <div className="space-y-1.5">
              <label htmlFor="quick-destination-input" className="block text-xs font-bold uppercase tracking-wider text-[#D5CEBF] flex items-center justify-between">
                <span>User ID / ID Akun Game *</span>
                <span className="text-[10px] text-[#84A951] font-normal flex items-center gap-1">
                  <ShieldCheck size={11} />
                  <span>Proses Otomatis</span>
                </span>
              </label>
              <input
                id="quick-destination-input"
                type="text"
                autoFocus
                required
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder={gameMeta.isValorant ? 'Riot ID & Tagline (cth: User#TAG)' : 'Masukkan User ID Akun Game'}
                className="w-full px-4 py-3 rounded-xl bg-[#14100D] border-2 border-[#3E342B] focus:border-[#D4A359] focus:ring-2 focus:ring-[#D4A359]/20 text-sm font-bold text-[#FAF4EB] placeholder-[#A89F91]/40 font-mono transition-all"
              />
            </div>
          ) : product.categoryId === 'pulsa' || product.categoryId === 'kuota' ? (
            <div>
              <label htmlFor="quick-destination-input" className="block text-xs font-bold uppercase tracking-wider text-[#D5CEBF] mb-1.5 flex items-center justify-between">
                <span>Nomor HP Tujuan Isi Ulang *</span>
                <span className="text-[10px] text-[#84A951] font-normal flex items-center gap-1">
                  <ShieldCheck size={11} />
                  <span>Langsung Terkirim</span>
                </span>
              </label>
              <div className="relative">
                <input
                  id="quick-destination-input"
                  type="tel"
                  autoFocus
                  required
                  value={destination}
                  onChange={(e) => {
                    setDestination(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-4 py-3 rounded-xl bg-[#14100D] border-2 border-[#3E342B] focus:border-[#D4A359] focus:ring-2 focus:ring-[#D4A359]/20 text-sm font-bold text-[#FAF4EB] placeholder-[#A89F91]/40 transition-all font-mono"
                />
              </div>
              <p className="text-[10px] text-[#A89F91] mt-1">
                Pastikan nomor handphone aktif dan benar.
              </p>
            </div>
          ) : product.categoryId === 'smm' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#D5CEBF] mb-1.5 flex items-center justify-between">
                  <span>Username / Link Target Akun *</span>
                  <span className="text-[10px] text-[#84A951] font-normal flex items-center gap-1">
                    <ShieldCheck size={11} />
                    <span>Layanan Provider SMM</span>
                  </span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={destination}
                  onChange={(e) => {
                    setDestination(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Contoh: https://instagram.com/username atau @username"
                  className="w-full px-4 py-3 rounded-xl bg-[#14100D] border-2 border-[#3E342B] focus:border-[#D4A359] focus:ring-2 focus:ring-[#D4A359]/20 text-sm font-bold text-[#FAF4EB] placeholder-[#A89F91]/40 transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#D5CEBF] mb-1.5 flex items-center justify-between">
                  <span>Jumlah Pesanan (Unit) *</span>
                  <span className="text-[10px] text-[#D4A359]">
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
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      setSmmQty(val);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder={`Min. ${product.smmMin || 100}`}
                    className="w-full px-4 py-3 rounded-xl bg-[#14100D] border-2 border-[#3E342B] focus:border-[#D4A359] focus:ring-2 focus:ring-[#D4A359]/20 text-sm font-bold text-[#FAF4EB] font-mono"
                  />
                  <span className="absolute right-3.5 top-3.5 text-xs text-[#A89F91] font-semibold">
                    unit
                  </span>
                </div>
                <p className="text-[10px] text-[#A89F91] mt-1">
                  Tarif: {formatRupiah(effectiveSellingRate)} / 1.000 unit. Subtotal: <strong className="text-[#D4A359]">{formatRupiah(basePrice)}</strong>
                </p>
              </div>

              {product.name.toLowerCase().includes('comment') && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#D5CEBF] mb-1.5">
                    Komentar Custom (1 baris per komentar)
                  </label>
                  <textarea
                    rows={3}
                    value={smmComments}
                    onChange={(e) => setSmmComments(e.target.value)}
                    placeholder="Tuliskan komentar di sini (pisahkan per baris)..."
                    className="w-full px-3 py-2 rounded-xl bg-[#14100D] border-2 border-[#3E342B] focus:border-[#D4A359] text-xs text-[#FAF4EB] placeholder-[#A89F91]/40 font-mono"
                  />
                </div>
              )}
            </div>
          ) : product.categoryId === 'premium' ? (
            <div>
              <label htmlFor="quick-destination-input" className="block text-xs font-bold uppercase tracking-wider text-[#D5CEBF] mb-1.5 flex items-center justify-between">
                <span>Email / No. WhatsApp Pembeli *</span>
                <span className="text-[10px] text-[#84A951] font-normal flex items-center gap-1">
                  <ShieldCheck size={11} />
                  <span>Akses Login Resmi</span>
                </span>
              </label>
              <div className="relative">
                <input
                  id="quick-destination-input"
                  type="text"
                  autoFocus
                  required
                  value={destination}
                  onChange={(e) => {
                    setDestination(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Contoh: user@gmail.com atau 08123456789"
                  className="w-full px-4 py-3 rounded-xl bg-[#14100D] border-2 border-[#3E342B] focus:border-[#D4A359] focus:ring-2 focus:ring-[#D4A359]/20 text-sm font-bold text-[#FAF4EB] placeholder-[#A89F91]/40 transition-all font-mono"
                />
              </div>
              <p className="text-[10px] text-[#A89F91] mt-1">
                Data login (Email & Password) otomatis ditampilkan di layar invoice segera setelah pembayaran selesai.
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor="quick-destination-input" className="block text-xs font-bold uppercase tracking-wider text-[#D5CEBF] mb-1.5 flex items-center justify-between">
                <span>{product.categoryId === 'wifi' ? 'Nama Pengguna / Catatan Penerima' : 'Nomor / Akun Tujuan *'}</span>
                <span className="text-[10px] text-[#84A951] font-normal flex items-center gap-1">
                  <ShieldCheck size={11} />
                  <span>Otomatis Masuk</span>
                </span>
              </label>
              <div className="relative">
                <input
                  id="quick-destination-input"
                  type="text"
                  autoFocus
                  required
                  value={destination}
                  onChange={(e) => {
                    setDestination(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder={product.categoryId === 'wifi' ? 'Nama Anda / Catatan' : 'Contoh: No. Meter PLN / ID Pelanggan'}
                  className="w-full px-4 py-3 rounded-xl bg-[#14100D] border-2 border-[#3E342B] focus:border-[#D4A359] focus:ring-2 focus:ring-[#D4A359]/20 text-sm font-bold text-[#FAF4EB] placeholder-[#A89F91]/40 transition-all"
                />
              </div>
              <p className="text-[10px] text-[#A89F91] mt-1">
                Kode voucher dan bukti pembayaran akan langsung ditampilkan di layar setelah pembayaran.
              </p>
            </div>
          )}

          {/* 3. Promo Code Banner & Redeem Voucher */}
          <div className="bg-[#241D17] rounded-xl p-3 border border-[#3E342B] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag size={14} className="text-[#D4A359]" />
                <span className="font-semibold text-xs text-[#FAF4EB]">
                  {appliedPromo ? (
                    <>
                      Promo: <span className="text-[#D4A359]">{appliedPromo.code}</span> (-{formatRupiah(discountAmount)})
                    </>
                  ) : (
                    'Punya Kode Promo / Voucher?'
                  )}
                </span>
              </div>
              {appliedPromo ? (
                <button
                  type="button"
                  onClick={() => {
                    setAppliedPromo(null);
                    setPromoCodeInput('');
                    setPromoError('');
                  }}
                  className="text-[11px] text-rose-400 font-semibold hover:underline"
                >
                  Hapus
                </button>
              ) : null}
            </div>

            {!appliedPromo && (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ketik kode voucher..."
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyPromo();
                    }
                  }}
                  className="flex-1 bg-[#1A1410] border border-[#3E342B] rounded-lg px-2.5 py-1.5 text-xs text-white uppercase focus:outline-none focus:border-[#D4A359]"
                />
                <button
                  type="button"
                  onClick={() => handleApplyPromo()}
                  className="px-3 py-1.5 bg-[#D4A359] text-[#1A1410] font-bold text-xs rounded-lg hover:bg-[#c39248] transition-colors"
                >
                  Terapkan
                </button>
              </div>
            )}

            {promoError && (
              <p className="text-[11px] text-rose-400 font-medium">{promoError}</p>
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium">
              {errorMessage}
            </div>
          )}

          {/* 4. Total & Tombol Bayar QRIS */}
          <div className="pt-2 border-t border-[#3E342B] space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-[10px] text-[#A89F91] uppercase tracking-wider block">Total Tagihan</span>
                <span className="text-xs text-[#84A951] font-semibold">Bebas Biaya Admin</span>
              </div>
              <span className="text-2xl font-black text-[#D4A359] font-mono">
                {formatRupiah(grandTotal)}
              </span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              id="quick-pay-submit-btn"
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#D4A359] via-[#E2B774] to-[#C08F47] hover:brightness-110 active:scale-[0.99] text-[#181411] font-black rounded-2xl text-sm transition-all shadow-lg shadow-[#D4A359]/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span>Menyiapkan QRIS...</span>
              ) : (
                <>
                  <Zap size={18} className="fill-[#181411]" />
                  <span>Bayar Sekarang via QRIS</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-[11px] pt-1 text-[#A89F91]">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenFullCheckout(product, destination);
                }}
                className="hover:text-[#D4A359] underline cursor-pointer transition-colors"
              >
                Halaman Checkout Lengkap &rarr;
              </button>

              <div className="flex items-center gap-1 text-[#84A951]">
                <ShieldCheck size={13} />
                <span>QRIS Otomatis</span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default QuickBuyModal;
