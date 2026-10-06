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

  // Filter products for category 'pulsa' & 'kuota'
  const activeProducts = products.filter(
    p => (serviceType === 'PULSA' ? p.categoryId === 'pulsa' : p.categoryId === 'kuota') && p.isActive
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
    onSelectProductToCheckout(p, phoneNumber.trim());
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-7 text-[#FAF4EB]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#3E342B]/80 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-[#D4A359]/20 text-[#D4A359] flex items-center justify-center border border-[#D4A359]/40">
              <Smartphone size={18} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#FAF4EB] tracking-tight">
              Isi Pulsa & Paket Data Kuota
            </h1>
          </div>
          <p className="text-xs text-[#A89F91]">
            Masukkan nomor tujuan HP untuk langsung melanjutkan ke pembayaran instan 24 jam.
          </p>
        </div>

        {/* Tab Toggle: Pulsa vs Kuota */}
        <div className="flex items-center p-1 rounded-2xl bg-[#18130F] border border-[#3E342B] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setServiceType('PULSA');
              setSelectedProduct(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              serviceType === 'PULSA'
                ? 'bg-[#D4A359] text-[#181411] shadow-md'
                : 'text-[#A89F91] hover:text-[#FAF4EB]'
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
                ? 'bg-[#D4A359] text-[#181411] shadow-md'
                : 'text-[#A89F91] hover:text-[#FAF4EB]'
            }`}
          >
            <Globe size={13} />
            <span>Paket Data Kuota</span>
          </button>
        </div>
      </div>

      {/* 1. INPUT NOMOR TUJUAN & DETEKSI OPERATOR (SQUIRCLE CARD) */}
      <div className="bg-[#1C1612] rounded-3xl p-5 sm:p-6 border border-[#3E342B] shadow-xl space-y-4">
        <div>
          <label htmlFor="pulsa-phone-input" className="block text-xs font-bold uppercase tracking-wider text-[#D5CEBF] mb-2 flex items-center justify-between">
            <span>1. Masukkan Nomor Handphone Tujuan</span>
            <span className="text-[10px] text-[#84A951] font-semibold flex items-center gap-1">
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
              className="w-full pl-4 pr-36 py-3.5 rounded-2xl bg-[#14100D] border-2 border-[#3E342B] focus:border-[#D4A359] focus:ring-4 focus:ring-[#D4A359]/20 text-base sm:text-lg font-bold font-mono text-[#FAF4EB] transition-all placeholder:text-[#A89F91]/50"
            />
            {selectedOperator && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#251E18] border border-[#D4A359]/50 shadow-xs">
                <ProductLogo provider={selectedOperator} size="xs" showBadgeBorder={false} />
                <span className="text-xs font-black text-[#D4A359]">
                  {selectedOperator}
                </span>
              </div>
            )}
          </div>
          <p className="text-[11px] text-[#A89F91] mt-2 flex items-center gap-1.5">
            <Info size={13} className="text-[#D4A359] shrink-0" />
            <span>Nomor tujuan langsung menerima saldo/paket detik itu juga setelah pembayaran berhasil.</span>
          </p>
        </div>

        {/* Pilihan Operator Manual */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#A89F91] mb-2">
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
                      ? 'bg-[#D4A359] text-[#181411] border-[#D4A359] shadow-sm font-black'
                      : 'bg-[#14100D] text-[#D5CEBF] border-[#3E342B] hover:border-[#D4A359]/60'
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
          <label className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#FAF4EB] flex items-center gap-2">
            <ProductLogo provider={selectedOperator} size="xs" />
            <span>
              2. Pilih {serviceType === 'PULSA' ? 'Nominal Pulsa' : 'Paket Kuota Data'} ({selectedOperator})
            </span>
          </label>
          <span className="text-xs text-[#A89F91]">
            {operatorProducts.length} Pilihan Tersedia
          </span>
        </div>

        {operatorProducts.length === 0 ? (
          <div className="bg-[#1C1612] rounded-3xl p-8 border border-dashed border-[#3E342B] text-center text-[#A89F91] space-y-2">
            <Smartphone size={36} className="mx-auto text-[#A89F91]/50" />
            <p className="text-sm font-bold text-[#D5CEBF]">Produk untuk operator {selectedOperator} belum tersedia.</p>
            <p className="text-xs text-[#A89F91]">Silakan coba pilih operator lainnya di atas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {operatorProducts.map((p) => {
              const isChosen = selectedProduct?.id === p.id;
              return (
                <div
                  key={p.id}
                  id={`product-item-${p.id}`}
                  onClick={() => setSelectedProduct(p)}
                  className={`relative bg-[#1C1612] rounded-2xl sm:rounded-3xl p-4.5 border transition-all cursor-pointer flex flex-col justify-between group ${
                    isChosen
                      ? 'border-[#D4A359] ring-2 ring-[#D4A359]/40 bg-gradient-to-b from-[#2B231C] to-[#1C1612] shadow-lg shadow-[#D4A359]/10 scale-[1.02]'
                      : 'border-[#3E342B]/80 hover:border-[#D4A359]/60 hover:bg-[#231A14]'
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
                          <span className="text-[10px] font-extrabold text-[#A89F91] uppercase tracking-wide block">
                            {p.provider}
                          </span>
                          <span className="text-xs font-bold text-[#FAF4EB] block">
                            {serviceType === 'PULSA' ? 'Pulsa Reguler' : 'Kuota Internet'}
                          </span>
                        </div>
                      </div>

                      {p.badge && (
                        <span className="text-[9px] font-bold text-[#D4A359] bg-[#D4A359]/15 border border-[#D4A359]/30 px-2 py-0.5 rounded-full uppercase">
                          {p.badge}
                        </span>
                      )}
                    </div>

                    <div className="mt-2">
                      <span className="text-lg sm:text-xl font-black text-[#FAF4EB] block">
                        {p.nominal ? formatRupiah(p.nominal) : p.name}
                      </span>
                      <p className="text-[11px] text-[#A89F91] mt-1 line-clamp-2 leading-relaxed">
                        {p.quotaDetails || p.description}
                      </p>
                    </div>
                  </div>

                  {/* Bottom: Price & Select Indicator */}
                  <div className="mt-4 pt-3 border-t border-[#3E342B]/60 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#A89F91] block">Harga Bayar</span>
                      <span className="text-sm sm:text-base font-black text-[#D4A359]">
                        {formatRupiah(p.sellingPrice)}
                      </span>
                    </div>

                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center border transition-all ${
                      isChosen
                        ? 'bg-[#D4A359] border-[#D4A359] text-[#181411] shadow-xs'
                        : 'border-[#3E342B] bg-[#14100D] text-transparent group-hover:border-[#D4A359]/60'
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
        <div className="sticky bottom-20 lg:bottom-6 z-30 bg-[#251E18]/95 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-5 border-2 border-[#D4A359]/80 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-slideUp">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[#A89F91]">Pilihan:</span>
              <span className="text-xs font-bold text-[#FAF4EB]">{selectedProduct.name}</span>
              <span className="text-xs text-[#D4A359] font-mono font-bold">
                &rarr; {phoneNumber || 'Nomor Belum Diisi'}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xs text-[#A89F91]">Total Bayar:</span>
              <span className="text-lg sm:text-xl font-black text-[#FAF4EB]">
                {formatRupiah(selectedProduct.sellingPrice)}
              </span>
              <span className="text-[10px] text-[#84A951] font-bold bg-[#84A951]/15 border border-[#84A951]/30 px-2 py-0.5 rounded-full">
                Bebas Admin
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleContinue()}
            id="pulsa-checkout-btn"
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-[#D4A359] via-[#E2B774] to-[#C08F47] text-[#181411] font-black rounded-xl sm:rounded-2xl text-xs sm:text-sm hover:brightness-110 active:scale-[0.99] transition-all shadow-lg shadow-[#D4A359]/25 flex items-center justify-center gap-2 cursor-pointer shrink-0"
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
