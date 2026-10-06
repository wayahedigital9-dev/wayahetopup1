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
  PhoneCall,
  Clock,
  ShieldCheck,
  ChevronDown,
  Sun,
  Moon
} from 'lucide-react';
import { User as UserType } from '../types';
import { storage } from '../services/storage';
import { useTheme } from '../context/ThemeContext';

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

  return (
    <header className="sticky top-0 z-40 w-full select-none">
      {/* TOP ANNOUNCEMENT / STATUS BAR */}
      <div className={`${isLight ? 'bg-[#F1F5F9] border-b border-[#E2E8F0] text-[#64748B]' : 'bg-[#121413] border-b border-[#28302A] text-[#A4ADA6]'} px-4 sm:px-8 py-1.5 text-[11px] hidden md:block transition-colors`}>
        <div className="max-w-[1380px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              SERVER AKTIF 99.98% SPEED INSTAN
            </span>
            <span className={isLight ? 'text-slate-300' : 'text-[#3E4C41]'}>|</span>
            <span>1.400+ Transaksi Sukses Jam Terakhir</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => handleNav('bantuan')} className={`${isLight ? 'hover:text-[#0F172A]' : 'hover:text-[#C7FF4D]'} transition-colors cursor-pointer`}>
              Panduan Top Up
            </button>
            <button onClick={() => handleNav('bantuan')} className={`${isLight ? 'hover:text-[#0F172A]' : 'hover:text-[#C7FF4D]'} transition-colors cursor-pointer`}>
              Bantuan 24/7 (CS)
            </button>
            <button onClick={() => handleNav('akun')} className="hover:underline transition-colors cursor-pointer font-bold text-amber-600">
              Program Reseller VIP
            </button>
          </div>
        </div>
      </div>

      {/* MAIN NAVBAR */}
      <div className={`${isLight ? 'bg-white/95 border-b border-[#E2E8F0]' : 'bg-[#101211]/95 border-b border-[#28302A]'} backdrop-blur-md px-4 sm:px-8 lg:px-10 py-3 transition-colors shadow-xs`}>
        <div className="max-w-[1380px] mx-auto flex items-center justify-between gap-4">
          {/* Brand & Logo */}
          <button
            onClick={() => handleNav('home')}
            id="navbar-brand-logo"
            className="flex items-center gap-3 text-left group cursor-pointer shrink-0 transition-transform hover:translate-x-0.5"
          >
            {effectiveLogo && !logoLoadError ? (
              <div className={`w-10 h-10 rounded-xl overflow-hidden border ${isLight ? 'border-slate-200 bg-slate-50' : 'border-[#3E4C41] bg-[#1B1F1C]'} flex items-center justify-center shadow-xs group-hover:border-amber-400 transition-all shrink-0`}>
                <img 
                  src={effectiveLogo} 
                  alt={effectiveName} 
                  className="w-full h-full object-contain rounded-xl p-0.5" 
                  onError={() => setLogoLoadError(true)}
                />
              </div>
            ) : (
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${isLight ? 'from-amber-400 to-amber-500 text-slate-900 border-amber-300 shadow-sm' : 'from-[#1B1F1C] via-[#232924] to-[#101211] text-[#C7FF4D] border-[#3E4C41] shadow-md'} border flex items-center justify-center transition-all shrink-0`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L15 8L21 9L17 14L18 20L12 17L6 20L7 14L3 9L9 8L12 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="rgba(0,0,0,0.15)" />
                  <circle cx="12" cy="12" r="2.5" fill="currentColor" />
                </svg>
              </div>
            )}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className={`font-space font-extrabold text-xl tracking-tight ${isLight ? 'text-[#0F172A]' : 'text-[#F5F7F2]'}`}>
                  {effectiveName === 'WayaheDigital' ? (
                    <>Wayahe<span className={isLight ? 'text-amber-500' : 'text-[#C7FF4D]'}>Digital</span></>
                  ) : (
                    effectiveName
                  )}
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isLight ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-[#C7FF4D]/15 text-[#C7FF4D] border-[#C7FF4D]/30'} border uppercase tracking-widest hidden sm:inline`}>
                  PRO
                </span>
              </div>
            </div>
          </button>

          {/* Search Pill Input */}
          <div className="hidden md:flex flex-1 max-w-md mx-2">
            <div className="relative w-full">
              <input
                type="text"
                value={navSearchQuery}
                onChange={(e) => setNavSearchQuery(e.target.value)}
                placeholder="Cari voucher WiFi, game, kuota, atau pulsa..."
                className={`w-full ${isLight ? 'bg-[#F8FAFC] text-[#0F172A] placeholder-[#94A3B8] border-[#E2E8F0] focus:border-amber-400 focus:ring-amber-400' : 'bg-[#1B1F1C] text-[#F5F7F2] placeholder-[#68736B] border-[#28302A] focus:border-[#C7FF4D] focus:ring-[#C7FF4D]'} text-xs rounded-full pl-9 pr-4 py-2 border focus:outline-none focus:ring-1 transition-all font-jakarta`}
              />
              <Search size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${isLight ? 'text-[#94A3B8]' : 'text-[#68736B]'}`} />
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1.5">
            <button
              onClick={() => handleNav('home')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer font-jakarta ${
                currentTab === 'home'
                  ? isLight
                    ? 'bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0] shadow-xs'
                    : 'bg-[#1E251F] text-[#C7FF4D] border border-[#3E4C41] shadow-xs'
                  : isLight
                    ? 'text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                    : 'text-[#F5F7F2] hover:text-[#C7FF4D] hover:bg-[#1B1F1C]'
              }`}
            >
              Katalog Game
            </button>
            <button
              onClick={() => handleNav('pulsa')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer font-jakarta ${
                currentTab === 'pulsa'
                  ? isLight
                    ? 'bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0] shadow-xs'
                    : 'bg-[#1E251F] text-[#C7FF4D] border border-[#3E4C41] shadow-xs'
                  : isLight
                    ? 'text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                    : 'text-[#F5F7F2] hover:text-[#C7FF4D] hover:bg-[#1B1F1C]'
              }`}
            >
              Pulsa & Data
            </button>
            <button
              onClick={() => handleNav('wifi')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer font-jakarta ${
                currentTab === 'wifi'
                  ? isLight
                    ? 'bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0] shadow-xs'
                    : 'bg-[#1E251F] text-[#C7FF4D] border border-[#3E4C41] shadow-xs'
                  : isLight
                    ? 'text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                    : 'text-[#F5F7F2] hover:text-[#C7FF4D] hover:bg-[#1B1F1C]'
              }`}
            >
              Aktivasi Voucher
            </button>
            <button
              onClick={() => handleNav('kuota')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer font-jakarta ${
                currentTab === 'kuota'
                  ? isLight
                    ? 'bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0] shadow-xs'
                    : 'bg-[#1E251F] text-[#C7FF4D] border border-[#3E4C41] shadow-xs'
                  : isLight
                    ? 'text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                    : 'text-[#F5F7F2] hover:text-[#C7FF4D] hover:bg-[#1B1F1C]'
              }`}
            >
              Promo & Event
            </button>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Theme Toggle Button (Siang / Malam) */}
            <button
              onClick={toggleTheme}
              id="navbar-theme-toggle"
              title={isDark ? "Beralih ke Mode Siang (Cerah)" : "Beralih ke Mode Malam (Gelap)"}
              className={`p-2 rounded-full border transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-xs ${
                isLight
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 hover:scale-105 active:scale-95'
                  : 'bg-[#1E251F] hover:bg-[#28322A] text-[#C7FF4D] border-[#3E4C41] hover:scale-105 active:scale-95'
              }`}
              aria-label="Ganti mode siang dan malam"
            >
              {isDark ? (
                <Sun size={15} className="text-[#C7FF4D] transition-transform hover:rotate-45" />
              ) : (
                <Moon size={15} className="text-amber-600 transition-transform hover:-rotate-12" />
              )}
            </button>

            {/* Cek Transaksi Pill */}
            <button
              onClick={() => handleNav('transaksi')}
              id="navbar-track-order-button"
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border cursor-pointer font-jakarta ${
                currentTab === 'transaksi'
                  ? isLight ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-xs' : 'bg-[#1E251F] text-[#C7FF4D] border-[#C7FF4D] font-bold shadow-lime-glow'
                  : isLight ? 'bg-white text-[#0F172A] hover:bg-slate-50 border-[#E2E8F0] shadow-xs' : 'bg-[#1B1F1C] text-[#F5F7F2] hover:text-[#C7FF4D] border-[#28302A] hover:border-[#3E4C41]'
              }`}
            >
              <ReceiptText size={14} className={currentTab === 'transaksi' ? (isLight ? 'text-white' : 'text-[#C7FF4D]') : (isLight ? 'text-[#0F172A]' : 'text-[#A4ADA6]')} />
              <span className="hidden sm:inline">Cek Transaksi</span>
              <span className="sm:hidden">Lacak</span>
            </button>

            {/* User Account / Login Pill */}
            <button
              onClick={onOpenAuth}
              id="navbar-user-btn"
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer font-space ${
                currentUser
                  ? isLight
                    ? 'bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0]'
                    : 'bg-[#1E251F] text-[#C7FF4D] border border-[#3E4C41] hover:border-[#C7FF4D]'
                  : isLight
                    ? 'bg-[#FACC15] hover:bg-[#EAB308] text-[#0F172A] shadow-xs hover:scale-[1.02]'
                    : 'bg-[#C7FF4D] hover:bg-[#D7FF75] active:bg-[#B4F234] text-[#101211] shadow-lime-glow hover:scale-[1.02]'
              }`}
            >
              <User size={14} />
              <span className="hidden sm:inline">
                {currentUser ? currentUser.name.split(' ')[0] : 'Masuk'}
              </span>
            </button>

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              id="mobile-nav-toggle"
              className={`p-1.5 ${isLight ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 border-slate-200' : 'text-[#A4ADA6] hover:text-[#F5F7F2] hover:bg-[#1B1F1C] border-[#28302A]'} rounded-full lg:hidden border cursor-pointer`}
              aria-label="Buka Menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className={`lg:hidden ${isLight ? 'bg-white border-b border-slate-200 text-slate-900' : 'bg-[#141815] border-b border-[#28302A] text-[#F5F7F2]'} px-4 pt-3 pb-6 space-y-2 shadow-xl animate-fadeIn`}>
          {/* Mobile Search */}
          <div className="relative w-full mb-3">
            <input
              type="text"
              value={navSearchQuery}
              onChange={(e) => setNavSearchQuery(e.target.value)}
              placeholder="Cari voucher atau game..."
              className={`w-full ${isLight ? 'bg-slate-50 text-slate-900 placeholder-slate-400 border-slate-200 focus:border-amber-400' : 'bg-[#1B1F1C] text-[#F5F7F2] placeholder-[#A4ADA6] border-[#28302A] focus:border-[#C7FF4D]'} text-xs rounded-full pl-9 pr-4 py-2 border outline-none`}
            />
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          {/* Mode Siang / Malam Switcher Row in Mobile Drawer */}
          <div className={`flex items-center justify-between p-2.5 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1B1F1C] border-[#28302A]'}`}>
            <div className="flex items-center gap-2">
              {isDark ? <Moon size={16} className="text-[#C7FF4D]" /> : <Sun size={16} className="text-amber-500" />}
              <span className={`text-xs font-semibold ${isLight ? 'text-slate-800' : 'text-[#F5F7F2]'}`}>
                Mode: <span className={isLight ? 'text-amber-600 font-bold' : 'text-[#C7FF4D] font-bold'}>{isDark ? 'Malam (Dark)' : 'Siang (Light)'}</span>
              </span>
            </div>
            <button
              onClick={toggleTheme}
              className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                isLight
                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300'
                  : 'bg-[#C7FF4D]/15 hover:bg-[#C7FF4D]/25 text-[#C7FF4D] border-[#C7FF4D]/40'
              }`}
            >
              {isDark ? <Sun size={13} /> : <Moon size={13} />}
              <span>{isDark ? 'Ke Siang' : 'Ke Malam'}</span>
            </button>
          </div>

          <button
            onClick={() => handleNav('home')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
              currentTab === 'home'
                ? isLight
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-[#1E251F] text-[#C7FF4D] border border-[#3E4C41]'
                : isLight
                  ? 'text-slate-700 hover:bg-slate-100'
                  : 'text-[#F5F7F2] hover:bg-[#1B1F1C]'
            }`}
          >
            <Zap size={16} className={isLight ? 'text-amber-500' : 'text-[#C7FF4D]'} />
            <span>Beranda Storefront</span>
          </button>
          <button
            onClick={() => handleNav('pulsa')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
              currentTab === 'pulsa'
                ? isLight
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-[#1E251F] text-[#C7FF4D] border border-[#3E4C41]'
                : isLight
                  ? 'text-slate-700 hover:bg-slate-100'
                  : 'text-[#F5F7F2] hover:bg-[#1B1F1C]'
            }`}
          >
            <Smartphone size={16} className={isLight ? 'text-amber-500' : 'text-[#C7FF4D]'} />
            <span>Pulsa Reguler Semua Operator</span>
          </button>
          <button
            onClick={() => handleNav('kuota')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
              currentTab === 'kuota'
                ? isLight
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-[#1E251F] text-[#C7FF4D] border border-[#3E4C41]'
                : isLight
                  ? 'text-slate-700 hover:bg-slate-100'
                  : 'text-[#F5F7F2] hover:bg-[#1B1F1C]'
            }`}
          >
            <Wifi size={16} className={isLight ? 'text-amber-500' : 'text-[#C7FF4D]'} />
            <span>Paket Kuota Internet & Gaming</span>
          </button>
          <button
            onClick={() => handleNav('wifi')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
              currentTab === 'wifi'
                ? isLight
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-[#1E251F] text-[#C7FF4D] border border-[#3E4C41]'
                : isLight
                  ? 'text-slate-700 hover:bg-slate-100'
                  : 'text-[#F5F7F2] hover:bg-[#1B1F1C]'
            }`}
          >
            <Radio size={16} className={isLight ? 'text-amber-500' : 'text-[#C7FF4D]'} />
            <span>Voucher WiFi RT/RW Net</span>
          </button>

          <div className={`pt-2 border-t ${isLight ? 'border-slate-200' : 'border-[#28302A]'} flex flex-col gap-1`}>
            <button
              onClick={() => handleNav('bantuan')}
              className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs ${isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'text-[#A4ADA6] hover:text-[#F5F7F2] hover:bg-[#1B1F1C]'}`}
            >
              <span>Bantuan & Panduan Transaksi</span>
            </button>
            <button
              onClick={() => {
                onOpenAdmin();
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium ${isLight ? 'text-amber-700 hover:bg-amber-50' : 'text-[#C7FF4D] hover:bg-[#1B1F1C]'}`}
            >
              <LayoutDashboard size={15} />
              <span>Masuk Panel Administrator</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
