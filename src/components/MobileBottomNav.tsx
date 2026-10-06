import React, { useState } from 'react';
import { 
  Home, 
  Grid, 
  ReceiptText, 
  User, 
  Wifi, 
  Smartphone, 
  Sparkles, 
  Gamepad2, 
  ArrowRight, 
  X,
  Layers
} from 'lucide-react';
import { storage } from '../services/storage';
import { useTheme } from '../context/ThemeContext';

interface MobileBottomNavProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
}

export function MobileBottomNav({ currentTab, onNavigate }: MobileBottomNavProps) {
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const { isDark } = useTheme();
  const isProductActive = ['pulsa', 'kuota', 'wifi'].includes(currentTab);

  // Load catalogs from storage to ensure custom photos & titles are reflected
  const catalogs = storage.getCatalogs();

  const getCatalogIcon = (iconType: string) => {
    switch (iconType) {
      case 'smartphone': return Smartphone;
      case 'sparkles': return Sparkles;
      case 'gamepad': return Gamepad2;
      case 'wifi':
      default: return Wifi;
    }
  };

  const handleSelectCatalog = (catId: string, targetTab: string) => {
    setIsCatalogOpen(false);

    // Khusus pulsa & kuota langsung ke halaman pengisian nomor tujuan dan pembayaran
    if (catId === 'pulsa-kuota' || catId === 'pulsa' || targetTab === 'pulsa') {
      onNavigate('pulsa');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (currentTab === 'home') {
      const el = document.getElementById('katalog-layanan');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      onNavigate(targetTab || 'home');
      setTimeout(() => {
        const el = document.getElementById('katalog-layanan');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
    }
  };

  return (
    <>
      {/* 1. FLOATING SQUIRCLE CATALOG QUICK-MENU (MODERN HP / MOBILE VIEW) */}
      {isCatalogOpen && (
        <div 
          className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end p-4 pb-22 bg-black/65 backdrop-blur-md animate-fadeIn"
          onClick={() => setIsCatalogOpen(false)}
        >
          <div 
            className="bg-gradient-to-b from-[#251E18] to-[#1A1410] border border-[#483C2F] rounded-3xl p-4.5 max-w-sm w-full mx-auto shadow-2xl shadow-black/80 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#3E342A]/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#D4A359]/30 to-[#D4A359]/10 text-[#D4A359] flex items-center justify-center border border-[#D4A359]/40 shadow-xs">
                  <Layers size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-[#FAF4EB]">Katalog Layanan Digital</h3>
                  <p className="text-[10px] text-[#A89F91]">Pilih kategori untuk melihat produk</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCatalogOpen(false)}
                className="w-7 h-7 rounded-full bg-[#181411] border border-[#3E352B] text-[#A89F91] hover:text-[#FAF4EB] flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Tutup"
              >
                <X size={14} />
              </button>
            </div>

            {/* SQUIRCLE 2x2 GRID (PERSEGI BUNDAR WITH PHOTO / ICON SUPPORT) */}
            <div className="grid grid-cols-2 gap-2.5 pt-0.5">
              {catalogs.map((cat) => {
                const IconComponent = getCatalogIcon(cat.iconType);

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCatalog(cat.id, cat.targetTab)}
                    className="p-3 rounded-2xl bg-[#1D1713] hover:bg-[#2A211B] border border-[#3E3328] hover:border-[#D4A359] text-left transition-all duration-200 cursor-pointer group flex flex-col items-center text-center relative overflow-hidden shadow-xs hover:shadow-md hover:scale-[1.02]"
                  >
                    {/* Squircle Photo or Icon */}
                    <div className="w-13 h-13 rounded-2xl bg-[#15110E] border border-[#3E352B] group-hover:border-[#D4A359]/60 flex items-center justify-center overflow-hidden shrink-0 shadow-inner mb-2 transition-all">
                      {cat.iconUrl ? (
                        <img
                          src={cat.iconUrl}
                          alt={cat.title}
                          className="w-full h-full object-cover rounded-2xl group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="text-[#D4A359] group-hover:scale-110 transition-transform">
                          <IconComponent size={22} />
                        </div>
                      )}
                    </div>

                    <div className="w-full">
                      <div className="font-bold text-xs text-[#FAF4EB] truncate group-hover:text-[#D4A359] transition-colors">
                        {cat.title}
                      </div>
                      <div className="text-[10px] text-[#A89F91] truncate mt-0.5">
                        {cat.subtitle}
                      </div>
                      {cat.badge && (
                        <div className="mt-1.5">
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-[#D4A359] bg-[#D4A359]/15 border border-[#D4A359]/30 uppercase tracking-tight">
                            {cat.badge}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Bottom Link: Jump to Store Section */}
            <div className="pt-1 border-t border-[#3E342A]/60">
              <button
                type="button"
                onClick={() => {
                  setIsCatalogOpen(false);
                  onNavigate('home');
                  setTimeout(() => {
                    const el = document.getElementById('katalog-layanan');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
                className="w-full py-2 px-3 rounded-xl bg-[#18130F] hover:bg-[#231A14] text-[11px] font-semibold text-[#D5CEBF] hover:text-[#FAF4EB] border border-[#3E342A] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Buka Seluruh Etalase Toko</span>
                <ArrowRight size={12} className="text-[#D4A359]" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MAIN BOTTOM NAVIGATION BAR */}
      <nav 
        id="mobile-bottom-navigation"
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 ${isDark ? 'bg-[#101211]/95 border-t border-[#28302A]' : 'bg-white/95 border-t border-slate-200'} backdrop-blur-lg pb-safe shadow-2xl transition-colors`}
        aria-label="Navigasi Bawah Ponsel"
      >
        <div className="grid grid-cols-4 h-16 max-w-md mx-auto">
          <button
            onClick={() => {
              setIsCatalogOpen(false);
              onNavigate('home');
            }}
            id="mobile-tab-home"
            className={`flex flex-col items-center justify-center min-h-[44px] transition-colors cursor-pointer ${
              currentTab === 'home' && !isCatalogOpen
                ? isDark ? 'text-[#C7FF4D] font-bold' : 'text-amber-600 font-bold'
                : isDark ? 'text-[#A4ADA6] hover:text-[#F5F7F2]' : 'text-slate-500 hover:text-slate-900'
            }`}
            aria-current={currentTab === 'home' ? 'page' : undefined}
          >
            <Home size={20} className={currentTab === 'home' && !isCatalogOpen ? 'stroke-[2.5]' : ''} />
            <span className="text-[11px] mt-1">Beranda</span>
          </button>

          <button
            onClick={() => setIsCatalogOpen(!isCatalogOpen)}
            id="mobile-tab-products"
            className={`flex flex-col items-center justify-center min-h-[44px] transition-colors cursor-pointer relative ${
              isProductActive || isCatalogOpen
                ? isDark ? 'text-[#C7FF4D] font-bold' : 'text-amber-600 font-bold'
                : isDark ? 'text-[#A4ADA6] hover:text-[#F5F7F2]' : 'text-slate-500 hover:text-slate-900'
            }`}
            aria-current={isProductActive ? 'page' : undefined}
          >
            <Grid size={20} className={isProductActive || isCatalogOpen ? 'stroke-[2.5]' : ''} />
            <span className="text-[11px] mt-1">Katalog</span>
            {isCatalogOpen && (
              <span className={`absolute top-1.5 right-6 w-2 h-2 rounded-full ${isDark ? 'bg-[#C7FF4D]' : 'bg-amber-500'} animate-ping`} />
            )}
          </button>

          <button
            onClick={() => {
              setIsCatalogOpen(false);
              onNavigate('transaksi');
            }}
            id="mobile-tab-transactions"
            className={`flex flex-col items-center justify-center min-h-[44px] transition-colors cursor-pointer ${
              currentTab === 'transaksi' && !isCatalogOpen
                ? isDark ? 'text-[#C7FF4D] font-bold' : 'text-amber-600 font-bold'
                : isDark ? 'text-[#A4ADA6] hover:text-[#F5F7F2]' : 'text-slate-500 hover:text-slate-900'
            }`}
            aria-current={currentTab === 'transaksi' ? 'page' : undefined}
          >
            <ReceiptText size={20} className={currentTab === 'transaksi' && !isCatalogOpen ? 'stroke-[2.5]' : ''} />
            <span className="text-[11px] mt-1">Lacak</span>
          </button>

          <button
            onClick={() => {
              setIsCatalogOpen(false);
              onNavigate('akun');
            }}
            id="mobile-tab-account"
            className={`flex flex-col items-center justify-center min-h-[44px] transition-colors cursor-pointer ${
              currentTab === 'akun' && !isCatalogOpen
                ? isDark ? 'text-[#C7FF4D] font-bold' : 'text-amber-600 font-bold'
                : isDark ? 'text-[#A4ADA6] hover:text-[#F5F7F2]' : 'text-slate-500 hover:text-slate-900'
            }`}
            aria-current={currentTab === 'akun' ? 'page' : undefined}
          >
            <User size={20} className={currentTab === 'akun' && !isCatalogOpen ? 'stroke-[2.5]' : ''} />
            <span className="text-[11px] mt-1">Akun</span>
          </button>
        </div>
      </nav>
    </>
  );
}
