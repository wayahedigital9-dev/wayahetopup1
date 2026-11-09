import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  ReceiptText, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Tag,
  Maximize2
} from 'lucide-react';
import { PromoBanner } from '../types';

interface HeroAdBannerProps {
  banners: PromoBanner[];
  onNavigate: (categoryOrTab: string) => void;
  specificCategory?: string; // e.g. 'premium' if used exclusively on license page
  isAdmin?: boolean;
}

export function HeroAdBanner({
  banners,
  onNavigate,
  specificCategory,
  isAdmin,
}: HeroAdBannerProps) {
  // Filter active banners, or if specificCategory is set, filter by category or prioritize it
  const displayBanners = banners.filter(b => b.isActive && (!specificCategory || b.ctaCategory === specificCategory));
  const fallbackBanners = banners.filter(b => b.isActive);
  const activeList = displayBanners.length > 0 ? displayBanners : fallbackBanners;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Keep index in bounds if activeList changes
  useEffect(() => {
    if (currentIndex >= activeList.length) {
      setCurrentIndex(0);
    }
  }, [activeList.length, currentIndex]);

  // Auto slide every 6 seconds when not hovered
  useEffect(() => {
    if (activeList.length <= 1 || isHovered) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % activeList.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [activeList.length, isHovered]);

  if (activeList.length === 0) return null;

  const currentBanner = activeList[currentIndex] || activeList[0];
  const layoutMode = currentBanner.photoLayout || 'FULL_HOLDER';
  const showText = currentBanner.showTextOverlay !== false;

  const handlePrev = () => {
    setCurrentIndex(prev => (prev - 1 + activeList.length) % activeList.length);
  };

  const handleNext = () => {
    setCurrentIndex(prev => (prev + 1) % activeList.length);
  };

  return (
    <div 
      className="relative rounded-[22px] overflow-hidden border border-[#1E293B] bg-[#0B0F17] shadow-2xl min-h-[380px] sm:min-h-[420px] flex flex-col justify-between group transition-all duration-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      id="hero-ad-billboard"
    >
      {/* ========================================================================= */}
      {/* 1. SLOT KHUSUS FOTO IKLAN (UKURAN DIPERBESAR SAMA DENGAN UKURAN HOLDER)   */}
      {/* ========================================================================= */}
      {currentBanner.imageUrl ? (
        layoutMode === 'FULL_HOLDER' ? (
          /* MODE A: FOTO MEMENUHI 100% SELURUH UKURAN HOLDER BANNER (FULL HOLDER) */
          <div 
            onClick={() => onNavigate(currentBanner.ctaCategory)}
            className="absolute inset-0 w-full h-full z-0 overflow-hidden cursor-pointer"
            title="Klik untuk melihat penawaran promo"
          >
            {/* Foto Iklan Full Ukuran Holder */}
            <img 
              src={currentBanner.imageUrl} 
              alt={currentBanner.title}
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
              referrerPolicy="no-referrer"
            />

            {/* Intelligent Sogan Gradient Overlay: menjaga keterbacaan teks di kiri, foto terang di kanan */}
            {showText && (
              <>
                <div className="absolute inset-0 bg-gradient-to-r from-[#0B0F17] via-[#0B0F17]/90 sm:via-[#0B0F17]/80 to-[#0B0F17]/30 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17]/95 via-transparent to-black/35 pointer-events-none" />
              </>
            )}

            {/* Clean clear background overlay without dot textures */}
          </div>
        ) : (
          /* MODE B: FOTO MEMENUHI SISI KANAN PENUH HOLDER DARI ATAS KE BAWAH (SPLIT FULL HEIGHT) */
          <div 
            onClick={() => onNavigate(currentBanner.ctaCategory)}
            className="absolute top-0 right-0 bottom-0 w-full lg:w-[50%] h-full z-0 overflow-hidden cursor-pointer"
            title="Klik untuk melihat penawaran promo"
          >
            <img 
              src={currentBanner.imageUrl} 
              alt={currentBanner.title}
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
              referrerPolicy="no-referrer"
            />
            {/* Smooth gradient blend into the dark left side */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B0F17] via-[#0B0F17]/40 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17]/90 via-transparent to-black/30 pointer-events-none" />
          </div>
        )
      ) : (
        /* Fallback Default Background jika belum ada foto */
        <div className="absolute inset-0 bg-gradient-to-r from-[#111827] via-[#1A2233] to-[#0B0F17] z-0" />
      )}

      {/* 2. Soft Ambient Warm Glow */}
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#F59E0B]/10 blur-3xl pointer-events-none z-1" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-[#C85A32]/10 blur-3xl pointer-events-none z-1" />

      {/* ========================================================================= */}
      {/* 3. KONTEN BILLBOARD (TEKS, BADGE, TOMBOL AKSI & TAG FOTO)                */}
      {/* ========================================================================= */}
      <div className="relative z-10 p-6 sm:p-9 lg:p-11 flex-1 flex flex-col justify-between">
        {showText ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
            {/* Left Col: Badges, Title, Subtitle, CTA */}
            <div className="lg:col-span-8 xl:col-span-8 space-y-4 text-left">
              {/* Pill Badge */}
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#0E131F]/90 backdrop-blur-md border border-[#334155] text-xs font-semibold text-[#F59E0B] shadow-md">
                <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
                <span className="tracking-wider uppercase text-[11px] font-extrabold">{currentBanner.badge}</span>
                <span className="text-[#475569]">•</span>
                <span className="text-[#94A3B8] text-[11px] font-medium">{currentBanner.tagline}</span>
              </div>

              {/* Heading 1 */}
              <h1 className="text-2xl sm:text-4xl lg:text-[44px] font-extrabold tracking-tight text-[#F8FAFC] leading-[1.18] drop-shadow-md">
                {currentBanner.title}
              </h1>

              {/* Subtitle / Description */}
              <p className="text-xs sm:text-sm md:text-base text-[#CBD5E1] max-w-2xl leading-relaxed drop-shadow-sm font-medium">
                {currentBanner.subtitle}
              </p>

              {/* Action Buttons (Pill Buttons) */}
              <div className="pt-3 flex flex-wrap items-center gap-3">
                {/* Primary Golden Pill Button */}
                <button
                  onClick={() => onNavigate(currentBanner.ctaCategory)}
                  id="hero-banner-cta-btn"
                  className="px-6 py-3 bg-[#F59E0B] hover:bg-[#FBBF24] text-[#0B0F17] font-extrabold rounded-full transition-all flex items-center gap-2 text-xs sm:text-sm shadow-xl shadow-[#F59E0B]/25 hover:shadow-[#F59E0B]/40 cursor-pointer active:scale-95"
                >
                  <span>{currentBanner.ctaText}</span>
                  <ArrowRight size={17} />
                </button>

                {/* Secondary Dark Pill Button */}
                <button
                  onClick={() => onNavigate(currentBanner.secondaryCtaAction || 'transaksi')}
                  id="hero-banner-secondary-btn"
                  className="px-5 py-3 bg-[#0E131F]/90 hover:bg-[#1A2233] text-[#F8FAFC] font-bold rounded-full border border-[#334155] hover:border-[#F59E0B]/70 transition-all flex items-center gap-2 text-xs sm:text-sm cursor-pointer active:scale-95 backdrop-blur-sm"
                >
                  <ReceiptText size={17} className="text-[#F59E0B]" />
                  <span>{currentBanner.secondaryCtaText || 'Lacak Pesanan'}</span>
                </button>
              </div>
            </div>

            {/* Right Col: Tag Iklan Foto & Garansi Info */}
            <div className="lg:col-span-4 xl:col-span-4 hidden lg:flex flex-col items-end justify-center">
              <div 
                onClick={() => onNavigate(currentBanner.ctaCategory)}
                className="p-4 rounded-2xl bg-[#0B0F17]/85 backdrop-blur-md border border-[#F59E0B]/40 text-right shadow-2xl space-y-2 cursor-pointer hover:border-[#F59E0B] transition-colors group/tag"
              >
                <div className="flex items-center justify-end gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#F59E0B]">
                  <Tag size={13} />
                  <span>{currentBanner.imageTag || 'Slot Iklan Foto'}</span>
                </div>
                <div className="text-xs text-[#F8FAFC] font-semibold flex items-center justify-end gap-1.5">
                  <ShieldCheck size={15} className="text-[#10B981]" />
                  <span>Garansi Resmi 100% Legal</span>
                </div>
                <div className="text-[11px] text-[#94A3B8] flex items-center justify-end gap-1 group-hover/tag:text-[#F59E0B] transition-colors">
                  <span>Lihat Penawaran</span>
                  <ExternalLink size={12} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Jika showTextOverlay dimatikan: Banner foto bersih tampil maksimal */
          <div 
            onClick={() => onNavigate(currentBanner.ctaCategory)}
            className="flex-1 flex flex-col justify-end cursor-pointer"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0B0F17]/85 backdrop-blur-md border border-[#F59E0B]/50 text-xs font-bold text-[#F59E0B] w-fit shadow-xl">
              <Tag size={13} />
              <span>{currentBanner.imageTag || currentBanner.title}</span>
              <ArrowRight size={13} className="ml-1" />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. ROW BAWAH: INDIKATOR SLIDER (KIRI) & TOMBOL NAVIGASI (KANAN)           */}
        {/* ========================================================================= */}
        <div className="relative z-20 pt-6 mt-6 border-t border-[#334155]/60 flex items-center justify-between">
          {/* Kiri: Indikator Dash & Titik */}
          <div className="flex items-center gap-2">
            {activeList.map((banner, idx) => (
              <button
                key={banner.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={`transition-all duration-300 rounded-full cursor-pointer ${
                  currentIndex === idx
                    ? 'w-8 h-2 bg-[#F59E0B]'
                    : 'w-2 h-2 bg-[#334155] hover:bg-[#94A3B8]'
                }`}
                aria-label={`Pindah ke banner ${idx + 1}`}
              />
            ))}
          </div>

          {/* Kanan: Tombol Panah Navigasi */}
          {activeList.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
                className="w-8 h-8 rounded-full border border-[#334155] bg-[#0E131F]/90 hover:bg-[#1A2233] hover:border-[#F59E0B] text-[#F8FAFC] flex items-center justify-center transition-colors cursor-pointer shadow-md"
                aria-label="Banner Sebelumnya"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className="w-8 h-8 rounded-full border border-[#334155] bg-[#0E131F]/90 hover:bg-[#1A2233] hover:border-[#F59E0B] text-[#F8FAFC] flex items-center justify-center transition-colors cursor-pointer shadow-md"
                aria-label="Banner Selanjutnya"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
