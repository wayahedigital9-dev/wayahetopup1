import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  ArrowRight, 
  Zap, 
  Clock, 
  Mail,
  CheckCircle2,
  Lock,
  AlertTriangle
} from 'lucide-react';
import { Product, PromoBanner } from '../types';
import { premiumAvailableStock, isManualPremium } from '../components/PremiumManualStockPanel';
import { formatRupiah } from '../utils/operator';
import { HeroAdBanner } from '../components/HeroAdBanner';
import { ProductLogo } from '../components/ProductLogo';
import { storage } from '../services/storage';
import { PREMIUM_CATEGORY_PILLS, matchesPremiumCategory } from './HomePage';
import { CategoryMaintenanceNotice } from '../components/CategoryMaintenanceNotice';
import { getPremiumProductStock } from '../utils/premiumStock';

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
    const existingPills = [...PREMIUM_CATEGORY_PILLS];
    const existingLower = new Set(existingPills.map(c => c.toLowerCase()));

    const aliasMap: Record<string, string> = {
      'editing': 'Design & Editing',
      'design': 'Design & Editing',
      'music': 'Musik',
      'ai': 'AI & Bot',
      'ai & tools': 'AI & Bot',
      'aplikasi premium': 'Aplikasi & Tools',
      'akun premium': 'Aplikasi & Tools',
      'vpn': 'VPN & Security'
    };

    const dynamicCats: string[] = [];

    premiumProducts.forEach(p => {
      const rawCat = p.digiflazzCategory || (p as any).category;
      if (rawCat && typeof rawCat === 'string') {
        const lower = rawCat.toLowerCase().trim();
        if (aliasMap[lower] || existingLower.has(lower)) {
          return;
        }
        existingLower.add(lower);
        dynamicCats.push(rawCat);
      }
    });

    return [...existingPills, ...dynamicCats];
  }, [premiumProducts]);

  const displayedProducts = useMemo(() => {
    return premiumProducts.filter(p => matchesPremiumCategory(p, selectedPremiumCategory));
  }, [premiumProducts, selectedPremiumCategory]);

  const banners = propBanners && propBanners.length > 0 ? propBanners : storage.getBanners();

  const handleCheckout = (product: Product) => {
    if (isManualPremium(product) && premiumAvailableStock(product) <= 0) {
      alert('Stok premium kosong. Silakan pilih produk lain.');
      return;
    }
    const stockInfo = getPremiumProductStock(product);
    if (!stockInfo.isAvailable) {
      alert(`Stok ${product.name} saat ini kosong atau sedang tidak aktif (${stockInfo.badgeLabel}). Silakan pilih produk lain.`);
      return;
    }
    if (!targetAccount || targetAccount.trim().length < 5) {
      alert('Masukkan email akun atau nomor WhatsApp tujuan aktivasi.');
      return;
    }
    onSelectProductToCheckout(product, targetAccount.trim());
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 text-[#F8FAFC]">
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
      <div className="bg-[#0E131F] border border-[#1E293B] rounded-2xl p-4 sm:p-5 flex items-start gap-4 text-xs shadow-md">
        <div className="w-10 h-10 rounded-xl bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] flex items-center justify-center shrink-0">
          <ShieldCheck size={22} />
        </div>
        <div className="space-y-1">
          <h2 className="font-bold text-sm text-[#F8FAFC] flex items-center gap-1.5">
            <span>Privasi 100% Terjaga: Kami Tidak Pernah Meminta Password Akun Anda</span>
          </h2>
          <p className="text-[#94A3B8] leading-relaxed">
            Seluruh produk lisensi & langganan premium digital di WayaheDigital diaktivasi via tautan undangan resmi keluarga/tim atau voucher key legal. Jangan pernah membagikan password pribadi Anda kepada siapa pun!
          </p>
        </div>
      </div>

      {/* 3. Input Email / Akun Tujuan */}
      <div className="bg-[#111827] rounded-2xl p-6 border border-[#1E293B] shadow-md space-y-3">
        <label htmlFor="premium-target-input" className="block text-xs font-bold uppercase tracking-wider text-[#F59E0B] flex items-center gap-1.5">
          <Mail size={15} />
          Email atau Nomor Akun Tujuan Aktivasi Lisensi
        </label>
        <input
          id="premium-target-input"
          type="text"
          placeholder="Contoh: akun_anda@gmail.com atau 081234567890"
          value={targetAccount}
          onChange={(e) => setTargetAccount(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-[#1E293B] bg-[#0B0F17] text-[#F8FAFC] focus:outline-none focus:border-[#F59E0B] text-sm font-semibold placeholder-[#475569]"
        />
        <p className="text-[11px] text-[#94A3B8]">
          Tautan aktivasi atau kode lisensi resmi akan diproses dan diverifikasi untuk akun yang Anda cantumkan di atas.
        </p>
      </div>

      {/* 4. Grid Produk Premium Lisensi */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
            Katalog Lisensi & Langganan Resmi
          </label>
          <span className="text-[11px] text-[#F59E0B] font-medium">
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
                    : 'border-[#1E293B] text-[#94A3B8] bg-[#111827] hover:bg-[#1E293B] hover:text-[#F8FAFC]'
                }`}
              >
                {subCat}
              </button>
            );
          })}
        </div>

        {displayedProducts.length === 0 ? (
          <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-[#1E293B] bg-[#111827]/40">
            <Sparkles className="mx-auto w-8 h-8 text-blue-400 mb-2 opacity-60" />
            <h3 className="font-bold text-sm text-[#F8FAFC]">
              Belum ada produk untuk kategori "{selectedPremiumCategory}"
            </h3>
            <p className="text-xs text-[#94A3B8] mt-1 max-w-sm mx-auto">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {displayedProducts.map((p) => {
              const hasVars = Boolean(p.hasVariants && p.variants && p.variants.length > 0);
              const minVarPrice = hasVars ? Math.min(...p.variants!.map(v => v.sellingPrice)) : p.sellingPrice;
              const stockInfo = getPremiumProductStock(p);

            return (
              <div
                key={p.id}
                className="bg-gradient-to-b from-[#111827] via-[#0E131F] to-[#0A0D14] rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-white/[0.08] hover:border-[#F59E0B]/50 hover:shadow-[0_12px_32px_rgba(245,158,11,0.12)] transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1"
              >
                <div>
                  {/* Top Badges, Logo & Stock */}
                  <div className="flex items-start justify-between gap-3 mb-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shadow-sm shrink-0 flex items-center justify-center bg-[#0B0F17] border border-white/[0.1] group-hover:scale-105 transition-transform duration-300">
                        <ProductLogo
                          provider={p.provider}
                          name={p.name}
                          category={p.categoryId}
                          iconUrl={p.iconUrl}
                          size="xl"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-space font-extrabold text-[#F59E0B] uppercase tracking-wider block">
                          {p.provider}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {hasVars && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-blue-500/15 text-blue-400 border-blue-500/30">
                              {p.variants!.length} Varian
                            </span>
                          )}
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-amber-500/15 text-amber-400 border-amber-500/30">
                            {p.badge || 'VIP'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Prominent Live Stock Badge */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border tracking-wide shadow-xs ${stockInfo.badgeStyle.bg} ${stockInfo.badgeStyle.text} ${stockInfo.badgeStyle.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${stockInfo.badgeStyle.dot} ${stockInfo.isAvailable ? 'animate-pulse' : ''}`} />
                        {stockInfo.badgeLabel}
                      </span>
                      <span className="text-[9px] font-medium text-slate-400">
                        {stockInfo.isApi ? '⚡ API Sync' : '🛡️ Admin Stock'}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-space font-bold text-sm sm:text-base leading-snug text-[#F8FAFC] group-hover:text-[#F59E0B] transition-colors line-clamp-1">
                    {p.name}
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-1.5 font-jakarta leading-relaxed line-clamp-2">
                    {p.description || 'Akun lisensi resmi premium dengan aktivasi instan dan garansi penuh.'}
                  </p>

                  {/* Trust / Benefit Badges Strip */}
                  <div className="mt-3 py-1.5 px-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-between text-[11px]">
                    <span className="font-medium text-slate-400 flex items-center gap-1">
                      <Clock size={12} className="text-[#F59E0B]" />
                      {p.duration || '1 Bulan'}
                    </span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <ShieldCheck size={12} />
                      Full Garansi 30 Hari
                    </span>
                  </div>

                  {/* Terms */}
                  {p.terms && p.terms.length > 0 && (
                    <div className="mt-2.5 text-[11px] text-[#94A3B8] space-y-0.5">
                      <span className="font-semibold text-[#F59E0B] text-[10px] block">Ketentuan:</span>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {p.terms.slice(0, 2).map((t, idx) => (
                          <li key={idx} className="line-clamp-1">{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3.5 border-t border-white/[0.08] flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-[#94A3B8] block">{hasVars ? 'Mulai dari' : 'Harga Resmi'}</span>
                    <span className="font-space font-black text-base sm:text-lg text-[#F59E0B] tracking-tight">
                      {formatRupiah(minVarPrice)}
                    </span>
                  </div>

                  <button
                    onClick={() => handleCheckout(p)}
                    disabled={!stockInfo.isAvailable}
                    id={`buy-premium-${p.id}`}
                    className={`px-4 py-2 rounded-xl text-xs font-bold font-space transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                      !stockInfo.isAvailable
                        ? 'bg-stone-800 text-stone-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 hover:shadow-amber-500/25'
                    }`}
                  >
                    <span>{!stockInfo.isAvailable ? 'Habis' : 'Pilih Produk'}</span>
                    {stockInfo.isAvailable ? <ArrowRight size={13} /> : <AlertTriangle size={13} />}
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
