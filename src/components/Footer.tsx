import React, { useState } from 'react';
import { ShieldCheck, Headphones, Clock, Mail, MessageCircle, ChevronRight, Sparkles } from 'lucide-react';
import { storage } from '../services/storage';
import { useTheme } from '../context/ThemeContext';

interface FooterProps {
  onNavigate: (tab: string) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  const [logoErr, setLogoErr] = useState(false);
  const { isDark } = useTheme();
  const isLight = !isDark;
  const settings = storage.getSettings();
  const effectiveLogo = settings.logoUrl;
  const effectiveName = settings.siteName || 'WayaheDigital';

  return (
    <footer className={`${isDark ? 'bg-[#0B0F17] text-slate-400 border-white/[0.08]' : 'bg-white text-slate-600 border-slate-200'} pt-14 pb-24 lg:pb-12 border-t transition-colors shadow-premium-sm`}>
      <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          
          {/* Brand Col */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              {effectiveLogo && !logoErr ? (
                <div className={`w-9 h-9 rounded-xl overflow-hidden border ${isDark ? 'border-white/10 bg-slate-900' : 'border-slate-200 bg-slate-50'} flex items-center justify-center shadow-xs shrink-0`}>
                  <img 
                    src={effectiveLogo} 
                    alt={effectiveName} 
                    className="w-full h-full object-contain p-1" 
                    onError={() => setLogoErr(true)}
                  />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 flex items-center justify-center shadow-xs shrink-0">
                  <Sparkles size={18} className="fill-current" />
                </div>
              )}
              <span className={`font-space font-extrabold text-xl tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {effectiveName === 'WayaheDigital' ? (
                  <>Wayahe<span className="text-amber-500">Digital</span></>
                ) : (
                  effectiveName
                )}
              </span>
            </div>

            <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'} font-jakarta`}>
              Platform top up game terpercaya, pulsa & kuota data terlengkap, serta voucher digital dengan sistem pengiriman otomatis 24 jam nonstop.
            </p>

            <div className="flex items-center gap-3 text-xs pt-1 font-jakarta">
              <span className={`flex items-center gap-1 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                <Clock size={14} className="text-amber-500" />
                <span>Otomatis 24 Jam</span>
              </span>
              <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>•</span>
              <span className="flex items-center gap-1 font-medium text-emerald-500">
                <ShieldCheck size={14} className="text-emerald-500" />
                <span>Garansi 100% Legal</span>
              </span>
            </div>
          </div>

          {/* Kategori Layanan */}
          <div>
            <h3 className={`font-space font-bold text-xs uppercase tracking-wider mb-4 border-l-2 border-amber-500 pl-2.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Katalog Layanan
            </h3>
            <ul className="space-y-2.5 text-xs font-jakarta">
              <li>
                <button
                  onClick={() => onNavigate('home')}
                  className={`${isDark ? 'hover:text-amber-400' : 'hover:text-slate-900'} hover:translate-x-0.5 transition-all flex items-center gap-1.5 cursor-pointer text-left`}
                >
                  <ChevronRight size={13} className="text-amber-500" />
                  <span>Top Up Diamond Game & Voucher</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('pulsa')}
                  className={`${isDark ? 'hover:text-amber-400' : 'hover:text-slate-900'} hover:translate-x-0.5 transition-all flex items-center gap-1.5 cursor-pointer text-left`}
                >
                  <ChevronRight size={13} className="text-amber-500" />
                  <span>Pulsa & Paket Data All Operator</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('wifi')}
                  className={`${isDark ? 'hover:text-amber-400' : 'hover:text-slate-900'} hover:translate-x-0.5 transition-all flex items-center gap-1.5 cursor-pointer text-left`}
                >
                  <ChevronRight size={13} className="text-amber-500" />
                  <span>Voucher WiFi RT/RW Net</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('home')}
                  className={`${isDark ? 'hover:text-amber-400' : 'hover:text-slate-900'} hover:translate-x-0.5 transition-all flex items-center gap-1.5 cursor-pointer text-left`}
                >
                  <ChevronRight size={13} className="text-amber-500" />
                  <span>Langganan Aplikasi Premium & AI</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Bantuan & Navigasi */}
          <div>
            <h3 className={`font-space font-bold text-xs uppercase tracking-wider mb-4 border-l-2 border-amber-500 pl-2.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Navigasi & Bantuan
            </h3>
            <ul className="space-y-2.5 text-xs font-jakarta">
              <li>
                <button
                  onClick={() => onNavigate('transaksi')}
                  className={`${isDark ? 'hover:text-amber-400' : 'hover:text-slate-900'} hover:translate-x-0.5 transition-all flex items-center gap-1.5 cursor-pointer`}
                >
                  <ChevronRight size={13} className="text-amber-500" />
                  <span>Lacak Pesanan & Invoice</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('bantuan')}
                  className={`${isDark ? 'hover:text-amber-400' : 'hover:text-slate-900'} hover:translate-x-0.5 transition-all flex items-center gap-1.5 cursor-pointer`}
                >
                  <ChevronRight size={13} className="text-amber-500" />
                  <span>Pusat Bantuan & FAQ</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('akun')}
                  className={`${isDark ? 'hover:text-amber-400' : 'hover:text-slate-900'} hover:translate-x-0.5 transition-all flex items-center gap-1.5 cursor-pointer`}
                >
                  <ChevronRight size={13} className="text-amber-500" />
                  <span>Program Reseller VIP</span>
                </button>
              </li>
              <li className={`pt-2 border-t ${isDark ? 'border-white/[0.08]' : 'border-slate-100'}`}>
                <button
                  onClick={() => onNavigate('admin')}
                  className="text-amber-500 hover:text-amber-400 font-semibold transition-colors flex items-center gap-1.5 text-xs cursor-pointer"
                >
                  <ChevronRight size={13} className="text-amber-500" />
                  <span>Portal Administrator</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Kontak Dukungan */}
          <div>
            <h3 className={`font-space font-bold text-xs uppercase tracking-wider mb-4 border-l-2 border-amber-500 pl-2.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Layanan Pelanggan
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-3 font-jakarta`}>
              Ada kendala transaksi atau butuh bantuan layanan? CS kami siap membantu 24/7.
            </p>
            <div className="space-y-2.5 text-xs font-jakarta">
              <a
                href={`https://wa.me/${(settings.supportWhatsApp || '0812-3456-7890').replace(/[^0-9]/g, '').replace(/^0/, '62')}`}
                target="_blank"
                rel="noreferrer"
                className={`flex items-center gap-2 ${isDark ? 'text-slate-200 hover:text-emerald-400' : 'text-slate-800 hover:text-emerald-600'} font-semibold transition-colors`}
              >
                <MessageCircle size={15} className="text-emerald-500" />
                <span>WhatsApp: {settings.supportWhatsApp || '0812-3456-7890'}</span>
              </a>
              <div className={`flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                <Mail size={15} className="text-amber-500" />
                <span>{settings.supportEmail || 'bantuan@wayahedigital.id'}</span>
              </div>
              <div className={`flex items-center gap-2 ${isDark ? 'text-slate-500' : 'text-slate-400'} text-[11px] pt-1`}>
                <Headphones size={13} />
                <span>{settings.supportHours || 'Respon ramah, cepat, dan solutif (24 Jam)'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className={`pt-6 border-t ${isDark ? 'border-white/[0.08] text-slate-500' : 'border-slate-200 text-slate-400'} flex flex-col sm:flex-row items-center justify-between text-xs gap-4 font-jakarta`}>
          <p>© {new Date().getFullYear()} Wayahe Digital. Hak Cipta Dilindungi.</p>
          <div className="flex items-center gap-4 text-[11px]">
            <button onClick={() => onNavigate('bantuan')} className={`${isDark ? 'hover:text-slate-300' : 'hover:text-slate-800'} cursor-pointer`}>
              Syarat &amp; Ketentuan
            </button>
            <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>•</span>
            <button onClick={() => onNavigate('bantuan')} className={`${isDark ? 'hover:text-slate-300' : 'hover:text-slate-800'} cursor-pointer`}>
              Kebijakan Privasi
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
