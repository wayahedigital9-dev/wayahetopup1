import React, { useState, useEffect, useRef } from 'react';
import { 
  Smartphone, 
  ArrowRight, 
  Check, 
  Sparkles, 
  Info, 
  Zap,
  Globe,
  CheckCircle2,
  ShieldCheck,
  CreditCard
} from 'lucide-react';
import { Product } from '../types';
import { detectOperator, OPERATORS, formatRupiah } from '../utils/operator';
import { ProductLogo } from '../components/ProductLogo';

interface PulsaPageProps {
  products: Product[];
  initialPhone?: string;
  onSelectProductToCheckout: (product: Product, targetNumber: string) => void;
}

export function PulsaPage({
  products,
  initialPhone = '',
  onSelectProductToCheckout,
}: PulsaPageProps) {
  const [serviceType, setServiceType] = useState<'PULSA' | 'KUOTA'>('PULSA');
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [selectedOperator, setSelectedOperator] = useState<string>('Telkomsel');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus phone input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Filter products for category 'pulsa' & 'kuota' (termasuk produk dengan status stok real-time)
  const activeProducts = products.filter(
    p => (serviceType === 'PULSA' ? p.categoryId === 'pulsa' : p.categoryId === 'kuota')
  );

  // Auto-detect operator whenever phone number changes
  useEffect(() => {
    const detected = detectOperator(phoneNumber);
    if (detected) {
      setSelectedOperator(detected);
    }
  }, [phoneNumber]);

  // Current operator products
  const operatorProducts = activeProducts
    .filter(p => p.provider.toLowerCase().includes(selectedOperator.toLowerCase()))
    .sort((a, b) => (a.nominal || a.sellingPrice) - (b.nominal || b.sellingPrice));

  const handleContinue = (productToCheckout?: Product) => {
    const p = productToCheckout || selectedProduct;
    if (!phoneNumber || phoneNumber.trim().length < 8) {
      alert('Masukkan nomor handphone tujuan yang valid (minimal 8 digit).');
      if (inputRef.current) inputRef.current.focus();
      return;
    }
    if (!p) {
      alert('Silakan pilih salah satu nominal pulsa atau kuota terlebih dahulu.');
      return;
    }
    const isAvail = p.isActive !== false &&
      p.sellerProductStatus !== false &&
      !(p.unlimitedStock === false && p.stock !== undefined && Number(p.stock) <= 0);
    if (!isAvail) {
      alert(p.statusNote || 'Stok produk ini sedang kosong dari supplier API. Silakan pilih nominal lain.');
      return;
    }
    onSelectProductToCheckout(p, phoneNumber.trim());
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-7 text-[#F8FAFC]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1E293B]/80 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-[#F59E0B]/20 text-[#F59E0B] flex items-center justify-center border border-[#F59E0B]/40">
              <Smartphone size={18} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#F8FAFC] tracking-tight">
              Isi Pulsa & Paket Data Kuota
            </h1>
          </div>
          <p className="text-xs text-[#94A3B8]">
            Masukkan nomor tujuan HP untuk langsung melanjutkan ke pembayaran instan 24 jam.
          </p>
        </div>

        {/* Tab Toggle: Pulsa vs Kuota */}
        <div className="flex items-center p-1 rounded-2xl bg-[#0B0F17] border border-[#1E293B] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setServiceType('PULSA');
              setSelectedProduct(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              serviceType === 'PULSA'
                ? 'bg-[#F59E0B] text-[#0B0F17] shadow-md'
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            <Zap size={13} />
            <span>Pulsa Reguler</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setServiceType('KUOTA');
              setSelectedProduct(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              serviceType === 'KUOTA'
                ? 'bg-[#F59E0B] text-[#0B0F17] shadow-md'
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            <Globe size={13} />
            <span>Paket Data Kuota</span>
          </button>
        </div>
      </div>

      {/* 1. INPUT NOMOR TUJUAN & DETEKSI OPERATOR (SQUIRCLE CARD) */}
      <div className="bg-[#0E131F] rounded-3xl p-5 sm:p-6 border border-[#1E293B] shadow-xl space-y-4">
        <div>
          <label htmlFor="pulsa-phone-input" className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1] mb-2 flex items-center justify-between">
            <span>1. Masukkan Nomor Handphone Tujuan</span>
            <span className="text-[10px] text-[#10B981] font-semibold flex items-center gap-1">
              <ShieldCheck size={12} />
              <span>Otomatis Deteksi Operator</span>
            </span>
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              id="pulsa-phone-input"
              type="tel"
              placeholder="Contoh: 081234567890"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full pl-4 pr-36 py-3.5 rounded-2xl bg-[#080B12] border-2 border-[#1E293B] focus:border-[#F59E0B] focus:ring-4 focus:ring-[#F59E0B]/20 text-base sm:text-lg font-bold font-mono text-[#F8FAFC] transition-all placeholder:text-[#94A3B8]/50"
            />
            {selectedOperator && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111827] border border-[#F59E0B]/50 shadow-xs">
                <ProductLogo provider={selectedOperator} size="xs" showBadgeBorder={false} />
                <span className="text-xs font-black text-[#F59E0B]">
                  {selectedOperator}
                </span>
              </div>
            )}
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-2 flex items-center gap-1.5">
            <Info size={13} className="text-[#F59E0B] shrink-0" />
            <span>Nomor tujuan langsung menerima saldo/paket detik itu juga setelah pembayaran berhasil.</span>
          </p>
        </div>

        {/* Pilihan Operator Manual */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-2">
            Koreksi Operator (Jika Berpindah Provider)
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {OPERATORS.map((op) => {
              const isSelected = selectedOperator.toLowerCase() === op.toLowerCase();
              return (
                <button
                  key={op}
                  type="button"
                  onClick={() => {
                    setSelectedOperator(op);
                    setSelectedProduct(null);
                  }}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-[#F59E0B] text-[#0B0F17] border-[#F59E0B] shadow-sm font-black'
                      : 'bg-[#080B12] text-[#CBD5E1] border-[#1E293B] hover:border-[#F59E0B]/60'
                  }`}
                >
                  <ProductLogo provider={op} size="xs" showBadgeBorder={false} />
                  <span>{op}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. PILIHAN PRODUK / NOMINAL / PAKET */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#F8FAFC] flex items-center gap-2">
            <ProductLogo provider={selectedOperator} size="xs" />
            <span>
              2. Pilih {serviceType === 'PULSA' ? 'Nominal Pulsa' : 'Paket Kuota Data'} ({selectedOperator})
            </span>
          </label>
          <span className="text-xs text-[#94A3B8]">
            {operatorProducts.length} Pilihan Tersedia
          </span>
        </div>

        {operatorProducts.length === 0 ? (
          <div className="bg-[#0E131F] rounded-3xl p-8 border border-dashed border-[#1E293B] text-center text-[#94A3B8] space-y-2">
            <Smartphone size={36} className="mx-auto text-[#94A3B8]/50" />
            <p className="text-sm font-bold text-[#CBD5E1]">Produk untuk operator {selectedOperator} belum tersedia.</p>
            <p className="text-xs text-[#94A3B8]">Silakan coba pilih operator lainnya di atas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {operatorProducts.map((p) => {
              const isChosen = selectedProduct?.id === p.id;
              const isAvailable = p.isActive !== false &&
                p.sellerProductStatus !== false &&
                !(p.unlimitedStock === false && p.stock !== undefined && Number(p.stock) <= 0);

              return (
                <div
                  key={p.id}
                  id={`product-item-${p.id}`}
                  onClick={() => setSelectedProduct(p)}
                  className={`relative bg-[#0E131F] rounded-2xl sm:rounded-3xl p-4.5 border transition-all cursor-pointer flex flex-col justify-between group ${
                    !isAvailable
                      ? 'opacity-60 bg-[#0A0D14]/80 border-dashed border-rose-500/25'
                      : isChosen
                      ? 'border-[#F59E0B] ring-2 ring-[#F59E0B]/40 bg-gradient-to-b from-[#1E293B] to-[#0E131F] shadow-lg shadow-[#F59E0B]/10 scale-[1.02]'
                      : 'border-[#1E293B]/80 hover:border-[#F59E0B]/60 hover:bg-[#131927]'
                  }`}
                >
                  {/* Top: Logo & Badge */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <ProductLogo
                          provider={p.provider}
                          name={p.name}
                          category={p.categoryId}
                          iconUrl={p.iconUrl}
                          size="sm"
                        />
                        <div>
                          <span className="text-[10px] font-extrabold text-[#94A3B8] uppercase tracking-wide block">
                            {p.provider}
                          </span>
                          <span className="text-xs font-bold text-[#F8FAFC] block">
                            {serviceType === 'PULSA' ? 'Pulsa Reguler' : 'Kuota Internet'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {!isAvailable ? (
                          <span className="text-[9px] font-bold text-rose-300 bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 rounded-full uppercase">
                            {p.statusNote || 'Stok Kosong'}
                          </span>
                        ) : p.badge ? (
                          <span className="text-[9px] font-bold text-[#F59E0B] bg-[#F59E0B]/15 border border-[#F59E0B]/30 px-2 py-0.5 rounded-full uppercase">
                            {p.badge}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-2">
                      <span className="text-lg sm:text-xl font-black text-[#F8FAFC] block">
                        {p.nominal ? formatRupiah(p.nominal) : p.name}
                      </span>
                      <p className="text-[11px] text-[#94A3B8] mt-1 line-clamp-2 leading-relaxed">
                        {p.quotaDetails || p.description}
                      </p>
                    </div>
                  </div>

                  {/* Bottom: Price & Select Indicator */}
                  <div className="mt-4 pt-3 border-t border-[#1E293B]/60 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#94A3B8] block">Harga Bayar</span>
                      <span className="text-sm sm:text-base font-black text-[#F59E0B]">
                        {formatRupiah(p.sellingPrice)}
                      </span>
                    </div>

                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center border transition-all ${
                      isChosen
                        ? 'bg-[#F59E0B] border-[#F59E0B] text-[#0B0F17] shadow-xs'
                        : 'border-[#1E293B] bg-[#080B12] text-transparent group-hover:border-[#F59E0B]/60'
                    }`}>
                      <Check size={14} className="stroke-[3]" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. STICKY BOTTOM BAR: LANJUT LANGSUNG KE PEMBAYARAN */}
      {selectedProduct && (
        <div className="sticky bottom-20 lg:bottom-6 z-30 bg-[#111827]/95 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-5 border-2 border-[#F59E0B]/80 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-slideUp">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[#94A3B8]">Pilihan:</span>
              <span className="text-xs font-bold text-[#F8FAFC]">{selectedProduct.name}</span>
              <span className="text-xs text-[#F59E0B] font-mono font-bold">
                &rarr; {phoneNumber || 'Nomor Belum Diisi'}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xs text-[#94A3B8]">Total Bayar:</span>
              <span className="text-lg sm:text-xl font-black text-[#F8FAFC]">
                {formatRupiah(selectedProduct.sellingPrice)}
              </span>
              <span className="text-[10px] text-[#10B981] font-bold bg-[#10B981]/15 border border-[#10B981]/30 px-2 py-0.5 rounded-full">
                Bebas Admin
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleContinue()}
            id="pulsa-checkout-btn"
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-[#F59E0B] via-[#FBBF24] to-[#D97706] text-[#0B0F17] font-black rounded-xl sm:rounded-2xl text-xs sm:text-sm hover:brightness-110 active:scale-[0.99] transition-all shadow-lg shadow-[#F59E0B]/25 flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <CreditCard size={16} />
            <span>Lanjut ke Pembayaran</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
