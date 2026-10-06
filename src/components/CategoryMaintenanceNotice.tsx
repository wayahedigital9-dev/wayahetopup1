import React from 'react';
import { Wrench, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';

interface CategoryMaintenanceNoticeProps {
  categoryName: string;
  onBack?: () => void;
  onRefresh?: () => void;
}

export function CategoryMaintenanceNotice({
  categoryName,
  onBack,
  onRefresh,
}: CategoryMaintenanceNoticeProps) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full bg-[#1F1914] border border-amber-500/30 rounded-3xl p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden backdrop-blur-md">
        {/* Glow ambient background */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Maintenance Icon */}
        <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500/20 to-orange-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-6 shadow-lg shadow-amber-500/10 animate-bounce">
          <Wrench size={38} className="rotate-12" />
        </div>

        {/* Required Maintenance Text */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold tracking-wide uppercase mb-3">
          <AlertCircle size={14} />
          <span>Status Layanan</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug mb-3">
          Maintenance akan segera kembali
        </h2>

        <p className="text-sm text-slate-300/90 leading-relaxed mb-6">
          Layanan <span className="text-amber-400 font-bold">{categoryName}</span> sedang dalam pemeliharaan atau optimasi sistem rutin oleh tim kami. Mohon ditunggu, transaksi akan segera dibuka kembali.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex-1 py-3 px-4 rounded-xl text-xs font-extrabold bg-[#2D241E] hover:bg-[#3D322A] text-slate-200 border border-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <ArrowLeft size={16} />
              <span>Kembali ke Beranda</span>
            </button>
          )}

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="py-3 px-4 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <RefreshCw size={16} />
              <span>Cek Status</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
