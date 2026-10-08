import React, { useState } from 'react';
import { 
  Gamepad2, 
  Radio, 
  Smartphone, 
  Wifi, 
  Sparkles,
  Zap
} from 'lucide-react';
import { CategoryType } from '../types';

interface ProductLogoProps {
  provider?: string;
  name?: string;
  category?: CategoryType;
  iconUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showBadgeBorder?: boolean;
}

export const ProductLogo: React.FC<ProductLogoProps> = ({
  provider = '',
  name = '',
  category,
  iconUrl,
  size = 'md',
  className = '',
  showBadgeBorder = true,
}) => {
  const [imageError, setImageError] = useState(false);

  // Size dimensions
  const sizeMap = {
    xs: {
      container: 'w-6 h-6 rounded-[6px]',
      svg: 'w-3.5 h-3.5',
      text: 'text-[9px]',
    },
    sm: {
      container: 'w-8 h-8 rounded-[8px]',
      svg: 'w-5 h-5',
      text: 'text-[10px]',
    },
    md: {
      container: 'w-11 h-11 rounded-xl',
      svg: 'w-6 h-6',
      text: 'text-xs',
    },
    lg: {
      container: 'w-14 h-14 rounded-2xl',
      svg: 'w-8 h-8',
      text: 'text-sm',
    },
    xl: {
      container: 'w-16 h-16 rounded-2xl',
      svg: 'w-10 h-10',
      text: 'text-base',
    },
    '2xl': {
      container: 'w-20 h-20 rounded-3xl',
      svg: 'w-12 h-12',
      text: 'text-lg',
    },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  // Normalized key for provider detection
  const pNorm = (provider || '').toLowerCase().trim();
  const nNorm = (name || '').toLowerCase().trim();

  // If custom iconUrl is provided and not an unsplash photo placeholder, render image
  const isUnsplash = Boolean(iconUrl && (iconUrl.includes('images.unsplash.com') || iconUrl.includes('unsplash.com')));
  const hasCustomDimensions = Boolean(className && className.includes('w-') && className.includes('h-'));
  const containerClasses = `${hasCustomDimensions ? '' : currentSize.container} ${className}`.trim();

  if (iconUrl && !isUnsplash && !imageError) {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden shrink-0 bg-[#1D1814] ${
          showBadgeBorder ? 'border border-[#3E352B] shadow-xs' : ''
        } ${containerClasses}`}
      >
        <img
          src={iconUrl}
          alt={provider || name || 'Logo'}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  // Render provider SVG Logo
  const renderProviderSvg = () => {
    // ==========================================
    // 1. TELCO OPERATORS
    // ==========================================

    // TELKOMSEL
    if (pNorm.includes('telkomsel') || pNorm.includes('tsel') || nNorm.includes('telkomsel')) {
      return (
        <div className="w-full h-full bg-[#E00A1E] flex flex-col items-center justify-center text-white relative overflow-hidden select-none">
          <svg viewBox="0 0 40 40" className="w-[78%] h-[78%]" fill="none">
            <rect width="40" height="40" rx="8" fill="#E00A1E" />
            <path
              d="M10 20C10 14.477 14.477 10 20 10C25.523 10 30 14.477 30 20C30 25.523 25.523 30 20 30"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx="20" cy="20" r="4.5" fill="white" />
            <path d="M26 12L32 6" stroke="#FFD000" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
      );
    }

    // INDOSAT OOREDOO / IM3
    if (pNorm.includes('indosat') || pNorm.includes('isat') || pNorm.includes('im3') || nNorm.includes('indosat') || nNorm.includes('im3')) {
      return (
        <div className="w-full h-full bg-[#FFD100] flex items-center justify-center text-[#E00A1E] relative overflow-hidden font-black select-none">
          <div className="flex flex-col items-center justify-center leading-none">
            <span className="text-[11px] sm:text-xs tracking-tighter text-[#E00A1E] font-black">im3</span>
            <div className="w-4 h-1 bg-[#E00A1E] rounded-full mt-0.5" />
          </div>
        </div>
      );
    }

    // XL AXIATA
    if (pNorm.includes('xl') || nNorm.includes('xl axiata') || nNorm.includes('xtra combo')) {
      return (
        <div className="w-full h-full bg-[#002C6C] flex items-center justify-center text-white relative overflow-hidden font-black select-none">
          <svg viewBox="0 0 40 40" className="w-[82%] h-[82%]">
            <rect width="40" height="40" rx="8" fill="#002C6C" />
            <path d="M9 11L18 29H13L9 19L5 29H0L9 11Z" fill="#00D284" />
            <path d="M16 11L25 29H20L16 19L12 29H7L16 11Z" fill="#00A2E8" />
            <text x="21" y="27" fill="#00D284" fontSize="17" fontWeight="900" fontFamily="sans-serif">XL</text>
          </svg>
        </div>
      );
    }

    // AXIS
    if (pNorm.includes('axis') || nNorm.includes('axis') || nNorm.includes('bronet')) {
      return (
        <div className="w-full h-full bg-[#632276] flex items-center justify-center text-white relative overflow-hidden font-black select-none">
          <div className="flex flex-col items-center justify-center">
            <span className="text-[11px] tracking-wider text-white font-black uppercase">AXIS</span>
            <span className="w-4 h-0.5 bg-[#E6007E] rounded-full mt-0.5" />
          </div>
        </div>
      );
    }

    // TRI (3 INDONESIA)
    if (pNorm.includes('tri') || pNorm.includes('three') || nNorm.includes('tri') || nNorm.includes('alwayson')) {
      return (
        <div className="w-full h-full bg-[#111111] flex items-center justify-center text-white relative overflow-hidden font-black border border-slate-700 select-none">
          <span className="text-lg sm:text-xl font-black text-[#FAF4EB] tracking-tighter">3</span>
        </div>
      );
    }

    // SMARTFREN
    if (pNorm.includes('smartfren') || pNorm.includes('smart') || nNorm.includes('smartfren')) {
      return (
        <div className="w-full h-full bg-[#ED1C24] flex items-center justify-center text-white relative overflow-hidden font-black select-none">
          <span className="text-[10px] sm:text-xs font-black tracking-tighter uppercase text-white">smart</span>
        </div>
      );
    }

    // ==========================================
    // 2. APLIKASI PREMIUM & STREAMING & AI
    // ==========================================

    // NETFLIX
    if (pNorm.includes('netflix') || nNorm.includes('netflix')) {
      return (
        <div className="w-full h-full bg-[#141414] flex items-center justify-center relative overflow-hidden select-none">
          <svg viewBox="0 0 32 32" className="w-[66%] h-[66%]" fill="none">
            <path d="M7 4h5.2v24H7z" fill="#B81D24" />
            <path d="M19.8 4H25v24h-5.2z" fill="#B81D24" />
            <path d="M7 4h5.2l7.6 24h-5.2z" fill="#E50914" />
          </svg>
        </div>
      );
    }

    // SPOTIFY
    if (pNorm.includes('spotify') || nNorm.includes('spotify')) {
      return (
        <div className="w-full h-full bg-[#121212] flex items-center justify-center text-[#1DB954] relative overflow-hidden select-none">
          <svg viewBox="0 0 24 24" className="w-[72%] h-[72%]" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.308c-.218.358-.682.474-1.04.256-2.853-1.744-6.446-2.14-10.677-1.173-.41.094-.817-.16-.91-.57-.094-.41.16-.817.57-.91 4.636-1.06 8.607-.613 11.802 1.34.358.218.474.682.256 1.057zm1.47-3.26c-.275.447-.858.591-1.305.316-3.266-2.008-8.246-2.59-12.11-1.416-.503.152-1.037-.134-1.189-.637-.152-.503.134-1.037.637-1.189 4.414-1.34 9.907-.694 13.652 1.61.447.275.591.858.316 1.336zm.126-3.393c-3.916-2.326-10.37-2.54-14.128-1.398-.6.182-1.237-.16-1.42-.76-.182-.6.16-1.237.76-1.42 4.314-1.31 11.44-1.06 15.952 1.62.54.32.716 1.02.395 1.56-.32.54-1.02.716-1.56.395z"/>
          </svg>
        </div>
      );
    }

    // YOUTUBE / YOUTUBE PREMIUM
    if (pNorm.includes('youtube') || nNorm.includes('youtube')) {
      return (
        <div className="w-full h-full bg-[#FF0000] flex items-center justify-center text-white relative overflow-hidden select-none">
          <svg viewBox="0 0 24 24" className="w-[68%] h-[68%]" fill="white">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        </div>
      );
    }

    // DISNEY+ / HOTSTAR
    if (pNorm.includes('disney') || nNorm.includes('disney') || pNorm.includes('hotstar') || nNorm.includes('hotstar')) {
      return (
        <div className="w-full h-full bg-[#040714] border border-[#113CCF]/40 flex items-center justify-center text-white relative overflow-hidden select-none">
          <svg viewBox="0 0 44 28" className="w-[80%] h-[80%]" fill="none">
            <path d="M5 8c8-7 24-7 34 2" stroke="#00D8FF" strokeWidth="2.8" strokeLinecap="round" />
            <text x="22" y="22" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="900" fontFamily="sans-serif" letterSpacing="-0.5">
              Disney+
            </text>
          </svg>
        </div>
      );
    }

    // VIU
    if (pNorm.includes('viu') || nNorm.includes('viu')) {
      return (
        <div className="w-full h-full bg-[#FFB800] flex items-center justify-center text-[#111111] select-none">
          <span className="text-xs sm:text-sm font-black tracking-tighter uppercase font-sans">VIU</span>
        </div>
      );
    }

    // VIDIO
    if (pNorm.includes('vidio') || nNorm.includes('vidio')) {
      return (
        <div className="w-full h-full bg-[#EE2737] flex items-center justify-center text-white relative select-none">
          <svg viewBox="0 0 24 24" className="w-[65%] h-[65%]" fill="white">
            <path d="M4 4l8 16 8-16h-4.5l-3.5 8.5L8.5 4H4z" />
          </svg>
        </div>
      );
    }

    // APPLE MUSIC
    if (pNorm.includes('apple') || nNorm.includes('apple music')) {
      return (
        <div className="w-full h-full bg-gradient-to-tr from-[#FC3C44] via-[#FA233B] to-[#F94C57] flex items-center justify-center text-white select-none">
          <svg viewBox="0 0 24 24" className="w-[66%] h-[66%]" fill="white">
            <path d="M19.5 3.2c-.3-.2-.7-.2-1-.1l-10 2.5c-.3.1-.5.3-.5.6V15c-.8-.5-1.9-.8-3-.8C2.2 14.2 0 15.8 0 17.8s2.2 3.6 5 3.6 5-1.6 5-3.6V9.8l8-2v5.4c-.8-.5-1.9-.8-3-.8-2.8 0-5 1.6-5 3.6s2.2 3.6 5 3.6 5-1.6 5-3.6V3.8c0-.3-.2-.5-.5-.6z" />
          </svg>
        </div>
      );
    }

    // CANVA
    if (pNorm.includes('canva') || nNorm.includes('canva')) {
      return (
        <div className="w-full h-full bg-gradient-to-tr from-[#00C4CC] via-[#3B66EE] to-[#7D2AE8] flex items-center justify-center text-white select-none">
          <span className="text-base sm:text-lg font-black italic tracking-tighter">C</span>
        </div>
      );
    }

    // CAPCUT
    if (pNorm.includes('capcut') || nNorm.includes('capcut')) {
      return (
        <div className="w-full h-full bg-black flex items-center justify-center text-white select-none">
          <svg viewBox="0 0 32 32" className="w-[68%] h-[68%]" fill="white">
            <path d="M5 8h9l-5 8 5 8H5l5-8z" />
            <path d="M27 8h-9l5 8-5 8h9l-5-8z" />
          </svg>
        </div>
      );
    }

    // ADOBE LIGHTROOM
    if (pNorm.includes('lightroom') || nNorm.includes('lightroom') || pNorm.includes('adobe')) {
      return (
        <div className="w-full h-full bg-[#001E36] border border-[#31A8FF]/60 flex items-center justify-center select-none">
          <span className="text-xs sm:text-sm font-black text-[#31A8FF] tracking-tight">Lr</span>
        </div>
      );
    }

    // CHATGPT / OPENAI
    if (pNorm.includes('chatgpt') || nNorm.includes('chatgpt') || pNorm.includes('openai') || nNorm.includes('openai') || nNorm.includes('gpt')) {
      return (
        <div className="w-full h-full bg-[#10A37F] flex items-center justify-center text-white select-none">
          <svg viewBox="0 0 24 24" className="w-[68%] h-[68%]" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a4 4 0 0 0-3.8 2.7 4 4 0 0 0-4 3.5A4 4 0 0 0 3 12a4 4 0 0 0 1.2 3.8 4 4 0 0 0 4 3.5 4 4 0 0 0 3.8 2.7 4 4 0 0 0 3.8-2.7 4 4 0 0 0 4-3.5A4 4 0 0 0 21 12a4 4 0 0 0-1.2-3.8 4 4 0 0 0-4-3.5A4 4 0 0 0 12 2z" />
            <circle cx="12" cy="12" r="3" fill="currentColor" />
          </svg>
        </div>
      );
    }

    // CLAUDE / ANTHROPIC
    if (pNorm.includes('claude') || nNorm.includes('claude') || pNorm.includes('anthropic')) {
      return (
        <div className="w-full h-full bg-[#CC6B49] flex items-center justify-center text-white select-none">
          <svg viewBox="0 0 24 24" className="w-[68%] h-[68%]" fill="currentColor">
            <path d="M12 2L13.8 8.6L20 7L15.4 12L20 17L13.8 15.4L12 22L10.2 15.4L4 17L8.6 12L4 7L10.2 8.6L12 2Z" />
          </svg>
        </div>
      );
    }

    // MICROSOFT 365 / OFFICE
    if (pNorm.includes('microsoft') || nNorm.includes('office') || nNorm.includes('365')) {
      return (
        <div className="w-full h-full bg-[#1E1E1E] border border-[#3E352B] flex items-center justify-center select-none">
          <div className="grid grid-cols-2 gap-1 w-5 h-5">
            <div className="bg-[#F25022] rounded-[1px]" />
            <div className="bg-[#7FBA00] rounded-[1px]" />
            <div className="bg-[#00A4EF] rounded-[1px]" />
            <div className="bg-[#FFB900] rounded-[1px]" />
          </div>
        </div>
      );
    }

    // GOOGLE GEMINI
    if (pNorm.includes('gemini') || nNorm.includes('gemini')) {
      return (
        <div className="w-full h-full bg-[#13161C] border border-blue-500/30 flex items-center justify-center select-none">
          <svg viewBox="0 0 24 24" className="w-[70%] h-[70%]" fill="none">
            <path d="M12 2C12 7.5 7.5 12 2 12C7.5 12 12 16.5 12 22C12 16.5 16.5 12 22 12C16.5 12 12 7.5 12 2Z" fill="url(#geminiGrad)" />
            <defs>
              <linearGradient id="geminiGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="#4E8CFF" />
                <stop offset="1" stopColor="#B57EDC" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      );
    }

    // GOOGLE ONE / DRIVE
    if (pNorm.includes('google') || nNorm.includes('google')) {
      return (
        <div className="w-full h-full bg-white flex items-center justify-center select-none shadow-xs">
          <svg viewBox="0 0 24 24" className="w-[72%] h-[72%]" fill="none">
            <path d="M12 4v16" stroke="#4285F4" strokeWidth="3" strokeLinecap="round" />
            <path d="M8 8l4-4" stroke="#EA4335" strokeWidth="3" strokeLinecap="round" />
            <path d="M8 20h8" stroke="#34A853" strokeWidth="3" strokeLinecap="round" />
            <circle cx="16" cy="10" r="2.5" fill="#FBBC05" />
          </svg>
        </div>
      );
    }

    // DUOLINGO
    if (pNorm.includes('duolingo') || nNorm.includes('duolingo')) {
      return (
        <div className="w-full h-full bg-[#58CC02] flex flex-col items-center justify-center text-white select-none">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-white flex items-center justify-center">
              <div className="w-1.2 h-1.2 rounded-full bg-slate-900" />
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-white flex items-center justify-center">
              <div className="w-1.2 h-1.2 rounded-full bg-slate-900" />
            </div>
          </div>
          <div className="w-2.5 h-1.2 bg-[#FF9600] rounded-b-full mt-0.5" />
        </div>
      );
    }

    // GRAMMARLY
    if (pNorm.includes('grammarly') || nNorm.includes('grammarly')) {
      return (
        <div className="w-full h-full bg-[#15C39A] flex items-center justify-center text-white select-none">
          <span className="text-sm sm:text-base font-black">G</span>
        </div>
      );
    }

    // DEEPSEEK
    if (pNorm.includes('deepseek') || nNorm.includes('deepseek')) {
      return (
        <div className="w-full h-full bg-[#0F172A] border border-blue-500/40 flex items-center justify-center text-blue-400 select-none">
          <svg viewBox="0 0 24 24" className="w-[68%] h-[68%]" fill="currentColor">
            <path d="M12 2c-4 4-8 8-8 13 0 4 3 7 8 7s8-3 8-7c0-5-4-9-8-13zm0 17c-2.8 0-5-2.2-5-5 0-2.5 2-5 5-8 3 3 5 5.5 5 8 0 2.8-2.2 5-5 5z"/>
          </svg>
        </div>
      );
    }

    // MIDJOURNEY
    if (pNorm.includes('midjourney') || nNorm.includes('midjourney')) {
      return (
        <div className="w-full h-full bg-[#0B0B0C] flex items-center justify-center text-white select-none">
          <svg viewBox="0 0 24 24" className="w-[68%] h-[68%]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 18h16M7 18l5-14 5 14M12 4v14" />
          </svg>
        </div>
      );
    }

    // CLOUVIA
    if (pNorm.includes('clouvia') || nNorm.includes('clouvia')) {
      return (
        <div className="w-full h-full bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-white select-none font-bold">
          <span className="text-xs sm:text-sm font-black tracking-tight">AI</span>
        </div>
      );
    }

    // NORDVPN
    if (pNorm.includes('nordvpn') || nNorm.includes('nordvpn') || (pNorm.includes('nord') && !pNorm.includes('indosat'))) {
      return (
        <div className="w-full h-full bg-[#003B95] flex items-center justify-center text-white select-none">
          <svg viewBox="0 0 24 24" className="w-[68%] h-[68%]" fill="currentColor">
            <path d="M12 3L2 19h20L12 3zm0 4.5l6.5 10.5H5.5L12 7.5z" />
          </svg>
        </div>
      );
    }

    // EXPRESSVPN
    if (pNorm.includes('expressvpn') || nNorm.includes('expressvpn')) {
      return (
        <div className="w-full h-full bg-[#DA3940] flex items-center justify-center text-white select-none">
          <span className="text-xs sm:text-sm font-black tracking-tighter">VPN</span>
        </div>
      );
    }

    // PRIME VIDEO
    if (pNorm.includes('prime') || nNorm.includes('prime video') || pNorm.includes('amazon')) {
      return (
        <div className="w-full h-full bg-[#00050D] flex items-center justify-center text-[#00A8E1] select-none">
          <svg viewBox="0 0 24 24" className="w-[70%] h-[70%]" fill="currentColor">
            <path d="M3 13.5C7 17 17 17 21 13.5c.3-.3.8-.1.7.4-.6 1.8-6.7 4.1-10.7 4.1S3.6 15.7 3 13.9c-.1-.5.4-.7.7-.4z"/>
            <path d="M18.5 14.5l2.5-1-1 2.5z"/>
          </svg>
        </div>
      );
    }

    // WETV
    if (pNorm.includes('wetv') || nNorm.includes('wetv')) {
      return (
        <div className="w-full h-full bg-[#FF5500] flex items-center justify-center text-white font-black select-none">
          <span className="text-[10px] sm:text-xs font-black tracking-tight">WeTV</span>
        </div>
      );
    }

    // IQIYI
    if (pNorm.includes('iqiyi') || nNorm.includes('iqiyi')) {
      return (
        <div className="w-full h-full bg-[#00CC36] flex items-center justify-center text-white font-black select-none">
          <span className="text-[10px] sm:text-xs font-black tracking-tight">iQIYI</span>
        </div>
      );
    }

    // HBO / MAX
    if (pNorm.includes('hbo') || nNorm.includes('hbo') || pNorm.includes('max') || nNorm.includes('max')) {
      return (
        <div className="w-full h-full bg-[#002BE7] flex items-center justify-center text-white font-black select-none">
          <span className="text-[10px] sm:text-xs font-black tracking-wider">MAX</span>
        </div>
      );
    }

    // ==========================================
    // 3. GAME CATEGORIES
    // ==========================================

    // MOBILE LEGENDS (MLBB)
    if (pNorm.includes('mobile legends') || pNorm.includes('mlbb') || nNorm.includes('mobile legends') || nNorm.includes('mlbb')) {
      return (
        <div className="w-full h-full bg-gradient-to-b from-[#1C2C4C] via-[#0E1626] to-[#080D18] border border-[#D4A359]/60 flex flex-col items-center justify-center text-[#D4A359] relative overflow-hidden select-none">
          <svg viewBox="0 0 24 24" className="w-[65%] h-[65%]" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L4 7v6c0 5 8 9 8 9s8-4 8-9V7l-8-5z" fill="#D4A359" fillOpacity="0.2" />
            <path d="M12 2v18" stroke="#FAF4EB" strokeWidth="1.5" />
            <path d="M8 8l8 8M16 8l-8 8" stroke="#D4A359" strokeWidth="1.5" />
          </svg>
          <span className="text-[7px] font-black text-[#D4A359] tracking-tighter leading-none mt-0.5">MLBB</span>
        </div>
      );
    }

    // FREE FIRE
    if (pNorm.includes('free fire') || pNorm.includes('ff') || nNorm.includes('free fire')) {
      return (
        <div className="w-full h-full bg-gradient-to-br from-[#E65100] via-[#C85A32] to-[#B71C1C] flex flex-col items-center justify-center text-white relative overflow-hidden shadow-xs select-none">
          <Zap size={14} className="text-[#FFD000] fill-[#FFD000]" />
          <span className="text-[8px] font-black tracking-tighter text-white">FF</span>
        </div>
      );
    }

    // PUBG MOBILE
    if (pNorm.includes('pubg') || nNorm.includes('pubg') || nNorm.includes('unknown cash')) {
      return (
        <div className="w-full h-full bg-[#1A1A1A] border border-[#F39C12] flex flex-col items-center justify-center text-[#F39C12] relative overflow-hidden select-none">
          <div className="w-4 h-3 rounded-t-md bg-[#F39C12] flex items-center justify-center">
            <div className="w-2.5 h-1 bg-[#1A1A1A] rounded-xs" />
          </div>
          <span className="text-[7px] font-extrabold text-[#FAF4EB] tracking-tighter uppercase mt-0.5">PUBG</span>
        </div>
      );
    }

    // GENSHIN IMPACT
    if (pNorm.includes('genshin') || nNorm.includes('genshin') || nNorm.includes('welkin')) {
      return (
        <div className="w-full h-full bg-gradient-to-tr from-[#1A2A6C] via-[#B21F1F] to-[#FDBB2D] flex items-center justify-center text-white relative overflow-hidden select-none">
          <Sparkles size={16} className="text-[#FFE259]" />
        </div>
      );
    }

    // VALORANT
    if (pNorm.includes('valorant') || nNorm.includes('valorant')) {
      return (
        <div className="w-full h-full bg-[#0F1923] border border-[#FF4655]/40 flex items-center justify-center text-[#FF4655] relative overflow-hidden select-none">
          <svg viewBox="0 0 24 24" className="w-[70%] h-[70%]" fill="#FF4655">
            <path d="M4 4l8 16 8-16h-4l-4 8-4-8z"/>
          </svg>
        </div>
      );
    }

    // STEAM WALLET
    if (pNorm.includes('steam') || nNorm.includes('steam')) {
      return (
        <div className="w-full h-full bg-gradient-to-b from-[#171A21] to-[#1B2838] flex items-center justify-center text-white relative overflow-hidden border border-[#3E352B] select-none">
          <svg viewBox="0 0 24 24" className="w-[68%] h-[68%]" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.24-.099.576-.237.954-.396l-2.73-3.957a3.003 3.003 0 0 1-.431-1.534c0-1.657 1.343-3 3-3 .171 0 .338.016.501.045l3.298-4.78a5.006 5.006 0 1 1 7.201 5.435l-4.78 3.298c.029.163.045.33.045.501 0 1.657-1.343 3-3 3-.387 0-.75-.075-1.085-.209L7.02 23.824C8.61 23.94 10.285 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
          </svg>
        </div>
      );
    }

    // ROBLOX
    if (pNorm.includes('roblox') || nNorm.includes('roblox')) {
      return (
        <div className="w-full h-full bg-[#181818] border border-[#555] flex items-center justify-center text-white relative overflow-hidden select-none">
          <div className="w-4 h-4 bg-white rotate-12 flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-[#181818]" />
          </div>
        </div>
      );
    }

    // ==========================================
    // 4. WIFI RT/RW NET (Hotspot Warga)
    // ==========================================
    if (category === 'wifi' || pNorm.includes('net') || pNorm.includes('wifi') || nNorm.includes('melati') || nNorm.includes('warga') || nNorm.includes('griya')) {
      const isMelati = pNorm.includes('melati') || nNorm.includes('melati');
      const isWarga = pNorm.includes('warga') || nNorm.includes('warga');
      const bgGrad = isMelati 
        ? 'from-[#0D9488] to-[#115E59]' 
        : isWarga 
        ? 'from-[#4F46E5] to-[#3730A3]' 
        : 'from-[#D4A359] to-[#9E6F27]';

      return (
        <div className={`w-full h-full bg-gradient-to-br ${bgGrad} flex flex-col items-center justify-center text-white relative overflow-hidden select-none`}>
          <Radio size={16} className="text-white drop-shadow-xs" />
          <span className="text-[7px] font-extrabold uppercase tracking-tighter leading-none mt-0.5">WIFI</span>
        </div>
      );
    }

    // ==========================================
    // 5. CATEGORY FALLBACKS
    // ==========================================
    if (category === 'pulsa') {
      return (
        <div className="w-full h-full bg-gradient-to-br from-[#C85A32] to-[#8C3415] flex items-center justify-center text-white select-none">
          <Smartphone size={16} />
        </div>
      );
    }

    if (category === 'kuota') {
      return (
        <div className="w-full h-full bg-gradient-to-br from-[#0D9488] to-[#044E46] flex items-center justify-center text-white select-none">
          <Wifi size={16} />
        </div>
      );
    }

    if (category === 'game') {
      return (
        <div className="w-full h-full bg-gradient-to-br from-[#D4A359] to-[#684C12] flex items-center justify-center text-[#181411] select-none">
          <Gamepad2 size={16} />
        </div>
      );
    }

    // Premium App Fallback: clean, elegant initial or sparkles badge
    if (category === 'premium') {
      const initial = (provider || name || 'P').charAt(0).toUpperCase();
      return (
        <div className="w-full h-full bg-gradient-to-br from-[#251E18] via-[#1D1814] to-[#14100D] border border-[#D4A359]/30 flex items-center justify-center text-[#D4A359] relative overflow-hidden select-none">
          <span className="text-base sm:text-lg font-black tracking-wider text-[#D4A359]">
            {initial}
          </span>
          <Sparkles size={10} className="text-[#D4A359]/70 absolute top-1.5 right-1.5" />
        </div>
      );
    }

    // Default Fallback
    return (
      <div className="w-full h-full bg-[#201A15] text-[#D4A359] flex items-center justify-center font-bold select-none">
        <Zap size={16} />
      </div>
    );
  };

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden shrink-0 ${
        showBadgeBorder ? 'border border-[#3E352B]/80 shadow-xs' : ''
      } ${containerClasses}`}
    >
      {renderProviderSvg()}
    </div>
  );
};
