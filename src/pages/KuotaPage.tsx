import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  ArrowRight, 
  Check, 
  Info, 
  Clock, 
  Sparkles,
  HelpCircle,
  FileText,
  X
} from 'lucide-react';
import { Product } from '../types';
import { detectOperator, OPERATORS, formatRupiah } from '../utils/operator';
import { ProductLogo } from '../components/ProductLogo';

interface KuotaPageProps {
  products: Product[];
  initialPhone?: string;
  onSelectProductToCheckout: (product: Product, targetNumber: string) => void;
}

export function KuotaPage({
  products,
  initialPhone = '',
  onSelectProductToCheckout,
}: KuotaPageProps) {
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [selectedOperator, setSelectedOperator] = useState<string>('Telkomsel');
  const [filterDuration, setFilterDuration] = useState<'ALL' | '30D' | 'HARIAN'>('ALL');
  const [detailModalProduct, setDetailModalProduct] = useState<Product | null>(null);

  // Auto detect
  useEffect(() => {
    const detected = detectOperator(phoneNumber);
    if (detected) {
      setSelectedOperator(detected);
    }
  }, [phoneNumber]);

  const kuotaProducts = products.filter(
    p => p.categoryId === 'kuota' && 
         p.isActive &&
         p.provider.toLowerCase().includes(selectedOperator.toLowerCase())
  );

  const filteredProducts = kuotaProducts.filter(p => {
    if (filterDuration === 'ALL') return true;
    if (filterDuration === '30D') return p.duration?.includes('30') || p.duration?.includes('Bulan') || p.duration?.includes('Aktif');
    if (filterDuration === 'HARIAN') return p.duration?.includes('Hari') && !p.duration?.includes('30');
    return true;
  });

  const handleSelectToCheckout = (product: Product) => {
    if (!phoneNumber || phoneNumber.trim().length < 8) {
      alert('Masukkan nomor handphone tujuan yang valid.');
      return;
    }
    onSelectProductToCheckout(product, phoneNumber.trim());
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
            <Wifi size={18} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Paket Kuota Internet
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-500">
          Paket data 24 jam semua operator Indonesia. Otomatis masuk dengan konfirmasi serial number resmi.
        </p>
      </div>

      {/* Input Nomor HP & Operator */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
        <div>
          <label htmlFor="kuota-phone-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            1. Nomor Handphone Tujuan Paket Data
          </label>
          <div className="relative">
            <input
              id="kuota-phone-input"
              type="tel"
              placeholder="Contoh: 08123456789"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full pl-4 pr-32 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base font-semibold text-slate-900"
            />
            {selectedOperator && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="text-xs font-bold px-2.5 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg">
                  {selectedOperator}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Operator Choice Chips */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Pilihan Operator
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {OPERATORS.map((op) => {
              const isSelected = selectedOperator.toLowerCase() === op.toLowerCase();
              return (
                <button
                  key={op}
                  type="button"
                  onClick={() => setSelectedOperator(op)}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
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

      {/* Filter Paket & Grid */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <ProductLogo provider={selectedOperator} size="xs" />
            <span>2. Pilih Paket Kuota ({selectedOperator})</span>
          </label>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setFilterDuration('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterDuration === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setFilterDuration('30D')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterDuration === '30D' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bulanan (30 Hari)
            </button>
            <button
              onClick={() => setFilterDuration('HARIAN')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterDuration === 'HARIAN' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Harian / Singkat
            </button>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-500">
            <Wifi size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold">Paket kuota belum tersedia untuk filter ini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProducts.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:shadow-md hover:border-teal-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <ProductLogo
                        provider={p.provider}
                        name={p.name}
                        category={p.categoryId}
                        iconUrl={p.iconUrl}
                        size="md"
                      />
                      <div>
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block">
                          {p.provider}
                        </span>
                        <span className="text-[11px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full inline-block">
                          {p.quotaDetails || 'Kuota Utama'}
                        </span>
                      </div>
                    </div>

                    {p.badge && (
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md shrink-0">
                        {p.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {p.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                    {p.description}
                  </p>

                  <div className="flex items-center gap-2 mt-3 text-xs text-slate-600">
                    <Clock size={13} className="text-slate-400" />
                    <span>Masa Aktif: <strong>{p.duration || '30 Hari'}</strong></span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Harga Paket</span>
                    <span className="text-lg font-extrabold text-teal-600">
                      {formatRupiah(p.sellingPrice)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDetailModalProduct(p)}
                      className="px-2.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                      title="Lihat Rincian & Syarat"
                    >
                      Detail
                    </button>
                    <button
                      onClick={() => handleSelectToCheckout(p)}
                      id={`buy-kuota-${p.id}`}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Pilih Paket</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Package Detail Modal */}
      {detailModalProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-teal-600 uppercase tracking-wider">
                  Rincian Paket Kuota
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 mt-1">
                  {detailModalProduct.name}
                </h3>
              </div>
              <button
                onClick={() => setDetailModalProduct(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl text-xs space-y-2 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Kuota Utama:</span>
                <span className="font-bold text-slate-900">{detailModalProduct.quotaDetails}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Masa Aktif:</span>
                <span className="font-bold text-slate-900">{detailModalProduct.duration}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Harga:</span>
                <span className="font-extrabold text-teal-600 text-sm">{formatRupiah(detailModalProduct.sellingPrice)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Ketentuan & Pembagian Kuota
              </h4>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4 leading-relaxed">
                {detailModalProduct.terms?.map((term, i) => (
                  <li key={i}>{term}</li>
                )) || (
                  <>
                    <li>Kuota aktif 24 jam di seluruh jaringan nasional.</li>
                    <li>Pastikan nomor dalam keadaan aktif dan tidak sedang masa tenggang.</li>
                  </>
                )}
              </ul>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setDetailModalProduct(null)}
                className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  const p = detailModalProduct;
                  setDetailModalProduct(null);
                  handleSelectToCheckout(p);
                }}
                className="w-1/2 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs"
              >
                Beli Paket Ini
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
