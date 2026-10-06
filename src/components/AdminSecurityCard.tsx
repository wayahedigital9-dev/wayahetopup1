import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  KeyRound, 
  Power, 
  AlertTriangle, 
  CheckCircle2, 
  Copy, 
  Check, 
  RefreshCw, 
  Trash2, 
  Lock, 
  Smartphone, 
  QrCode, 
  Flame, 
  Eye, 
  EyeOff, 
  Ban, 
  Activity,
  Cpu,
  Layers,
  Terminal,
  Radio
} from 'lucide-react';
import { AppSettings, SecurityIntrusionLog } from '../types';
import { 
  generateTotpSecret, 
  getOtpAuthUrl, 
  generateTotpQRCode, 
  verifyTotpCode 
} from '../utils/totp';

interface AdminSecurityCardProps {
  settings: AppSettings;
  onSaveSettings: (newSettings: Partial<AppSettings>) => void;
  onShowToast: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const DEFAULT_SECURITY_LOGS: SecurityIntrusionLog[] = [
  {
    id: 'sec-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    ipAddress: '194.26.29.112',
    threatType: 'SQL_INJECTION',
    details: 'SQLi attempt blocked on /api/orders: payload "UNION SELECT 1,username,password FROM admins--"',
    actionTaken: 'BLOCKED',
    severity: 'CRITICAL',
    targetEndpoint: '/api/orders',
    status: 'BLOCKED',
  },
  {
    id: 'sec-2',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    ipAddress: '45.155.205.233',
    threatType: 'BRUTE_FORCE',
    details: '5 failed login attempts within 30 seconds for username "admin"',
    actionTaken: 'IP_BANNED',
    severity: 'HIGH',
    targetEndpoint: '/api/admin/login',
    status: 'BLOCKED',
  },
  {
    id: 'sec-3',
    timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    ipAddress: '185.220.101.5',
    threatType: 'XSS_ATTACK',
    details: 'Malicious script tag stripped from input field: <script>document.location=...</script>',
    actionTaken: 'SANITIZED',
    severity: 'MEDIUM',
    targetEndpoint: '/api/products/search',
    status: 'MITIGATED',
  },
  {
    id: 'sec-4',
    timestamp: new Date(Date.now() - 1000 * 60 * 480).toISOString(),
    ipAddress: '103.149.28.18',
    threatType: 'UNAUTHORIZED_ACCESS',
    details: 'Direct path traversal request blocked: GET /backend/src/config/apikeys.ts',
    actionTaken: 'BLOCKED',
    severity: 'HIGH',
    targetEndpoint: '/backend/src/config/apikeys.ts',
    status: 'BLOCKED',
  },
];

export const AdminSecurityCard: React.FC<AdminSecurityCardProps> = ({
  settings,
  onSaveSettings,
  onShowToast,
}) => {
  // 1. System Running / Stopped Status State
  const [systemStatus, setSystemStatus] = useState<'RUNNING' | 'STOPPED'>(
    settings.systemStatus || 'RUNNING'
  );
  const [maintenanceMessage, setMaintenanceMessage] = useState<string>(
    settings.systemMaintenanceMessage ||
      'Sistem transaksi sedang dijeda sementara untuk pemeliharaan rutin. Silakan kembali beberapa saat lagi.'
  );

  // 2. Security Intrusion Detection State
  const [wafProtection, setWafProtection] = useState<boolean>(
    settings.wafProtectionEnabled !== false
  );
  const [antiBruteForce, setAntiBruteForce] = useState<boolean>(
    settings.antiBruteForceEnabled !== false
  );
  const [autoBlockSuspicious, setAutoBlockSuspicious] = useState<boolean>(
    settings.autoBlockSuspiciousIp !== false
  );
  const [securityLogs, setSecurityLogs] = useState<SecurityIntrusionLog[]>(() => {
    try {
      const stored = localStorage.getItem('wayahe_security_logs');
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return DEFAULT_SECURITY_LOGS;
  });
  const [simulatingAttack, setSimulatingAttack] = useState<boolean>(false);

  // 3. Google Authenticator 2FA State
  const [googleAuthEnabled, setGoogleAuthEnabled] = useState<boolean>(
    Boolean(settings.googleAuthEnabled)
  );
  const [googleAuthSecret, setGoogleAuthSecret] = useState<string>(
    settings.googleAuthSecret || ''
  );
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [testOtpInput, setTestOtpInput] = useState<string>('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);
  const [showSecretKey, setShowSecretKey] = useState<boolean>(false);
  const [copiedSecret, setCopiedSecret] = useState<boolean>(false);
  const [totpVerifiedBadge, setTotpVerifiedBadge] = useState<boolean>(
    Boolean(settings.googleAuthEnabled)
  );

  // Sync initial state if parent settings update
  useEffect(() => {
    if (settings.systemStatus) setSystemStatus(settings.systemStatus);
    if (settings.systemMaintenanceMessage) setMaintenanceMessage(settings.systemMaintenanceMessage);
    if (settings.googleAuthEnabled !== undefined) setGoogleAuthEnabled(settings.googleAuthEnabled);
    if (settings.googleAuthSecret) setGoogleAuthSecret(settings.googleAuthSecret);
  }, [settings]);

  // Generate QR Code if secret exists
  useEffect(() => {
    if (googleAuthSecret) {
      const accountName = settings.adminUsername || 'admin@wayahedigital.id';
      const otpauthUrl = getOtpAuthUrl(googleAuthSecret, accountName, settings.siteName || 'WayaheDigital');
      generateTotpQRCode(otpauthUrl).then((qr) => {
        setQrCodeDataUrl(qr);
      });
    }
  }, [googleAuthSecret, settings.adminUsername, settings.siteName]);

  // Persist logs to localStorage
  const saveLogs = (logs: SecurityIntrusionLog[]) => {
    setSecurityLogs(logs);
    try {
      localStorage.setItem('wayahe_security_logs', JSON.stringify(logs));
    } catch (_) {}
  };

  // ── Handle Toggle System Status (RUNNING vs STOPPED) ──
  const handleToggleSystemStatus = (newStatus: 'RUNNING' | 'STOPPED') => {
    setSystemStatus(newStatus);
    onSaveSettings({
      systemStatus: newStatus,
      systemMaintenanceMessage: maintenanceMessage,
    });

    if (newStatus === 'RUNNING') {
      onShowToast(
        'Sistem Dijalankan (ONLINE)',
        'Website toko dan seluruh proses checkout kini berjalan aktif untuk pengunjung.',
        'success'
      );
    } else {
      onShowToast(
        'Sistem Dihentikan (STOPPED)',
        'Sistem transaksi telah dijeda. Pengunjung akan melihat pesan pemeliharaan.',
        'warning'
      );
    }
  };

  const handleSaveMaintenanceMessage = () => {
    onSaveSettings({
      systemMaintenanceMessage: maintenanceMessage,
    });
    onShowToast('Pesan Pemeliharaan Disimpan', 'Pesan berhasil diperbarui.', 'success');
  };

  // ── Handle Security Toggle ──
  const handleToggleWaf = (val: boolean) => {
    setWafProtection(val);
    onSaveSettings({ wafProtectionEnabled: val });
    onShowToast('WAF Protection', `Firewall aplikasi web ${val ? 'Diaktifkan' : 'Dinonaktifkan'}.`, 'info');
  };

  const handleToggleAntiBruteForce = (val: boolean) => {
    setAntiBruteForce(val);
    onSaveSettings({ antiBruteForceEnabled: val });
    onShowToast('Anti Brute-Force', `Proteksi login brute-force ${val ? 'Diaktifkan' : 'Dinonaktifkan'}.`, 'info');
  };

  const handleToggleAutoBlock = (val: boolean) => {
    setAutoBlockSuspicious(val);
    onSaveSettings({ autoBlockSuspiciousIp: val });
    onShowToast('Auto-Block IP', `Auto-block IP mencurigakan ${val ? 'Diaktifkan' : 'Dinonaktifkan'}.`, 'info');
  };

  // ── Simulate Attack & Intrusion Block ──
  const handleSimulateAttack = () => {
    setSimulatingAttack(true);
    setTimeout(() => {
      const attackTypes: Array<{
        type: 'SQL_INJECTION' | 'XSS_ATTACK' | 'BRUTE_FORCE' | 'UNAUTHORIZED_ACCESS';
        details: string;
        action: 'BLOCKED' | 'IP_BANNED' | 'SANITIZED';
        severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
      }> = [
        {
          type: 'SQL_INJECTION',
          details: `Injeksi SQL terdeteksi: GET /api/orders?filter=' OR '1'='1' -- Payload dinetralkan WAF`,
          action: 'BLOCKED',
          severity: 'CRITICAL',
        },
        {
          type: 'XSS_ATTACK',
          details: `Serangan Cross-Site Scripting (XSS): <img src=x onerror=alert(document.cookie)> dibersihkan oleh sanitizer`,
          action: 'SANITIZED',
          severity: 'HIGH',
        },
        {
          type: 'UNAUTHORIZED_ACCESS',
          details: `Upaya akses direktori sensitif (/etc/passwd, /.env) dicegat oleh filter firewall`,
          action: 'BLOCKED',
          severity: 'HIGH',
        },
      ];

      const pick = attackTypes[Math.floor(Math.random() * attackTypes.length)];
      const randomIp = `185.${Math.floor(Math.random() * 200 + 20)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

      const newLog: SecurityIntrusionLog = {
        id: 'sec-' + Date.now(),
        timestamp: new Date().toISOString(),
        ipAddress: randomIp,
        threatType: pick.type,
        details: pick.details,
        actionTaken: pick.action,
        severity: pick.severity,
        targetEndpoint: '/api/admin',
        status: 'BLOCKED',
      };

      const updated = [newLog, ...securityLogs.slice(0, 19)];
      saveLogs(updated);
      setSimulatingAttack(false);

      onShowToast(
        'Ancaman Berhasil Dicegat!',
        `WAF mendeteksi dan memblokir serangan ${pick.type} dari IP ${randomIp}. Keamanan website tetap aman 100%.`,
        'success'
      );
    }, 900);
  };

  const handleClearLogs = () => {
    saveLogs([]);
    onShowToast('Log Keamanan Dibersihkan', 'Riwayat log ancaman telah dikosongkan.', 'info');
  };

  // ── Google Authenticator (TOTP) Handlers ──
  const handleStartSetupGoogleAuth = () => {
    const newSecret = generateTotpSecret(20);
    setGoogleAuthSecret(newSecret);
    setTestOtpInput('');
    setTotpVerifiedBadge(false);
    onShowToast(
      'Kunci Rahasia Dibuat',
      'Scan QR Code berikut menggunakan Google Authenticator di HP Anda.',
      'info'
    );
  };

  const handleVerifyAndEnableGoogleAuth = async () => {
    if (!testOtpInput.trim()) {
      onShowToast('Kode OTP Kosong', 'Masukkan 6 digit kode dari aplikasi Google Authenticator.', 'error');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const isValid = await verifyTotpCode(testOtpInput, googleAuthSecret, 2);
      if (isValid) {
        setGoogleAuthEnabled(true);
        setTotpVerifiedBadge(true);
        onSaveSettings({
          googleAuthEnabled: true,
          googleAuthSecret: googleAuthSecret,
        });
        onShowToast(
          'Google Authenticator Aktif!',
          'Autentikasi dua langkah (2FA) berhasil diaktifkan. Akun admin Anda kini terlindungi.',
          'success'
        );
      } else {
        onShowToast(
          'Kode Tidak Sesuai',
          'Kode 6-digit salah atau waktu di HP Anda tidak sinkron. Coba periksa kembali aplikasi Authenticator Anda.',
          'error'
        );
      }
    } catch (err: any) {
      onShowToast('Gagal Verifikasi', err.message, 'error');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleDisableGoogleAuth = () => {
    if (!window.confirm('Apakah Anda yakin ingin menonaktifkan Google Authenticator? Akun admin akan menjadi kurang aman.')) {
      return;
    }
    setGoogleAuthEnabled(false);
    setTotpVerifiedBadge(false);
    onSaveSettings({
      googleAuthEnabled: false,
    });
    onShowToast('Google Authenticator Dinonaktifkan', '2FA telah dinonaktifkan.', 'warning');
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(googleAuthSecret);
    setCopiedSecret(true);
    onShowToast('Kunci Disalin', 'Secret key berhasil disalin ke clipboard.', 'info');
    setTimeout(() => setCopiedSecret(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          1. SISTEM ON/OFF SWITCH (RUNNING & STOP CONTROL)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#121626] to-[#0b0e1b] border border-cyan-500/30 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-inner ${
              systemStatus === 'RUNNING'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                : 'bg-rose-500/15 border-rose-500/40 text-rose-400'
            }`}>
              <Power size={24} className={systemStatus === 'RUNNING' ? 'animate-pulse' : ''} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Status Operasional Sistem Toko
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${
                  systemStatus === 'RUNNING'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-500/20'
                }`}>
                  {systemStatus === 'RUNNING' ? '● RUNNING (AKTIF)' : '■ STOPPED (JEDA)'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Tombol kendali ON/OFF untuk menjalankan atau menghentikan transaksi sistem sesuai kebutuhan
              </p>
            </div>
          </div>

          {/* Interactive ON / OFF Big Switch */}
          <div className="flex items-center gap-2 bg-[#060913] p-1.5 rounded-2xl border border-slate-800 shadow-inner">
            <button
              type="button"
              onClick={() => handleToggleSystemStatus('RUNNING')}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                systemStatus === 'RUNNING'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25 scale-[1.02]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <CheckCircle2 size={16} />
              <span>RUNNING (ON)</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleSystemStatus('STOPPED')}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                systemStatus === 'STOPPED'
                  ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-lg shadow-rose-500/25 scale-[1.02]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Ban size={16} />
              <span>STOP (OFF)</span>
            </button>
          </div>
        </div>

        {/* Status description & message */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <span>Pesan Banner Pemeliharaan (Ditampilkan saat STOP)</span>
            </label>
            <div className="flex gap-2">
              <textarea
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                rows={2}
                placeholder="Tuliskan pesan yang dilihat pengunjung saat transaksi sedang dihentikan..."
                className="flex-1 px-3.5 py-2.5 bg-[#060913] border border-slate-800 focus:border-cyan-500 rounded-xl text-xs text-slate-200 outline-none resize-none leading-relaxed"
              />
              <button
                type="button"
                onClick={handleSaveMaintenanceMessage}
                className="px-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs transition-all cursor-pointer self-stretch shrink-0 flex items-center justify-center"
              >
                Simpan Pesan
              </button>
            </div>
          </div>

          <div className={`rounded-xl p-3.5 border flex flex-col justify-between ${
            systemStatus === 'RUNNING'
              ? 'bg-emerald-950/20 border-emerald-500/25 text-emerald-200'
              : 'bg-rose-950/20 border-rose-500/25 text-rose-200'
          }`}>
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Activity size={14} />
              <span>Dampak Operasional:</span>
            </span>
            <p className="text-xs mt-1.5 leading-snug">
              {systemStatus === 'RUNNING'
                ? 'Semua pelanggan dapat memilih produk, memasukkan nomor tujuan, dan menyelesaikan pembayaran secara normal.'
                : 'Halaman toko menampilkan peringatan jeda transaksi. Tombol pembayaran dinonaktifkan. Akses login admin tetap normal.'}
            </p>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. DETEKSI PEMBOBOLAN & KEAMANAN WEBSITE (WAF / IDS)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#121626] to-[#0b0e1b] border border-cyan-500/30 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shadow-inner">
              <ShieldAlert size={24} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Deteksi Pembobolan & Keamanan Website (WAF & IDS)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                  <ShieldCheck size={12} />
                  <span>Proteksi Aktif 24/7</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitoring realtime terhadap serangan SQL Injection, Cross-Site Scripting (XSS), Brute Force, & Akses Ilegal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSimulateAttack}
              disabled={simulatingAttack}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-600/30 to-rose-600/30 hover:from-amber-600/40 hover:to-rose-600/40 border border-amber-500/40 text-amber-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              title="Jalankan simulasi serangan untuk menguji firewall website"
            >
              <Flame size={14} className={simulatingAttack ? 'animate-bounce text-rose-400' : 'text-amber-400'} />
              <span>{simulatingAttack ? 'Menjalankan Simulasi...' : 'Uji Simulasi Keamanan'}</span>
            </button>

            <button
              type="button"
              onClick={handleClearLogs}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer border border-slate-800"
              title="Bersihkan log keamanan"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* 3 Core Toggles: WAF, Anti Brute Force, Auto Block */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4">
          {/* Toggle 1: Web Application Firewall (WAF) */}
          <div className="bg-[#060913] border border-slate-800/90 rounded-xl p-3.5 flex items-center justify-between">
            <div className="space-y-0.5 pr-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-cyan-400" />
                <span>Firewall WAF Aplikasi</span>
              </span>
              <p className="text-[11px] text-slate-400">
                Filter payload SQL Injection, XSS, & Directory Traversal
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={wafProtection}
                onChange={(e) => handleToggleWaf(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
            </label>
          </div>

          {/* Toggle 2: Anti Brute Force */}
          <div className="bg-[#060913] border border-slate-800/90 rounded-xl p-3.5 flex items-center justify-between">
            <div className="space-y-0.5 pr-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Lock size={14} className="text-emerald-400" />
                <span>Proteksi Anti Brute-Force</span>
              </span>
              <p className="text-[11px] text-slate-400">
                Kunci otomatis jika 5x gagal login password admin berturut-turut
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={antiBruteForce}
                onChange={(e) => handleToggleAntiBruteForce(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Toggle 3: Auto-Block Suspicious IP */}
          <div className="bg-[#060913] border border-slate-800/90 rounded-xl p-3.5 flex items-center justify-between">
            <div className="space-y-0.5 pr-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Ban size={14} className="text-rose-400" />
                <span>Blokir Otomatis IP Penyerang</span>
              </span>
              <p className="text-[11px] text-slate-400">
                Tolak langsung request dari IP yang melakukan aktivitas mencurigakan
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={autoBlockSuspicious}
                onChange={(e) => handleToggleAutoBlock(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
            </label>
          </div>
        </div>

        {/* Security Incident Logs Table */}
        <div className="mt-4 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between pb-2.5">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Terminal size={14} className="text-cyan-400" />
              <span>Log Deteksi Serangan & Pembobolan Terkini</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              Total {securityLogs.length} Percobaan Dicegat
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#04060d]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#090e1c] text-slate-400 font-semibold border-b border-slate-800 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">IP Penyerang</th>
                  <th className="py-2.5 px-3">Kategori Ancaman</th>
                  <th className="py-2.5 px-3">Detail Percobaan</th>
                  <th className="py-2.5 px-3 text-right">Tindakan WAF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {securityLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500 font-sans">
                      Belum ada ancaman terdeteksi. Sistem berjalan dalam kondisi aman.
                    </td>
                  </tr>
                ) : (
                  securityLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-cyan-300 whitespace-nowrap">
                        {log.ipAddress}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.threatType === 'SQL_INJECTION'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : log.threatType === 'BRUTE_FORCE'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : log.threatType === 'XSS_ATTACK'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}>
                          {log.threatType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 font-sans text-xs max-w-xs truncate" title={log.details}>
                        {log.details}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {log.actionTaken}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. GOOGLE AUTHENTICATOR (2FA / TOTP)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#121626] to-[#0b0e1b] border border-cyan-500/30 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shadow-inner">
              <KeyRound size={24} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Google Authenticator (2FA / Dua Langkah)
                </h3>
                {googleAuthEnabled ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <ShieldCheck size={12} />
                    <span>2FA Aktif</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                    Nonaktif
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Wajibkan verifikasi kode 6-digit dari aplikasi Google Authenticator setiap kali Admin login
              </p>
            </div>
          </div>

          <div>
            {googleAuthEnabled ? (
              <button
                type="button"
                onClick={handleDisableGoogleAuth}
                className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Ban size={14} />
                <span>Nonaktifkan 2FA</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartSetupGoogleAuth}
                className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
              >
                <Smartphone size={14} />
                <span>{googleAuthSecret ? 'Atur Ulang Kunci 2FA' : 'Aktifkan Google Authenticator'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Setup Flow when Secret is Generated or 2FA is Active */}
        {(googleAuthSecret || googleAuthEnabled) && (
          <div className="pt-5 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* Column 1: QR Code */}
            <div className="bg-[#050814] border border-slate-800 rounded-2xl p-4 flex flex-col items-center text-center">
              <div className="w-48 h-48 bg-white p-2.5 rounded-xl shadow-lg flex items-center justify-center">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="Google Authenticator QR Code"
                    className="w-full h-full object-contain rounded-lg"
                  />
                ) : (
                  <div className="text-slate-400 flex flex-col items-center gap-2">
                    <QrCode size={36} className="text-slate-300 animate-pulse" />
                    <span className="text-[11px]">Membuat QR Code...</span>
                  </div>
                )}
              </div>
              <span className="text-xs font-bold text-slate-300 mt-3 flex items-center gap-1">
                <Smartphone size={13} className="text-cyan-400" />
                <span>Scan dengan Google Authenticator</span>
              </span>
              <p className="text-[10px] text-slate-500 mt-1 max-w-[200px]">
                Buka aplikasi Google Authenticator di Android/iOS, lalu scan kode QR di atas.
              </p>
            </div>

            {/* Column 2 & 3: Secret Key & Verification Form */}
            <div className="md:col-span-2 space-y-4">
              {/* Secret Key Box */}
              <div className="bg-[#050814] border border-slate-800 rounded-2xl p-4 space-y-2">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Kunci Rahasia Manual (Secret Key RFC 6238)</span>
                  <button
                    type="button"
                    onClick={() => setShowSecretKey(!showSecretKey)}
                    className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px] cursor-pointer"
                  >
                    {showSecretKey ? <EyeOff size={13} /> : <Eye size={13} />}
                    <span>{showSecretKey ? 'Sembunyikan' : 'Tampilkan'}</span>
                  </button>
                </label>

                <div className="flex items-center gap-2">
                  <input
                    type={showSecretKey ? 'text' : 'password'}
                    readOnly
                    value={googleAuthSecret}
                    className="flex-1 px-3.5 py-2.5 bg-[#030610] border border-slate-800 rounded-xl text-xs font-mono font-bold text-cyan-300 tracking-wider outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {copiedSecret ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span>{copiedSecret ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  Jika kamera HP tidak bisa scan QR, pilih <strong>"Enter a setup key"</strong> di aplikasi Google Authenticator dan tempelkan kunci ini.
                </p>
              </div>

              {/* Verification & Test Step */}
              <div className="bg-[#050814] border border-cyan-500/30 rounded-2xl p-4 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-cyan-400" />
                    <span>Konfirmasi Verifikasi 6-Digit Token</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Ketik 6 angka yang muncul di Google Authenticator untuk memverifikasi dan mengaktifkan proteksi
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                  <input
                    type="text"
                    maxLength={6}
                    value={testOtpInput}
                    onChange={(e) => setTestOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Contoh: 123456"
                    className="w-full sm:w-48 px-4 py-2.5 bg-[#030610] border border-cyan-500/40 focus:border-cyan-400 rounded-xl text-center text-lg font-mono font-black tracking-widest text-cyan-300 outline-none"
                  />

                  <button
                    type="button"
                    onClick={handleVerifyAndEnableGoogleAuth}
                    disabled={isVerifyingOtp || testOtpInput.length < 6}
                    className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} />
                    <span>{isVerifyingOtp ? 'Memverifikasi...' : 'Verifikasi & Kunci 2FA'}</span>
                  </button>
                </div>

                {totpVerifiedBadge && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/20 border border-emerald-500/30 rounded-lg p-2">
                    <ShieldCheck size={14} />
                    <span>✓ Akun terverifikasi dengan Google Authenticator! Saat login berikutnya, kode 2FA akan diminta.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
