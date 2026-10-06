import React, { useState } from 'react';
import { ShieldCheck, Headphones, Clock, Mail, MessageCircle, FileText, ChevronRight, Sparkles } from 'lucide-react';
import { storage } from '../services/storage';
import { useTheme } from '../context/ThemeContext';

interface FooterProps {
  onNavigate: (tab: string) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  const [logoErr, setLogoErr] = useState(false);
  const { isDark } = useTheme();
  const settings = storage.getSettings();
  const effectiveLogo = settings.logoUrl;
  const effectiveName = settings.siteName || 'WayaheDigital';

  return (
    <footer className={`${isDark ? 'bg-[#101211] text-[#A4ADA6] border-[#28302A]' : 'bg-white text-slate-600 border-slate-200'} pt-14 pb-24 lg:pb-14 border-t shadow-xs transition-colors`}>
      <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Brand Col */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              {effectiveLogo && !logoErr ? (
                <div className={`w-9 h-9 rounded-xl overflow-hidden border ${isDark ? 'border-[#3E4C41] bg-[#1B1F1C]' : 'border-slate-200 bg-slate-50'} flex items-center justify-center shadow-xs shrink-0`}>
                  <img 
                    src={effectiveLogo} 
                    alt={effectiveName} 
                    className="w-full h-full object-contain rounded-xl p-0.5" 
                    onError={() => setLogoErr(true)}
                  />
                </div>
              ) : (
                <div className={`w-9 h-9 rounded-xl ${isDark ? 'bg-gradient-to-br from-[#1B1F1C] to-[#232924] border-[#3E4C41] text-[#C7FF4D]' : 'bg-gradient-to-br from-amber-400 to-amber-500 border-amber-300 text-slate-900'} border flex items-center justify-center shadow-xs shrink-0`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L15 8L21 9L17 14L18 20L12 17L6 20L7 14L3 9L9 8L12 2Z" stroke="currentColor" strokeWidth="1.8" fill="rgba(0,0,0,0.15)" />
                  </svg>
                </div>
              )}
              <span className={`font-space font-extrabold text-xl tracking-tight ${isDark ? 'text-[#F5F7F2]' : 'text-slate-900'}`}>
                {effectiveName === 'WayaheDigital' ? (
                  <>Wayahe<span className={isDark ? 'text-[#C7FF4D]' : 'text-amber-500'}>Digital</span></>
                ) : (
                  effectiveName
                )}
              </span>
            </div>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-[#A4ADA6]' : 'text-slate-500'} font-jakarta`}>
              Pusat isi ulang pulsa, paket data kuota internet, voucher WiFi RT/RW Net, dan top up game terpercaya, cepat, dan amanah.
            </p>
            <div className="flex items-center gap-3 text-xs pt-1 font-jakarta">
              <span className={`flex items-center gap-1 font-medium ${isDark ? 'text-[#F5F7F2]' : 'text-slate-700'}`}>
                <Clock size={14} className={isDark ? 'text-[#C7FF4D]' : 'text-amber-500'} />
                <span>Otomatis 24 Jam</span>
              </span>
              <span className={isDark ? 'text-[#3E4C41]' : 'text-slate-300'}>•</span>
              <span className="flex items-center gap-1 font-medium text-emerald-500">
                <ShieldCheck size={14} className="text-emerald-500" />
                <span>Pembayaran Terverifikasi</span>
              </span>
            </div>
          </div>

          {/* Kategori Produk */}
          <div>
            <h3 className={`${isDark ? 'text-[#F5F7F2] border-[#C7FF4D]' : 'text-slate-900 border-amber-500'} font-bold text-xs uppercase tracking-wider mb-4 border-l-2 pl-2.5 font-space`}>
              Katalog Layanan
            </h3>
            <ul className="space-y-2.5 text-xs font-jakarta">
              <li>
                <button
                  onClick={() => onNavigate('home')}
                  className={`${isDark ? 'hover:text-[#C7FF4D]' : 'hover:text-slate-900'} hover:translate-x-0.5 transition-all flex items-center gap-1.5 cursor-pointer text-left`}
                >
                  <ChevronRight size={13} className={isDark ? 'text-[#C7FF4D]' : 'text-amber-500'} />
                  <span>Top Up Game &amp; Diamond MLBB/FF</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('wifi')}
                  className={`${isDark ? 'hover:text-[#C7FF4D]' : 'hover:text-slate-900'} hover:translate-x-0.5 transition-all flex items-center gap-1.5 cursor-pointer text-left`}
                >
                  <ChevronRight size={13} className={isDark ? 'text-[#C7FF4D]' : 'text-amber-500'} />
                  <span>Voucher WiFi RT/RW Net Warga</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('pulsa')}
                  className={`${isDark ? 'hover:text-[#C7FF4D]' : 'hover:text-slate-900'} hover:translate-x-0.5 transition-all flex items-center gap-1.5 cursor-pointer text-left`}
                >
                  <ChevronRight size={13} className={isDark ? 'text-[#C7FF4D]' : 'text-amber-500'} />
                  <span>Pulsa Reguler Semua Operator</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('kuota')}
                  className={`${isDark ? 'hover:text-[#C7FF4D]' : 'hover:text-slate-900'} hover:translate-x-0.5 transition-all flex items-center gap-1.5 cursor-pointer text-left`}
                >
                  <ChevronRight size={13} className={isDark ? 'text-[#C7FF4D]' : 'text-amber-500'} />
                  <span>Paket Data Kuota Internet</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Bantuan & Navigasi */}
          <div>
            <h3 className={`${isDark ? 'text-[#F5F7F2] border-[#C7FF4D]' : 'text-slate-900 border-amber-500'} font-bold text-xs uppercase tracking-wider mb-4 border-l-2 pl-2.5 font-space`}>
              Navigasi &amp; Bantuan
            </h3>
            <ul className="space-y-2.5 text-xs font-jakarta">
              <li>
                <button
                  onClick={() => onNavigate('transaksi')}
                  className={`${isDark ? 'hover:text-[#C7FF4D]' : 'hover:text-slate-900'} hover:translate-x-0.5 transition-all flex items-center gap-1.5 cursor-pointer`}
                >
                  <ChevronRight size={13} className={isDark ? 'text-[#C7FF4D]' : 'text-amber-500'} />
                  <span>Lacak Pesanan &amp; Invoice</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('bantuan')}
                  className={`${isDark ? 'hover:text-[#C7FF4D]' : 'hover:text-slate-900'} hover:translate-x-0.5 transition-all flex items-center gap-1.5 cursor-pointer`}
                >
                  <ChevronRight size={13} className={isDark ? 'text-[#C7FF4D]' : 'text-amber-500'} />
                  <span>Pusat Bantuan &amp; FAQ</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('bantuan')}
                  className={`${isDark ? 'hover:text-[#C7FF4D]' : 'hover:text-slate-900'} hover:translate-x-0.5 transition-all flex items-center gap-1.5 cursor-pointer`}
                >
                  <ChevronRight size={13} className={isDark ? 'text-[#C7FF4D]' : 'text-amber-500'} />
                  <span>Syarat &amp; Ketentuan Layanan</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('bantuan')}
                  className={`${isDark ? 'hover:text-[#C7FF4D]' : 'hover:text-slate-900'} hover:translate-x-0.5 transition-all flex items-center gap-1.5 cursor-pointer`}
                >
                  <ChevronRight size={13} className={isDark ? 'text-[#C7FF4D]' : 'text-amber-500'} />
                  <span>Kebijakan Privasi</span>
                </button>
              </li>
              <li className={`pt-2 border-t ${isDark ? 'border-[#28302A]' : 'border-slate-100'}`}>
                <button
                  onClick={() => onNavigate('admin')}
                  className={`${isDark ? 'text-[#C7FF4D]' : 'text-amber-600 hover:text-amber-700'} font-semibold transition-colors flex items-center gap-1.5 text-xs cursor-pointer`}
                >
                  <ChevronRight size={13} className={isDark ? 'text-[#C7FF4D]' : 'text-amber-600'} />
                  <span>Portal Administrator</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Kontak Dukungan */}
          <div>
            <h3 className={`${isDark ? 'text-[#F5F7F2] border-[#C7FF4D]' : 'text-slate-900 border-amber-500'} font-bold text-xs uppercase tracking-wider mb-4 border-l-2 pl-2.5 font-space`}>
              Layanan Pelanggan
            </h3>
            <p className={`text-xs ${isDark ? 'text-[#A4ADA6]' : 'text-slate-500'} mb-3 font-jakarta`}>
              Ada kendala transaksi atau butuh bantuan layanan? Hubungi CS kami langsung.
            </p>
            <div className="space-y-2.5 text-xs font-jakarta">
              <a
                href={`https://wa.me/${(settings.supportWhatsApp || '0812-3456-7890').replace(/[^0-9]/g, '').replace(/^0/, '62')}`}
                target="_blank"
                rel="noreferrer"
                className={`flex items-center gap-2 ${isDark ? 'text-[#F5F7F2] hover:text-[#C7FF4D]' : 'text-slate-800 hover:text-emerald-600'} font-semibold transition-colors`}
              >
                <MessageCircle size={15} className="text-emerald-500" />
                <span>WhatsApp: {settings.supportWhatsApp || '0812-3456-7890'}</span>
              </a>
              <div className={`flex items-center gap-2 ${isDark ? 'text-[#A4ADA6]' : 'text-slate-600'}`}>
                <Mail size={15} className={isDark ? 'text-[#C7FF4D]' : 'text-amber-500'} />
                <span>{settings.supportEmail || 'bantuan@wayahedigital.id'}</span>
              </div>
              <div className={`flex items-center gap-2 ${isDark ? 'text-[#68736B]' : 'text-slate-500'} text-[11px] pt-1`}>
                <Headphones size={13} className={isDark ? 'text-[#68736B]' : 'text-slate-400'} />
                <span>{settings.supportHours || 'Respon ramah, cepat, dan solutif (24 Jam)'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className={`pt-8 border-t ${isDark ? 'border-[#28302A] text-[#68736B]' : 'border-slate-200 text-slate-400'} flex flex-col sm:flex-row items-center justify-between text-xs gap-4 font-jakarta`}>
          <p>© {new Date().getFullYear()} Wayahe Digital. All rights reserved.</p>
          <div className="flex items-center gap-4 text-[11px]">
            <button onClick={() => onNavigate('bantuan')} className={`${isDark ? 'hover:text-[#F5F7F2]' : 'hover:text-slate-800'} cursor-pointer`}>
              Syarat &amp; Ketentuan
            </button>
            <span className={isDark ? 'text-[#3E4C41]' : 'text-slate-300'}>•</span>
            <button onClick={() => onNavigate('bantuan')} className={`${isDark ? 'hover:text-[#F5F7F2]' : 'hover:text-slate-800'} cursor-pointer`}>
              Kebijakan Privasi
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
