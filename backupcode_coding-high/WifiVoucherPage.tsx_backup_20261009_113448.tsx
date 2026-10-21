import React, { useState, useMemo } from 'react';
import { 
  Radio, 
  MapPin, 
  Clock, 
  Zap, 
  ShieldCheck, 
  HelpCircle, 
  ArrowRight,
  Wifi,
  Info,
  CheckCircle2,
  Search,
  Sparkles,
  Layers,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Smartphone,
  Server,
  Lock,
  ExternalLink
} from 'lucide-react';
import { Product } from '../types';
import { formatRupiah } from '../utils/operator';
import { ProductLogo } from '../components/ProductLogo';
import { storage } from '../services/storage';

interface WifiVoucherPageProps {
  products: Product[];
  onSelectProductToCheckout: (product: Product, targetDestination: string) => void;
}

export function WifiVoucherPage({
  products,
  onSelectProductToCheckout,
}: WifiVoucherPageProps) {
  const [buyerPhone, setBuyerPhone] = useState('');
  const [selectedDurationFilter, setSelectedDurationFilter] = useState<'ALL' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [checkVoucherInput, setCheckVoucherInput] = useState('');
  const [checkResult, setCheckResult] = useState<{ found: boolean; voucher?: any; message?: string } | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<{ [productId: string]: string }>({});

  // Ambil data batch voucher untuk menghitung stok real-time
  const batches = useMemo(() => {
    try {
      return storage.getVoucherBatches();
    } catch {
      return [];
    }
  }, []);

  const wifiProducts = useMemo(() => {
    return products.filter(p => p.categoryId === 'wifi' && p.isActive);
  }, [products]);

  const totalAvailableVouchers = useMemo(() => {
    const fromBatches = batches.reduce((acc, b) => acc + (b.vouchers?.filter(v => v.status === 'AVAILABLE')?.length || 0), 0);
    const fromProducts = wifiProducts.reduce((acc, p) => {
      if (p.hasVariants && p.variants) {
        return acc + p.variants.reduce((vSum, v) => vSum + (v.voucherCodes?.length || v.stock || 0), 0);
      }
      return acc + (p.voucherCodes?.length || p.stock || 0);
    }, 0);
    return fromBatches + fromProducts;
  }, [batches, wifiProducts]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return wifiProducts.filter(p => {
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(query);
        const matchDesc = p.description.toLowerCase().includes(query);
        if (!matchName && !matchDesc) return false;
      }

      // Duration filter
      if (selectedDurationFilter !== 'ALL') {
        const durationLower = (p.duration || p.name).toLowerCase();
        if (selectedDurationFilter === 'HOURLY') {
          if (!durationLower.includes('jam') && !durationLower.includes('hour') && !durationLower.includes('2j') && !durationLower.includes('3j') && !durationLower.includes('6j') && !durationLower.includes('12j')) return false;
        } else if (selectedDurationFilter === 'DAILY') {
          if (!durationLower.includes('hari') && !durationLower.includes('24') && !durationLower.includes('1 h') && !durationLower.includes('3 h')) return false;
        } else if (selectedDurationFilter === 'WEEKLY') {
          if (!durationLower.includes('minggu') && !durationLower.includes('7') && !durationLower.includes('week')) return false;
        } else if (selectedDurationFilter === 'MONTHLY') {
          if (!durationLower.includes('bulan') && !durationLower.includes('30') && !durationLower.includes('month')) return false;
        }
      }

      return true;
    });
  }, [wifiProducts, searchQuery, selectedDurationFilter]);

  const handleCheckout = (product: Product) => {
    const hasVars = Array.isArray(product.variants) && product.variants.length > 0;
    const selectedVarId = selectedVariants[product.id] || (hasVars ? product.variants![0].id : null);
    const activeVar = hasVars ? product.variants!.find(v => v.id === selectedVarId) || product.variants![0] : null;

    const payload: Product = activeVar ? {
      ...product,
      name: `${product.name} - ${activeVar.name}`,
      sellingPrice: activeVar.sellingPrice,
      supplierPrice: activeVar.supplierPrice ?? product.supplierPrice,
      discountPrice: activeVar.discountPrice,
      duration: activeVar.duration || product.duration,
      speed: activeVar.speed || product.speed,
      stock: activeVar.stock ?? product.stock,
      badge: activeVar.badge || product.badge,
      selectedVariantId: activeVar.id,
      selectedVariantName: activeVar.name,
    } : product;

    onSelectProductToCheckout(payload, buyerPhone.trim() || 'Pelanggan WiFi');
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCheckVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkVoucherInput.trim()) return;

    const term = checkVoucherInput.trim().toUpperCase();
    const orders = storage.getOrders();
    
    // Cari di orders berdasarkan WhatsApp / invoice / voucher code
    const matchingOrder = orders.find(o => 
      o.category === 'wifi' && (
        o.targetDestination.includes(term) ||
        o.customerPhone?.includes(term) ||
        o.invoiceNumber.toUpperCase().includes(term) ||
        o.fulfillmentResult?.voucherCode?.toUpperCase().includes(term)
      )
    );

    if (matchingOrder && matchingOrder.fulfillmentResult?.voucherCode) {
      setCheckResult({
        found: true,
        voucher: {
          code: matchingOrder.fulfillmentResult.voucherCode,
          password: matchingOrder.fulfillmentResult.voucherPassword || '-',
          invoice: matchingOrder.invoiceNumber,
          product: matchingOrder.items[0]?.productName || 'Voucher WiFi RT/RW Net',
          date: matchingOrder.paidAt || matchingOrder.createdAt,
          ssid: matchingOrder.fulfillmentResult.wifiSsid || storage.getSettings().wifiHotspotSsid || 'MelatiNet_Warga_Hotspot',
          status: matchingOrder.fulfillmentStatus === 'SUCCESS' ? 'Aktif' : 'Menunggu Aktivasi',
        }
      });
    } else {
      // Cek di batches
      let batchVoucher: any = null;
      for (const b of batches) {
        const found = b.vouchers.find(v => v.code.toUpperCase() === term);
        if (found) {
          batchVoucher = { ...found, batchName: b.name, location: b.location };
          break;
        }
      }

      if (batchVoucher) {
        setCheckResult({
          found: true,
          voucher: {
            code: batchVoucher.code,
            password: batchVoucher.password || '-',
            invoice: 'Stok Terdaftar di Sistem',
            product: batchVoucher.batchName,
            ssid: 'Hotspot RT/RW Net Setempat',
            status: batchVoucher.status === 'AVAILABLE' ? 'Tersedia (Belum Terpakai)' : 'Sudah Terpakai / Aktif',
          }
        });
      } else {
        setCheckResult({
          found: false,
          message: 'Voucher tidak ditemukan. Pastikan Anda memasukkan nomor WhatsApp pembelian atau Nomor Invoice yang benar.'
        });
      }
    }
  };

  const faqs = [
    {
      q: 'Bagaimana cara login setelah membeli voucher WiFi?',
      a: 'Setelah pembayaran sukses, Anda akan langsung menerima Kode Voucher & Password. Sambungkan HP/Laptop ke sinyal WiFi RT/RW Net yang tersedia, buka browser untuk masuk ke halaman login captive portal, lalu masukkan Kode Voucher tersebut.'
    },
    {
      q: 'Apakah bisa digunakan di lebih dari 1 perangkat?',
      a: 'Voucher hotspot standar digunakan 1 perangkat secara bersamaan (1 login per voucher). Jika ingin berganti perangkat, silakan logout terlebih dahulu dari perangkat lama.'
    },
    {
      q: 'Bagaimana jika halaman login WiFi tidak muncul otomatis?',
      a: 'Buka aplikasi browser (Chrome/Safari), lalu ketik alamat http://hotspot.wayahedigital.id atau http://10.0.0.1 pada kolom URL dan tekan Enter.'
    },
    {
      q: 'Berapa lama masa aktif voucher WiFi?',
      a: 'Masa aktif voucher mulai dihitung sejak voucher pertama kali di-login-kan ke jaringan WiFi hotspot, bukan dari saat jam pembelian.'
    }
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* 1. HERO BANNER DENGAN INDIKATOR STATUS JARINGAN */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/50 shadow-xl p-6 sm:p-8 text-white">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-48 h-48 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>MikroTik Hotspot Server: ONLINE (99.9% Uptime)</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white leading-tight">
              Voucher Internet WiFi <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-300">RT/RW Net</span>
            </h1>

            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Akses internet warga berkecepatan tinggi, tanpa kuota & FUP, murah meriah untuk seluruh warga. Beli voucher instan online, kode langsung aktif otomatis!
            </p>

            {/* Micro Stats */}
            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-300">
              <div className="flex items-center gap-1.5">
                <Zap size={15} className="text-amber-400" />
                <span>Speed Up to 20 Mbps</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-sky-400" />
                <span>Unlimited Tanpa Kuota</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles size={15} className="text-emerald-400" />
                <span>{totalAvailableVouchers > 0 ? `${totalAvailableVouchers} Voucher Siap Pakai` : 'Stok Selalu Update'}</span>
              </div>
            </div>
          </div>

          {/* Quick Access Card */}
          <div className="bg-white/10 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-white/15 text-white max-w-xs w-full shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-200 uppercase tracking-wider">Akses Hotspot</span>
              <Wifi size={16} className="text-sky-400 animate-pulse" />
            </div>
            
            <div className="bg-black/30 p-2.5 rounded-xl border border-white/10 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Halaman Login:</span>
              <p className="font-mono text-sm font-bold text-white flex items-center justify-between">
                <span>hotspot.wayahedigital.id</span>
                <button 
                  onClick={() => handleCopy('hotspot.wayahedigital.id')}
                  className="text-slate-400 hover:text-white transition-colors text-xs cursor-pointer"
                  title="Salin Alamat Login"
                >
                  {copiedCode === 'hotspot.wayahedigital.id' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </p>
            </div>

            <div className="text-[11px] text-slate-300 space-y-1">
              <div className="flex items-center justify-between">
                <span>Metode Akses:</span>
                <span className="text-emerald-300 font-semibold">Kode Voucher / Password</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Sistem:</span>
                <span className="text-sky-300 font-medium">Captive Portal Otomatis</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. FORM IDENTITAS PEMBELI VOUCHER (OPSIONAL) */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm relative overflow-hidden space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <label htmlFor="wifi-buyer-phone" className="block text-xs font-extrabold uppercase tracking-wider text-slate-800">
              1. Nama Pembeli / Catatan (Opsional)
            </label>
            <p className="text-xs text-slate-500 mt-0.5">
              Kode voucher & password langsung ditampilkan di layar detik itu juga setelah pembayaran berhasil.
            </p>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Smartphone size={18} />
          </div>
          <input
            id="wifi-buyer-phone"
            type="text"
            placeholder="Nama Anda (opsional, contoh: Budi)"
            value={buyerPhone}
            onChange={(e) => setBuyerPhone(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-semibold text-slate-900 transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* 3. FILTER & SEARCH BAR */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Radio size={20} className="text-indigo-600" />
              <span>2. Pilih Paket Voucher WiFi</span>
            </h2>
            <p className="text-xs text-slate-500">
              Tersedia {filteredProducts.length} pilihan paket durasi sesuai kebutuhan Anda.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari paket / durasi / lokasi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <button
              onClick={() => setSelectedDurationFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedDurationFilter === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Paket ({wifiProducts.length})
            </button>
            <button
              onClick={() => setSelectedDurationFilter('HOURLY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedDurationFilter === 'HOURLY'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ⏱️ Harian / Jam
            </button>
            <button
              onClick={() => setSelectedDurationFilter('DAILY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedDurationFilter === 'DAILY'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              📅 24 Jam
            </button>
            <button
              onClick={() => setSelectedDurationFilter('WEEKLY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedDurationFilter === 'WEEKLY'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🚀 Mingguan (7 Hari)
            </button>
            <button
              onClick={() => setSelectedDurationFilter('MONTHLY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedDurationFilter === 'MONTHLY'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              👑 Bulanan (30 Hari)
            </button>
          </div>
        </div>

        {/* 4. GRID PRODUK VOUCHER */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs space-y-3">
            <Radio size={36} className="mx-auto text-slate-300" />
            <h3 className="font-bold text-slate-800 text-base">Tidak Ada Paket yang Sesuai</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Coba sesuaikan kata kunci pencarian atau ubah filter durasi di atas.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedDurationFilter('ALL'); }}
              className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold rounded-xl text-xs transition-colors"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((p) => {
              const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
              const selectedVarId = selectedVariants[p.id] || (hasVariants ? p.variants![0].id : null);
              const activeVariant = hasVariants ? p.variants!.find(v => v.id === selectedVarId) || p.variants![0] : null;

              const currentSellingPrice = activeVariant ? activeVariant.sellingPrice : p.sellingPrice;
              const currentDiscountPrice = activeVariant ? activeVariant.discountPrice : p.discountPrice;
              const currentDuration = activeVariant?.duration || p.duration || '24 Jam';
              const currentSpeed = activeVariant?.speed || p.speed || 'Up to 10 Mbps';
              const currentStock = Array.isArray(activeVariant?.voucherCodes) && activeVariant.voucherCodes.length > 0
                ? activeVariant.voucherCodes.length
                : (activeVariant?.stock ?? (Array.isArray(p.voucherCodes) && p.voucherCodes.length > 0 ? p.voucherCodes.length : (p.stock ?? 10)));
              const isOutOfStock = currentStock <= 0;
              const currentBadge = activeVariant?.badge || p.badge;

              return (
                <div
                  key={p.id}
                  className={`group relative bg-white rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between hover:shadow-md ${
                    isOutOfStock
                      ? 'opacity-60 border-slate-200 bg-slate-50/50'
                      : currentBadge
                        ? 'border-indigo-200 hover:border-indigo-400 ring-1 ring-indigo-500/10'
                        : 'border-slate-200/90 hover:border-indigo-300'
                  }`}
                >
                  {/* Badge Terlaris / Promo */}
                  {currentBadge && (
                    <div className="absolute -top-2.5 right-4">
                      <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                        <Sparkles size={10} />
                        {currentBadge}
                      </span>
                    </div>
                  )}

                  <div>
                    {/* Header Item */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="shrink-0 p-2.5 rounded-xl bg-gradient-to-br from-sky-50 to-indigo-50 text-indigo-600 border border-indigo-100/80 group-hover:scale-105 transition-transform">
                        <ProductLogo
                          provider={p.provider}
                          name={p.name}
                          category={p.categoryId}
                          iconUrl={p.iconUrl}
                          size="md"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                          {p.name}
                        </h3>
                        <div className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md mt-1">
                          <Clock size={11} className="text-sky-600" />
                          <span>Masa Aktif: {currentDuration}</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                      {p.description || 'Voucher internet hotspot kecepatan stabil tanpa kuota & FUP.'}
                    </p>

                    {/* Multi-Varian Selector Chips */}
                    {hasVariants && (
                      <div className="mb-3 space-y-1.5 bg-indigo-50/40 p-2.5 rounded-xl border border-indigo-100/80">
                        <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider block">
                          Pilih Varian Durasi:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {p.variants!.map(v => {
                            const isSelected = v.id === selectedVarId;
                            return (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => setSelectedVariants(prev => ({ ...prev, [p.id]: v.id }))}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-600/30'
                                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                                }`}
                              >
                                <span>{v.name}</span>
                                <span className={`text-[10px] font-mono ${isSelected ? 'text-indigo-200' : 'text-emerald-600'}`}>
                                  ({formatRupiah(v.sellingPrice)})
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Fitur & Spek Kotak */}
                    <div className="space-y-1.5 bg-slate-50/80 rounded-xl p-3 border border-slate-100 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Zap size={13} className="text-amber-500" />
                          Kecepatan:
                        </span>
                        <span className="font-bold text-slate-800">{currentSpeed}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <ShieldCheck size={13} className="text-emerald-500" />
                          Kuota:
                        </span>
                        <span className="font-bold text-emerald-700">Unlimited (No FUP)</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-200/60">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Layers size={13} className="text-indigo-500" />
                          Ketersediaan:
                        </span>
                        <span className={`font-bold ${
                          isOutOfStock 
                            ? 'text-rose-600' 
                            : currentStock <= 5 
                              ? 'text-amber-600 animate-pulse' 
                              : 'text-teal-600'
                        }`}>
                          {isOutOfStock 
                            ? 'Stok Habis' 
                            : currentStock <= 5 
                              ? `Sisa ${currentStock} Voucher!` 
                              : `Tersedia (${currentStock} pcs)`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pricing & CTA Button */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">
                        {hasVariants ? 'Harga Varian Terpilih' : 'Harga Voucher'}
                      </span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base sm:text-lg font-black text-indigo-600">
                          {formatRupiah(currentSellingPrice)}
                        </span>
                        {currentDiscountPrice && currentDiscountPrice > currentSellingPrice && (
                          <span className="text-[10px] text-slate-400 line-through">
                            {formatRupiah(currentDiscountPrice)}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleCheckout(p)}
                      disabled={isOutOfStock}
                      id={`buy-wifi-${p.id}`}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                        isOutOfStock
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-indigo-600/20'
                      }`}
                    >
                      <span>{isOutOfStock ? 'Habis' : 'Beli Sekarang'}</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. FITUR CEK STATUS & SALIN KODE VOUCHER */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl p-6 text-white border border-indigo-900 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-extrabold text-base text-white flex items-center gap-2">
              <Search size={18} className="text-sky-400" />
              <span>Cek Status & Kode Voucher Anda</span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Sudah pernah membeli? Masukkan nomor WhatsApp atau Nomor Invoice Anda untuk melihat / menyalin kode voucher kembali.
            </p>
          </div>
        </div>

        <form onSubmit={handleCheckVoucher} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Masukkan No WhatsApp / No Invoice / Kode Voucher..."
            value={checkVoucherInput}
            onChange={(e) => setCheckVoucherInput(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-400 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-400 backdrop-blur-md"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Search size={14} />
            <span>Cari Voucher</span>
          </button>
        </form>

        {checkResult && (
          <div className={`p-4 rounded-xl text-xs space-y-2 border animate-fade-in ${
            checkResult.found 
              ? 'bg-white/10 border-emerald-500/40 text-white' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
          }`}>
            {checkResult.found && checkResult.voucher ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={14} />
                    <span>Voucher Ditemukan</span>
                  </span>
                  <span className="text-[10px] text-slate-400">{checkResult.voucher.invoice}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-black/40 p-3 rounded-lg border border-white/10">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Kode Voucher (Username)</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-base font-black text-amber-400">
                        {checkResult.voucher.code}
                      </span>
                      <button
                        onClick={() => handleCopy(checkResult.voucher.code)}
                        className="p-1 text-slate-300 hover:text-white transition-colors"
                        title="Salin Kode"
                      >
                        {copiedCode === checkResult.voucher.code ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Password Voucher</span>
                    <span className="font-mono text-sm font-bold text-slate-200">
                      {checkResult.voucher.password}
                    </span>
                  </div>

                  <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10 text-[11px] text-slate-300">
                    <span>Paket: <strong className="text-white">{checkResult.voucher.product}</strong></span>
                    <span>Status: <strong className="text-emerald-300">{checkResult.voucher.status}</strong></span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-rose-300">{checkResult.message}</p>
            )}
          </div>
        )}
      </div>

      {/* 6. PANDUAN CARA MENGGUNAKAN VOUCHER (3 LANGKAH MUDAH) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <HelpCircle size={18} className="text-indigo-600" />
            <span>Cara Login & Menggunakan Voucher WiFi RT/RW Net</span>
          </h3>
          <span className="text-[11px] font-semibold text-slate-400">3 Langkah Cepat</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/80 space-y-2 relative overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 font-black text-sm flex items-center justify-center">
              1
            </div>
            <p className="font-bold text-slate-900 text-sm">Hubungkan ke Sinyal WiFi</p>
            <p className="text-slate-500 leading-relaxed text-xs">
              Buka menu WiFi pada HP / Laptop Anda, lalu sambungkan ke sinyal hotspot WiFi yang tersedia di lokasi Anda.
            </p>
          </div>

          <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/80 space-y-2 relative overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 font-black text-sm flex items-center justify-center">
              2
            </div>
            <p className="font-bold text-slate-900 text-sm">Buka Halaman Login</p>
            <p className="text-slate-500 leading-relaxed text-xs">
              Halaman captive portal login akan terbuka otomatis. Jika tidak, buka browser dan ketik alamat <span className="font-mono text-indigo-600 font-semibold">hotspot.wayahedigital.id</span>.
            </p>
          </div>

          <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/80 space-y-2 relative overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 font-black text-sm flex items-center justify-center">
              3
            </div>
            <p className="font-bold text-slate-900 text-sm">Masukkan Kode & Klik Login</p>
            <p className="text-slate-500 leading-relaxed text-xs">
              Ketik atau tempel Kode Voucher dan Password dari invoice pembelian Anda. Internet langsung aktif seketika!
            </p>
          </div>
        </div>
      </div>

      {/* 7. FAQ ACCORDION */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-3">
        <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider mb-2">
          Pertanyaan Umum (FAQ) Hotspot RT/RW Net
        </h3>

        <div className="divide-y divide-slate-100">
          {faqs.map((faq, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div key={index} className="py-3">
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  className="w-full flex items-center justify-between text-left text-xs font-bold text-slate-800 hover:text-indigo-600 transition-colors gap-3"
                >
                  <span>{faq.q}</span>
                  {isOpen ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                </button>
                {isOpen && (
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 animate-fade-in">
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
