import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  Search, 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  RefreshCw, 
  QrCode, 
  Copy, 
  X,
  Zap,
  Smartphone,
  Gamepad2,
  Crown,
  Wifi,
  Bot
} from 'lucide-react';
import { Product, Order } from '../types';
import { formatRupiah } from '../utils/operator';
import { ProductLogo } from '../components/ProductLogo';
import { getPremiumProductStock } from '../utils/premiumStock';
import { storage } from '../services/storage';
import { apiAdapter } from '../services/apiAdapter';

interface TelegramStorePageProps {
  products: Product[];
  onShowToast?: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigateHome?: () => void;
}

export function TelegramStorePage({
  products,
  onShowToast = () => {},
  onNavigateHome,
}: TelegramStorePageProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [destinationTarget, setDestinationTarget] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<{
    order: any;
    qrString: string;
    qrImageUrl: string;
  } | null>(null);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);

  // Deteksi Telegram WebApp SDK
  const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
  const tgUser = tg?.initDataUnsafe?.user || null;

  useEffect(() => {
    if (tg) {
      try {
        tg.ready();
        tg.expand();
        tg.enableClosingConfirmation();
        if (tg.setHeaderColor) {
          tg.setHeaderColor('#0A0E17');
        }
      } catch (_) {}
    }
  }, [tg]);

  // Haptic feedback helper
  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (tg?.HapticFeedback?.impactOccurred) {
      tg.HapticFeedback.impactOccurred(type);
    }
  };

  const appSettings = storage.getSettings();

  // Filter kategori
  const categories = [
    { id: 'all', label: 'Semua', icon: ShoppingBag },
    { id: 'game', label: '🎮 Game', icon: Gamepad2 },
    { id: 'pulsa', label: '📱 Pulsa & Data', icon: Smartphone },
    { id: 'premium', label: '👑 Akun Premium', icon: Crown },
    { id: 'pln', label: '⚡ PLN Listrik', icon: Zap },
    { id: 'wifi', label: '📶 WiFi Voucher', icon: Wifi },
  ];

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.isActive === false) return false;
      const matchCat =
        selectedCategory === 'all'
          ? true
          : selectedCategory === 'pulsa'
          ? p.categoryId === 'pulsa' || p.categoryId === 'kuota'
          : p.categoryId === selectedCategory;

      const matchSearch =
        searchQuery.trim() === ''
          ? true
          : (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.provider || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.description || '').toLowerCase().includes(searchQuery.toLowerCase());

      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const handleOpenProduct = (p: Product) => {
    triggerHaptic('medium');
    setSelectedProduct(p);
    if (p.hasVariants && p.variants && p.variants.length > 0) {
      setSelectedVariantId(p.variants[0].id);
    } else {
      setSelectedVariantId('');
    }
    setDestinationTarget('');
    setActiveInvoice(null);
  };

  const handleCreateOrder = async () => {
    if (!selectedProduct) return;
    if (!destinationTarget || destinationTarget.trim().length < 3) {
      triggerHaptic('heavy');
      onShowToast('Data Tujuan Kosong', 'Silakan masukkan nomor HP, ID Game, atau email akun tujuan.', 'warning');
      return;
    }

    triggerHaptic('medium');
    setIsSubmitting(true);

    try {
      let finalPrice = selectedProduct.sellingPrice;
      let variantName = '';

      if (selectedProduct.hasVariants && selectedProduct.variants && selectedVariantId) {
        const v = selectedProduct.variants.find((item) => item.id === selectedVariantId);
        if (v) {
          finalPrice = v.sellingPrice;
          variantName = v.name;
        }
      }

      // Buat order via backend API adapter
      const invoiceNumber = `INV/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/WD/${Math.floor(1000 + Math.random() * 9000)}`;
      
      const { order, gatewayRefId } = await apiAdapter.createOrder({
        productId: selectedProduct.id,
        variantId: selectedVariantId || undefined,
        variantName: variantName || undefined,
        targetDestination: destinationTarget.trim(),
        customerName: tgUser?.first_name ? `${tgUser.first_name} (Telegram)` : 'Pelanggan Telegram',
        customerPhone: destinationTarget.replace(/[^0-9]/g, '') || '',
        customerEmail: destinationTarget.includes('@') ? destinationTarget.trim() : undefined,
        paymentMethod: 'qris',
      });

      // Dapatkan data QRIS
      const qrStr = order?.qrString || gatewayRefId || (order as any)?.qrisString || '';
      const qrImg = qrStr ? `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(qrStr)}` : '';

      setActiveInvoice({
        order,
        qrString: qrStr,
        qrImageUrl: qrImg,
      });

      triggerHaptic('heavy');
      onShowToast('Invoice Diterbitkan', `Silakan scan QRIS untuk menyelesaikan pembayaran`, 'success');
    } catch (err: any) {
      triggerHaptic('heavy');
      onShowToast('Gagal Membuat Pesanan', err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckPaymentStatus = async () => {
    if (!activeInvoice?.order) return;
    setIsCheckingPayment(true);
    triggerHaptic('light');

    try {
      const checkResult = await apiAdapter.checkOrderStatus(activeInvoice.order.invoiceNumber || activeInvoice.order.id);
      if (checkResult.paymentStatus === 'PAID' || checkResult.fulfillmentStatus === 'SUCCESS') {
        triggerHaptic('heavy');
        onShowToast('Pembayaran Berhasil! 🎉', 'Pesanan Anda telah lunas dan sedang diproses otomatis.', 'success');
        if (checkResult.order) {
          setActiveInvoice(prev => prev ? { ...prev, order: checkResult.order! } : null);
        }
      } else {
        triggerHaptic('light');
        onShowToast('Menunggu Pembayaran', 'Pembayaran QRIS belum terdeteksi. Silakan selesaikan pembayaran.', 'info');
      }
    } catch (e: any) {
      onShowToast('Cek Pembayaran', e.message || 'Gagal memeriksa status pembayaran', 'error');
    } finally {
      setIsCheckingPayment(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 font-sans pb-24 selection:bg-amber-500 selection:text-slate-950">
      {/* 1. TOP HEADER BRANDING */}
      <header className="sticky top-0 z-30 bg-[#0A0F1D]/90 backdrop-blur-md border-b border-white/[0.08] px-4 py-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 p-0.5 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <div className="w-full h-full bg-[#0A0E17] rounded-[10px] flex items-center justify-center">
                <Bot size={18} className="text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight text-white">WayaheDigital</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                  Telegram Store
                </span>
              </div>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Sistem Otomatis 24 Jam
              </span>
            </div>
          </div>

          {onNavigateHome && (
            <button
              type="button"
              onClick={onNavigateHome}
              className="text-xs font-bold text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] transition-colors"
            >
              Ke Web Utama →
            </button>
          )}
        </div>
      </header>

      {/* 2. USER GREETING BANNER */}
      <div className="max-w-4xl mx-auto px-4 pt-4 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/15 via-[#0E1526] to-[#0A0E17] border border-amber-500/30 p-4 shadow-xl">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                Official Telegram Mini App
              </span>
              <h1 className="text-base sm:text-lg font-black text-white mt-0.5">
                Halo, {tgUser?.first_name || 'Sobat Wayahe'}! 👋
              </h1>
              <p className="text-xs text-slate-300 mt-1 max-w-md">
                Nikmati top up game kilat, pulsa, kuota, token PLN & akun premium dengan harga agen langsung di Telegram.
              </p>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-1">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                ⚡ Proses 1-3 Detik
              </span>
              <span className="text-[10px] text-slate-400">Garansi Penuh 100%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. SEARCH BAR */}
      <div className="max-w-4xl mx-auto px-4 pt-4 sm:px-6">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Cari Mobile Legends, Netflix, Pulsa Telkomsel, dll..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0F1626] border border-white/[0.08] text-xs font-semibold text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 4. CATEGORY TABS CAROUSEL */}
      <div className="max-w-4xl mx-auto px-4 pt-3 sm:px-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((c) => {
            const isSelected = selectedCategory === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedCategory(c.id);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 border flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/20'
                    : 'bg-[#0E1526] text-slate-400 border-white/[0.08] hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. PRODUCT GRID */}
      <main className="max-w-4xl mx-auto px-4 pt-4 sm:px-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {filteredProducts.length} Produk Tersedia
          </span>
          <span className="text-[11px] text-amber-400 font-medium">Auto Order Kilat</span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="py-12 text-center rounded-2xl bg-[#0E1526]/50 border border-white/[0.08] p-6">
            <Sparkles className="mx-auto text-amber-400 w-8 h-8 mb-2 opacity-60" />
            <h3 className="font-bold text-sm text-white">Produk tidak ditemukan</h3>
            <p className="text-xs text-slate-400 mt-1">Coba kata kunci lain atau pilih kategori Semua.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {filteredProducts.map((p) => {
              const stockInfo = getPremiumProductStock(p);
              const minPrice = p.hasVariants && p.variants && p.variants.length > 0
                ? Math.min(...p.variants.map((v) => v.sellingPrice))
                : p.sellingPrice;

              return (
                <motion.div
                  key={p.id}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleOpenProduct(p)}
                  className="rounded-2xl bg-gradient-to-b from-[#111827] to-[#0A0D15] border border-white/[0.08] hover:border-amber-400/50 p-3.5 flex flex-col justify-between cursor-pointer transition-shadow hover:shadow-lg hover:shadow-amber-500/10 group"
                >
                  <div>
                    {/* Top Row: Logo & Stock */}
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="w-11 h-11 rounded-xl bg-slate-900 border border-white/[0.1] overflow-hidden flex items-center justify-center shrink-0">
                        <ProductLogo
                          provider={p.provider}
                          name={p.name}
                          category={p.categoryId}
                          iconUrl={p.iconUrl}
                          size="md"
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${stockInfo.badgeStyle.bg} ${stockInfo.badgeStyle.text} ${stockInfo.badgeStyle.border}`}
                      >
                        <span className={`w-1 h-1 rounded-full ${stockInfo.badgeStyle.dot}`} />
                        {stockInfo.badgeLabel}
                      </span>
                    </div>

                    <span className="text-[10px] font-extrabold text-amber-500 uppercase tracking-wider block truncate">
                      {p.provider}
                    </span>

                    <h3 className="font-bold text-xs sm:text-sm text-white group-hover:text-amber-400 transition-colors line-clamp-1 mt-0.5">
                      {p.name}
                    </h3>

                    <p className="text-[10px] text-slate-400 line-clamp-1 mt-1">
                      {p.duration || 'Proses Instan'}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-white/[0.06] flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-slate-400 block">Mulai</span>
                      <span className="text-xs sm:text-sm font-black text-amber-400">
                        {formatRupiah(minPrice)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-bold flex items-center justify-center hover:bg-amber-400 transition-colors"
                    >
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      {/* 6. BOTTOM DRAWER CHECKOUT MODAL */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-lg bg-[#0E1526] rounded-t-3xl sm:rounded-3xl border border-white/[0.1] p-5 sm:p-6 max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 border border-white/[0.1] overflow-hidden flex items-center justify-center shrink-0">
                    <ProductLogo
                      provider={selectedProduct.provider}
                      name={selectedProduct.name}
                      category={selectedProduct.categoryId}
                      iconUrl={selectedProduct.iconUrl}
                      size="lg"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-amber-500">
                      {selectedProduct.provider}
                    </span>
                    <h2 className="text-sm sm:text-base font-extrabold text-white">
                      {selectedProduct.name}
                    </h2>
                    <span className="text-xs font-bold text-amber-400">
                      {formatRupiah(
                        selectedProduct.hasVariants && selectedVariantId
                          ? selectedProduct.variants?.find((v) => v.id === selectedVariantId)?.sellingPrice || selectedProduct.sellingPrice
                          : selectedProduct.sellingPrice
                      )}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {/* JIKA SUDAH ADA INVOICE QRIS AKTIF */}
              {activeInvoice ? (
                <div className="space-y-4 text-center py-2">
                  <div className="p-4 rounded-2xl bg-white text-slate-900 max-w-[260px] mx-auto shadow-xl">
                    <img
                      src={activeInvoice.qrImageUrl}
                      alt="QRIS Pembayaran"
                      className="w-full h-auto rounded-lg mx-auto"
                    />
                    <div className="mt-2 text-center">
                      <span className="text-[10px] font-bold text-slate-500 block uppercase">Metode Pembayaran</span>
                      <span className="text-xs font-black text-slate-900">QRIS Resmi Terverifikasi</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-slate-400 block">Total Pembayaran:</span>
                    <span className="text-xl font-black text-amber-400">
                      {formatRupiah(activeInvoice.order.totalAmount)}
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Invoice: <code className="text-white font-mono">{activeInvoice.order.invoiceNumber}</code>
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-left">
                    💡 <b>Cara Bayar:</b> Buka aplikasi DANA, GoPay, OVO, ShopeePay, BCA, atau Mobile Banking apa saja, lalu scan QR di atas.
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCheckPaymentStatus}
                      disabled={isCheckingPayment}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
                    >
                      <RefreshCw size={14} className={isCheckingPayment ? 'animate-spin' : ''} />
                      <span>{isCheckingPayment ? 'Memeriksa...' : 'Cek Status Pembayaran 🔄'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveInvoice(null)}
                      className="px-4 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              ) : (
                /* FORM INPUT CHECKOUT */
                <div className="space-y-4">
                  {/* Pilihan Varian jika ada */}
                  {selectedProduct.hasVariants && selectedProduct.variants && selectedProduct.variants.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 block">
                        Pilih Varian / Paket *
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedProduct.variants.map((v) => {
                          const isSel = selectedVariantId === v.id;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                triggerHaptic('light');
                                setSelectedVariantId(v.id);
                              }}
                              className={`p-2.5 rounded-xl border text-left transition-all ${
                                isSel
                                  ? 'border-amber-400 bg-amber-500/15 text-white ring-1 ring-amber-400/40'
                                  : 'border-white/[0.08] bg-[#0A0E17] text-slate-400 hover:border-amber-500/40'
                              }`}
                            >
                              <span className="text-xs font-bold block truncate">{v.name}</span>
                              <span className="text-xs font-black text-amber-400 mt-1 block">
                                {formatRupiah(v.sellingPrice)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Input Nomor / ID Tujuan */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">
                      {selectedProduct.categoryId === 'game'
                        ? 'ID Akun Game / Server Tujuan *'
                        : selectedProduct.categoryId === 'premium'
                        ? 'Email atau No. WhatsApp Penerima Akun *'
                        : selectedProduct.categoryId === 'pln'
                        ? 'Nomor Meter / ID Pelanggan PLN *'
                        : 'Nomor HP Tujuan Transaksi *'}
                    </label>
                    <input
                      type="text"
                      placeholder={
                        selectedProduct.categoryId === 'game'
                          ? 'Contoh: 12345678 (2020) atau Player#1234'
                          : selectedProduct.categoryId === 'premium'
                          ? 'Contoh: akun@gmail.com atau 08123456789'
                          : 'Contoh: 081234567890'
                      }
                      value={destinationTarget}
                      onChange={(e) => setDestinationTarget(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-[#080B12] border border-white/[0.1] text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {/* Ringkasan & Tombol Beli */}
                  <button
                    type="button"
                    onClick={handleCreateOrder}
                    disabled={isSubmitting}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span>{isSubmitting ? 'Memproses Pesanan...' : 'Beli Sekarang via QRIS ⚡'}</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
