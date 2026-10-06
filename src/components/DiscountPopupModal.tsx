import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Tag, 
  Copy, 
  Check, 
  Gift, 
  ArrowRight,
  PartyPopper
} from 'lucide-react';
import { DiscountPopupConfig } from '../types';
import { storage, DEFAULT_DISCOUNT_POPUP } from '../services/storage';
import { formatRupiah } from '../utils/operator';

interface DiscountPopupModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onNavigate?: (tab: string) => void;
  forceConfig?: DiscountPopupConfig; // Untuk live preview dari Pengaturan Admin
  isPreviewMode?: boolean;
}

const STORAGE_POPUP_KEY = 'wd_dismissed_discount_popup_v1';

export function DiscountPopupModal({
  isOpen: propIsOpen,
  onClose: propOnClose,
  onNavigate,
  forceConfig,
  isPreviewMode = false,
}: DiscountPopupModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Ambil config dari props (jika preview) atau dari storage
  const config: DiscountPopupConfig = forceConfig || storage.getSettings().discountPopup || DEFAULT_DISCOUNT_POPUP;

  useEffect(() => {
    if (isPreviewMode) {
      setInternalOpen(propIsOpen ?? true);
      return;
    }

    // Jika dipanggil dengan propIsOpen eksplisit
    if (propIsOpen !== undefined) {
      setInternalOpen(propIsOpen);
      return;
    }

    // Cek apakah popup diaktifkan admin
    if (!config.isEnabled) {
      setInternalOpen(false);
      return;
    }

    // Cek apakah user sudah pernah menutup popup di sesi ini
    const dismissedSession = sessionStorage.getItem(STORAGE_POPUP_KEY);
    if (dismissedSession) {
      return;
    }

    // Evaluasi target audience
    const currentUser = storage.getUser();
    const isNewMember = !currentUser || currentUser.role === 'CUSTOMER';

    if (config.targetAudience === 'NEW_MEMBER') {
      // Tampilkan khusus untuk pengguna baru / member
      const timer = setTimeout(() => {
        setInternalOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (config.targetAudience === 'EVENT' || config.targetAudience === 'ALL') {
      // Tampilkan untuk event atau semua pengunjung
      const timer = setTimeout(() => {
        setInternalOpen(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [propIsOpen, isPreviewMode, config.isEnabled, config.targetAudience]);

  const handleClose = () => {
    if (!isPreviewMode) {
      sessionStorage.setItem(STORAGE_POPUP_KEY, 'true');
    }
    setInternalOpen(false);
    if (propOnClose) propOnClose();
  };

  const handleCopyCode = () => {
    if (!config.promoCode) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(config.promoCode);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleUsePromo = () => {
    handleCopyCode();
    // Simpan promo di sessionStorage agar checkout langsung mengenali
    sessionStorage.setItem('wd_applied_promo_code', config.promoCode);

    setTimeout(() => {
      handleClose();
      if (onNavigate) {
        onNavigate('home');
      }
      const el = document.getElementById('katalog-layanan');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 400);
  };

  const isOpen = propIsOpen !== undefined ? propIsOpen : internalOpen;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
      {/* Container Modal Squircle */}
      <div 
        className="relative w-full max-w-lg bg-gradient-to-b from-[#221B16] via-[#1B1511] to-[#14100D] border-2 border-[#D4A359]/70 rounded-3xl sm:rounded-[32px] p-5 sm:p-7 shadow-2xl shadow-[#D4A359]/15 overflow-hidden text-[#FAF4EB]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Glows */}
        <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-[#D4A359]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-[#14100D]/80 hover:bg-[#D4A359] text-[#A89F91] hover:text-[#181411] border border-[#3E342B] flex items-center justify-center transition-all cursor-pointer shadow-md"
          aria-label="Tutup popup diskon"
        >
          <X size={16} />
        </button>

        {/* Optional Banner Image */}
        {config.bannerUrl && (
          <div className="relative w-full h-36 sm:h-44 rounded-2xl overflow-hidden border border-[#3E342B] mb-4.5 shadow-inner">
            <img
              src={config.bannerUrl}
              alt="Promo Banner"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1B1511] via-transparent to-black/20" />
            
            {/* Overlay Badge */}
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#181411]/85 backdrop-blur-sm border border-[#D4A359]/60 text-[#D4A359] text-[10px] font-black tracking-wider uppercase shadow-md">
              <Sparkles size={11} />
              <span>{config.badgeText || 'PROMO TERBATAS'}</span>
            </div>
          </div>
        )}

        {/* Header Content */}
        <div className="space-y-2 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            {!config.bannerUrl && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4A359]/20 border border-[#D4A359]/50 text-[#D4A359] text-[10px] font-black tracking-wider uppercase">
                <PartyPopper size={12} />
                <span>{config.badgeText || 'PROMO SPESIAL'}</span>
              </span>
            )}
            <span className="text-[11px] font-bold text-[#84A951] bg-[#84A951]/15 px-2.5 py-0.5 rounded-full border border-[#84A951]/30">
              {config.targetAudience === 'NEW_MEMBER' 
                ? '⭐ Khusus Pengguna & Member Baru' 
                : config.targetAudience === 'EVENT'
                ? '⚡ Flash Event Terbatas'
                : '🎁 Promo Spesial Warga'}
            </span>
          </div>

          <h3 className="text-lg sm:text-2xl font-black text-[#FAF4EB] tracking-tight leading-tight">
            {config.title || 'Diskon Spesial Menanti Anda!'}
          </h3>

          <p className="text-xs sm:text-sm font-semibold text-[#D4A359]">
            {config.tagline || 'Gunakan kupon promo sekarang & nikmati potongan harga'}
          </p>

          <p className="text-xs text-[#A89F91] leading-relaxed">
            {config.description || 'Dapatkan potongan harga langsung untuk seluruh transaksi voucher WiFi, paket data kuota murah, dan akun premium resmi.'}
          </p>
        </div>

        {/* Voucher Ticket Box (Persegi Bundar Aesthetic) */}
        <div className="my-5 p-3.5 sm:p-4 rounded-2xl bg-[#14100D] border-2 border-dashed border-[#D4A359]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative shadow-inner">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4A359]/30 to-[#D4A359]/10 text-[#D4A359] flex items-center justify-center border border-[#D4A359]/40 shrink-0 shadow-xs">
              <Gift size={24} />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-[#A89F91] tracking-wider">
                Nilai Diskon Potongan
              </div>
              <div className="text-base sm:text-lg font-black text-[#FAF4EB]">
                {formatRupiah(config.discountAmount || 5000)}
              </div>
              <div className="text-[10px] text-[#84A951] font-semibold">
                Otomatis dipotong saat checkout
              </div>
            </div>
          </div>

          {/* Promo Code Pill with Copy */}
          <div className="flex items-center gap-2 bg-[#1F1914] px-3 py-2 rounded-xl border border-[#3E342B] sm:self-center">
            <div className="text-left">
              <div className="text-[9px] text-[#A89F91] uppercase font-semibold">Kode Promo:</div>
              <div className="font-mono font-black text-xs sm:text-sm text-[#D4A359] tracking-wider">
                {config.promoCode || 'MEMBERBARU'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              className={`p-2 rounded-lg transition-all text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0 ${
                copied
                  ? 'bg-[#84A951] text-[#14100D]'
                  : 'bg-[#D4A359] hover:bg-[#C08F47] text-[#181411]'
              }`}
              title="Salin kode promo"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Tersalin!' : 'Salin'}</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleUsePromo}
            className="w-full sm:flex-1 py-3 px-5 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm bg-gradient-to-r from-[#D4A359] via-[#E2B774] to-[#C08F47] text-[#181411] hover:brightness-110 active:scale-[0.99] transition-all shadow-lg shadow-[#D4A359]/25 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Tag size={16} />
            <span>Klaim & Gunakan Diskon</span>
            <ArrowRight size={16} />
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="w-full sm:w-auto py-2.5 px-4 rounded-xl text-xs font-semibold text-[#A89F91] hover:text-[#FAF4EB] hover:bg-white/5 transition-colors cursor-pointer"
          >
            Nanti Saja
          </button>
        </div>

        {isPreviewMode && (
          <div className="mt-3 text-center text-[10px] text-amber-300/80 font-mono bg-amber-500/10 py-1 px-2 rounded-lg border border-amber-500/30">
            🔍 Mode Pratinjau Pengaturan Admin (Preview Live)
          </div>
        )}
      </div>
    </div>
  );
}
