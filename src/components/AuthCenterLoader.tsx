import React from 'react';
import { Loader2, ShieldCheck, Sparkles, LogOut, CheckCircle2 } from 'lucide-react';

interface AuthCenterLoaderProps {
  type: 'LOGIN_MEMBER' | 'LOGOUT_MEMBER' | 'LOGIN_ADMIN' | 'LOGOUT_ADMIN';
  message?: string;
}

export function AuthCenterLoader({ type, message }: AuthCenterLoaderProps) {
  const isLogout = type.includes('LOGOUT');
  const isAdmin = type.includes('ADMIN');

  let title = 'Memproses Autentikasi...';
  let defaultSub = 'Menghubungkan sesi aman dan memuat preferensi...';

  if (type === 'LOGIN_ADMIN') {
    title = 'Sugeng Rawuh Administrator';
    defaultSub = 'Membuka portal manajemen sistem Wayahe Digital...';
  } else if (type === 'LOGOUT_ADMIN') {
    title = 'Mengakhiri Sesi Administrator';
    defaultSub = 'Mengamankan sesi dan membersihkan kredensial lokal...';
  } else if (type === 'LOGIN_MEMBER') {
    title = 'Masuk ke Akun Member';
    defaultSub = 'Menyiapkan saldo, poin reward, dan layanan Anda...';
  } else if (type === 'LOGOUT_MEMBER') {
    title = 'Keluar dari Akun';
    defaultSub = 'Sampun medal, matur nuwun sampun kepareng rawuh...';
  }

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-[#100C08]/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#1C1612] border border-[#D4A359]/30 shadow-2xl shadow-black/80 rounded-3xl p-8 max-w-sm w-full mx-4 text-center relative overflow-hidden animate-modalIn">
        {/* Glow ambient background */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#D4A359]/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-amber-600/15 rounded-full blur-2xl pointer-events-none" />

        {/* Center Spinner Ring & Icon */}
        <div className="relative mx-auto w-20 h-20 mb-6 flex items-center justify-center">
          {/* Animated pulsing outer ring */}
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#D4A359]/30 animate-spin" style={{ animationDuration: '6s' }} />
          <div className="absolute inset-1 rounded-full border-2 border-t-[#D4A359] border-r-amber-500/80 border-b-transparent border-l-transparent animate-spin" style={{ animationDuration: '1s' }} />
          
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2A1E14] to-[#14100C] border border-[#D4A359]/40 flex items-center justify-center shadow-lg shadow-black/50">
            {isLogout ? (
              <LogOut className="w-7 h-7 text-[#D4A359] animate-pulse" />
            ) : isAdmin ? (
              <ShieldCheck className="w-7 h-7 text-[#D4A359] animate-bounce" />
            ) : (
              <Sparkles className="w-7 h-7 text-[#D4A359] animate-pulse" />
            )}
          </div>
        </div>

        {/* Text */}
        <h3 className="text-xl font-bold text-[#FAF4EB] tracking-wide mb-2 font-serif">
          {title}
        </h3>
        <p className="text-xs text-[#D4A359]/80 leading-relaxed">
          {message || defaultSub}
        </p>

        {/* Mini progress pulse */}
        <div className="mt-6 flex items-center justify-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#D4A359] animate-ping" />
          <span className="w-2 h-2 rounded-full bg-[#D4A359]/60 animate-ping" style={{ animationDelay: '200ms' }} />
          <span className="w-2 h-2 rounded-full bg-[#D4A359]/30 animate-ping" style={{ animationDelay: '400ms' }} />
        </div>
      </div>
    </div>
  );
}
