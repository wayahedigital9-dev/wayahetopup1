import React, { useState } from 'react';
import {
  Zap,
  Search,
  User,
  Menu,
  X,
  LayoutDashboard,
  Smartphone,
  Wifi,
  Radio,
  Sparkles,
  ReceiptText,
  Gamepad2,
  Crown,
  ChevronRight,
  Sun,
  Moon
} from 'lucide-react';
import { User as UserType } from '../types';
import { storage } from '../services/storage';
import { useTheme } from '../context/ThemeContext';
import { formatRupiah } from '../utils/operator';

interface NavbarProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  currentUser: UserType | null;
  onOpenAuth: () => void;
  onOpenAdmin: () => void;
  logoUrl?: string;
  siteName?: string;
}

export function Navbar({
  currentTab,
  onNavigate,
  currentUser,
  onOpenAuth,
  onOpenAdmin,
  logoUrl: propLogoUrl,
  siteName: propSiteName,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navSearchQuery, setNavSearchQuery] = useState('');
  const [logoLoadError, setLogoLoadError] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const isLight = !isDark;

  const currentSettings = storage.getSettings();
  const effectiveLogo = propLogoUrl || currentSettings.logoUrl;
  const effectiveName = propSiteName || currentSettings.siteName || 'WayaheDigital';

  const handleNav = (tab: string) => {
    onNavigate(tab);
    setMobileMenuOpen(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (navSearchQuery.trim()) {
      handleNav('home');
      window.dispatchEvent(new CustomEvent('app:search', { detail: navSearchQuery.trim() }));
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full select-none">
      {/* MAIN NAVBAR DOCK */}
      <div className={`${isLight ? 'bg-white/85 border-b border-slate-200/80 text-slate-900' : 'bg-[#0E131F]/85 border-b border-white/[0.07] text-[#F8FAFC]'} backdrop-blur-xl px-4 sm:px-8 lg:px-10 py-2.5 transition-colors shadow-premium-sm`}>
        <div className="max-w-[1380px] mx-auto flex items-center justify-between gap-4">

          {/* Brand & Logo */}
          <button
            onClick={() => handleNav('home')}
            id="navbar-brand-logo"
            className="flex items-center gap-2.5 text-left group cursor-pointer shrink-0 transition-transform hover:scale-[1.01]"
          >
            {effectiveLogo && !logoLoadError ? (
              <div className={`w-9 h-9 rounded-xl overflow-hidden border ${isLight ? 'border-slate-200/90 bg-white shadow-xs' : 'border-white/10 bg-slate-900/60 shadow-inner'} flex items-center justify-center transition-all shrink-0 group-hover:border-amber-500/50`}>
                <img
                  src={effectiveLogo}
                  alt={effectiveName}
                  className="w-full h-full object-contain p-1"
                  onError={() => setLogoLoadError(true)}
                />
              </div>
            ) : (
              <div className={`w-9 h-9 rounded-xl ${isLight ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 shadow-xs' : 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-amber-glow'} flex items-center justify-center transition-all shrink-0`}>
                <Sparkles size={18} className="fill-current" />
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="font-space font-extrabold text-lg sm:text-xl tracking-tight">
                {effectiveName === 'WayaheDigital' ? (
                  <>Wayahe<span className="text-amber-500">Digital</span></>
                ) : (
                  effectiveName
                )}
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isLight ? 'bg-amber-100 text-amber-800 border border-amber-200/80' : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'} uppercase tracking-wider hidden sm:inline`}>
                PRO
              </span>
            </div>
          </button>

          {/* Minimalist Search Input */}
          <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 max-w-sm mx-2">
            <div className="relative w-full">
              <Search size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
              <input
                type="text"
                value={navSearchQuery}
                onChange={(e) => setNavSearchQuery(e.target.value)}
                placeholder="Cari game, pulsa, token PLN, voucher..."
                className={`w-full ${isLight ? 'bg-slate-100/80 text-slate-900 placeholder-slate-400 border-slate-200/90 focus:border-amber-500 focus:bg-white' : 'bg-slate-900/60 text-slate-100 placeholder-slate-500 border-white/[0.08] focus:border-amber-400/80 focus:bg-slate-900'} text-xs rounded-full pl-9 pr-14 py-2 border outline-none transition-all font-jakarta shadow-inner`}
              />
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded ${isLight ? 'bg-slate-200/70 text-slate-500' : 'bg-slate-800 text-slate-400'} pointer-events-none`}>
                ↵
              </span>
            </div>
          </form>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {[
              { id: 'home', label: 'Beranda' },
              { id: 'pulsa', label: 'Pulsa & Data' },
              { id: 'wifi', label: 'Voucher WiFi' },
              { id: 'kuota', label: 'Promo' },
            ].map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleNav(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer font-jakarta ${isActive
                    ? isLight
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white/10 text-white border border-white/15'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              id="navbar-theme-toggle"
              title={isDark ? "Beralih ke Mode Siang" : "Beralih ke Mode Malam"}
              className={`w-8 h-8 rounded-full border transition-all cursor-pointer flex items-center justify-center shrink-0 ${isLight
                ? 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 border-slate-200'
                : 'bg-slate-900/80 hover:bg-slate-800 text-amber-400 border-white/[0.08]'
                }`}
              aria-label="Ganti mode tema"
            >
              {isDark ? (
                <Sun size={14} className="transition-transform hover:rotate-45" />
              ) : (
                <Moon size={14} className="transition-transform hover:-rotate-12" />
              )}
            </button>

            {/* Cek Transaksi Pill */}
            <button
              onClick={() => handleNav('transaksi')}
              id="navbar-track-order-button"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border cursor-pointer font-jakarta ${currentTab === 'transaksi'
                ? isLight
                  ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-xs'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold shadow-amber-glow'
                : isLight
                  ? 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                  : 'bg-slate-900/60 text-slate-300 hover:text-white border-white/[0.08] hover:border-white/20'
                }`}
            >
              <ReceiptText size={13} className={currentTab === 'transaksi' ? (isLight ? 'text-white' : 'text-amber-400') : 'text-slate-400'} />
              <span className="hidden sm:inline">Lacak Pesanan</span>
              <span className="sm:hidden">Lacak</span>
            </button>

            {/* Member Account / Login Pill */}
            {currentUser ? (
              <button
                onClick={onOpenAuth}
                id="navbar-user-btn"
                className={`inline-flex items-center gap-2 pl-2 pr-3.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer font-jakarta border ${isLight
                  ? 'bg-slate-100 hover:bg-slate-200/70 border-slate-200 text-slate-800'
                  : 'bg-slate-900/80 hover:bg-slate-800 border-white/[0.08] text-slate-200'
                  }`}
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 font-bold flex items-center justify-center text-[10px] shadow-xs">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[11px] font-bold leading-tight truncate max-w-[80px] sm:max-w-[100px]">
                    {currentUser.name.split(' ')[0]}
                  </span>
                  <span className="text-[9px] text-emerald-500 font-mono leading-tight">
                    {formatRupiah(currentUser.balance || 0)}
                  </span>
                </div>
              </button>
            ) : (
              <button
                onClick={onOpenAuth}
                id="navbar-user-btn"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer font-space bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-premium-sm hover:scale-[1.02] active:scale-95"
              >
                <User size={13} />
                <span>Masuk</span>
              </button>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              id="mobile-nav-toggle"
              className={`p-1.5 rounded-full lg:hidden border cursor-pointer transition-colors ${isLight
                ? 'text-slate-700 hover:bg-slate-100 border-slate-200'
                : 'text-slate-300 hover:bg-slate-800 border-white/[0.08]'
                }`}
              aria-label="Buka Menu"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* 3. MOBILE DRAWER MENU */}
      {mobileMenuOpen && (
        <div className={`lg:hidden ${isLight ? 'bg-white/95 border-b border-slate-200 text-slate-900' : 'bg-[#0E131F]/95 border-b border-white/[0.08] text-[#F8FAFC]'} backdrop-blur-2xl px-4 pt-3 pb-6 space-y-2.5 shadow-premium-lg animate-fadeIn`}>
          {/* Mobile Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative w-full mb-3">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={navSearchQuery}
              onChange={(e) => setNavSearchQuery(e.target.value)}
              placeholder="Cari voucher, game, paket..."
              className={`w-full ${isLight ? 'bg-slate-100 text-slate-900 placeholder-slate-400 border-slate-200' : 'bg-slate-900 text-slate-100 placeholder-slate-500 border-white/[0.08]'} text-xs rounded-full pl-9 pr-4 py-2 border outline-none font-jakarta`}
            />
          </form>

          {/* Quick Nav Links */}
          <div className="space-y-1">
            {[
              { id: 'home', label: 'Beranda Storefront', icon: Zap },
              { id: 'pulsa', label: 'Pulsa & Kuota Data', icon: Smartphone },
              { id: 'wifi', label: 'Voucher WiFi RT/RW Net', icon: Radio },
              { id: 'transaksi', label: 'Lacak Status Transaksi', icon: ReceiptText },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${isActive
                    ? isLight
                      ? 'bg-amber-50 text-amber-900 border border-amber-200'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : isLight
                      ? 'text-slate-700 hover:bg-slate-50'
                      : 'text-slate-300 hover:bg-slate-900'
                    }`}
                >
                  <Icon size={16} className={isActive ? 'text-amber-500' : 'text-slate-400'} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Admin shortcut */}
          <div className={`pt-2 border-t ${isLight ? 'border-slate-200' : 'border-white/[0.08]'} flex flex-col gap-1`}>
            <button
              onClick={() => {
                onOpenAdmin();
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium ${isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:bg-slate-900'}`}
            >
              <div className="flex items-center gap-2">
                <LayoutDashboard size={14} />
                <span>Panel Administrator</span>
              </div>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
