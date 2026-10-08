import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, 
  LogIn, 
  UserPlus, 
  LogOut, 
  ReceiptText, 
  Ticket, 
  ShieldCheck, 
  Copy, 
  Phone, 
  Mail, 
  CheckCircle2, 
  Lock, 
  Sparkles,
  Gift,
  Zap,
  Smartphone,
  Check,
  Star,
  Wallet,
  Award,
  Clock,
  Key,
  Shield,
  Tag,
  AlertCircle,
  Crown,
  Eye,
  EyeOff,
  AtSign,
  X,
} from 'lucide-react';
import { User, Order, RegisteredMemberAccount } from '../types';
import { storage } from '../services/storage';
import { formatRupiah, formatDateWIB } from '../utils/operator';
import { PaymentStatusBadge, FulfillmentStatusBadge } from '../components/StatusBadge';
import { ProductLogo } from '../components/ProductLogo';

interface AkunPageProps {
  currentUser: User | null;
  orders: Order[];
  initialAuthRole?: 'LOGIN' | 'REGISTER';
  onUserChange: (user: User | null) => void;
  onOpenInvoice: (order: Order) => void;
  onCopyText: (text: string, label: string) => void;
  onShowToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export function AkunPage({
  currentUser,
  orders,
  initialAuthRole,
  onUserChange,
  onOpenInvoice,
  onCopyText,
  onShowToast,
}: AkunPageProps) {
  // Auth Role: 'LOGIN' vs 'REGISTER'
  const [authRole, setAuthRole] = useState<'LOGIN' | 'REGISTER'>(() => {
    if (initialAuthRole) return initialAuthRole;
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      const path = window.location.pathname.toLowerCase();
      if (hash.includes('daftar') || hash.includes('register') || path.includes('daftar') || path.includes('register')) {
        return 'REGISTER';
      }
    }
    return 'LOGIN';
  });

  useEffect(() => {
    if (initialAuthRole) {
      setAuthRole(initialAuthRole);
    }
  }, [initialAuthRole]);

  // Form Fields
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Dashboard Sub-Tab (Ketika sudah login)
  const [memberTab, setMemberTab] = useState<'SUMMARY' | 'VOUCHERS' | 'PROMOS' | 'SETTINGS'>('SUMMARY');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Edit Profile form state
  const [profileName, setProfileName] = useState(currentUser?.name || '');
  const [profilePhone, setProfilePhone] = useState(currentUser?.phone || '');

  // Top Up Saldo Simulation Modal
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number>(50000);

  const [memberBusy, setMemberBusy] = useState(false);
  useEffect(() => {
    setProfileName(currentUser?.name || '');
    setProfilePhone(currentUser?.phone || '');
    if (currentUser) storage.hydrateMemberOrders().catch(() => {});
  }, [currentUser?.id]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); if (memberBusy) return; setMemberBusy(true);
    try {
      const user = await storage.registerMember({ username: regUsername.trim().toLowerCase(), email: regEmail.trim().toLowerCase(), password: regPassword, name: regName.trim(), phone: regPhone.trim() });
      setRegPassword(''); onUserChange(user);
      setProfileName(user.name); setProfilePhone(user.phone);
      onShowToast('Pendaftaran Berhasil', 'Akun tersimpan di database dan dapat digunakan di perangkat lain. Saldo awal Rp 0.', 'success');
    } catch (e) { onShowToast('Pendaftaran Gagal', e instanceof Error ? e.message : 'Silakan coba lagi.', 'error'); }
    finally { setMemberBusy(false); }
  };
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); if (memberBusy) return; setMemberBusy(true);
    try {
      const user = await storage.loginMember(loginIdentifier, loginPassword);
      setLoginPassword(''); onUserChange(user);
      setProfileName(user.name); setProfilePhone(user.phone);
      onShowToast('Berhasil Masuk', `Selamat datang, ${user.name}.`, 'success');
    } catch (e) { onShowToast('Login Gagal', e instanceof Error ? e.message : 'Silakan coba lagi.', 'error'); }
    finally { setMemberBusy(false); }
  };
  const handleLogout = async () => {
    try { await storage.logoutMember(); onUserChange(null); onShowToast('Keluar Akun', 'Sesi server telah berakhir.', 'info'); }
    catch (e) { onShowToast('Logout Gagal', e instanceof Error ? e.message : 'Silakan coba lagi.', 'error'); }
  };
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault(); if (!currentUser || memberBusy) return; setMemberBusy(true);
    try { const user = await storage.updateMemberProfile(profileName); onUserChange(user); onShowToast('Profil Disimpan', 'Profil dikonfirmasi tersimpan di database.', 'success'); }
    catch (e) { onShowToast('Simpan Gagal', e instanceof Error ? e.message : 'Silakan coba lagi.', 'error'); }
    finally { setMemberBusy(false); }
  };
  const handleConfirmTopUp = () => {
    setShowTopUpModal(false);
    onShowToast('Top Up Belum Tersedia', 'Saldo hanya berubah setelah pembayaran yang diverifikasi server. Simulasi saldo dinonaktifkan.', 'warning');
  };
  const userOrders = currentUser ? storage.getMemberOrders() : [];

  // User Vouchers (WiFi Hotspot & Akun Premium)
  const userVouchers = userOrders.filter(
    o => o.paymentStatus === 'PAID' && 
         (o.fulfillmentResult?.voucherCode || o.category === 'wifi' || o.category === 'premium')
  );

  const activePromos = [
    {
      code: 'MEMBERBARU',
      title: 'Diskon Spesial Member Baru',
      discount: 'Rp 5.000',
      minTx: 'Rp 10.000',
      tag: 'Eksklusif Member',
      desc: 'Berlaku untuk semua voucher WiFi hotspot, paket kuota & lisensi premium.'
    },
    {
      code: 'WAYAHEHEMAT',
      title: 'Potongan Belanja Digital Warga',
      discount: 'Rp 3.000',
      minTx: 'Rp 20.000',
      tag: 'Semua Produk',
      desc: 'Nikmati kupon hemat otomatis untuk transaksi di atas Rp 20.000.'
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8 text-[#FAF4EB]">
      {/* 1. JIKA PENGGUNA BELUM LOGIN: FORM LOGIN GMAIL DENGAN KODE VERIFIKASI */}
      {!currentUser ? (
        <div className="max-w-lg mx-auto space-y-6">
          {/* Header Card */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-[#D4A359]/30 to-[#D4A359]/10 border-2 border-[#D4A359] text-[#D4A359] flex items-center justify-center mx-auto shadow-lg shadow-[#D4A359]/20">
              <Crown size={28} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#FAF4EB] tracking-tight">
              {authRole === 'REGISTER' ? 'Pendaftaran Member Wayahe' : 'Masuk Akun Member'}
            </h1>
            <p className="text-xs sm:text-sm text-[#A89F91]">
              {authRole === 'REGISTER'
                ? 'Daftar dengan username, email & kata sandi untuk bergabung menjadi member Wayahe Digital.'
                : 'Masuk dengan Username atau Gmail & kata sandi Anda untuk akses brankas voucher dan riwayat pesanan.'}
            </p>
          </div>

          {/* Mandatory Buyer Registration Notice */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2.5">
            <AlertCircle size={18} className="text-amber-400 shrink-0" />
            <p className="leading-relaxed">
              <strong>Ketentuan Pembeli:</strong> Semua pembeli wajib mendaftar akun member terlebih dahulu sebelum membeli. Setelah mendaftar, Anda otomatis mendapatkan dashboard pribadi dengan <strong>sisa saldo dompet</strong> dan <strong>riwayat transaksi</strong>.
            </p>
          </div>

          {/* Main Auth Card (Squircle) */}
          <div className="bg-gradient-to-b from-[#221B16] to-[#17130F] border border-[#3E342B] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            {/* Primary Role Switcher: [Masuk / Login] vs [Daftar Akun Baru] */}
            <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-[#14100D] border border-[#3E342B]/80 text-xs font-bold gap-1">
              <button
                type="button"
                onClick={() => setAuthRole('LOGIN')}
                className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  authRole === 'LOGIN'
                    ? 'bg-[#D4A359] text-[#181411] shadow-md font-black'
                    : 'text-[#A89F91] hover:text-[#FAF4EB]'
                }`}
              >
                <LogIn size={15} />
                <span>Masuk (Login)</span>
              </button>

              <button
                type="button"
                onClick={() => setAuthRole('REGISTER')}
                className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  authRole === 'REGISTER'
                    ? 'bg-[#D4A359] text-[#181411] shadow-md font-black'
                    : 'text-[#A89F91] hover:text-[#FAF4EB]'
                }`}
              >
                <UserPlus size={15} />
                <span>Daftar Akun</span>
              </button>
            </div>

            {/* FORM UTAMA (ROLE DAFTAR ATAU ROLE LOGIN) */}
            <div className="space-y-5">
                {/* 1. ROLE DAFTAR: NAMA, NO HP, USERNAME, EMAIL, PASSWORD */}
                {authRole === 'REGISTER' && (
                  <form onSubmit={handleRegister} className="space-y-3.5">
                    {/* Input Nama Lengkap */}
                    <div>
                      <label className="block text-xs font-bold text-[#D5CEBF] mb-1 flex items-center justify-between">
                        <span>Nama Lengkap / Panggilan</span>
                        <span className="text-[10px] text-[#D4A359]">Untuk sapaan di dashboard</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="contoh: Joko Prasetyo"
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl bg-[#14100D] border border-[#3E342B] text-[#FAF4EB] focus:outline-none focus:border-[#D4A359] focus:ring-2 focus:ring-[#D4A359]/20"
                        />
                        <UserIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A89F91]" />
                      </div>
                    </div>

                    {/* Input Nomor WhatsApp / HP */}
                    <div>
                      <label className="block text-xs font-bold text-[#D5CEBF] mb-1 flex items-center justify-between">
                        <span>Nomor WhatsApp / HP</span>
                        <span className="text-[10px] text-[#A89F91]">Bisa digunakan untuk login & notif</span>
                      </label>
                      <div className="relative">
                        <input
                          type="tel"
                          required
                          placeholder="contoh: 081234567890"
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl bg-[#14100D] border border-[#3E342B] text-[#FAF4EB] focus:outline-none focus:border-[#D4A359] focus:ring-2 focus:ring-[#D4A359]/20"
                        />
                        <Smartphone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A89F91]" />
                      </div>
                    </div>

                    {/* Input Username */}
                    <div>
                      <label className="block text-xs font-bold text-[#D5CEBF] mb-1 flex items-center justify-between">
                        <span>Username Member</span>
                        <span className="text-[10px] text-[#A89F91]">Min. 3 karakter (huruf/angka)</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="contoh: joko_digital"
                          value={regUsername}
                          onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                          className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl bg-[#14100D] border border-[#3E342B] text-[#FAF4EB] focus:outline-none focus:border-[#D4A359] focus:ring-2 focus:ring-[#D4A359]/20"
                        />
                        <AtSign size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A89F91]" />
                      </div>
                    </div>

                    {/* Input Email (Gmail) */}
                    <div>
                      <label className="block text-xs font-bold text-[#D5CEBF] mb-1 flex items-center justify-between">
                        <span>Alamat Email (Gmail)</span>
                        <span className="text-[10px] text-[#D4A359]">Untuk bukti order & invoice</span>
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          required
                          placeholder="nama.anda@gmail.com"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl bg-[#14100D] border border-[#3E342B] text-[#FAF4EB] focus:outline-none focus:border-[#D4A359] focus:ring-2 focus:ring-[#D4A359]/20"
                        />
                        <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A89F91]" />
                      </div>
                    </div>

                    {/* Input Password */}
                    <div>
                      <label className="block text-xs font-bold text-[#D5CEBF] mb-1 flex items-center justify-between">
                        <span>Kata Sandi (Password)</span>
                        <span className="text-[10px] text-[#A89F91]">Min. 8 karakter</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showRegPassword ? 'text' : 'password'}
                          required
                          placeholder="Minimal 8 karakter rahasia"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm rounded-2xl bg-[#14100D] border border-[#3E342B] text-[#FAF4EB] focus:outline-none focus:border-[#D4A359] focus:ring-2 focus:ring-[#D4A359]/20"
                        />
                        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A89F91]" />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A89F91] hover:text-white cursor-pointer"
                        >
                          {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Member Welcome Bonus Highlight */}
                    <div className="p-3 rounded-2xl bg-gradient-to-r from-[#D4A359]/15 to-emerald-500/10 border border-[#D4A359]/40 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[#D4A359]/20 text-[#D4A359] flex items-center justify-center shrink-0">
                        <Gift size={18} />
                      </div>
                      <div className="text-xs">
                        <p className="font-black text-[#D4A359]">Akun tersimpan aman di database</p>
                        <p className="text-[11px] text-[#D5CEBF]">
                          Gunakan akun yang sama di perangkat lain. Saldo awal Rp 0; tidak ada bonus saldo otomatis.
                        </p>
                      </div>
                    </div>

                    {/* Submit Register Button */}
                    <button
                      type="submit"
                      disabled={memberBusy}
                      className="w-full py-3 px-4 rounded-2xl font-black text-xs sm:text-sm bg-gradient-to-r from-[#D4A359] via-[#E2B774] to-[#C08F47] text-[#181411] hover:brightness-110 active:scale-[0.99] transition-all shadow-lg shadow-[#D4A359]/20 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <UserPlus size={16} />
                      <span>Daftar Akun</span>
                    </button>
                  </form>
                )}

                {/* 2. ROLE LOGIN: GMAIL / USERNAME / NO WHATSAPP & PASSWORD */}
                {authRole === 'LOGIN' && (
                  <form onSubmit={handleLogin} className="space-y-4">
                    {/* Input Identifier */}
                    <div>
                      <label className="block text-xs font-bold text-[#D5CEBF] mb-1.5 flex items-center justify-between">
                        <span>Username, Gmail, atau No. WhatsApp</span>
                        <span className="text-[10px] text-[#D4A359]">Pilih salah satu</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="Masukkan username, email@gmail.com, atau 08xxx"
                          value={loginIdentifier}
                          onChange={(e) => setLoginIdentifier(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl bg-[#14100D] border border-[#3E342B] text-[#FAF4EB] focus:outline-none focus:border-[#D4A359] focus:ring-2 focus:ring-[#D4A359]/20"
                        />
                        <UserIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A89F91]" />
                      </div>
                    </div>

                    {/* Input Password */}
                    <div>
                      <label className="block text-xs font-bold text-[#D5CEBF] mb-1.5">
                        Kata Sandi (Password)
                      </label>
                      <div className="relative">
                        <input
                          type={showLoginPassword ? 'text' : 'password'}
                          required
                          placeholder="Masukkan kata sandi akun Anda"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm rounded-2xl bg-[#14100D] border border-[#3E342B] text-[#FAF4EB] focus:outline-none focus:border-[#D4A359] focus:ring-2 focus:ring-[#D4A359]/20"
                        />
                        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A89F91]" />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A89F91] hover:text-white cursor-pointer"
                        >
                          {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Submit Login Button */}
                    <button
                      type="submit"
                      disabled={memberBusy}
                      className="w-full py-3 px-4 rounded-2xl font-black text-xs sm:text-sm bg-[#D4A359] hover:bg-[#C08F47] text-[#181411] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                    >
                      <LogIn size={16} />
                      <span>Masuk ke Akun Member</span>
                    </button>
                  </form>
                )}



                {/* Footer Switcher */}
                <div className="text-center pt-2 text-xs text-[#A89F91]">
                  {authRole === 'REGISTER' ? (
                    <p>
                      Sudah punya akun member?{' '}
                      <button
                        type="button"
                        onClick={() => setAuthRole('LOGIN')}
                        className="text-[#D4A359] font-bold hover:underline cursor-pointer ml-1"
                      >
                        Masuk di sini
                      </button>
                    </p>
                  ) : (
                    <p>
                      Belum punya akun member?{' '}
                      <button
                        type="button"
                        onClick={() => setAuthRole('REGISTER')}
                        className="text-[#D4A359] font-bold hover:underline cursor-pointer ml-1"
                      >
                        Daftar Akun Baru
                      </button>
                    </p>
                  )}
                </div>
              </div>
          </div>
        </div>
      ) : (
        /* 2. JIKA PENGGUNA SUDAH LOGIN: DASHBOARD MEMBER YANG SANGAT BAGUS */
        <div className="space-y-6">
          {/* A. HEADER PROFIL MEMBER UTAMA (CARD SQUIRCLE MEWAH) */}
          <div className="relative bg-gradient-to-r from-[#2B221A] via-[#221B15] to-[#18130F] border-2 border-[#D4A359]/70 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-0 right-0 w-72 h-72 bg-[#D4A359]/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              {/* Avatar & User Details */}
              <div className="flex items-center gap-4 sm:gap-5">
                {/* Squircle Avatar */}
                <div className="relative shrink-0">
                  <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-[#14100D] border-2 border-[#D4A359] p-1 shadow-lg shadow-[#D4A359]/20 overflow-hidden flex items-center justify-center">
                    {currentUser.avatar ? (
                      <img
                        src={currentUser.avatar}
                        alt={currentUser.name}
                        className="w-full h-full object-cover rounded-xl sm:rounded-2xl"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-[#D4A359] to-[#F1C888] text-[#181411] font-black text-2xl flex items-center justify-center rounded-xl sm:rounded-2xl">
                        {currentUser.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#84A951] border-2 border-[#18130F] flex items-center justify-center shadow-xs" title="Online">
                    <Check size={11} className="text-[#14100D] stroke-[3]" />
                  </span>
                </div>

                {/* Name & Badges */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-black text-[#FAF4EB]">
                      {currentUser.name}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-[#D4A359]/20 text-[#D4A359] border border-[#D4A359]/50 shadow-xs flex items-center gap-1">
                      <Crown size={11} />
                      <span>{currentUser.memberTier || 'MEMBER'}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[#A89F91] flex-wrap">
                    <span className="flex items-center gap-1">
                      <Mail size={13} className="text-[#D4A359]" />
                      <span>{currentUser.email}</span>
                    </span>
                    {currentUser.isGmailVerified && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#84A951] bg-[#84A951]/15 px-2 py-0.5 rounded-full border border-[#84A951]/30">
                        <CheckCircle2 size={11} />
                        <span>Gmail Terverifikasi</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Phone size={13} className="text-[#D4A359]" />
                      <span>{currentUser.phone}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Saldo Dompet Member & Quick Action */}
              <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap bg-[#14100D]/80 backdrop-blur-sm p-3.5 sm:p-4 rounded-2xl border border-[#3E342B] md:self-stretch justify-between">
                <div>
                  <div className="text-[10px] font-bold text-[#A89F91] uppercase tracking-wider flex items-center gap-1">
                    <Wallet size={12} className="text-[#D4A359]" />
                    <span>Saldo Dompet Member</span>
                  </div>
                  <div className="text-lg sm:text-xl font-black text-[#FAF4EB] mt-0.5">
                    {formatRupiah(currentUser.balance ?? 0)}
                  </div>
                  <div className="text-[10px] text-[#84A951] font-semibold flex items-center gap-1 mt-0.5">
                    <Star size={10} />
                    <span>{currentUser.rewardPoints ?? 0} Poin Reward</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowTopUpModal(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#D4A359] hover:bg-[#C08F47] text-[#181411] font-black text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>+ Top Up Saldo</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-3 py-1 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <LogOut size={10} />
                    <span>Keluar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* B. 4 METRIK STATISTIK CEPAT MEMBER */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-[#1F1914] p-4 rounded-2xl border border-[#3E342B] space-y-1 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#A89F91]">Total Pesanan</span>
                <div className="w-7 h-7 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center">
                  <ReceiptText size={14} />
                </div>
              </div>
              <div className="text-xl font-black text-[#FAF4EB]">{userOrders.length}</div>
              <p className="text-[10px] text-[#84A951]">Transaksi tersimpan</p>
            </div>

            <div className="bg-[#1F1914] p-4 rounded-2xl border border-[#3E342B] space-y-1 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#A89F91]">Voucher Aktif</span>
                <div className="w-7 h-7 rounded-lg bg-[#D4A359]/15 text-[#D4A359] flex items-center justify-center">
                  <Ticket size={14} />
                </div>
              </div>
              <div className="text-xl font-black text-[#FAF4EB]">{userVouchers.length}</div>
              <p className="text-[10px] text-[#D4A359]">Siap digunakan</p>
            </div>

            <div className="bg-[#1F1914] p-4 rounded-2xl border border-[#3E342B] space-y-1 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#A89F91]">Kupon Promo</span>
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
                  <Tag size={14} />
                </div>
              </div>
              <div className="text-xl font-black text-[#FAF4EB]">2 Kupon</div>
              <p className="text-[10px] text-[#84A951]">Hemat s.d Rp 10.000</p>
            </div>

            <div className="bg-[#1F1914] p-4 rounded-2xl border border-[#3E342B] space-y-1 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#A89F91]">Keamanan Akun</span>
                <div className="w-7 h-7 rounded-lg bg-[#84A951]/15 text-[#84A951] flex items-center justify-center">
                  <ShieldCheck size={14} />
                </div>
              </div>
              <div className="text-xl font-black text-[#84A951]">100% Aman</div>
              <p className="text-[10px] text-[#A89F91]">Data tersimpan di server</p>
            </div>
          </div>

          {/* C. SUB-TAB NAVIGASI DASHBOARD */}
          <div className="flex items-center gap-2 border-b border-[#3E342B] pb-2 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setMemberTab('SUMMARY')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                memberTab === 'SUMMARY'
                  ? 'bg-[#D4A359] text-[#181411] shadow-md font-black'
                  : 'bg-[#181411] text-[#A89F91] hover:text-[#FAF4EB] border border-[#3E342B]'
              }`}
            >
              <Zap size={14} />
              <span>Ringkasan & Promo</span>
            </button>

            <button
              type="button"
              onClick={() => setMemberTab('VOUCHERS')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                memberTab === 'VOUCHERS'
                  ? 'bg-[#D4A359] text-[#181411] shadow-md font-black'
                  : 'bg-[#181411] text-[#A89F91] hover:text-[#FAF4EB] border border-[#3E342B]'
              }`}
            >
              <Ticket size={14} />
              <span>Brankas Voucher ({userVouchers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setMemberTab('PROMOS')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                memberTab === 'PROMOS'
                  ? 'bg-[#D4A359] text-[#181411] shadow-md font-black'
                  : 'bg-[#181411] text-[#A89F91] hover:text-[#FAF4EB] border border-[#3E342B]'
              }`}
            >
              <Gift size={14} />
              <span>Kupon Diskon Member</span>
            </button>

            <button
              type="button"
              onClick={() => setMemberTab('SETTINGS')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                memberTab === 'SETTINGS'
                  ? 'bg-[#D4A359] text-[#181411] shadow-md font-black'
                  : 'bg-[#181411] text-[#A89F91] hover:text-[#FAF4EB] border border-[#3E342B]'
              }`}
            >
              <Shield size={14} />
              <span>Profil & Keamanan</span>
            </button>
          </div>

          {/* D. ISI KONTEN SUB-TAB */}
          {/* TAB 1: RINGKASAN & RIWAYAT PESANAN */}
          {memberTab === 'SUMMARY' && (
            <div className="space-y-6">
              {/* Banner Promo Spesial Member Baru */}
              <div className="p-5 rounded-3xl bg-gradient-to-r from-[#32261B] via-[#241A13] to-[#1A130E] border border-[#D4A359]/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#D4A359]/20 text-[#D4A359] flex items-center justify-center shrink-0 border border-[#D4A359]/40">
                    <Gift size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D4A359] text-[#181411] uppercase font-mono">
                        MEMBERBARU
                      </span>
                      <span className="text-xs font-bold text-[#84A951]">Hemat Rp 5.000</span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-[#FAF4EB] mt-0.5">
                      Kupon Diskon Sambutan Member Baru Anda Siap Dipakai!
                    </h3>
                    <p className="text-[11px] text-[#A89F91]">
                      Gunakan kode kupon di atas saat checkout untuk mendapatkan potongan langsung Rp 5.000.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onCopyText('MEMBERBARU', 'Kode Promo MEMBERBARU')}
                  className="px-4 py-2 rounded-xl bg-[#D4A359] hover:bg-[#C08F47] text-[#181411] font-black text-xs transition-all shadow-md shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <Copy size={13} />
                  <span>Salin Kupon</span>
                </button>
              </div>

              {/* Riwayat Transaksi Member */}
              <div className="bg-[#1C1612] p-5 sm:p-6 rounded-3xl border border-[#3E342B] space-y-4">
                <div className="flex items-center justify-between border-b border-[#3E342B]/80 pb-3">
                  <div>
                    <h3 className="font-bold text-base text-[#FAF4EB]">Riwayat Transaksi Terbaru</h3>
                    <p className="text-xs text-[#A89F91]">Daftar pembelian produk dan voucher digital Anda</p>
                  </div>
                  <span className="text-xs font-bold text-[#D4A359]">
                    {userOrders.length} Transaksi
                  </span>
                </div>

                {userOrders.length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <ReceiptText size={36} className="mx-auto text-[#A89F91]/50" />
                    <p className="text-sm font-bold text-[#D5CEBF]">Belum ada transaksi di akun Anda</p>
                    <p className="text-xs text-[#A89F91]">Mulai belanja pulsa, kuota, voucher WiFi atau akun streaming sekarang.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-4 rounded-2xl bg-[#14100D] border border-[#3E342B]/70 hover:border-[#D4A359]/50 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <ProductLogo
                            provider={ord.items[0]?.provider || 'Wayahe'}
                            category={ord.category}
                            size="sm"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-[#D4A359]">
                                {ord.invoiceNumber}
                              </span>
                              <span className="text-[10px] text-[#A89F91]">
                                {formatDateWIB(ord.createdAt)}
                              </span>
                            </div>
                            <div className="font-bold text-xs sm:text-sm text-[#FAF4EB]">
                              {ord.items[0]?.productName || 'Produk Digital'}
                            </div>
                            <div className="text-[10px] text-[#A89F91]">
                              Tujuan: {ord.targetDestination} • Via {ord.paymentMethod || 'QRIS'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <div className="text-right">
                            <div className="font-black text-sm text-[#FAF4EB]">
                              {formatRupiah(ord.totalAmount)}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                              <PaymentStatusBadge status={ord.paymentStatus} />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => onOpenInvoice(ord)}
                            className="px-3 py-1.5 rounded-xl bg-[#221B16] hover:bg-[#D4A359] text-[#D5CEBF] hover:text-[#181411] border border-[#3E342B] font-bold text-xs transition-colors cursor-pointer"
                          >
                            Invoice
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: BRANKAS VOUCHER SAYA */}
          {memberTab === 'VOUCHERS' && (
            <div className="bg-[#1C1612] p-5 sm:p-7 rounded-3xl border border-[#3E342B] space-y-5">
              <div className="border-b border-[#3E342B]/80 pb-3">
                <h3 className="font-bold text-base text-[#FAF4EB] flex items-center gap-2">
                  <Ticket size={18} className="text-[#D4A359]" />
                  <span>Koleksi Voucher Digital Anda</span>
                </h3>
                <p className="text-xs text-[#A89F91]">
                  Kode voucher WiFi dan lisensi akun premium Anda tersimpan aman dan dapat disalin kapan saja.
                </p>
              </div>

              {userVouchers.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <Ticket size={40} className="mx-auto text-[#A89F91]/50" />
                  <h4 className="font-bold text-sm text-[#FAF4EB]">Belum Ada Voucher yang Dibeli</h4>
                  <p className="text-xs text-[#A89F91] max-w-sm mx-auto">
                    Beli voucher WiFi Hotspot RT/RW Net atau akun premium streaming untuk melihat kode aksesnya di sini.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userVouchers.map((ord) => {
                    const code = ord.fulfillmentResult?.voucherCode || 'MLT24-' + ord.id.slice(-5);
                    const password = ord.fulfillmentResult?.voucherPassword || '123';
                    const isCopied = copiedCode === code;

                    return (
                      <div
                        key={ord.id}
                        className="p-4.5 rounded-3xl bg-gradient-to-br from-[#1E1712] to-[#14100D] border-2 border-dashed border-[#D4A359]/60 space-y-3 relative shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <ProductLogo
                              provider={ord.items[0]?.provider || 'WiFi'}
                              category={ord.category}
                              size="sm"
                            />
                            <div>
                              <span className="text-[10px] font-extrabold uppercase text-[#D4A359] block">
                                {ord.category === 'wifi' ? 'HOTSPOT RT/RW NET' : 'AKUN PREMIUM'}
                              </span>
                              <span className="font-bold text-xs text-[#FAF4EB] block">
                                {ord.items[0]?.productName}
                              </span>
                            </div>
                          </div>

                          <span className="text-[9px] font-black uppercase bg-[#84A951]/20 text-[#84A951] border border-[#84A951]/40 px-2 py-0.5 rounded-full">
                            AKTIF
                          </span>
                        </div>

                        {/* Voucher Code Box */}
                        <div className="p-3 rounded-2xl bg-[#100C09] border border-[#3E342B] flex items-center justify-between">
                          <div>
                            <div className="text-[9px] font-semibold text-[#A89F91] uppercase">Kode Voucher:</div>
                            <div className="font-mono font-black text-sm sm:text-base text-[#D4A359] tracking-wider">
                              {code}
                            </div>
                            {password && (
                              <div className="text-[10px] text-[#A89F91] mt-0.5">
                                Sandi: <span className="font-mono text-white font-bold">{password}</span>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              onCopyText(code, 'Kode Voucher');
                              setCopiedCode(code);
                              setTimeout(() => setCopiedCode(null), 2000);
                            }}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 cursor-pointer ${
                              isCopied
                                ? 'bg-[#84A951] text-[#14100D]'
                                : 'bg-[#D4A359] hover:bg-[#C08F47] text-[#181411]'
                            }`}
                          >
                            {isCopied ? <Check size={12} /> : <Copy size={12} />}
                            <span>{isCopied ? 'Tersalin' : 'Salin'}</span>
                          </button>
                        </div>

                        <div className="text-[10px] text-[#A89F91] flex items-center justify-between pt-1">
                          <span>Lokasi: {ord.targetDestination || 'Hotspot Desa'}</span>
                          <span>{formatDateWIB(ord.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: KUPON DISKON MEMBER */}
          {memberTab === 'PROMOS' && (
            <div className="bg-[#1C1612] p-5 sm:p-7 rounded-3xl border border-[#3E342B] space-y-5">
              <div className="border-b border-[#3E342B]/80 pb-3">
                <h3 className="font-bold text-base text-[#FAF4EB] flex items-center gap-2">
                  <Gift size={18} className="text-[#D4A359]" />
                  <span>Kupon & Voucher Diskon Eksklusif</span>
                </h3>
                <p className="text-xs text-[#A89F91]">
                  Kupon spesial untuk member terdaftar. Gunakan saat checkout untuk menikmati potongan langsung.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activePromos.map((promo, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-3xl bg-gradient-to-br from-[#221B16] to-[#17130F] border border-[#D4A359]/60 space-y-3 relative shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-[#D4A359] bg-[#D4A359]/15 border border-[#D4A359]/30 px-2 py-0.5 rounded-full">
                        {promo.tag}
                      </span>
                      <span className="text-xs font-black text-[#84A951]">
                        Diskon {promo.discount}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-[#FAF4EB]">{promo.title}</h4>
                      <p className="text-xs text-[#A89F91] mt-1">{promo.desc}</p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#14100D] border border-dashed border-[#D4A359]/50 flex items-center justify-between">
                      <div>
                        <div className="text-[9px] uppercase font-semibold text-[#A89F91]">Kode Kupon:</div>
                        <div className="font-mono font-black text-xs sm:text-sm text-[#D4A359] tracking-wider">
                          {promo.code}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onCopyText(promo.code, `Kupon ${promo.code}`)}
                        className="px-3 py-1.5 rounded-lg bg-[#D4A359] hover:bg-[#C08F47] text-[#181411] font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Copy size={12} />
                        <span>Salin</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: PENGATURAN PROFIL & KEAMANAN */}
          {memberTab === 'SETTINGS' && (
            <div className="bg-[#1C1612] p-5 sm:p-7 rounded-3xl border border-[#3E342B] space-y-5">
              <div className="border-b border-[#3E342B]/80 pb-3">
                <h3 className="font-bold text-base text-[#FAF4EB] flex items-center gap-2">
                  <Shield size={18} className="text-[#D4A359]" />
                  <span>Profil & Keamanan Akun Member</span>
                </h3>
                <p className="text-xs text-[#A89F91]">
                  Kelola data kontak WhatsApp, nama pengguna, dan status autentikasi akun Anda.
                </p>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-xs font-bold text-[#D5CEBF] mb-1">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-[#14100D] border border-[#3E342B] text-[#FAF4EB] text-xs sm:text-sm focus:outline-none focus:border-[#D4A359]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#D5CEBF] mb-1">
                    Alamat Email Akun
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      readOnly
                      value={currentUser.email}
                      className="w-full pl-4 pr-24 py-2.5 rounded-2xl bg-[#14100D]/60 border border-[#3E342B] text-[#A89F91] text-xs sm:text-sm cursor-not-allowed font-mono"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#84A951] flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      <span>Verified</span>
                    </span>
                  </div>
                  <p className="text-[10px] text-[#A89F91] mt-1">Email identitas login tersimpan di server. Perubahan email atau nomor HP memerlukan bantuan admin.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#D5CEBF] mb-1">
                    Nomor WhatsApp / HP
                  </label>
                  <input
                    type="tel"
                    required
                    value={profilePhone}
                      disabled
                    onChange={(e) => setProfilePhone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-[#14100D] border border-[#3E342B] text-[#FAF4EB] text-xs sm:text-sm focus:outline-none focus:border-[#D4A359]"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                      disabled={memberBusy}
                    className="px-5 py-2.5 rounded-2xl bg-[#D4A359] hover:bg-[#C08F47] text-[#181411] font-bold text-xs transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <Check size={14} />
                    <span>Simpan Perubahan Profil</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* E. SIMULASI MODAL TOP UP SALDO */}
          {showTopUpModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
              <div className="bg-[#1D1713] border border-[#3E342B] rounded-3xl p-6 max-w-sm w-full space-y-5 shadow-2xl text-[#FAF4EB]">
                <div className="flex items-center justify-between border-b border-[#3E342B]/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Wallet size={18} className="text-[#D4A359]" />
                    <h3 className="font-bold text-sm text-[#FAF4EB]">Top Up Saldo Member</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTopUpModal(false)}
                    className="text-[#A89F91] hover:text-white cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-[#A89F91]">
                    Pilih Nominal Top Up Saldo:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[20000, 50000, 100000, 200000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setTopUpAmount(amt)}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          topUpAmount === amt
                            ? 'bg-[#D4A359] text-[#181411] border-[#D4A359]'
                            : 'bg-[#14100D] border-[#3E342B] text-[#FAF4EB]'
                        }`}
                      >
                        {formatRupiah(amt)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTopUpModal(false)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-[#A89F91] hover:text-white cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmTopUp}
                    className="px-4 py-2 rounded-xl bg-[#D4A359] hover:bg-[#C08F47] text-[#181411] text-xs font-black transition-all cursor-pointer"
                  >
                    Konfirmasi Top Up
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
