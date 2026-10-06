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
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
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
      container: 'w-10 h-10 rounded-[10px]',
      svg: 'w-6 h-6',
      text: 'text-xs',
    },
    lg: {
      container: 'w-12 h-12 rounded-[12px]',
      svg: 'w-7 h-7',
      text: 'text-sm',
    },
    xl: {
      container: 'w-16 h-16 rounded-[16px]',
      svg: 'w-10 h-10',
      text: 'text-base',
    },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  // Normalized key for provider detection
  const pNorm = (provider || '').toLowerCase().trim();
  const nNorm = (name || '').toLowerCase().trim();

  // If custom iconUrl is provided and valid, render image
  if (iconUrl && !imageError) {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden shrink-0 bg-[#1D1814] ${
          showBadgeBorder ? 'border border-[#3E352B] shadow-xs' : ''
        } ${currentSize.container} ${className}`}
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
    // 1. TELKOMSEL
    if (pNorm.includes('telkomsel') || pNorm.includes('tsel') || nNorm.includes('telkomsel')) {
      return (
        <div className="w-full h-full bg-[#E00A1E] flex flex-col items-center justify-center text-white relative overflow-hidden">
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

    // 2. INDOSAT OOREDOO / IM3
    if (pNorm.includes('indosat') || pNorm.includes('isat') || pNorm.includes('im3') || nNorm.includes('indosat') || nNorm.includes('im3')) {
      return (
        <div className="w-full h-full bg-[#FFD100] flex items-center justify-center text-[#E00A1E] relative overflow-hidden font-black">
          <div className="flex flex-col items-center justify-center leading-none">
            <span className="text-[9px] sm:text-[10px] tracking-tighter text-[#E00A1E] font-black">im3</span>
            <div className="w-4 h-1 bg-[#E00A1E] rounded-full mt-0.5" />
          </div>
        </div>
      );
    }

    // 3. XL AXIATA
    if (pNorm.includes('xl') || nNorm.includes('xl axiata') || nNorm.includes('xtra combo')) {
      return (
        <div className="w-full h-full bg-[#002C6C] flex items-center justify-center text-white relative overflow-hidden font-black">
          <svg viewBox="0 0 40 40" className="w-[82%] h-[82%]">
            <rect width="40" height="40" rx="8" fill="#002C6C" />
            <path d="M9 11L18 29H13L9 19L5 29H0L9 11Z" fill="#00D284" />
            <path d="M16 11L25 29H20L16 19L12 29H7L16 11Z" fill="#00A2E8" />
            <text x="21" y="27" fill="#00D284" fontSize="17" fontWeight="900" fontFamily="sans-serif">XL</text>
          </svg>
        </div>
      );
    }

    // 4. AXIS
    if (pNorm.includes('axis') || nNorm.includes('axis') || nNorm.includes('bronet')) {
      return (
        <div className="w-full h-full bg-[#632276] flex items-center justify-center text-white relative overflow-hidden font-black">
          <div className="flex flex-col items-center justify-center">
            <span className="text-[10px] tracking-wider text-white font-black uppercase">AXIS</span>
            <span className="w-3 h-0.5 bg-[#E6007E] rounded-full mt-0.5" />
          </div>
        </div>
      );
    }

    // 5. TRI (3 INDONESIA)
    if (pNorm.includes('tri') || pNorm.includes('three') || nNorm.includes('tri') || nNorm.includes('alwayson')) {
      return (
        <div className="w-full h-full bg-[#111111] flex items-center justify-center text-white relative overflow-hidden font-black border border-slate-700">
          <span className="text-base sm:text-lg font-black text-[#FAF4EB] tracking-tighter">3</span>
        </div>
      );
    }

    // 6. SMARTFREN
    if (pNorm.includes('smartfren') || pNorm.includes('smart') || nNorm.includes('smartfren')) {
      return (
        <div className="w-full h-full bg-[#ED1C24] flex items-center justify-center text-white relative overflow-hidden font-black">
          <span className="text-[9px] font-black tracking-tighter uppercase text-white">smart</span>
        </div>
      );
    }

    // 7. SPOTIFY
    if (pNorm.includes('spotify') || nNorm.includes('spotify')) {
      return (
        <div className="w-full h-full bg-[#121212] flex items-center justify-center text-[#1DB954] relative overflow-hidden">
          <svg viewBox="0 0 24 24" className="w-[72%] h-[72%]" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.308c-.218.358-.682.474-1.04.256-2.853-1.744-6.446-2.14-10.677-1.173-.41.094-.817-.16-.91-.57-.094-.41.16-.817.57-.91 4.636-1.06 8.607-.613 11.802 1.34.358.218.474.682.256 1.057zm1.47-3.26c-.275.447-.858.591-1.305.316-3.266-2.008-8.246-2.59-12.11-1.416-.503.152-1.037-.134-1.189-.637-.152-.503.134-1.037.637-1.189 4.414-1.34 9.907-.694 13.652 1.61.447.275.591.858.316 1.336zm.126-3.393c-3.916-2.326-10.37-2.54-14.128-1.398-.6.182-1.237-.16-1.42-.76-.182-.6.16-1.237.76-1.42 4.314-1.31 11.44-1.06 15.952 1.62.54.32.716 1.02.395 1.56-.32.54-1.02.716-1.56.395z"/>
          </svg>
        </div>
      );
    }

    // 8. YOUTUBE / YOUTUBE PREMIUM
    if (pNorm.includes('youtube') || nNorm.includes('youtube')) {
      return (
        <div className="w-full h-full bg-[#FF0000] flex items-center justify-center text-white relative overflow-hidden">
          <svg viewBox="0 0 24 24" className="w-[68%] h-[68%]" fill="white">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        </div>
      );
    }

    // 9. CANVA
    if (pNorm.includes('canva') || nNorm.includes('canva')) {
      return (
        <div className="w-full h-full bg-gradient-to-tr from-[#00C4CC] to-[#7D2AE8] flex items-center justify-center text-white relative overflow-hidden font-bold">
          <span className="text-sm font-black italic tracking-tighter">C</span>
        </div>
      );
    }

    // 10. DISNEY+ HOTSTAR
    if (pNorm.includes('disney') || nNorm.includes('disney')) {
      return (
        <div className="w-full h-full bg-[#040D1C] border border-[#113CCF]/50 flex items-center justify-center text-white relative overflow-hidden">
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-extrabold text-[#2CCFF3] tracking-tighter">Disney+</span>
          </div>
        </div>
      );
    }

    // 11. MICROSOFT 365
    if (pNorm.includes('microsoft') || nNorm.includes('office') || nNorm.includes('365')) {
      return (
        <div className="w-full h-full bg-[#201A15] border border-[#3E352B] flex items-center justify-center p-2 relative overflow-hidden">
          <div className="grid grid-cols-2 gap-0.5 w-4 h-4">
            <div className="bg-[#F25022] rounded-[1px]" />
            <div className="bg-[#7FBA00] rounded-[1px]" />
            <div className="bg-[#00A4EF] rounded-[1px]" />
            <div className="bg-[#FFB900] rounded-[1px]" />
          </div>
        </div>
      );
    }

    // 12. MOBILE LEGENDS (MLBB)
    if (pNorm.includes('mobile legends') || pNorm.includes('mlbb') || nNorm.includes('mobile legends') || nNorm.includes('mlbb')) {
      return (
        <div className="w-full h-full bg-gradient-to-b from-[#1C2C4C] via-[#0E1626] to-[#080D18] border border-[#D4A359]/60 flex flex-col items-center justify-center text-[#D4A359] relative overflow-hidden">
          <svg viewBox="0 0 24 24" className="w-[65%] h-[65%]" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L4 7v6c0 5 8 9 8 9s8-4 8-9V7l-8-5z" fill="#D4A359" fillOpacity="0.2" />
            <path d="M12 2v18" stroke="#FAF4EB" strokeWidth="1.5" />
            <path d="M8 8l8 8M16 8l-8 8" stroke="#D4A359" strokeWidth="1.5" />
          </svg>
          <span className="text-[7px] font-black text-[#D4A359] tracking-tighter leading-none mt-0.5">MLBB</span>
        </div>
      );
    }

    // 13. FREE FIRE
    if (pNorm.includes('free fire') || pNorm.includes('ff') || nNorm.includes('free fire')) {
      return (
        <div className="w-full h-full bg-gradient-to-br from-[#E65100] via-[#C85A32] to-[#B71C1C] flex flex-col items-center justify-center text-white relative overflow-hidden shadow-xs">
          <Zap size={14} className="text-[#FFD000] fill-[#FFD000]" />
          <span className="text-[8px] font-black tracking-tighter text-white">FF</span>
        </div>
      );
    }

    // 14. PUBG MOBILE
    if (pNorm.includes('pubg') || nNorm.includes('pubg') || nNorm.includes('unknown cash')) {
      return (
        <div className="w-full h-full bg-[#1A1A1A] border border-[#F39C12] flex flex-col items-center justify-center text-[#F39C12] relative overflow-hidden">
          <div className="w-4 h-3 rounded-t-md bg-[#F39C12] flex items-center justify-center">
            <div className="w-2.5 h-1 bg-[#1A1A1A] rounded-xs" />
          </div>
          <span className="text-[7px] font-extrabold text-[#FAF4EB] tracking-tighter uppercase mt-0.5">PUBG</span>
        </div>
      );
    }

    // 15. GENSHIN IMPACT
    if (pNorm.includes('genshin') || nNorm.includes('genshin') || nNorm.includes('welkin')) {
      return (
        <div className="w-full h-full bg-gradient-to-tr from-[#1A2A6C] via-[#B21F1F] to-[#FDBB2D] flex items-center justify-center text-white relative overflow-hidden">
          <Sparkles size={16} className="text-[#FFE259]" />
        </div>
      );
    }

    // 16. VALORANT
    if (pNorm.includes('valorant') || nNorm.includes('valorant')) {
      return (
        <div className="w-full h-full bg-[#0F1923] border border-[#FF4655]/40 flex items-center justify-center text-[#FF4655] relative overflow-hidden">
          <svg viewBox="0 0 24 24" className="w-[70%] h-[70%]" fill="#FF4655">
            <path d="M4 4l8 16 8-16h-4l-4 8-4-8z"/>
          </svg>
        </div>
      );
    }

    // 17. STEAM WALLET
    if (pNorm.includes('steam') || nNorm.includes('steam')) {
      return (
        <div className="w-full h-full bg-gradient-to-b from-[#171A21] to-[#1B2838] flex items-center justify-center text-white relative overflow-hidden border border-[#3E352B]">
          <svg viewBox="0 0 24 24" className="w-[68%] h-[68%]" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.24-.099.576-.237.954-.396l-2.73-3.957a3.003 3.003 0 0 1-.431-1.534c0-1.657 1.343-3 3-3 .171 0 .338.016.501.045l3.298-4.78a5.006 5.006 0 1 1 7.201 5.435l-4.78 3.298c.029.163.045.33.045.501 0 1.657-1.343 3-3 3-.387 0-.75-.075-1.085-.209L7.02 23.824C8.61 23.94 10.285 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
          </svg>
        </div>
      );
    }

    // 18. ROBLOX
    if (pNorm.includes('roblox') || nNorm.includes('roblox')) {
      return (
        <div className="w-full h-full bg-[#181818] border border-[#555] flex items-center justify-center text-white relative overflow-hidden">
          <div className="w-4 h-4 bg-white rotate-12 flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-[#181818]" />
          </div>
        </div>
      );
    }

    // 19. WIFI RT/RW NET (Hotspot Warga)
    if (category === 'wifi' || pNorm.includes('net') || pNorm.includes('wifi') || nNorm.includes('melati') || nNorm.includes('warga') || nNorm.includes('griya')) {
      const isMelati = pNorm.includes('melati') || nNorm.includes('melati');
      const isWarga = pNorm.includes('warga') || nNorm.includes('warga');
      const bgGrad = isMelati 
        ? 'from-[#0D9488] to-[#115E59]' 
        : isWarga 
        ? 'from-[#4F46E5] to-[#3730A3]' 
        : 'from-[#D4A359] to-[#9E6F27]';

      return (
        <div className={`w-full h-full bg-gradient-to-br ${bgGrad} flex flex-col items-center justify-center text-white relative overflow-hidden`}>
          <Radio size={15} className="text-white drop-shadow-xs" />
          <span className="text-[7px] font-extrabold uppercase tracking-tighter leading-none mt-0.5">WIFI</span>
        </div>
      );
    }

    // 20. CATEGORY FALLBACKS
    if (category === 'pulsa') {
      return (
        <div className="w-full h-full bg-gradient-to-br from-[#C85A32] to-[#8C3415] flex items-center justify-center text-white">
          <Smartphone size={16} />
        </div>
      );
    }

    if (category === 'kuota') {
      return (
        <div className="w-full h-full bg-gradient-to-br from-[#0D9488] to-[#044E46] flex items-center justify-center text-white">
          <Wifi size={16} />
        </div>
      );
    }

    if (category === 'game') {
      return (
        <div className="w-full h-full bg-gradient-to-br from-[#D4A359] to-[#684C12] flex items-center justify-center text-[#181411]">
          <Gamepad2 size={16} />
        </div>
      );
    }

    if (category === 'premium') {
      return (
        <div className="w-full h-full bg-gradient-to-br from-[#84A951] to-[#3B5418] flex items-center justify-center text-white">
          <Sparkles size={16} />
        </div>
      );
    }

    // Default Fallback
    return (
      <div className="w-full h-full bg-[#201A15] text-[#D4A359] flex items-center justify-center font-bold">
        <Zap size={16} />
      </div>
    );
  };

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden shrink-0 ${
        showBadgeBorder ? 'border border-[#3E352B]/80 shadow-xs' : ''
      } ${currentSize.container} ${className}`}
    >
      {renderProviderSvg()}
    </div>
  );
};
