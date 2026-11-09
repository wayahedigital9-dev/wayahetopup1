import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Gamepad2, 
  Sparkles, 
  Zap, 
  Check, 
  ShieldCheck, 
  ArrowRight,
  Info,
  Server,
  Lock,
  Flame,
  Clock,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { Product } from '../types';
import { formatRupiah } from '../utils/operator';

export interface SelectedGameInfo {
  id: string;
  title: string;
  publisher: string;
  rating?: string;
  image?: string;
  tag?: string;
  provider: string;
}

interface GameTopUpModalProps {
  isOpen: boolean;
  game: SelectedGameInfo | null;
  products: Product[];
  allGames?: SelectedGameInfo[];
  onSelectGame?: (game: SelectedGameInfo) => void;
  onClose: () => void;
  onCheckout: (product: Product, targetAccount: string) => void;
  onShowToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// Built-in authentic denomination packages for games to ensure catalog is never empty
const DEFAULT_GAME_DENOMINATIONS: Record<string, Array<{ id: string; name: string; price: number; badge?: string; type?: 'currency' | 'pass' | 'special' }>> = {
  mlbb: [
    { id: '3d', name: '3 Diamonds', price: 1500, type: 'currency' },
    { id: '12d', name: '12 Diamonds', price: 3800, type: 'currency' },
    { id: '53d', name: '53 Diamonds', price: 14500, type: 'currency' },
    { id: '86d', name: '86 Diamonds', price: 21900, badge: 'POPULER', type: 'currency' },
    { id: '172d', name: '172 Diamonds', price: 43500, type: 'currency' },
    { id: '257d', name: '257 Diamonds', price: 64900, badge: 'HEMAT', type: 'currency' },
    { id: 'wdp', name: 'Weekly Diamond Pass', price: 28500, badge: 'BEST SELLER', type: 'pass' },
    { id: 'twilight', name: 'Twilight Pass', price: 145000, badge: 'VIP', type: 'pass' },
    { id: '706d', name: '706 Diamonds', price: 175000, type: 'currency' },
    { id: '2195d', name: '2195 Diamonds', price: 525000, type: 'currency' }
  ],
  ff: [
    { id: '5d', name: '5 Diamonds', price: 1000, type: 'currency' },
    { id: '70d', name: '70 Diamonds', price: 9500, badge: 'POPULER', type: 'currency' },
    { id: '140d', name: '140 Diamonds', price: 19000, type: 'currency' },
    { id: '355d', name: '355 Diamonds', price: 48000, type: 'currency' },
    { id: '720d', name: '720 Diamonds', price: 95000, badge: 'HEMAT', type: 'currency' },
    { id: 'member_w', name: 'Membership Mingguan', price: 29000, badge: 'BEST SELLER', type: 'pass' },
    { id: 'member_m', name: 'Membership Bulanan', price: 115000, type: 'pass' },
    { id: '2180d', name: '2180 Diamonds', price: 285000, type: 'currency' }
  ],
  pubgm: [
    { id: '60uc', name: '60 UC', price: 14500, type: 'currency' },
    { id: '325uc', name: '325 UC', price: 74000, badge: 'POPULER', type: 'currency' },
    { id: '660uc', name: '660 UC', price: 148000, badge: 'BEST SELLER', type: 'currency' },
    { id: '1800uc', name: '1800 UC', price: 370000, type: 'currency' },
    { id: '3850uc', name: '3850 UC', price: 740000, type: 'currency' },
    { id: '8100uc', name: '8100 UC', price: 1480000, type: 'currency' }
  ],
  valorant: [
    { id: '125vp', name: '125 Points (VP)', price: 14000, type: 'currency' },
    { id: '420vp', name: '420 Points (VP)', price: 45000, type: 'currency' },
    { id: '700vp', name: '700 Points (VP)', price: 75000, badge: 'POPULER', type: 'currency' },
    { id: '1375vp', name: '1375 Points (VP)', price: 145000, badge: 'BEST SELLER', type: 'currency' },
    { id: '2400vp', name: '2400 Points (VP)', price: 245000, type: 'currency' },
    { id: '4000vp', name: '4000 Points (VP)', price: 395000, type: 'currency' }
  ],
  genshin: [
    { id: 'welkin', name: 'Blessing of Welkin Moon', price: 65000, badge: 'BEST SELLER', type: 'pass' },
    { id: '60gc', name: '60 Genesis Crystals', price: 16500, type: 'currency' },
    { id: '330gc', name: '300+30 Genesis Crystals', price: 75000, badge: 'POPULER', type: 'currency' },
    { id: '1090gc', name: '980+110 Genesis Crystals', price: 235000, type: 'currency' },
    { id: '2240gc', name: '1980+260 Genesis Crystals', price: 465000, type: 'currency' },
    { id: '3880gc', name: '3280+600 Genesis Crystals', price: 775000, type: 'currency' }
  ],
  hok: [
    { id: '16tk', name: '16 Tokens', price: 3500, type: 'currency' },
    { id: '80tk', name: '80 Tokens', price: 16500, type: 'currency' },
    { id: '257tk', name: '240+17 Tokens', price: 49000, badge: 'POPULER', type: 'currency' },
    { id: '432tk', name: '400+32 Tokens', price: 79000, type: 'currency' },
    { id: '895tk', name: '800+95 Tokens', price: 159000, type: 'currency' },
    { id: 'weekly_card', name: 'Weekly Card', price: 15000, badge: 'BEST SELLER', type: 'pass' }
  ],
  magicchess: [
    { id: '50mc', name: '50 Diamonds', price: 14700, type: 'currency' },
    { id: '100mc', name: '100 Diamonds', price: 29000, type: 'currency' },
    { id: '250mc', name: '250 Diamonds', price: 72000, badge: 'POPULER', type: 'currency' },
    { id: 'pass_vip', name: 'Chess Pass VIP', price: 45000, badge: 'BEST SELLER', type: 'pass' }
  ],
  pb: [
    { id: '1200pb', name: '1.200 PB Cash', price: 11500, type: 'currency' },
    { id: '2400pb', name: '2.400 PB Cash', price: 22500, type: 'currency' },
    { id: '6000pb', name: '6.000 PB Cash', price: 54000, badge: 'POPULER', type: 'currency' },
    { id: '12000pb', name: '12.000 PB Cash', price: 105000, type: 'currency' },
    { id: '24000pb', name: '24.000 PB Cash', price: 205000, type: 'currency' }
  ],
  codm: [
    { id: '31cp', name: '31 CP', price: 5000, type: 'currency' },
    { id: '63cp', name: '63 CP', price: 10000, type: 'currency' },
    { id: '128cp', name: '128 CP', price: 20000, type: 'currency' },
    { id: '321cp', name: '321 CP', price: 50000, badge: 'POPULER', type: 'currency' },
    { id: '645cp', name: '645 CP', price: 10000, badge: 'BEST SELLER', type: 'currency' },
    { id: '800cp', name: '800 CP', price: 125000, type: 'currency' }
  ],
  roblox: [
    { id: '80rbx', name: '80 Robux', price: 15000, type: 'currency' },
    { id: '160rbx', name: '160 Robux', price: 30000, type: 'currency' },
    { id: '400rbx', name: '400 Robux', price: 75000, badge: 'POPULER', type: 'currency' },
    { id: '800rbx', name: '800 Robux', price: 149000, badge: 'BEST SELLER', type: 'currency' },
    { id: '1700rbx', name: '1.700 Robux', price: 310000, type: 'currency' },
    { id: 'gc100k', name: 'Gift Card IDR 100.000', price: 102000, badge: 'VOUCHER', type: 'special' }
  ]
};

// Strips repetitive prefix from product names so diamonds display cleanly without "..."
const cleanItemName = (name: string, gameTitle: string): string => {
  let n = name;
  const prefixes = [
    gameTitle, 
    'MOBILE LEGENDS', 
    'Mobile Legends', 
    'FREE FIRE', 
    'Free Fire', 
    'PUBG MOBILE', 
    'PUBG Mobile',
    'VALORANT', 
    'GENSHIN IMPACT', 
    'Genshin Impact',
    'HONOR OF KINGS', 
    'Honor of Kings',
    'POINT BLANK', 
    'Point Blank',
    'ROBLOX', 
    'Roblox',
    'CALL OF DUTY', 
    'Call of Duty'
  ];
  for (const p of prefixes) {
    const regex = new RegExp(`^${p}\\s*[-–:]?\\s*`, 'i');
    n = n.replace(regex, '');
  }
  return n.trim() || name;
};

// Helper to check whether a product is available from upstream API / stock
export const isGameProductAvailable = (p: Product): boolean => {
  if (p.isActive === false) return false;
  if (p.sellerProductStatus === false) return false;
  if (p.unlimitedStock === false && p.stock !== undefined && Number(p.stock) <= 0) return false;
  return true;
};

export function GameTopUpModal({
  isOpen,
  game,
  products,
  allGames,
  onSelectGame,
  onClose,
  onCheckout,
  onShowToast
}: GameTopUpModalProps) {
  // Input fields for game credentials
  const [userId, setUserId] = useState<string>('');
  const [zoneId, setZoneId] = useState<string>('');
  const [server, setServer] = useState<string>('os_asia');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [packageFilterTab, setPackageFilterTab] = useState<'all' | 'popular' | 'currency' | 'pass'>('all');

  // Lock body scroll when modal is open to prevent page scrolling behind modal
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  // Reset inputs when game changes
  useEffect(() => {
    if (isOpen && game) {
      setUserId('');
      setZoneId('');
      setServer('os_asia');
      setPackageFilterTab('all');
    }
  }, [isOpen, game]);

  // Determine game type
  const isMLBB = useMemo(() => {
    if (!game) return false;
    const str = (game.title + ' ' + game.provider + ' ' + game.id).toLowerCase();
    return str.includes('legend') || str.includes('mlbb');
  }, [game]);

  const isFreeFire = useMemo(() => {
    if (!game) return false;
    const str = (game.title + ' ' + game.provider + ' ' + game.id).toLowerCase();
    return str.includes('free fire') || str.includes('ff');
  }, [game]);

  const isGenshin = useMemo(() => {
    if (!game) return false;
    const str = (game.title + ' ' + game.provider + ' ' + game.id).toLowerCase();
    return str.includes('genshin');
  }, [game]);

  const isValorant = useMemo(() => {
    if (!game) return false;
    const str = (game.title + ' ' + game.provider + ' ' + game.id).toLowerCase();
    return str.includes('valorant');
  }, [game]);

  const isRoblox = useMemo(() => {
    if (!game) return false;
    const str = (game.title + ' ' + game.provider + ' ' + game.id).toLowerCase();
    return str.includes('roblox');
  }, [game]);

  // Dynamically get products: matches backend products if present, else seamlessly uses built-in authentic denominations
  const gameProducts = useMemo(() => {
    if (!game) return [];
    const provLower = game.provider.toLowerCase();
    const titleLower = game.title.toLowerCase();
    const idLower = game.id.toLowerCase();

    // 1. Check live database products (termasuk status aktif/stok dari supplier API)
    const liveMatches = products.filter(p => {
      if (p.categoryId !== 'game') return false;
      const pProv = (p.provider || '').toLowerCase();
      const pName = (p.name || '').toLowerCase();
      const pSku = (p.sku || '').toLowerCase();
      const pSuppSku = (p.supplierSku || '').toLowerCase();

      if (isMLBB) {
        return pProv.includes('mobile legend') || pName.includes('mobile legend') || pSku.includes('mlbb') || pSuppSku.includes('mlbb') || pName.includes('diamond pass');
      }
      if (isFreeFire) {
        return pProv.includes('free fire') || pName.includes('free fire') || pSku.includes('ff') || pSuppSku.includes('ff');
      }
      if (isGenshin) {
        return pProv.includes('genshin') || pName.includes('genshin') || pSku.includes('gi') || pSuppSku.includes('gi');
      }
      if (isValorant) {
        return pProv.includes('valorant') || pName.includes('valorant') || pSku.includes('val');
      }

      return (
        pProv.includes(provLower) ||
        pName.includes(titleLower) ||
        pSku.includes(idLower)
      );
    });

    if (liveMatches.length > 0) {
      return liveMatches.sort((a, b) => a.sellingPrice - b.sellingPrice);
    }

    // 2. Fallback to rich built-in catalog for instant availability
    const defaultList = DEFAULT_GAME_DENOMINATIONS[game.id] || DEFAULT_GAME_DENOMINATIONS.mlbb;
    return defaultList.map(item => ({
      id: `p-${game.id}-${item.id}`,
      categoryId: 'game' as const,
      provider: game.provider || game.title,
      name: item.name,
      sku: `SKU-${game.id.toUpperCase()}-${item.id.toUpperCase()}`,
      description: `Top Up ${item.name} ${game.title} - 100% Legal & Cepat`,
      supplierPrice: Math.round(item.price * 0.95),
      sellingPrice: item.price,
      duration: 'Instan 1-3 Detik',
      deliveryMethod: 'AUTOMATIC' as const,
      isActive: true,
      badge: item.badge
    } as Product));
  }, [game, products, isMLBB, isFreeFire, isGenshin, isValorant]);

  // Filtered by package tab
  const filteredProducts = useMemo(() => {
    if (packageFilterTab === 'all') return gameProducts;
    if (packageFilterTab === 'popular') {
      return gameProducts.filter(p => p.badge || p.sellingPrice < 35000);
    }
    if (packageFilterTab === 'pass') {
      return gameProducts.filter(p => 
        p.name.toLowerCase().includes('pass') || 
        p.name.toLowerCase().includes('membership') || 
        p.name.toLowerCase().includes('welkin') ||
        p.name.toLowerCase().includes('card')
      );
    }
    if (packageFilterTab === 'currency') {
      return gameProducts.filter(p => 
        !p.name.toLowerCase().includes('pass') && 
        !p.name.toLowerCase().includes('membership') &&
        !p.name.toLowerCase().includes('welkin')
      );
    }
    return gameProducts;
  }, [gameProducts, packageFilterTab]);

  // Select first available item by default
  useEffect(() => {
    if (gameProducts.length > 0) {
      const currentSelected = gameProducts.find(p => p.id === selectedProductId);
      if (!currentSelected || !isGameProductAvailable(currentSelected)) {
        const firstAvailable = gameProducts.find(isGameProductAvailable) || gameProducts[0];
        setSelectedProductId(firstAvailable.id);
      }
    } else {
      setSelectedProductId('');
    }
  }, [gameProducts, selectedProductId]);

  if (!isOpen || !game || typeof document === 'undefined') return null;

  const selectedProduct = gameProducts.find(p => p.id === selectedProductId) || gameProducts[0];

  const handleProceedCheckout = () => {
    if (!userId.trim()) {
      onShowToast(
        'Data Belum Lengkap', 
        isMLBB 
          ? 'Masukkan User ID akun Mobile Legends Anda' 
          : isValorant
          ? 'Masukkan Riot ID & Tagline (cth: Player#1234)'
          : isRoblox
          ? 'Masukkan Username Akun Roblox'
          : 'Masukkan Player ID / Akun ID game Anda', 
        'warning'
      );
      return;
    }

    if (isMLBB && !zoneId.trim()) {
      onShowToast('Zone ID Belum Diisi', 'Masukkan 4-5 digit Zone ID / Server (Contoh: 2020)', 'warning');
      return;
    }

    if (!selectedProduct) {
      onShowToast('Pilih Nominal', 'Silakan pilih paket diamond/item terlebih dahulu', 'warning');
      return;
    }

    if (!isGameProductAvailable(selectedProduct)) {
      onShowToast(
        'Stok Kosong / Gangguan', 
        selectedProduct.statusNote || 'Nominal yang dipilih sedang kosong dari provider API. Silakan pilih nominal lain.', 
        'warning'
      );
      return;
    }

    let targetString = userId.trim();
    if (isMLBB) {
      targetString = `${userId.trim()} (${zoneId.trim()})`;
    } else if (isGenshin) {
      targetString = `${userId.trim()} [${server}]`;
    }

    onClose();
    onCheckout(selectedProduct, targetString);
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl max-h-[92dvh] sm:max-h-[88dvh] flex flex-col rounded-2xl sm:rounded-3xl bg-[#0B0F17] border border-white/10 shadow-2xl text-slate-100 font-outfit overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow corner ambient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 blur-3xl pointer-events-none" />

        {/* 1. Header Hero with Game Switcher */}
        <div className="shrink-0 flex items-center justify-between p-3.5 sm:p-4 border-b border-white/10 bg-gradient-to-r from-amber-500/15 via-[#0E131F] to-[#111827] backdrop-blur-md relative z-10">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            {game.image ? (
              <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden border border-white/15 shadow-md shrink-0">
                <img 
                  src={game.image} 
                  alt={game.title} 
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#0E131F] border border-amber-500/40 flex items-center justify-center text-amber-500 shrink-0">
                <Gamepad2 size={20} />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {allGames && allGames.length > 0 && onSelectGame ? (
                  <div className="relative inline-block">
                    <select
                      value={game.id}
                      onChange={(e) => {
                        const next = allGames.find(g => g.id === e.target.value);
                        if (next) onSelectGame(next);
                      }}
                      className="font-space font-extrabold text-xs sm:text-sm text-white tracking-tight bg-[#0B0F17] hover:bg-slate-900 border border-white/20 rounded-lg px-2 py-0.5 cursor-pointer focus:outline-none focus:border-amber-400 pr-5 appearance-none"
                    >
                      {allGames.map(g => (
                        <option key={g.id} value={g.id} className="bg-slate-900 text-white text-xs">
                          {g.title}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                ) : (
                  <h3 className="font-space font-extrabold text-sm sm:text-base text-white tracking-tight truncate">
                    {game.title}
                  </h3>
                )}
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[8.5px] font-black uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                  <span>INSTAN 24/7</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center gap-1.5">
                <span>{game.publisher}</span>
                <span>•</span>
                <span className="text-amber-400 font-bold">★ {game.rating || '4.9'}</span>
                <span>•</span>
                <span className="text-emerald-400 flex items-center gap-0.5">
                  <ShieldCheck size={11} /> 100% Legal
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Tutup modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* 2. Scrollable Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3.5 sm:p-5 md:p-6 space-y-4 relative z-10">
          
          {/* Step 1: Input Game Account */}
          <div className="bg-[#0E131F] p-3 sm:p-4 rounded-2xl border border-white/[0.08] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold font-space text-amber-400 uppercase tracking-wider">
                <span className="w-4.5 h-4.5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[10px] font-black shrink-0">1</span>
                <span>Masukkan Data Akun Game</span>
              </div>
              <span className="text-[9.5px] text-emerald-400 flex items-center gap-1 font-semibold">
                <ShieldCheck size={11} />
                <span>Tanpa Password Akun</span>
              </span>
            </div>

            {isMLBB ? (
              <div className="space-y-1.5">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="User ID (cth: 12345678)"
                      className="w-full bg-[#080B12] border border-white/10 rounded-xl px-3 py-2 text-white font-mono font-bold text-xs sm:text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all shadow-inner"
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={zoneId}
                      onChange={(e) => setZoneId(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="Zone ID (2020)"
                      className="w-full bg-[#080B12] border border-white/10 rounded-xl px-2 py-2 text-white font-mono font-bold text-xs sm:text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all shadow-inner text-center"
                    />
                  </div>
                </div>

                <p className="text-[9.5px] text-slate-400 flex items-center gap-1">
                  <Info size={11} className="text-amber-400 shrink-0" />
                  <span>Contoh: User ID <strong>12345678</strong> dan Zone ID <strong>(2020)</strong> di Profil game.</span>
                </p>
              </div>
            ) : isGenshin ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="UID Akun (cth: 812345678)"
                    className="w-full bg-[#080B12] border border-white/10 rounded-xl px-3 py-2 text-white font-mono font-bold text-xs sm:text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all shadow-inner"
                  />
                </div>

                <div>
                  <select
                    value={server}
                    onChange={(e) => setServer(e.target.value)}
                    className="w-full bg-[#080B12] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                  >
                    <option value="os_asia">Server Asia</option>
                    <option value="os_usa">America</option>
                    <option value="os_euro">Europe</option>
                    <option value="os_cht">TW, HK, MO</option>
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder={
                    isFreeFire 
                      ? 'Player ID Free Fire (cth: 198273645)' 
                      : isValorant 
                      ? 'Riot ID & Tagline (cth: Player#1234)' 
                      : isRoblox
                      ? 'Username Akun Roblox'
                      : 'Masukkan ID Akun Game tujuan...'
                  }
                  className="w-full bg-[#080B12] border border-white/10 rounded-xl px-3 py-2 text-white font-mono font-bold text-xs sm:text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all shadow-inner"
                />
              </div>
            )}
          </div>

          {/* Step 2: Choose Denominations / Diamond Packages */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold font-space text-amber-400 uppercase tracking-wider">
                <span className="w-4.5 h-4.5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[10px] font-black shrink-0">2</span>
                <span>Pilih Nominal {isMLBB || isFreeFire ? 'Diamond' : isValorant ? 'Points (VP)' : isGenshin ? 'Genesis Crystals' : isRoblox ? 'Robux' : 'Item'}</span>
              </div>

              {/* Package Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                {[
                  { id: 'all', label: 'Semua' },
                  { id: 'popular', label: '⚡ Populer' },
                  { id: 'currency', label: '💎 Diamond' },
                  { id: 'pass', label: '🎟️ Pass/VIP' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPackageFilterTab(tab.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-space font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      packageFilterTab === tab.id
                        ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                        : 'bg-[#0E131F] text-slate-400 hover:text-white border border-white/10'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid Nominal Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5">
              {filteredProducts.map((p) => {
                const isSelected = selectedProduct?.id === p.id;
                const isAvailable = isGameProductAvailable(p);
                const displayName = cleanItemName(p.name, game.title);

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedProductId(p.id);
                      if (!isAvailable) {
                        onShowToast(
                          'Nominal Tidak Tersedia',
                          p.statusNote || 'Stok produk ini sedang kosong dari supplier API.',
                          'warning'
                        );
                      }
                    }}
                    className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between select-none ${
                      !isAvailable
                        ? 'opacity-55 bg-[#0A0D14]/80 border-dashed border-rose-500/25 hover:border-rose-500/40'
                        : isSelected
                        ? 'bg-gradient-to-br from-amber-500/20 via-[#0E131F] to-[#121826] border-amber-500 shadow-amber-glow ring-1 ring-amber-500'
                        : 'bg-[#0E131F]/90 border-white/[0.08] hover:border-white/20 hover:bg-[#131927]'
                    } hover:-translate-y-0.5 active:scale-[0.98]`}
                  >
                    {/* Active Check Badge */}
                    {isSelected && (
                      <div className={`absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center shadow-xs ${
                        isAvailable ? 'bg-amber-500 text-slate-950' : 'bg-rose-500 text-white'
                      }`}>
                        <Check size={10} className="stroke-[3]" />
                      </div>
                    )}

                    {/* Badge Chip if any */}
                    {p.badge && (
                      <span className="self-start text-[8px] font-black px-1.5 py-0.2 rounded-md bg-amber-500 text-slate-950 uppercase tracking-tighter mb-1 shadow-xs">
                        {p.badge}
                      </span>
                    )}

                    <div className="pr-4">
                      <div className="flex items-center gap-1 text-xs font-space font-bold text-white tracking-tight">
                        <span className="text-amber-400 text-xs shrink-0">
                          {p.name.toLowerCase().includes('pass') ? '🎟️' : '💎'}
                        </span>
                        <span className="truncate">{displayName}</span>
                      </div>
                      <p className="text-[9.5px] text-slate-400 mt-0.5 truncate font-mono">
                        {p.duration || 'Proses 1-3 Detik'}
                      </p>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-white/[0.06] flex items-baseline justify-between">
                      <span className="text-xs sm:text-[13px] font-space font-extrabold text-amber-400 font-mono">
                        {formatRupiah(p.sellingPrice)}
                      </span>
                      <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded border ${
                        isAvailable
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                          : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      }`}>
                        {isAvailable ? 'Ready' : (p.statusNote || 'Habis')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Security & Trust Strip */}
          <div className="p-2.5 rounded-xl bg-[#080B12] border border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <ShieldCheck size={12} /> 100% Legal & Bergaransi Anti-Banned
            </span>
            <span className="flex items-center gap-1 text-amber-400 font-medium">
              <Zap size={12} /> Pengiriman Kilat Detik Itu Juga
            </span>
          </div>
        </div>

        {/* 3. Sticky Action Footer (Always Visible & Responsive) */}
        <div className="shrink-0 p-3 sm:p-4 border-t border-white/10 bg-[#0A0D14]/95 backdrop-blur-md flex items-center justify-between gap-3 relative z-10">
          <div className="min-w-0 pr-2">
            <span className="text-[9px] text-slate-400 uppercase font-mono tracking-wider block">Total Tagihan</span>
            <div className="text-base sm:text-xl font-extrabold font-space text-amber-400 truncate font-mono">
              {selectedProduct ? formatRupiah(selectedProduct.sellingPrice) : 'Rp 0'}
            </div>
            {selectedProduct && (
              <span className="text-[10px] text-slate-400 truncate block max-w-[170px] sm:max-w-[260px]">
                {cleanItemName(selectedProduct.name, game.title)}
                {!isGameProductAvailable(selectedProduct) && (
                  <span className="text-rose-400 font-bold ml-1">({selectedProduct.statusNote || 'Stok Kosong'})</span>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Batal
            </button>

            <button
              onClick={handleProceedCheckout}
              disabled={!selectedProduct || !isGameProductAvailable(selectedProduct)}
              className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl font-space font-extrabold text-xs sm:text-sm tracking-wide shadow-md transition-all ${
                selectedProduct && isGameProductAvailable(selectedProduct)
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-glow cursor-pointer active:scale-98'
                  : 'bg-slate-800 text-slate-400 border border-white/10 cursor-not-allowed opacity-60'
              }`}
            >
              {selectedProduct && isGameProductAvailable(selectedProduct) ? (
                <>
                  <Zap size={15} className="fill-current text-slate-950" />
                  <span>Beli Sekarang</span>
                  <ArrowRight size={14} />
                </>
              ) : (
                <>
                  <span>Stok Habis (API)</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default GameTopUpModal;
