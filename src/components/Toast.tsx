import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { ToastMessage } from '../types';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const [isClosing, setIsClosing] = useState(false);

  // Durasi cepat untuk notif berhasil (1200ms agar cepat hilang seperti yang diminta pengguna)
  const duration = toast.type === 'success' ? 1200 : toast.type === 'error' ? 3200 : 2200;

  useEffect(() => {
    // Mulai animasi fade-out sebelum dihapus
    const fadeTimer = setTimeout(() => {
      setIsClosing(true);
    }, Math.max(200, duration - 250));

    const removeTimer = setTimeout(() => {
      onDismiss(toast.id);
    }, duration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [toast.id, duration, onDismiss]);

  let bgColor = 'bg-[#12100e] border-[#3e342b] text-[#faf4eb]';
  let icon = <Info size={18} className="text-sky-400 shrink-0" />;
  let progressBarColor = 'bg-sky-400';

  if (toast.type === 'success') {
    bgColor = 'bg-[#0e1912] border-emerald-500/40 text-emerald-100 shadow-emerald-500/10';
    icon = <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />;
    progressBarColor = 'bg-emerald-400';
  } else if (toast.type === 'error') {
    bgColor = 'bg-[#1e0e11] border-rose-500/40 text-rose-100 shadow-rose-500/10';
    icon = <AlertCircle size={18} className="text-rose-400 shrink-0" />;
    progressBarColor = 'bg-rose-400';
  } else if (toast.type === 'warning') {
    bgColor = 'bg-[#1e170e] border-amber-500/40 text-amber-100 shadow-amber-500/10';
    icon = <AlertTriangle size={18} className="text-amber-400 shrink-0" />;
    progressBarColor = 'bg-amber-400';
  }

  return (
    <div
      id={`toast-${toast.id}`}
      className={`pointer-events-auto relative overflow-hidden flex items-start gap-3 p-3.5 rounded-2xl border shadow-xl backdrop-blur-md transition-all duration-200 transform ${
        isClosing ? 'opacity-0 translate-y-2 scale-95' : 'opacity-100 translate-y-0 scale-100 animate-fadeIn'
      } ${bgColor}`}
      role="alert"
    >
      <div className="pt-0.5">{icon}</div>
      <div className="flex-1 min-w-0 pr-2">
        <p className="text-xs md:text-sm font-bold leading-tight tracking-tight">{toast.title}</p>
        <p className="text-[11px] opacity-85 mt-0.5 leading-snug">{toast.message}</p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 shrink-0 cursor-pointer transition-colors"
        aria-label="Tutup notifikasi"
      >
        <X size={15} />
      </button>

      {/* Fast animated progress bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10">
        <div
          className={`h-full ${progressBarColor} transition-all ease-linear`}
          style={{
            animation: `shrinkWidth ${duration}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      id="toast-container"
      className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
