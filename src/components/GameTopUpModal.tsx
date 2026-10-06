import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Gamepad2, 
  Sparkles, 
  Zap, 
  Check, 
  ShieldCheck, 
  ArrowRight,
  Info,
  Server
} from 'lucide-react';
import { Product } from '../types';
import { formatRupiah } from '../utils/operator';
import { ProductLogo } from './ProductLogo';

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
  onClose: () => void;
  onCheckout: (product: Product, targetAccount: string) => void;
  onShowToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export function GameTopUpModal({
  isOpen,
  game,
  products,
  onClose,
  onCheckout,
  onShowToast
}: GameTopUpModalProps) {
  // Input fields for game credentials
  const [userId, setUserId] = useState<string>('');
  const [zoneId, setZoneId] = useState<string>('');
  const [server, setServer] = useState<string>('os_asia');
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Reset inputs when game changes
  useEffect(() => {
    if (isOpen && game) {
      setUserId('');
      setZoneId('');
      setServer('os_asia');
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

  // Dynamically get all products for this game from products list (syncs with Digiflazz / H2H)
  const gameProducts = useMemo(() => {
    if (!game) return [];
    const provLower = game.provider.toLowerCase();
    const titleLower = game.title.toLowerCase();
    const idLower = game.id.toLowerCase();

    const matches = products.filter(p => {
      if (p.categoryId !== 'game' || !p.isActive) return false;
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

    return matches.sort((a, b) => a.sellingPrice - b.sellingPrice);
  }, [game, products, isMLBB, isFreeFire, isGenshin, isValorant]);

  // Select first item by default if none selected or not in list
  useEffect(() => {
    if (gameProducts.length > 0) {
      const exists = gameProducts.some(p => p.id === selectedProductId);
      if (!exists) {
        setSelectedProductId(gameProducts[0].id);
      }
    } else {
      setSelectedProductId('');
    }
  }, [gameProducts, selectedProductId]);

  if (!isOpen || !game) return null;

  const selectedProduct = gameProducts.find(p => p.id === selectedProductId) || gameProducts[0];

  const handleProceedCheckout = () => {
    if (!userId.trim()) {
      onShowToast('Data Belum Lengkap', isMLBB ? 'Masukkan User ID akun game Anda' : 'Masukkan Player ID / Akun ID game Anda', 'warning');
      return;
    }

    if (isMLBB && !zoneId.trim()) {
      onShowToast('Zone ID Belum Diisi', 'Masukkan Zone ID / Server (Contoh: 2020)', 'warning');
      return;
    }

    if (!selectedProduct) {
      onShowToast('Pilih Nominal', 'Silakan pilih paket diamond/item terlebih dahulu', 'warning');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#0F1422] border border-[#00F5D4]/40 shadow-2xl p-4 sm:p-6 text-[#DFE2EF] font-outfit"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow corner */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#00F5D4]/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#8B5CF6]/15 blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-3">
            {game.image ? (
              <img 
                src={game.image} 
                alt={game.title} 
                className="w-12 h-12 rounded-2xl object-cover border border-white/10 shadow-md"
              />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-[#141A29] border border-[#00F5D4]/40 flex items-center justify-center text-[#00F5D4]">
                <Gamepad2 size={24} />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-syne font-black text-base sm:text-lg text-white">
                  {game.title}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-[#00F5D4]/15 border border-[#00F5D4]/40 text-[#00F5D4] text-[9px] font-black uppercase">
                  ⚡ PROSES OTOMATIS
                </span>
              </div>
              <p className="text-xs text-[#83948F]">
                {game.publisher} • 100% Legal & Garansi Anti-Banned
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-[#83948F] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step 1: Input Game Account */}
        <div className="mt-5 space-y-3 relative z-10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-syne text-[#00F5D4] uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#00F5D4] text-[#090D16] flex items-center justify-center text-[10px] font-black">1</span>
              Masukkan Data Akun Game
            </span>
          </div>

          {isMLBB ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#83948F] block">User ID</label>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Contoh: 12345678"
                  className="w-full bg-[#141A29] border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-[#00F5D4] focus:ring-1 focus:ring-[#00F5D4]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#83948F] block">Zone ID (Server)</label>
                <input
                  type="text"
                  value={zoneId}
                  onChange={(e) => setZoneId(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Contoh: 2020"
                  className="w-full bg-[#141A29] border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-[#00F5D4] focus:ring-1 focus:ring-[#00F5D4]"
                />
              </div>

              <div className="sm:col-span-2 text-[10px] text-[#83948F] flex items-center gap-1.5 bg-[#141A29]/60 px-3 py-1.5 rounded-lg border border-white/5">
                <Info size={12} className="text-[#00F5D4] shrink-0" />
                <span>Untuk mengetahui User ID Anda, buka Profil di dalam game Mobile Legends. Contoh: 12345678 (2020)</span>
              </div>
            </div>
          ) : isGenshin ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#83948F] block">UID Akun Genshin</label>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Contoh: 812345678"
                  className="w-full bg-[#141A29] border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-[#00F5D4] focus:ring-1 focus:ring-[#00F5D4]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#83948F] block">Server</label>
                <select
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  className="w-full bg-[#141A29] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-[#00F5D4]"
                >
                  <option value="os_asia">Asia</option>
                  <option value="os_usa">America</option>
                  <option value="os_euro">Europe</option>
                  <option value="os_cht">TW, HK, MO</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#83948F] block">
                {isFreeFire ? 'Player ID Free Fire' : isValorant ? 'Riot ID & Tagline (e.g. Player#1234)' : 'ID Akun / Player ID'}
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder={isFreeFire ? 'Contoh: 198273645' : isValorant ? 'Username#1234' : 'Masukkan ID Pengguna Game'}
                className="w-full bg-[#141A29] border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-[#00F5D4] focus:ring-1 focus:ring-[#00F5D4]"
              />
            </div>
          )}
        </div>

        {/* Step 2: Choose Denominations / Diamond Packages */}
        <div className="mt-6 space-y-3 relative z-10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-syne text-[#00F5D4] uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#00F5D4] text-[#090D16] flex items-center justify-center text-[10px] font-black">2</span>
              Pilih Nominal {isMLBB ? 'Diamond' : isFreeFire ? 'Diamond' : isValorant ? 'Points' : isGenshin ? 'Genesis Crystals' : 'Item'}
            </span>
            <span className="text-[10px] text-[#83948F]">
              Tersedia {gameProducts.length} Paket
            </span>
          </div>

          {gameProducts.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#141A29]/70 border border-white/5 text-center text-xs text-[#83948F]">
              Belum ada produk aktif untuk game ini. Pastikan produk telah disinkronkan di menu Admin.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
              {gameProducts.map((p) => {
                const isSelected = selectedProduct?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedProductId(p.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                      isSelected
                        ? 'glow-card-cyan bg-[#142338] border-[#00F5D4]'
                        : 'bg-[#141A29]/80 border-white/10 hover:border-white/20 hover:bg-[#182033]'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#00F5D4] text-[#090D16] flex items-center justify-center">
                        <Check size={10} className="stroke-[3]" />
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-syne font-black text-white">
                        <span className="text-[#00F5D4]">💎</span>
                        <span className="truncate">{p.name}</span>
                      </div>
                      <p className="text-[10px] text-[#83948F] mt-0.5 truncate">
                        {p.duration || 'Proses Kilat 5 Detik'}
                      </p>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-white/5 flex items-center justify-between">
                      <span className="text-xs font-syne font-black text-[#00F5D4]">
                        {formatRupiah(p.sellingPrice)}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-[#DFE2EF]">
                        {p.stock !== undefined && p.stock > 0 ? 'Ready' : 'Aktif'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Step 3: Checkout Action Bar */}
        <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div>
            <span className="text-[10px] text-[#83948F] uppercase block font-inter">Total Pembayaran</span>
            <div className="text-lg sm:text-xl font-black font-syne text-[#00F5D4]">
              {selectedProduct ? formatRupiah(selectedProduct.sellingPrice) : 'Rp 0'}
            </div>
            {selectedProduct && (
              <span className="text-[10px] text-[#83948F]">
                {selectedProduct.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-[#83948F] hover:text-white transition-colors cursor-pointer"
            >
              Batal
            </button>

            <button
              onClick={handleProceedCheckout}
              disabled={!selectedProduct}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#00F5D4] hover:bg-[#26FEDC] disabled:opacity-50 text-[#090D16] font-syne font-extrabold text-xs sm:text-sm tracking-wide shadow-cyber-cyan transition-all cursor-pointer"
            >
              <Zap size={14} className="fill-[#090D16]" />
              <span>Beli Sekarang via QRIS</span>
              <ArrowRight size={14} className="stroke-[2.5]" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
