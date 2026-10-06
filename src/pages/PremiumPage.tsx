import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  ArrowRight, 
  Zap, 
  Clock, 
  Mail,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { Product, PromoBanner } from '../types';
import { formatRupiah } from '../utils/operator';
import { HeroAdBanner } from '../components/HeroAdBanner';
import { ProductLogo } from '../components/ProductLogo';
import { storage } from '../services/storage';
import { PREMIUM_CATEGORY_PILLS, matchesPremiumCategory } from './HomePage';
import { CategoryMaintenanceNotice } from '../components/CategoryMaintenanceNotice';

interface PremiumPageProps {
  products: Product[];
  banners?: PromoBanner[];
  onSelectProductToCheckout: (product: Product, targetAccount: string) => void;
  onNavigate?: (tab: string) => void;
  isAdmin?: boolean;
}

export function PremiumPage({
  products,
  banners: propBanners,
  onSelectProductToCheckout,
  onNavigate = () => {},
  isAdmin,
}: PremiumPageProps) {
  const isPremiumActive = storage.getSettings().categoryStatus?.premium !== false;

  if (!isPremiumActive) {
    return (
      <CategoryMaintenanceNotice
        categoryName="Akun Aplikasi Premium"
        onBack={() => onNavigate('home')}
      />
    );
  }

  const premiumProducts = useMemo(() => products.filter(p => p.categoryId === 'premium' && p.isActive), [products]);
  const [targetAccount, setTargetAccount] = useState('');
  const [selectedPremiumCategory, setSelectedPremiumCategory] = useState<string>('Semua');

  const availablePremiumCategories = useMemo(() => {
    const existingLower = new Set(PREMIUM_CATEGORY_PILLS.map(c => c.toLowerCase()));
    const dynamicCats: string[] = [];

    premiumProducts.forEach(p => {
      const rawCat = p.digiflazzCategory || (p as any).category;
      if (rawCat && typeof rawCat === 'string' && !existingLower.has(rawCat.toLowerCase())) {
        existingLower.add(rawCat.toLowerCase());
        dynamicCats.push(rawCat);
      }
    });

    return [...PREMIUM_CATEGORY_PILLS, ...dynamicCats];
  }, [premiumProducts]);

  const displayedProducts = useMemo(() => {
    return premiumProducts.filter(p => matchesPremiumCategory(p, selectedPremiumCategory));
  }, [premiumProducts, selectedPremiumCategory]);

  const banners = propBanners && propBanners.length > 0 ? propBanners : storage.getBanners();

  const handleCheckout = (product: Product) => {
    if (!targetAccount || targetAccount.trim().length < 5) {
      alert('Masukkan email akun atau nomor WhatsApp tujuan aktivasi.');
      return;
    }
    onSelectProductToCheckout(product, targetAccount.trim());
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 text-[#FAF4EB]">
      {/* 1. TEMPAT IKLAN FOTO DI ATAS HALAMAN LISENSI (HERO AD BILLBOARD) */}
      <section className="relative">
        <HeroAdBanner 
          banners={banners}
          specificCategory="premium"
          onNavigate={(target) => onNavigate(target)}
          isAdmin={isAdmin}
        />
      </section>

      {/* 2. Security Guarantee Banner (Explicitly: No Personal Password Required) */}
      <div className="bg-[#1D1814] border border-[#3E352B] rounded-2xl p-4 sm:p-5 flex items-start gap-4 text-xs shadow-md">
        <div className="w-10 h-10 rounded-xl bg-[#84A951]/20 border border-[#84A951]/40 text-[#84A951] flex items-center justify-center shrink-0">
          <ShieldCheck size={22} />
        </div>
        <div className="space-y-1">
          <h2 className="font-bold text-sm text-[#FAF4EB] flex items-center gap-1.5">
            <span>Privasi 100% Terjaga: Kami Tidak Pernah Meminta Password Akun Anda</span>
          </h2>
          <p className="text-[#A89F91] leading-relaxed">
            Seluruh produk lisensi & langganan premium digital di WayaheDigital diaktivasi via tautan undangan resmi keluarga/tim atau voucher key legal. Jangan pernah membagikan password pribadi Anda kepada siapa pun!
          </p>
        </div>
      </div>

      {/* 3. Input Email / Akun Tujuan */}
      <div className="bg-[#201A15] rounded-2xl p-6 border border-[#3E352B] shadow-md space-y-3">
        <label htmlFor="premium-target-input" className="block text-xs font-bold uppercase tracking-wider text-[#D4A359] flex items-center gap-1.5">
          <Mail size={15} />
          Email atau Nomor Akun Tujuan Aktivasi Lisensi
        </label>
        <input
          id="premium-target-input"
          type="text"
          placeholder="Contoh: akun_anda@gmail.com atau 081234567890"
          value={targetAccount}
          onChange={(e) => setTargetAccount(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-[#3E352B] bg-[#181411] text-[#FAF4EB] focus:outline-none focus:border-[#D4A359] text-sm font-semibold placeholder-[#5C5042]"
        />
        <p className="text-[11px] text-[#A89F91]">
          Tautan aktivasi atau kode lisensi resmi akan diproses dan diverifikasi untuk akun yang Anda cantumkan di atas.
        </p>
      </div>

      {/* 4. Grid Produk Premium Lisensi */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#A89F91]">
            Katalog Lisensi & Langganan Resmi
          </label>
          <span className="text-[11px] text-[#D4A359] font-medium">
            {displayedProducts.length} Produk Tersedia
          </span>
        </div>

        {/* HORIZONTAL PILL SUB-CATEGORY FILTER BAR (SESUAI GAMBAR DILAMPIRKAN PENGGUNA) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none py-1">
          {availablePremiumCategories.map((subCat) => {
            const isSelected = selectedPremiumCategory === subCat;
            return (
              <button
                key={subCat}
                type="button"
                onClick={() => setSelectedPremiumCategory(subCat)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer shrink-0 border ${
                  isSelected
                    ? 'border-blue-600 text-blue-600 bg-blue-50/70 font-bold shadow-xs dark:bg-blue-600/15 dark:border-blue-500 dark:text-blue-400'
                    : 'border-[#3E352B] text-[#A89F91] bg-[#201A15] hover:bg-[#2B231D] hover:text-[#FAF4EB]'
                }`}
              >
                {subCat}
              </button>
            );
          })}
        </div>

        {displayedProducts.length === 0 ? (
          <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-[#3E352B] bg-[#201A15]/40">
            <Sparkles className="mx-auto w-8 h-8 text-blue-400 mb-2 opacity-60" />
            <h3 className="font-bold text-sm text-[#FAF4EB]">
              Belum ada produk untuk kategori "{selectedPremiumCategory}"
            </h3>
            <p className="text-xs text-[#A89F91] mt-1 max-w-sm mx-auto">
              Produk akun premium dapat disinkronkan oleh admin via Dashboard Admin &gt; Produk Premium.
            </p>
            <button
              type="button"
              onClick={() => setSelectedPremiumCategory('Semua')}
              className="mt-3 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer shadow-xs"
            >
              Tampilkan Semua Kategori
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedProducts.map((p) => {
              const isAuto = p.deliveryMethod === 'AUTOMATIC';
              const hasVars = Boolean(p.hasVariants && p.variants && p.variants.length > 0);
              const minVarPrice = hasVars ? Math.min(...p.variants!.map(v => v.sellingPrice)) : p.sellingPrice;

            return (
              <div
                key={p.id}
                className="bg-[#201A15] rounded-2xl p-5 border border-[#3E352B] hover:border-[#D4A359]/70 transition-all flex flex-col justify-between group shadow-sm hover:shadow-xl"
              >
                <div>
                  {/* Top Badges & Logo */}
                  <div className="flex items-start justify-between gap-2.5 mb-3">
                    <div className="flex items-center gap-2.5">
                      <ProductLogo
                        provider={p.provider}
                        name={p.name}
                        category={p.categoryId}
                        iconUrl={p.iconUrl}
                        size="md"
                      />
                      <div>
                        <span className="text-[10px] font-extrabold text-[#D4A359] uppercase tracking-wider block">
                          {p.provider}
                        </span>
                        <span className="text-xs font-semibold text-[#FAF4EB] line-clamp-1">
                          Lisensi Resmi
                        </span>
                      </div>
                    </div>

                    {p.stock !== undefined && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 ${
                        p.stock > 5
                          ? 'text-[#84A951] bg-[#84A951]/10 border border-[#84A951]/30'
                          : p.stock > 0
                          ? 'text-[#D4A359] bg-[#D4A359]/10 border border-[#D4A359]/30'
                          : 'text-rose-400 bg-rose-500/10 border border-rose-500/30'
                      }`}>
                        {p.stock > 0 ? `Stok: ${p.stock}` : 'Stok Habis'}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-[#FAF4EB] group-hover:text-[#D4A359] transition-colors leading-snug">
                    {p.name}
                  </h3>
                  <p className="text-xs text-[#A89F91] mt-1.5 leading-relaxed line-clamp-2">
                    {p.description}
                  </p>

                  {/* Duration & Guarantee & Stock */}
                  <div className="mt-3.5 space-y-1.5 text-xs bg-[#181411] p-3 rounded-xl border border-[#2D241D]">
                    <div className="flex justify-between">
                      <span className="text-[#A89F91]">Masa Aktif:</span>
                      <span className="font-bold text-[#FAF4EB]">{p.duration || '1 Bulan'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A89F91]">Status Stok:</span>
                      <span className={`font-bold ${
                        (p.stock ?? 10) > 5
                          ? 'text-[#84A951]'
                          : (p.stock ?? 10) > 0
                          ? 'text-[#D4A359]'
                          : 'text-rose-400'
                      }`}>
                        {(p.stock ?? 10) > 0 ? `Tersedia (${p.stock ?? 10} slot akun)` : 'Stok Habis'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A89F91]">Garansi:</span>
                      <span className="font-bold text-[#84A951]">Full Garansi 30 Hari</span>
                    </div>
                  </div>

                  {/* Terms */}
                  {p.terms && (
                    <div className="mt-3 text-[11px] text-[#A89F91] space-y-1">
                      <span className="font-semibold text-[#D4A359] block">Ketentuan:</span>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {p.terms.slice(0, 2).map((t, idx) => (
                          <li key={idx}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-[#3E352B] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-[#A89F91] block">{hasVars ? 'Mulai dari' : 'Harga Resmi'}</span>
                    <span className="text-lg font-extrabold text-[#D4A359]">
                      {formatRupiah(minVarPrice)}
                    </span>
                  </div>

                  <button
                    onClick={() => handleCheckout(p)}
                    disabled={(p.stock ?? 10) <= 0}
                    id={`buy-premium-${p.id}`}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                      (p.stock ?? 10) <= 0
                        ? 'bg-stone-800 text-stone-500 cursor-not-allowed'
                        : 'bg-[#D4A359] hover:bg-[#E2B774] text-[#1D1814]'
                    }`}
                  >
                    <span>{(p.stock ?? 10) <= 0 ? 'Habis' : 'Pilih Produk'}</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
  );
}
