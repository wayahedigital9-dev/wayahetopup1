import React from 'react';
import { ShieldAlert, RotateCcw, LayoutDashboard, Sparkles } from 'lucide-react';
import { storage } from '../services/storage';

interface DemoBannerProps {
  onOpenAdmin: () => void;
  onRefreshData?: () => void;
}

export function DemoBanner({ onOpenAdmin, onRefreshData }: DemoBannerProps) {
  const [isDismissed, setIsDismissed] = React.useState(false);

  const handleResetData = () => {
    if (window.confirm('Reset semua data transaksi & simulasi ke kondisi awal demo?')) {
      storage.resetToDemo();
      if (onRefreshData) onRefreshData();
      window.location.reload();
    }
  };

  if (isDismissed) return null;

  return (
    <aside 
      id="demo-mode-alert-banner"
      className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2 text-xs md:text-sm font-medium transition-colors"
      aria-label="Informasi Mode Demo"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <span className="inline-flex items-center gap-1 bg-amber-500 text-white font-bold text-[11px] px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs shrink-0">
            <ShieldAlert size={13} aria-hidden="true" />
            Mode Demo
          </span>
          <span>
            Lingkungan simulasi aktif (Mock Adapter). <strong>Pembayaran adalah simulasi</strong> tanpa memotong saldo uang riil.
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenAdmin}
            id="banner-admin-button"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 rounded-lg border border-amber-300 font-semibold text-xs transition-colors shadow-xs"
          >
            <LayoutDashboard size={13} />
            Dashboard Admin
          </button>
          <button
            onClick={handleResetData}
            title="Reset data demo ke awal"
            className="inline-flex items-center gap-1 px-2 py-1 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded-lg text-xs transition-colors"
          >
            <RotateCcw size={13} />
            Reset
          </button>
        </div>
      </div>
    </aside>
  );
}
