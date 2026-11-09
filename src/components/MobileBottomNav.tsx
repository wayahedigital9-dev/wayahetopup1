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
  const isLight = !isDark;
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
      {/* 1. FLOATING SQUIRCLE CATALOG QUICK-MENU (PREMIUM MODAL) */}
      {isCatalogOpen && (
        <div 
          className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end p-4 pb-22 bg-black/60 backdrop-blur-md animate-fadeIn"
          onClick={() => setIsCatalogOpen(false)}
        >
          <div 
            className={`border rounded-3xl p-4.5 max-w-sm w-full mx-auto shadow-2xl space-y-4 ${
              isDark 
                ? 'bg-[#0E131F]/95 border-white/[0.1] text-white shadow-black/80' 
                : 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-900/15'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center justify-between border-b pb-3 ${isDark ? 'border-white/[0.08]' : 'border-slate-100'}`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shadow-xs ${
                  isDark ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-600'
                }`}>
                  <Layers size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm font-space">Katalog Layanan Digital</h3>
                  <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Pilih kategori untuk melihat produk</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCatalogOpen(false)}
                className={`w-7 h-7 rounded-full border flex items-center justify-center cursor-pointer transition-colors ${
                  isDark ? 'bg-slate-900 border-white/[0.1] text-slate-400 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-900'
                }`}
                aria-label="Tutup"
              >
                <X size={14} />
              </button>
            </div>

            {/* SQUIRCLE 2x2 GRID */}
            <div className="grid grid-cols-2 gap-2.5 pt-0.5">
              {catalogs.map((cat) => {
                const IconComponent = getCatalogIcon(cat.iconType);

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCatalog(cat.id, cat.targetTab)}
                    className={`p-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer group flex flex-col items-center text-center relative overflow-hidden shadow-xs hover:shadow-md hover:scale-[1.02] ${
                      isDark
                        ? 'bg-slate-900/70 hover:bg-slate-800/80 border-white/[0.08] hover:border-amber-500/50'
                        : 'bg-slate-50/80 hover:bg-white border-slate-200 hover:border-amber-400 shadow-xs'
                    }`}
                  >
                    {/* Squircle Photo or Icon */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden shrink-0 shadow-inner mb-2 transition-all border ${
                      isDark ? 'bg-slate-950/80 border-white/[0.08]' : 'bg-white border-slate-200'
                    }`}>
                      {cat.iconUrl ? (
                        <img
                          src={cat.iconUrl}
                          alt={cat.title}
                          className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="text-amber-500 group-hover:scale-110 transition-transform">
                          <IconComponent size={20} />
                        </div>
                      )}
                    </div>

                    <div className="w-full">
                      <div className="font-bold text-xs truncate group-hover:text-amber-500 transition-colors font-space">
                        {cat.title}
                      </div>
                      <div className={`text-[10px] truncate mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {cat.subtitle}
                      </div>
                      {cat.badge && (
                        <div className="mt-1.5">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                            isDark ? 'text-amber-400 bg-amber-500/15 border-amber-500/30' : 'text-amber-700 bg-amber-100 border-amber-200'
                          }`}>
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
            <div className={`pt-2 border-t ${isDark ? 'border-white/[0.08]' : 'border-slate-100'}`}>
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
                className={`w-full py-2 px-3 rounded-xl text-[11px] font-semibold border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  isDark ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-white/[0.08]' : 'bg-slate-100 hover:bg-slate-200/70 text-slate-700 border-slate-200'
                }`}
              >
                <span>Buka Seluruh Etalase Toko</span>
                <ArrowRight size={12} className="text-amber-500" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MAIN BOTTOM NAVIGATION BAR */}
      <nav 
        id="mobile-bottom-navigation"
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 ${
          isDark 
            ? 'bg-[#0B0F17]/90 border-t border-white/[0.08] text-slate-300' 
            : 'bg-white/90 border-t border-slate-200/80 text-slate-700'
        } backdrop-blur-xl pb-safe shadow-premium-lg transition-colors`}
        aria-label="Navigasi Bawah Ponsel"
      >
        <div className="grid grid-cols-4 h-15 max-w-md mx-auto">
          <button
            onClick={() => {
              setIsCatalogOpen(false);
              onNavigate('home');
            }}
            id="mobile-tab-home"
            className={`flex flex-col items-center justify-center min-h-[44px] transition-all cursor-pointer ${
              currentTab === 'home' && !isCatalogOpen
                ? 'text-amber-500 font-bold scale-105'
                : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
            aria-current={currentTab === 'home' ? 'page' : undefined}
          >
            <Home size={19} className={currentTab === 'home' && !isCatalogOpen ? 'stroke-[2.4]' : ''} />
            <span className="text-[10px] mt-1 font-jakarta">Beranda</span>
          </button>

          <button
            onClick={() => setIsCatalogOpen(!isCatalogOpen)}
            id="mobile-tab-products"
            className={`flex flex-col items-center justify-center min-h-[44px] transition-all cursor-pointer relative ${
              isProductActive || isCatalogOpen
                ? 'text-amber-500 font-bold scale-105'
                : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
            aria-current={isProductActive ? 'page' : undefined}
          >
            <Grid size={19} className={isProductActive || isCatalogOpen ? 'stroke-[2.4]' : ''} />
            <span className="text-[10px] mt-1 font-jakarta">Katalog</span>
            {isCatalogOpen && (
              <span className="absolute top-1.5 right-6 w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
            )}
          </button>

          <button
            onClick={() => {
              setIsCatalogOpen(false);
              onNavigate('transaksi');
            }}
            id="mobile-tab-transactions"
            className={`flex flex-col items-center justify-center min-h-[44px] transition-all cursor-pointer ${
              currentTab === 'transaksi' && !isCatalogOpen
                ? 'text-amber-500 font-bold scale-105'
                : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
            aria-current={currentTab === 'transaksi' ? 'page' : undefined}
          >
            <ReceiptText size={19} className={currentTab === 'transaksi' && !isCatalogOpen ? 'stroke-[2.4]' : ''} />
            <span className="text-[10px] mt-1 font-jakarta">Lacak</span>
          </button>

          <button
            onClick={() => {
              setIsCatalogOpen(false);
              onNavigate('akun');
            }}
            id="mobile-tab-account"
            className={`flex flex-col items-center justify-center min-h-[44px] transition-all cursor-pointer ${
              currentTab === 'akun' && !isCatalogOpen
                ? 'text-amber-500 font-bold scale-105'
                : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
            aria-current={currentTab === 'akun' ? 'page' : undefined}
          >
            <User size={19} className={currentTab === 'akun' && !isCatalogOpen ? 'stroke-[2.4]' : ''} />
            <span className="text-[10px] mt-1 font-jakarta">Akun</span>
          </button>
        </div>
      </nav>
    </>
  );
}
