import React, { useState } from 'react';
import { 
  User as UserIcon, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  ShieldCheck, 
  Sparkles, 
  KeyRound, 
  AlertCircle,
  HelpCircle,
  X,
  CheckCircle2,
  Smartphone,
  ShieldAlert
} from 'lucide-react';
import { AdminAuthSession, AdminRole } from '../types';
import { storage } from '../services/storage';
import { verifyTotpCode } from '../utils/totp';

interface AdminLoginPageProps {
  onLoginSuccess: (session: AdminAuthSession) => void;
  onBackToStore: () => void;
  onShowToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export function AdminLoginPage({
  onLoginSuccess,
  onBackToStore,
  onShowToast,
}: AdminLoginPageProps) {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 2FA Google Authenticator States
  const [loginStep, setLoginStep] = useState<'CREDENTIALS' | '2FA_OTP'>('CREDENTIALS');
  const [totpInput, setTotpInput] = useState('');
  const [pendingSession, setPendingSession] = useState<AdminAuthSession | null>(null);
  const [isVerifyingTotp, setIsVerifyingTotp] = useState(false);

  // Modals for "Lupa Kata Sandi" & "Bantuan / Syarat"
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanInput = usernameOrEmail.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanInput) {
      setErrorMessage('Nama pengguna atau email wajib diisi.');
      return;
    }

    if (!cleanPass) {
      setErrorMessage('Kata sandi wajib diisi.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const currentSettings = storage.getSettings();
      const activeAdminUser = (currentSettings.adminUsername || 'admin').trim().toLowerCase();
      const activeAdminPass = currentSettings.adminPassword || 'admin123';
      const activeAdminEmail = (currentSettings.supportEmail || 'admin@wayahedigital.id').trim().toLowerCase();

      const isMatch = (cleanInput === activeAdminUser || cleanInput === activeAdminEmail) && cleanPass === activeAdminPass;

      if (isMatch) {
        const adminName = currentSettings.adminName || 'Super Administrator';
        const adminEmail = currentSettings.supportEmail || 'admin@wayahedigital.id';
        const adminRole: AdminRole = 'SUPER_ADMIN';
        const adminRoleTitle = 'Super Administrator';

        const session: AdminAuthSession = {
          isAuthenticated: true,
          username: activeAdminUser,
          name: adminName,
          email: adminEmail,
          role: adminRole,
          roleTitle: adminRoleTitle,
          token: 'adm-token-' + Date.now() + Math.random().toString(36).substring(2, 8),
          loginAt: new Date().toISOString(),
        };

        // Periksa apakah Google Authenticator (2FA) diaktifkan
        if (currentSettings.googleAuthEnabled && currentSettings.googleAuthSecret) {
          setIsLoading(false);
          setPendingSession(session);
          setLoginStep('2FA_OTP');
          setTotpInput('');
          setErrorMessage(null);
          onShowToast('Langkah 2: Verifikasi 2FA', 'Buka aplikasi Google Authenticator dan masukkan kode 6-digit.', 'info');
          return;
        }

        // Jika 2FA tidak aktif, login langsung sukses
        storage.saveAdminSession(session);
        storage.addAuditLog(
          'ADMIN_LOGIN_SUCCESS',
          `${adminName} (${adminRoleTitle})`,
          `Login berhasil via portal autentikasi admin pada ${new Date().toLocaleString('id-ID')}`
        );

        setIsLoading(false);
        onShowToast('Sugeng Rawuh!', `Selamat datang, ${adminName} (${adminRoleTitle})`, 'success');
        onLoginSuccess(session);
      } else {
        setIsLoading(false);
        setErrorMessage('Nama pengguna atau kata sandi tidak cocok. Silakan periksa kembali.');
        onShowToast('Autentikasi Gagal', 'Kredensial admin tidak valid.', 'error');
      }
    }, 500);
  };

  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = totpInput.trim().replace(/\s+/g, '');
    if (!cleanCode) {
      setErrorMessage('Masukkan 6 digit kode dari Google Authenticator.');
      return;
    }

    setIsVerifyingTotp(true);
    setErrorMessage(null);

    try {
      const currentSettings = storage.getSettings();
      const secret = currentSettings.googleAuthSecret || '';
      const isValid = await verifyTotpCode(cleanCode, secret, 2);

      if (isValid && pendingSession) {
        storage.saveAdminSession(pendingSession);
        storage.addAuditLog(
          'ADMIN_2FA_LOGIN_SUCCESS',
          `${pendingSession.name} (${pendingSession.roleTitle})`,
          `Login berhasil dengan verifikasi 2FA Google Authenticator pada ${new Date().toLocaleString('id-ID')}`
        );
        setIsVerifyingTotp(false);
        onShowToast('Verifikasi Berhasil', `Selamat datang, ${pendingSession.name}!`, 'success');
        onLoginSuccess(pendingSession);
      } else {
        setIsVerifyingTotp(false);
        setErrorMessage('Kode verifikasi Google Authenticator tidak cocok atau telah kedaluwarsa.');
        onShowToast('Kode 2FA Tidak Cocok', 'Silakan periksa kembali aplikasi Google Authenticator di ponsel Anda.', 'error');
      }
    } catch (err: any) {
      setIsVerifyingTotp(false);
      setErrorMessage(err.message || 'Terjadi kesalahan verifikasi kode 2FA.');
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-3 sm:p-6 overflow-hidden bg-[#241306] select-none font-sans">
      
      {/* 1. LAYER ILUSTRASI LATAR BELAKANG SUASANA JAWA / PEDESAAN NUSANTARA */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        
        {/* Langit Sunset / Golden Hour Gradient */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 30%, #F5B059 0%, #E8883B 35%, #C25624 70%, #541F0A 100%)',
          }}
        />

        {/* Siluet Matahari & Cahaya Hangat */}
        <div 
          className="absolute left-1/2 top-[22%] -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full blur-2xl opacity-60 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #FFE49E 0%, #F8A53B 60%, transparent 80%)' }}
        />

        {/* Gunung / Bukit Bertingkat (SVG) */}
        <svg 
          className="absolute bottom-[28%] left-0 w-full h-[36%] opacity-70" 
          viewBox="0 0 1440 320" 
          preserveAspectRatio="none"
        >
          {/* Gunung Jauh */}
          <path 
            fill="#8B3C18" 
            d="M0,192L80,181.3C160,171,320,149,480,165.3C640,181,800,235,960,224C1120,213,1280,139,1360,101.3L1440,64L1440,320L1360,320C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320L0,320Z"
          />
          {/* Bukit Depan */}
          <path 
            fill="#5E250E" 
            d="M0,240L60,224C120,208,240,176,360,186.7C480,197,600,251,720,261.3C840,272,960,240,1080,218.7C1200,197,1320,187,1380,181.3L1440,176L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"
          />
        </svg>

        {/* Terasering Sawah Hijau Keemasan */}
        <svg 
          className="absolute bottom-[20%] left-0 w-full h-[22%] opacity-85" 
          viewBox="0 0 1440 200" 
          preserveAspectRatio="none"
        >
          <path 
            fill="#6E4416" 
            d="M0,80 Q360,160 720,90 T1440,110 L1440,200 L0,200 Z"
          />
          <path 
            fill="#4D2E10" 
            d="M0,130 Q300,70 680,140 T1440,120 L1440,200 L0,200 Z"
          />
        </svg>

        {/* Siluet Rumah Joglo Jawa Tradisional (Kanan) */}
        <div className="absolute right-[-10px] sm:right-6 bottom-[16%] sm:bottom-[18%] w-64 sm:w-80 md:w-96 pointer-events-none opacity-85">
          <svg viewBox="0 0 320 260" className="w-full h-auto drop-shadow-2xl">
            {/* Atap Joglo Piramida Tingkat */}
            <polygon points="160,20 190,70 130,70" fill="#2E1708" />
            <polygon points="160,20 250,110 70,110" fill="#3D1F0C" />
            <polygon points="160,70 290,140 30,140" fill="#4E2710" />
            {/* Lisplang / Hiasan Atap Khas Jawa */}
            <path d="M25,140 Q160,135 295,140 L290,146 Q160,141 30,146 Z" fill="#753C1A" />
            {/* Dinding Kayu & Tiang Soko Guru */}
            <rect x="55" y="146" width="210" height="90" fill="#3B1C0B" />
            {/* Tiang-Tiang Beranda Kayu */}
            <rect x="65" y="146" width="8" height="90" fill="#5A2C11" />
            <rect x="105" y="146" width="8" height="90" fill="#5A2C11" />
            <rect x="156" y="146" width="8" height="90" fill="#5A2C11" />
            <rect x="207" y="146" width="8" height="90" fill="#5A2C11" />
            <rect x="247" y="146" width="8" height="90" fill="#5A2C11" />
            {/* Pagar Beranda Kayu Balustrade */}
            <rect x="55" y="195" width="210" height="6" fill="#6E3817" />
            <rect x="55" y="225" width="210" height="6" fill="#6E3817" />
            {/* Pintu Kayu Gebyok */}
            <rect x="135" y="160" width="50" height="75" fill="#241006" rx="2" />
          </svg>
        </div>

        {/* Meja Kayu Foreground Bawah */}
        <div 
          className="absolute bottom-0 left-0 w-full h-[22%] sm:h-[25%] border-t-4 border-[#3D1E0B]"
          style={{
            background: 'linear-gradient(to bottom, #542D13 0%, #3D1F0C 40%, #241105 100%)',
            boxShadow: 'inset 0 12px 20px rgba(0,0,0,0.5)',
          }}
        >
          {/* Tekstur Urat Serat Kayu (Wood Grain) */}
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#C5884B_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Kain Batik Alas Meja (Kiri & Kanan) */}
          <div className="absolute left-0 bottom-0 w-48 sm:w-72 h-16 sm:h-24 opacity-80 pointer-events-none">
            <svg viewBox="0 0 200 100" className="w-full h-full">
              <path d="M0,30 Q60,10 120,40 L160,100 L0,100 Z" fill="#1F3644" />
              <path d="M0,45 Q70,25 130,55 L150,100 L0,100 Z" fill="#A8753C" opacity="0.8" />
              {/* Pola Parang Batik */}
              <circle cx="40" cy="60" r="10" fill="#D3A766" opacity="0.6" />
              <circle cx="80" cy="50" r="8" fill="#D3A766" opacity="0.6" />
              <circle cx="110" cy="75" r="10" fill="#D3A766" opacity="0.6" />
            </svg>
          </div>

          <div className="absolute right-0 bottom-0 w-48 sm:w-64 h-16 sm:h-20 opacity-85 pointer-events-none">
            <svg viewBox="0 0 200 100" className="w-full h-full">
              <path d="M50,100 L120,20 Q160,40 200,30 L200,100 Z" fill="#693315" />
              <path d="M80,100 L135,35 Q170,50 200,45 L200,100 Z" fill="#C5934C" opacity="0.7" />
            </svg>
          </div>
        </div>

        {/* Objek Meja Kiri: Keris Pusaka Jawa Tradisional */}
        <div className="hidden sm:block absolute left-4 md:left-14 lg:left-24 bottom-3 sm:bottom-6 w-36 sm:w-52 md:w-64 pointer-events-none drop-shadow-2xl">
          <svg viewBox="0 0 260 120" className="w-full h-auto">
            {/* Gagang / Danganan Keris (Hilt) */}
            <path d="M20,75 Q35,45 55,60 Q70,75 50,85 Z" fill="#42200D" />
            <circle cx="36" cy="62" r="5" fill="#C49A4D" />
            {/* Mendak / Cincin Logam Keemasan */}
            <rect x="52" y="65" width="6" height="12" fill="#D4AF37" rx="1" transform="rotate(-25 55 71)" />
            {/* Warangka Gayaman / Sarung Ukiran Kayu */}
            <path d="M56,66 Q80,50 110,65 Q100,82 62,80 Z" fill="#633414" />
            <path d="M95,68 Q180,80 250,95 Q180,92 90,80 Z" fill="#522A0F" />
            <path d="M100,71 Q180,82 245,94" stroke="#8C4E20" strokeWidth="2" fill="none" />
            {/* Pendok Kuningan / Emas */}
            <rect x="110" y="72" width="70" height="8" fill="#C69E4A" opacity="0.8" rx="2" transform="rotate(10 145 76)" />
          </svg>
        </div>

        {/* Objek Meja Kanan: Cangkir Kopi Tubruk & Lampu Teplok Antik */}
        <div className="hidden sm:flex absolute right-4 md:right-12 lg:right-20 bottom-3 sm:bottom-6 items-end gap-3 pointer-events-none drop-shadow-2xl">
          {/* Cangkir Kopi Keramik & Pisin */}
          <div className="w-20 md:w-24">
            <svg viewBox="0 0 100 80" className="w-full h-auto">
              {/* Asap Uap Kopi Hangat */}
              <path d="M45,20 Q48,10 43,5" stroke="#FFE9C4" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7" />
              <path d="M55,18 Q60,8 54,3" stroke="#FFE9C4" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />
              {/* Pisin (Saucer) */}
              <ellipse cx="50" cy="72" rx="42" ry="7" fill="#E8DEC9" stroke="#C2B193" strokeWidth="1.5" />
              {/* Cangkir Putih Tulang */}
              <path d="M22,38 L28,68 Q50,73 72,68 L78,38 Z" fill="#F4EFE6" stroke="#D3C5AB" strokeWidth="1.5" />
              <ellipse cx="50" cy="38" rx="28" ry="6" fill="#2E170B" />
              {/* Pegangan Cangkir */}
              <path d="M76,43 C90,43 90,62 74,64" stroke="#D3C5AB" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
          </div>

          {/* Lampu Teplok / Minyak Antik */}
          <div className="w-16 md:w-20">
            <svg viewBox="0 0 80 140" className="w-full h-auto">
              {/* Nyala Api Lilin / Sumbu */}
              <ellipse cx="40" cy="75" rx="6" ry="14" fill="#FFF2A3" />
              <ellipse cx="40" cy="75" rx="3" ry="8" fill="#FF8C00" />
              <circle cx="40" cy="75" r="18" fill="#FFEAA7" opacity="0.3" />
              {/* Kaca Semprong Bening */}
              <path d="M30,10 C25,45 22,65 24,90 C34,93 46,93 56,90 C58,65 55,45 50,10 Z" fill="rgba(255,255,255,0.2)" stroke="#FFFFFF" strokeWidth="1.5" />
              {/* Penutup & Kenop Pemutar Sumbu */}
              <rect x="25" y="90" width="30" height="12" fill="#996E2E" rx="2" />
              <circle cx="60" cy="96" r="4" fill="#B38638" />
              {/* Wadah Minyak Kaca Bawah */}
              <path d="M24,102 Q12,120 20,132 Q40,137 60,132 Q68,120 56,102 Z" fill="#754E22" stroke="#523412" strokeWidth="1.5" />
            </svg>
          </div>
        </div>

      </div>

      {/* 2. BINGKAI UKIRAN KAYU KLASIK KHAS JAWA (ORNATE CARVED TEAK FRAME) */}
      <div className="absolute inset-0 pointer-events-none z-10 border-[10px] sm:border-[16px] md:border-[20px] border-[#381B09] shadow-[inset_0_0_30px_rgba(0,0,0,0.85)]">
        {/* Ukiran Pojok Kiri Atas */}
        <div className="absolute top-0 left-0 w-20 sm:w-32 md:w-40 h-20 sm:h-32 md:h-40">
          <svg viewBox="0 0 100 100" className="w-full h-full text-[#241105]">
            <path d="M0,0 L100,0 C70,10 50,30 40,50 C30,70 10,70 0,100 Z" fill="currentColor" opacity="0.95" />
            <path d="M12,12 Q40,25 35,55 Q20,40 12,12 Z" fill="#5E3114" />
            <circle cx="28" cy="28" r="4" fill="#C59B4D" />
          </svg>
        </div>

        {/* Ukiran Pojok Kanan Atas */}
        <div className="absolute top-0 right-0 w-20 sm:w-32 md:w-40 h-20 sm:h-32 md:h-40">
          <svg viewBox="0 0 100 100" className="w-full h-full text-[#241105] -scale-x-100">
            <path d="M0,0 L100,0 C70,10 50,30 40,50 C30,70 10,70 0,100 Z" fill="currentColor" opacity="0.95" />
            <path d="M12,12 Q40,25 35,55 Q20,40 12,12 Z" fill="#5E3114" />
            <circle cx="28" cy="28" r="4" fill="#C59B4D" />
          </svg>
        </div>

        {/* Ukiran Pojok Kiri Bawah */}
        <div className="absolute bottom-0 left-0 w-16 sm:w-28 md:w-36 h-16 sm:h-28 md:h-36">
          <svg viewBox="0 0 100 100" className="w-full h-full text-[#241105] -scale-y-100">
            <path d="M0,0 L100,0 C70,10 50,30 40,50 C30,70 10,70 0,100 Z" fill="currentColor" opacity="0.95" />
            <path d="M12,12 Q40,25 35,55 Q20,40 12,12 Z" fill="#5E3114" />
          </svg>
        </div>

        {/* Ukiran Pojok Kanan Bawah */}
        <div className="absolute bottom-0 right-0 w-16 sm:w-28 md:w-36 h-16 sm:h-28 md:h-36">
          <svg viewBox="0 0 100 100" className="w-full h-full text-[#241105] -scale-x-100 -scale-y-100">
            <path d="M0,0 L100,0 C70,10 50,30 40,50 C30,70 10,70 0,100 Z" fill="currentColor" opacity="0.95" />
            <path d="M12,12 Q40,25 35,55 Q20,40 12,12 Z" fill="#5E3114" />
          </svg>
        </div>
      </div>

      {/* 3. CENTER CARD LOGIN BERGAYA JAWA KLASIK (IDENTIK DENGAN GAMBAR USER) */}
      <div className="relative z-20 w-full max-w-[420px] sm:max-w-[460px] my-auto">
        
        {/* Tombol Cepat Kembali ke Toko (Di Luar Kartu, Mobile Friendly) */}
        <div className="flex items-center justify-between mb-3 px-1">
          <button
            type="button"
            onClick={onBackToStore}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#3D1E0C]/80 hover:bg-[#3D1E0C] text-[#F3E5D0] text-xs font-semibold backdrop-blur-xs border border-[#C59B4D]/30 transition-all cursor-pointer shadow-md"
          >
            <ArrowLeft size={13} />
            <span>Kembali ke Toko</span>
          </button>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#C59B4D]/20 border border-[#C59B4D]/40 text-[#FFE7B8] text-[11px] font-bold">
            <ShieldCheck size={13} className="text-[#F2C063]" />
            <span>Gerbang Admin Aman</span>
          </div>
        </div>

        {/* Main Cream / Ivory Card */}
        <div 
          className="relative rounded-[28px] sm:rounded-[34px] overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] border-2 border-[#D8BE9A]/80 p-6 sm:p-8"
          style={{
            background: 'linear-gradient(180deg, #FBF8F3 0%, #F5EFE6 45%, #EFE5D6 100%)',
          }}
        >
          
          {/* ORNAMEN BATIK POJOK KARTU (4 Sudut - Khas Batik Kawung & Parang Nusantara) */}
          
          {/* Kiri Atas */}
          <div className="absolute top-0 left-0 w-16 sm:w-20 h-16 sm:h-20 pointer-events-none opacity-90">
            <svg viewBox="0 0 80 80" className="w-full h-full">
              <path d="M0,0 L80,0 C60,15 40,35 30,55 C20,70 10,75 0,80 Z" fill="#422513" />
              {/* Motif Batik Geometris Kawung */}
              <ellipse cx="22" cy="22" rx="14" ry="7" fill="#C59B4D" transform="rotate(45 22 22)" opacity="0.85" />
              <circle cx="22" cy="22" r="3.5" fill="#FAF5EE" />
              <ellipse cx="48" cy="12" rx="8" ry="4" fill="#C59B4D" transform="rotate(20 48 12)" opacity="0.8" />
              <ellipse cx="12" cy="48" rx="8" ry="4" fill="#C59B4D" transform="rotate(70 12 48)" opacity="0.8" />
            </svg>
          </div>

          {/* Kanan Atas */}
          <div className="absolute top-0 right-0 w-16 sm:w-20 h-16 sm:h-20 pointer-events-none opacity-90">
            <svg viewBox="0 0 80 80" className="w-full h-full -scale-x-100">
              <path d="M0,0 L80,0 C60,15 40,35 30,55 C20,70 10,75 0,80 Z" fill="#422513" />
              <ellipse cx="22" cy="22" rx="14" ry="7" fill="#C59B4D" transform="rotate(45 22 22)" opacity="0.85" />
              <circle cx="22" cy="22" r="3.5" fill="#FAF5EE" />
              <ellipse cx="48" cy="12" rx="8" ry="4" fill="#C59B4D" transform="rotate(20 48 12)" opacity="0.8" />
              <ellipse cx="12" cy="48" rx="8" ry="4" fill="#C59B4D" transform="rotate(70 12 48)" opacity="0.8" />
            </svg>
          </div>

          {/* Kiri Bawah */}
          <div className="absolute bottom-0 left-0 w-16 sm:w-20 h-16 sm:h-20 pointer-events-none opacity-90">
            <svg viewBox="0 0 80 80" className="w-full h-full -scale-y-100">
              <path d="M0,0 L80,0 C60,15 40,35 30,55 C20,70 10,75 0,80 Z" fill="#422513" />
              <ellipse cx="22" cy="22" rx="14" ry="7" fill="#C59B4D" transform="rotate(45 22 22)" opacity="0.85" />
              <circle cx="22" cy="22" r="3.5" fill="#FAF5EE" />
              <ellipse cx="48" cy="12" rx="8" ry="4" fill="#C59B4D" transform="rotate(20 48 12)" opacity="0.8" />
              <ellipse cx="12" cy="48" rx="8" ry="4" fill="#C59B4D" transform="rotate(70 12 48)" opacity="0.8" />
            </svg>
          </div>

          {/* Kanan Bawah */}
          <div className="absolute bottom-0 right-0 w-16 sm:w-20 h-16 sm:h-20 pointer-events-none opacity-90">
            <svg viewBox="0 0 80 80" className="w-full h-full -scale-x-100 -scale-y-100">
              <path d="M0,0 L80,0 C60,15 40,35 30,55 C20,70 10,75 0,80 Z" fill="#422513" />
              <ellipse cx="22" cy="22" rx="14" ry="7" fill="#C59B4D" transform="rotate(45 22 22)" opacity="0.85" />
              <circle cx="22" cy="22" r="3.5" fill="#FAF5EE" />
              <ellipse cx="48" cy="12" rx="8" ry="4" fill="#C59B4D" transform="rotate(20 48 12)" opacity="0.8" />
              <ellipse cx="12" cy="48" rx="8" ry="4" fill="#C59B4D" transform="rotate(70 12 48)" opacity="0.8" />
            </svg>
          </div>

          {/* ISI KONTEN UTAMA */}
          <div className="relative z-10 flex flex-col items-center text-center">
            
            {/* Header Brand Logo */}
            <div className="mt-1">
              <h2 className="text-2xl sm:text-[28px] font-black tracking-tight flex items-center justify-center">
                <span className="text-[#2C190D] font-serif font-black">Wayahe</span>
                <span className="text-[#B58532] font-sans font-extrabold ml-0.5">Digital</span>
              </h2>
              <span className="block text-[10px] sm:text-[11px] font-extrabold tracking-[0.22em] text-[#866D57] uppercase mt-0.5">
                ADMIN PANEL
              </span>
            </div>

            {/* Sapaan Jawa atau Judul 2FA */}
            <div className="mt-5 sm:mt-6 mb-5">
              <h1 
                className="text-2xl sm:text-[30px] font-bold text-[#221307] tracking-tight leading-tight"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                {loginStep === '2FA_OTP' ? 'Verifikasi Dua Langkah' : 'Sugeng Rawuh Admin'}
              </h1>
              <p className="text-xs sm:text-sm text-[#745E49] mt-1 font-medium">
                {loginStep === '2FA_OTP' 
                  ? 'Buka Google Authenticator di HP Anda & ketik 6 angka token' 
                  : 'Silakan Masuk untuk Mengelola'}
              </p>
            </div>

            {/* Notifikasi Pesan Kesalahan jika ada */}
            {errorMessage && (
              <div className="w-full mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2 text-left animate-shake">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* STEP 1: FORM LOGIN USERNAME & PASSWORD */}
            {loginStep === 'CREDENTIALS' && (
              <form onSubmit={handleLogin} className="w-full space-y-3.5">
                
                {/* Field 1: Nama Pengguna / Email */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8A715A]">
                    <UserIcon size={18} />
                  </div>
                  <input
                    type="text"
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    placeholder="Nama Pengguna / Email"
                    className="w-full pl-10 pr-4 py-3 sm:py-3.5 rounded-2xl bg-white border border-[#D5BE9E] text-sm text-black font-semibold placeholder-[#866D57] focus:outline-none focus:ring-2 focus:ring-[#C59B4D] focus:border-[#C59B4D] focus:bg-white transition-all shadow-inner"
                    autoComplete="username"
                    autoFocus
                  />
                </div>

                {/* Field 2: Kata Sandi */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8A715A]">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Kata Sandi"
                    className="w-full pl-10 pr-11 py-3 sm:py-3.5 rounded-2xl bg-white border border-[#D5BE9E] text-sm text-black font-semibold placeholder-[#866D57] focus:outline-none focus:ring-2 focus:ring-[#C59B4D] focus:border-[#C59B4D] focus:bg-white transition-all shadow-inner"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#8A715A] hover:text-[#422513] transition-colors cursor-pointer"
                    title={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Link Lupa Kata Sandi */}
                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-xs font-semibold text-[#7D644F] hover:text-[#996E2E] hover:underline cursor-pointer transition-colors"
                  >
                    Lupa Kata Sandi?
                  </button>
                </div>

                {/* Tombol Utama MASUK */}
                <button
                  type="submit"
                  id="btn-admin-login-submit"
                  disabled={isLoading}
                  className="w-full py-3.5 sm:py-4 px-6 rounded-2xl font-black text-sm sm:text-base tracking-[0.18em] uppercase text-[#261407] transition-all duration-200 transform hover:brightness-105 active:scale-[0.99] cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed border border-[#ECC47E]"
                  style={{
                    background: 'linear-gradient(180deg, #E2B86C 0%, #CF9E4D 60%, #B88432 100%)',
                    boxShadow: '0 8px 24px -4px rgba(184, 132, 50, 0.45), inset 0 1px 1px rgba(255,255,255,0.7)',
                    textShadow: '0 1px 0 rgba(255,255,255,0.35)',
                  }}
                >
                  {isLoading ? (
                    <span className="inline-flex items-center gap-2 text-[#261407]">
                      <span className="w-4 h-4 border-2 border-[#261407] border-t-transparent rounded-full animate-spin" />
                      <span>Memverifikasi...</span>
                    </span>
                  ) : (
                    'MASUK'
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: FORM VERIFIKASI GOOGLE AUTHENTICATOR (2FA) */}
            {loginStep === '2FA_OTP' && (
              <form onSubmit={handleVerifyTotp} className="w-full space-y-4 animate-fadeIn">
                <div className="p-3.5 rounded-2xl bg-[#F4ECDE] border border-[#D5BE9E] flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-xl bg-[#422513] text-[#F2C063] flex items-center justify-center shrink-0 shadow-sm">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#3B1F0D] block">
                      Google Authenticator Terpasang
                    </span>
                    <span className="text-[11px] text-[#745E49] leading-tight block">
                      Akun {pendingSession?.name} diamankan dengan kode verifikasi 6 angka
                    </span>
                  </div>
                </div>

                {/* 6-Digit OTP Input */}
                <div className="space-y-1">
                  <input
                    type="text"
                    maxLength={6}
                    value={totpInput}
                    onChange={(e) => setTotpInput(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="• • • • • •"
                    className="w-full py-3.5 rounded-2xl bg-white border-2 border-[#C59B4D] text-center text-2xl font-mono font-black tracking-[0.3em] text-[#2C190D] placeholder-[#D5BE9E] focus:outline-none focus:ring-4 focus:ring-[#C59B4D]/30 transition-all shadow-inner"
                    autoFocus
                  />
                  <span className="text-[10px] text-[#866D57] block text-center">
                    Masukkan 6 angka yang tampil di layar HP Anda
                  </span>
                </div>

                {/* Tombol Verifikasi */}
                <button
                  type="submit"
                  disabled={isVerifyingTotp || totpInput.length < 6}
                  className="w-full py-3.5 sm:py-4 px-6 rounded-2xl font-black text-sm sm:text-base tracking-[0.18em] uppercase text-[#261407] transition-all duration-200 transform hover:brightness-105 active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-[#ECC47E]"
                  style={{
                    background: 'linear-gradient(180deg, #E2B86C 0%, #CF9E4D 60%, #B88432 100%)',
                    boxShadow: '0 8px 24px -4px rgba(184, 132, 50, 0.45), inset 0 1px 1px rgba(255,255,255,0.7)',
                    textShadow: '0 1px 0 rgba(255,255,255,0.35)',
                  }}
                >
                  {isVerifyingTotp ? (
                    <span className="inline-flex items-center gap-2 text-[#261407]">
                      <span className="w-4 h-4 border-2 border-[#261407] border-t-transparent rounded-full animate-spin" />
                      <span>Memvalidasi Token...</span>
                    </span>
                  ) : (
                    'VERIFIKASI & MASUK'
                  )}
                </button>

                {/* Tombol Kembali ke Step 1 */}
                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginStep('CREDENTIALS');
                      setErrorMessage(null);
                    }}
                    className="text-xs font-bold text-[#7D644F] hover:text-[#2C190D] transition-colors cursor-pointer"
                  >
                    ← Kembali ke Login Sandi
                  </button>
                </div>
              </form>
            )}

            {/* FOOTER KARTU */}
            <div className="mt-6 text-[11px] text-[#866F5A] space-y-1.5">
              <p>Hak Cipta © 2024 WayaheDigital | Admin Portal</p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowHelpModal(true)}
                  className="hover:text-[#422513] hover:underline cursor-pointer"
                >
                  Bantuan
                </button>
                <span>|</span>
                <button
                  type="button"
                  onClick={() => setShowHelpModal(true)}
                  className="hover:text-[#422513] hover:underline cursor-pointer"
                >
                  Syarat
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* 4. MODAL LUPA KATA SANDI */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-[#FAF6F0] rounded-3xl p-6 border-2 border-[#D8BE9A] shadow-2xl text-[#2B180B] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3D1BA]">
              <div className="flex items-center gap-2">
                <KeyRound size={20} className="text-[#C59B4D]" />
                <h3 className="font-bold text-base text-[#241307]">Bantuan Lupa Kata Sandi</h3>
              </div>
              <button 
                onClick={() => setShowForgotModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-[#EFE4D2] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-[#614D3C] leading-relaxed">
              <p>
                Demi menjaga keamanan data transaksi dan saldo sistem, kredensial administrator tidak disimpan secara terbuka.
              </p>
              <div className="p-3.5 rounded-2xl bg-white/90 border border-[#DECAAF] shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-[#241307] font-bold text-xs">
                  <ShieldCheck size={16} className="text-[#C59B4D]" />
                  <span>Petunjuk Pemulihan:</span>
                </div>
                <ul className="list-disc list-inside space-y-1.5 text-[#614D3C] text-[11px]">
                  <li>Silakan hubungi pemilik website / Super Administrator untuk melakukan pengecekan akun.</li>
                  <li>Kata sandi dan username dapat diperbarui melalui pengaturan administrator setelah berhasil masuk.</li>
                </ul>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-[#E3D1BA] flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="px-4 py-2 rounded-xl bg-[#C59B4D] hover:bg-[#B38734] text-white text-xs font-bold cursor-pointer transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL BANTUAN & SYARAT */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#FAF6F0] rounded-2xl p-6 border-2 border-[#D8BE9A] shadow-2xl text-[#2B180B]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3D1BA]">
              <div className="flex items-center gap-2">
                <HelpCircle size={20} className="text-[#C59B4D]" />
                <h3 className="font-bold text-base text-[#241307]">Ketentuan Portal Admin</h3>
              </div>
              <button 
                onClick={() => setShowHelpModal(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-[#EFE4D2] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-2.5 text-xs text-[#614D3C] leading-relaxed">
              <p>
                <strong>1. Kerahasiaan Kredensial:</strong> Setiap sesi login dicatat dalam log audit sistem (audit logs) untuk mencegah penyalahgunaan data pesanan dan voucher WiFi.
              </p>
              <p>
                <strong>2. Pengelolaan Inventori:</strong> Administrator berhak mengimpor batch kode voucher WiFi RT/RW Net dan mengubah harga jual produk pulsa/kuota secara real-time.
              </p>
              <p>
                <strong>3. Eksekusi Pembayaran:</strong> Transaksi yang telah diverifikasi oleh Webhook Payment Gateway akan diteruskan otomatis ke Digiflazz atau alokasi voucher fisik.
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-[#E3D1BA] flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 rounded-xl bg-[#C59B4D] hover:bg-[#B38734] text-white text-xs font-bold cursor-pointer transition-colors"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
