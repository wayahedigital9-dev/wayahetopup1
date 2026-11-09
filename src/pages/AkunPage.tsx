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
  const [userOrders, setUserOrders] = useState<Order[]>(() => {
    if (!currentUser) return [];
    const direct = storage.getMemberOrders();
    if (direct.length > 0) return direct;
    return orders.filter(o => o.userId === currentUser.id);
  });

  useEffect(() => {
    setProfileName(currentUser?.name || '');
    setProfilePhone(currentUser?.phone || '');
    if (currentUser) {
      storage.hydrateMemberOrders().then((ords) => {
        if (Array.isArray(ords)) setUserOrders(ords);
      }).catch(() => {});
    } else {
      setUserOrders([]);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    const handleSync = () => {
      if (currentUser) {
        const fresh = storage.getMemberOrders();
        setUserOrders(fresh);
      }
    };
    window.addEventListener('wayahe_storage_synced', handleSync);
    return () => window.removeEventListener('wayahe_storage_synced', handleSync);
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentUser) {
      const fromProp = orders.filter(o => o.userId === currentUser.id);
      if (fromProp.length > 0) {
        const direct = storage.getMemberOrders();
        setUserOrders(direct.length > 0 ? direct : fromProp);
      }
    }
  }, [orders, currentUser?.id]);

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

  // User Vouchers (WiFi Hotspot & Akun Premium)
  const filteredOrders = userOrders.filter(
    (o: Order) => o.paymentStatus === 'PAID' &&
      o.fulfillmentStatus === 'SUCCESS' &&
      Boolean(o.fulfillmentResult?.voucherCode) &&
      (o.category === 'wifi' || o.category === 'premium')
  );
  const userVouchers = filteredOrders;

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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8 text-[#F8FAFC]">
      {/* 1. JIKA PENGGUNA BELUM LOGIN: FORM LOGIN GMAIL DENGAN KODE VERIFIKASI */}
      {!currentUser ? (
        <div className="max-w-lg mx-auto space-y-6">
          {/* Header Card */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-[#F59E0B]/30 to-[#F59E0B]/10 border-2 border-[#F59E0B] text-[#F59E0B] flex items-center justify-center mx-auto shadow-lg shadow-[#F59E0B]/20">
              <Crown size={28} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#F8FAFC] tracking-tight">
              {authRole === 'REGISTER' ? 'Pendaftaran Member Wayahe' : 'Masuk Akun Member'}
            </h1>
            <p className="text-xs sm:text-sm text-[#94A3B8]">
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
          <div className="bg-gradient-to-b from-[#131927] to-[#0B0F17] border border-[#1E293B] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            {/* Primary Role Switcher: [Masuk / Login] vs [Daftar Akun Baru] */}
            <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-[#080B12] border border-[#1E293B]/80 text-xs font-bold gap-1">
              <button
                type="button"
                onClick={() => setAuthRole('LOGIN')}
                className={`py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  authRole === 'LOGIN'
                    ? 'bg-[#F59E0B] text-[#0B0F17] shadow-md font-black'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC]'
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
                    ? 'bg-[#F59E0B] text-[#0B0F17] shadow-md font-black'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC]'
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
                      <label className="block text-xs font-bold text-[#CBD5E1] mb-1 flex items-center justify-between">
                        <span>Nama Lengkap / Panggilan</span>
                        <span className="text-[10px] text-[#F59E0B]">Untuk sapaan di dashboard</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="contoh: Joko Prasetyo"
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl bg-[#080B12] border border-[#1E293B] text-[#F8FAFC] focus:outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20"
                        />
                        <UserIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                      </div>
                    </div>

                    {/* Input Nomor WhatsApp / HP */}
                    <div>
                      <label className="block text-xs font-bold text-[#CBD5E1] mb-1 flex items-center justify-between">
                        <span>Nomor WhatsApp / HP</span>
                        <span className="text-[10px] text-[#94A3B8]">Bisa digunakan untuk login & notif</span>
                      </label>
                      <div className="relative">
                        <input
                          type="tel"
                          required
                          placeholder="contoh: 081234567890"
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl bg-[#080B12] border border-[#1E293B] text-[#F8FAFC] focus:outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20"
                        />
                        <Smartphone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                      </div>
                    </div>

                    {/* Input Username */}
                    <div>
                      <label className="block text-xs font-bold text-[#CBD5E1] mb-1 flex items-center justify-between">
                        <span>Username Member</span>
                        <span className="text-[10px] text-[#94A3B8]">Min. 3 karakter (huruf/angka)</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="contoh: joko_digital"
                          value={regUsername}
                          onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                          className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl bg-[#080B12] border border-[#1E293B] text-[#F8FAFC] focus:outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20"
                        />
                        <AtSign size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                      </div>
                    </div>

                    {/* Input Email (Gmail) */}
                    <div>
                      <label className="block text-xs font-bold text-[#CBD5E1] mb-1 flex items-center justify-between">
                        <span>Alamat Email (Gmail)</span>
                        <span className="text-[10px] text-[#F59E0B]">Untuk bukti order & invoice</span>
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          required
                          placeholder="nama.anda@gmail.com"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl bg-[#080B12] border border-[#1E293B] text-[#F8FAFC] focus:outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20"
                        />
                        <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                      </div>
                    </div>

                    {/* Input Password */}
                    <div>
                      <label className="block text-xs font-bold text-[#CBD5E1] mb-1 flex items-center justify-between">
                        <span>Kata Sandi (Password)</span>
                        <span className="text-[10px] text-[#94A3B8]">Min. 8 karakter</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showRegPassword ? 'text' : 'password'}
                          required
                          placeholder="Minimal 8 karakter rahasia"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm rounded-2xl bg-[#080B12] border border-[#1E293B] text-[#F8FAFC] focus:outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20"
                        />
                        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white cursor-pointer"
                        >
                          {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Member Welcome Bonus Highlight */}
                    <div className="p-3 rounded-2xl bg-gradient-to-r from-[#F59E0B]/15 to-emerald-500/10 border border-[#F59E0B]/40 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[#F59E0B]/20 text-[#F59E0B] flex items-center justify-center shrink-0">
                        <Gift size={18} />
                      </div>
                      <div className="text-xs">
                        <p className="font-black text-[#F59E0B]">Akun tersimpan aman di database</p>
                        <p className="text-[11px] text-[#CBD5E1]">
                          Gunakan akun yang sama di perangkat lain. Saldo awal Rp 0; tidak ada bonus saldo otomatis.
                        </p>
                      </div>
                    </div>

                    {/* Submit Register Button */}
                    <button
                      type="submit"
                      disabled={memberBusy}
                      className="w-full py-3 px-4 rounded-2xl font-black text-xs sm:text-sm bg-gradient-to-r from-[#F59E0B] via-[#FBBF24] to-[#D97706] text-[#0B0F17] hover:brightness-110 active:scale-[0.99] transition-all shadow-lg shadow-[#F59E0B]/20 flex items-center justify-center gap-2 cursor-pointer"
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
                      <label className="block text-xs font-bold text-[#CBD5E1] mb-1.5 flex items-center justify-between">
                        <span>Username, Gmail, atau No. WhatsApp</span>
                        <span className="text-[10px] text-[#F59E0B]">Pilih salah satu</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="Masukkan username, email@gmail.com, atau 08xxx"
                          value={loginIdentifier}
                          onChange={(e) => setLoginIdentifier(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl bg-[#080B12] border border-[#1E293B] text-[#F8FAFC] focus:outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20"
                        />
                        <UserIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                      </div>
                    </div>

                    {/* Input Password */}
                    <div>
                      <label className="block text-xs font-bold text-[#CBD5E1] mb-1.5">
                        Kata Sandi (Password)
                      </label>
                      <div className="relative">
                        <input
                          type={showLoginPassword ? 'text' : 'password'}
                          required
                          placeholder="Masukkan kata sandi akun Anda"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm rounded-2xl bg-[#080B12] border border-[#1E293B] text-[#F8FAFC] focus:outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/20"
                        />
                        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white cursor-pointer"
                        >
                          {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Submit Login Button */}
                    <button
                      type="submit"
                      disabled={memberBusy}
                      className="w-full py-3 px-4 rounded-2xl font-black text-xs sm:text-sm bg-[#F59E0B] hover:bg-[#D97706] text-[#0B0F17] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                    >
                      <LogIn size={16} />
                      <span>Masuk ke Akun Member</span>
                    </button>
                  </form>
                )}



                {/* Footer Switcher */}
                <div className="text-center pt-2 text-xs text-[#94A3B8]">
                  {authRole === 'REGISTER' ? (
                    <p>
                      Sudah punya akun member?{' '}
                      <button
                        type="button"
                        onClick={() => setAuthRole('LOGIN')}
                        className="text-[#F59E0B] font-bold hover:underline cursor-pointer ml-1"
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
                        className="text-[#F59E0B] font-bold hover:underline cursor-pointer ml-1"
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
          <div className="relative bg-gradient-to-r from-[#1E293B] via-[#131927] to-[#0B0F17] border-2 border-[#F59E0B]/70 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-0 right-0 w-72 h-72 bg-[#F59E0B]/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              {/* Avatar & User Details */}
              <div className="flex items-center gap-4 sm:gap-5">
                {/* Squircle Avatar */}
                <div className="relative shrink-0">
                  <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-[#080B12] border-2 border-[#F59E0B] p-1 shadow-lg shadow-[#F59E0B]/20 overflow-hidden flex items-center justify-center">
                    {currentUser.avatar ? (
                      <img
                        src={currentUser.avatar}
                        alt={currentUser.name}
                        className="w-full h-full object-cover rounded-xl sm:rounded-2xl"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-[#F59E0B] to-[#FCD34D] text-[#0B0F17] font-black text-2xl flex items-center justify-center rounded-xl sm:rounded-2xl">
                        {currentUser.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#10B981] border-2 border-[#0B0F17] flex items-center justify-center shadow-xs" title="Online">
                    <Check size={11} className="text-[#080B12] stroke-[3]" />
                  </span>
                </div>

                {/* Name & Badges */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-black text-[#F8FAFC]">
                      {currentUser.name}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/50 shadow-xs flex items-center gap-1">
                      <Crown size={11} />
                      <span>{currentUser.memberTier || 'MEMBER'}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[#94A3B8] flex-wrap">
                    <span className="flex items-center gap-1">
                      <Mail size={13} className="text-[#F59E0B]" />
                      <span>{currentUser.email}</span>
                    </span>
                    {currentUser.isGmailVerified && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#10B981] bg-[#10B981]/15 px-2 py-0.5 rounded-full border border-[#10B981]/30">
                        <CheckCircle2 size={11} />
                        <span>Gmail Terverifikasi</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Phone size={13} className="text-[#F59E0B]" />
                      <span>{currentUser.phone}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Saldo Dompet Member & Quick Action */}
              <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap bg-[#080B12]/80 backdrop-blur-sm p-3.5 sm:p-4 rounded-2xl border border-[#1E293B] md:self-stretch justify-between">
                <div>
                  <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider flex items-center gap-1">
                    <Wallet size={12} className="text-[#F59E0B]" />
                    <span>Saldo Dompet Member</span>
                  </div>
                  <div className="text-lg sm:text-xl font-black text-[#F8FAFC] mt-0.5">
                    {formatRupiah(currentUser.balance ?? 0)}
                  </div>
                  <div className="text-[10px] text-[#10B981] font-semibold flex items-center gap-1 mt-0.5">
                    <Star size={10} />
                    <span>{currentUser.rewardPoints ?? 0} Poin Reward</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowTopUpModal(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-[#0B0F17] font-black text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-1"
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
            <div className="bg-[#111827] p-4 rounded-2xl border border-[#1E293B] space-y-1 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#94A3B8]">Total Pesanan</span>
                <div className="w-7 h-7 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center">
                  <ReceiptText size={14} />
                </div>
              </div>
              <div className="text-xl font-black text-[#F8FAFC]">{userOrders.length}</div>
              <p className="text-[10px] text-[#10B981]">Transaksi tersimpan</p>
            </div>

            <div className="bg-[#111827] p-4 rounded-2xl border border-[#1E293B] space-y-1 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#94A3B8]">Voucher Aktif</span>
                <div className="w-7 h-7 rounded-lg bg-[#F59E0B]/15 text-[#F59E0B] flex items-center justify-center">
                  <Ticket size={14} />
                </div>
              </div>
              <div className="text-xl font-black text-[#F8FAFC]">{userVouchers.length}</div>
              <p className="text-[10px] text-[#F59E0B]">Siap digunakan</p>
            </div>

            <div className="bg-[#111827] p-4 rounded-2xl border border-[#1E293B] space-y-1 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#94A3B8]">Kupon Promo</span>
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
                  <Tag size={14} />
                </div>
              </div>
              <div className="text-xl font-black text-[#F8FAFC]">2 Kupon</div>
              <p className="text-[10px] text-[#10B981]">Hemat s.d Rp 10.000</p>
            </div>

            <div className="bg-[#111827] p-4 rounded-2xl border border-[#1E293B] space-y-1 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#94A3B8]">Keamanan Akun</span>
                <div className="w-7 h-7 rounded-lg bg-[#10B981]/15 text-[#10B981] flex items-center justify-center">
                  <ShieldCheck size={14} />
                </div>
              </div>
              <div className="text-xl font-black text-[#10B981]">100% Aman</div>
              <p className="text-[10px] text-[#94A3B8]">Data tersimpan di server</p>
            </div>
          </div>

          {/* C. SUB-TAB NAVIGASI DASHBOARD */}
          <div className="flex items-center gap-2 border-b border-[#1E293B] pb-2 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setMemberTab('SUMMARY')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                memberTab === 'SUMMARY'
                  ? 'bg-[#F59E0B] text-[#0B0F17] shadow-md font-black'
                  : 'bg-[#0B0F17] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#1E293B]'
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
                  ? 'bg-[#F59E0B] text-[#0B0F17] shadow-md font-black'
                  : 'bg-[#0B0F17] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#1E293B]'
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
                  ? 'bg-[#F59E0B] text-[#0B0F17] shadow-md font-black'
                  : 'bg-[#0B0F17] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#1E293B]'
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
                  ? 'bg-[#F59E0B] text-[#0B0F17] shadow-md font-black'
                  : 'bg-[#0B0F17] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#1E293B]'
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
              <div className="p-5 rounded-3xl bg-gradient-to-r from-[#1E293B] via-[#131927] to-[#0B0F17] border border-[#F59E0B]/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#F59E0B]/20 text-[#F59E0B] flex items-center justify-center shrink-0 border border-[#F59E0B]/40">
                    <Gift size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F59E0B] text-[#0B0F17] uppercase font-mono">
                        MEMBERBARU
                      </span>
                      <span className="text-xs font-bold text-[#10B981]">Hemat Rp 5.000</span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-[#F8FAFC] mt-0.5">
                      Kupon Diskon Sambutan Member Baru Anda Siap Dipakai!
                    </h3>
                    <p className="text-[11px] text-[#94A3B8]">
                      Gunakan kode kupon di atas saat checkout untuk mendapatkan potongan langsung Rp 5.000.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onCopyText('MEMBERBARU', 'Kode Promo MEMBERBARU')}
                  className="px-4 py-2 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-[#0B0F17] font-black text-xs transition-all shadow-md shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <Copy size={13} />
                  <span>Salin Kupon</span>
                </button>
              </div>

              {/* Riwayat Transaksi Member */}
              <div className="bg-[#0E131F] p-5 sm:p-6 rounded-3xl border border-[#1E293B] space-y-4">
                <div className="flex items-center justify-between border-b border-[#1E293B]/80 pb-3">
                  <div>
                    <h3 className="font-bold text-base text-[#F8FAFC]">Riwayat Transaksi Terbaru</h3>
                    <p className="text-xs text-[#94A3B8]">Daftar pembelian produk dan voucher digital Anda</p>
                  </div>
                  <span className="text-xs font-bold text-[#F59E0B]">
                    {userOrders.length} Transaksi
                  </span>
                </div>

                {userOrders.length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <ReceiptText size={36} className="mx-auto text-[#94A3B8]/50" />
                    <p className="text-sm font-bold text-[#CBD5E1]">Belum ada transaksi di akun Anda</p>
                    <p className="text-xs text-[#94A3B8]">Mulai belanja pulsa, kuota, voucher WiFi atau akun streaming sekarang.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-4 rounded-2xl bg-[#080B12] border border-[#1E293B]/70 hover:border-[#F59E0B]/50 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <ProductLogo
                            provider={ord.items[0]?.provider || 'Wayahe'}
                            category={ord.category}
                            size="sm"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-[#F59E0B]">
                                {ord.invoiceNumber}
                              </span>
                              <span className="text-[10px] text-[#94A3B8]">
                                {formatDateWIB(ord.createdAt)}
                              </span>
                            </div>
                            <div className="font-bold text-xs sm:text-sm text-[#F8FAFC]">
                              {ord.items[0]?.productName || 'Produk Digital'}
                            </div>
                            <div className="text-[10px] text-[#94A3B8]">
                              Tujuan: {ord.targetDestination} • Via {ord.paymentMethod || 'QRIS'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <div className="text-right">
                            <div className="font-black text-sm text-[#F8FAFC]">
                              {formatRupiah(ord.totalAmount)}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                              <PaymentStatusBadge status={ord.paymentStatus} />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => onOpenInvoice(ord)}
                            className="px-3 py-1.5 rounded-xl bg-[#131927] hover:bg-[#F59E0B] text-[#CBD5E1] hover:text-[#0B0F17] border border-[#1E293B] font-bold text-xs transition-colors cursor-pointer"
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
            <div className="bg-[#0E131F] p-5 sm:p-7 rounded-3xl border border-[#1E293B] space-y-5">
              <div className="border-b border-[#1E293B]/80 pb-3">
                <h3 className="font-bold text-base text-[#F8FAFC] flex items-center gap-2">
                  <Ticket size={18} className="text-[#F59E0B]" />
                  <span>Koleksi Voucher Digital Anda</span>
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  Kode voucher WiFi dan lisensi akun premium Anda tersimpan aman dan dapat disalin kapan saja.
                </p>
              </div>

              {userVouchers.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <Ticket size={40} className="mx-auto text-[#94A3B8]/50" />
                  <h4 className="font-bold text-sm text-[#F8FAFC]">Belum Ada Voucher yang Dibeli</h4>
                  <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
                    Beli voucher WiFi Hotspot RT/RW Net atau akun premium streaming untuk melihat kode aksesnya di sini.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userVouchers.map((ord) => {
                    const code = ord.fulfillmentResult?.voucherCode;
                    if (!code) return null;
                    const isCopied = copiedCode === code;

                    return (
                      <div
                        key={ord.id}
                        className="p-4.5 rounded-3xl bg-gradient-to-br from-[#0E131F] to-[#080B12] border-2 border-dashed border-[#F59E0B]/60 space-y-3 relative shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <ProductLogo
                              provider={ord.items[0]?.provider || 'WiFi'}
                              category={ord.category}
                              size="sm"
                            />
                            <div>
                              <span className="text-[10px] font-extrabold uppercase text-[#F59E0B] block">
                                {ord.category === 'wifi' ? 'HOTSPOT RT/RW NET' : 'AKUN PREMIUM'}
                              </span>
                              <span className="font-bold text-xs text-[#F8FAFC] block">
                                {ord.items[0]?.productName}
                              </span>
                            </div>
                          </div>

                          <span className="text-[9px] font-black uppercase bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 px-2 py-0.5 rounded-full">
                            AKTIF
                          </span>
                        </div>

                        {/* Voucher Code Box */}
                        <div className="p-3 rounded-2xl bg-[#06080D] border border-[#1E293B] flex items-center justify-between">
                          <div>
                            <div className="text-[9px] font-semibold text-[#94A3B8] uppercase">Kode Voucher:</div>
                            <div className="font-mono font-black text-sm sm:text-base text-[#F59E0B] tracking-wider">
                              {code}
                            </div>
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
                                ? 'bg-[#10B981] text-[#080B12]'
                                : 'bg-[#F59E0B] hover:bg-[#D97706] text-[#0B0F17]'
                            }`}
                          >
                            {isCopied ? <Check size={12} /> : <Copy size={12} />}
                            <span>{isCopied ? 'Tersalin' : 'Salin'}</span>
                          </button>
                        </div>

                        <div className="text-[10px] text-[#94A3B8] flex items-center justify-between pt-1">
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
            <div className="bg-[#0E131F] p-5 sm:p-7 rounded-3xl border border-[#1E293B] space-y-5">
              <div className="border-b border-[#1E293B]/80 pb-3">
                <h3 className="font-bold text-base text-[#F8FAFC] flex items-center gap-2">
                  <Gift size={18} className="text-[#F59E0B]" />
                  <span>Kupon & Voucher Diskon Eksklusif</span>
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  Kupon spesial untuk member terdaftar. Gunakan saat checkout untuk menikmati potongan langsung.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activePromos.map((promo, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-3xl bg-gradient-to-br from-[#131927] to-[#0B0F17] border border-[#F59E0B]/60 space-y-3 relative shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-[#F59E0B] bg-[#F59E0B]/15 border border-[#F59E0B]/30 px-2 py-0.5 rounded-full">
                        {promo.tag}
                      </span>
                      <span className="text-xs font-black text-[#10B981]">
                        Diskon {promo.discount}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-[#F8FAFC]">{promo.title}</h4>
                      <p className="text-xs text-[#94A3B8] mt-1">{promo.desc}</p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#080B12] border border-dashed border-[#F59E0B]/50 flex items-center justify-between">
                      <div>
                        <div className="text-[9px] uppercase font-semibold text-[#94A3B8]">Kode Kupon:</div>
                        <div className="font-mono font-black text-xs sm:text-sm text-[#F59E0B] tracking-wider">
                          {promo.code}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onCopyText(promo.code, `Kupon ${promo.code}`)}
                        className="px-3 py-1.5 rounded-lg bg-[#F59E0B] hover:bg-[#D97706] text-[#0B0F17] font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
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
            <div className="bg-[#0E131F] p-5 sm:p-7 rounded-3xl border border-[#1E293B] space-y-5">
              <div className="border-b border-[#1E293B]/80 pb-3">
                <h3 className="font-bold text-base text-[#F8FAFC] flex items-center gap-2">
                  <Shield size={18} className="text-[#F59E0B]" />
                  <span>Profil & Keamanan Akun Member</span>
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  Kelola data kontak WhatsApp, nama pengguna, dan status autentikasi akun Anda.
                </p>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-[#080B12] border border-[#1E293B] text-[#F8FAFC] text-xs sm:text-sm focus:outline-none focus:border-[#F59E0B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                    Alamat Email Akun
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      readOnly
                      value={currentUser.email}
                      className="w-full pl-4 pr-24 py-2.5 rounded-2xl bg-[#080B12]/60 border border-[#1E293B] text-[#94A3B8] text-xs sm:text-sm cursor-not-allowed font-mono"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#10B981] flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      <span>Verified</span>
                    </span>
                  </div>
                  <p className="text-[10px] text-[#94A3B8] mt-1">Email identitas login tersimpan di server. Perubahan email atau nomor HP memerlukan bantuan admin.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1">
                    Nomor WhatsApp / HP
                  </label>
                  <input
                    type="tel"
                    required
                    value={profilePhone}
                      disabled
                    onChange={(e) => setProfilePhone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-[#080B12] border border-[#1E293B] text-[#F8FAFC] text-xs sm:text-sm focus:outline-none focus:border-[#F59E0B]"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                      disabled={memberBusy}
                    className="px-5 py-2.5 rounded-2xl bg-[#F59E0B] hover:bg-[#D97706] text-[#0B0F17] font-bold text-xs transition-all shadow-md cursor-pointer flex items-center gap-1.5"
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
              <div className="bg-[#0E131F] border border-[#1E293B] rounded-3xl p-6 max-w-sm w-full space-y-5 shadow-2xl text-[#F8FAFC]">
                <div className="flex items-center justify-between border-b border-[#1E293B]/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Wallet size={18} className="text-[#F59E0B]" />
                    <h3 className="font-bold text-sm text-[#F8FAFC]">Top Up Saldo Member</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTopUpModal(false)}
                    className="text-[#94A3B8] hover:text-white cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-[#94A3B8]">
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
                            ? 'bg-[#F59E0B] text-[#0B0F17] border-[#F59E0B]'
                            : 'bg-[#080B12] border-[#1E293B] text-[#F8FAFC]'
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
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-white cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmTopUp}
                    className="px-4 py-2 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-[#0B0F17] text-xs font-black transition-all cursor-pointer"
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
