import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  ShieldCheck, 
  AlertTriangle, 
  Copy, 
  Check, 
  RefreshCw, 
  ExternalLink, 
  Network, 
  Save, 
  Info,
  Server,
  ChevronDown,
  ChevronUp,
  Cpu,
  ArrowRight,
  Radio
} from 'lucide-react';
import { apiAdapter } from '../services/apiAdapter';

interface AdminDigiflazzIpCardProps {
  onShowToast: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  compact?: boolean;
}

export const AdminDigiflazzIpCard: React.FC<AdminDigiflazzIpCardProps> = ({ onShowToast, compact = false }) => {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detectingLive, setDetectingLive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedLive, setCopiedLive] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // States
  const [configuredIp, setConfiguredIp] = useState<string>('');
  const [liveServerIp, setLiveServerIp] = useState<string>('');
  const [outboundIp, setOutboundIp] = useState<string>('');
  const [proxyUrl, setProxyUrl] = useState<string>('');
  const [isProxyActive, setIsProxyActive] = useState<boolean>(false);
  const [isWhitelisted, setIsWhitelisted] = useState<boolean | null>(null);
  const [deposit, setDeposit] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [lastChecked, setLastChecked] = useState<string>('');

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const raw = await apiAdapter.getDigiflazzIpStatus();
      const data = (raw as any)?.data || raw;
      if (data) {
        const lockedIp = data.configuredWhitelistIp || '';
        const live = data.liveServerIp || '';
        setConfiguredIp(lockedIp);
        setOutboundIp(data.outboundIp || '');
        setLiveServerIp(live);
        setProxyUrl(data.outboundProxy || '');
        setIsProxyActive(Boolean(data.isProxyActive));
        setIsWhitelisted(data.isWhitelisted === true ? true : data.isWhitelisted === false ? false : null);
        setDeposit(data.deposit !== undefined ? data.deposit : null);
        setStatusMessage(data.digiflazzMessage || 'Koneksi dan whitelist belum terverifikasi.');
        setLastChecked(new Date(data.lastChecked || Date.now()).toLocaleTimeString('id-ID'));
      }
    } catch (e: any) {
      setIsWhitelisted(null);
      setDeposit(null);
      setStatusMessage(e.message || 'Status koneksi belum terverifikasi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleDetectLiveIp = async () => {
    setDetectingLive(true);
    try {
      const res = await apiAdapter.detectDigiflazzLiveIp();
      if (res && res.liveIp) {
        setLiveServerIp(res.liveIp);
        onShowToast(
          'Deteksi IP VPS Berhasil',
          `IP Publik outbound server Anda saat ini: ${res.liveIp}`,
          'success'
        );
        // Jika IP berbeda dari configured, beri opsi mudah
        if (res.liveIp !== configuredIp) {
          onShowToast(
            'Penyesuaian IP Jaringan',
            `IP VPS (${res.liveIp}) berbeda dengan Whitelist (${configuredIp}). Klik "Gunakan IP VPS Ini" lalu Simpan.`,
            'warning'
          );
        }
      }
    } catch (err: any) {
      onShowToast('Gagal Deteksi IP VPS', err.message || 'Tidak dapat mendeteksi IP publik server.', 'error');
    } finally {
      setDetectingLive(false);
    }
  };

  const handleApplyLiveIpToConfig = () => {
    setConfiguredIp(liveServerIp);
    onShowToast(
      'IP Diterapkan',
      `IP VPS ${liveServerIp} telah diisikan ke kolom Whitelist. Jangan lupa klik "Simpan IP Whitelist" dan daftarkan di Digiflazz Member.`,
      'info'
    );
  };

  const handleCopyIp = (ipToCopy: string, isLive = false) => {
    navigator.clipboard.writeText(ipToCopy);
    if (isLive) {
      setCopiedLive(true);
      setTimeout(() => setCopiedLive(false), 2500);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
    onShowToast('IP Disalin', `IP ${ipToCopy} berhasil disalin ke clipboard!`, 'info');
  };

  const handleTestIp = async () => {
    setTesting(true);
    try {
      const raw = await apiAdapter.testDigiflazzIp(proxyUrl);
      const result = raw?.data || raw;
      if (result) {
        const ip = result.outboundIp || '';
        setOutboundIp(ip);
        if (result.liveServerIp) setLiveServerIp(result.liveServerIp);
        setIsWhitelisted(result.isWhitelisted === true ? true : result.isWhitelisted === false ? false : null);
        setDeposit(result.deposit !== undefined ? result.deposit : null);
        const msg = result.digiflazzMessage || '';
        setStatusMessage(msg);
        setLastChecked(new Date().toLocaleTimeString('id-ID'));

        if (result.isWhitelisted) {
          onShowToast('Whitelist Terverifikasi!', msg || `IP ${ip} terdaftar dan diakui oleh Digiflazz!`, 'success');
        } else {
          onShowToast('Perhatian IP Whitelist', msg || 'Koneksi dan whitelist belum terverifikasi.', 'warning');
        }
      }
    } catch (err: any) {
      setIsWhitelisted(null);
      setDeposit(null);
      setStatusMessage(err.message || 'Koneksi belum terverifikasi.');
      onShowToast('Uji Koneksi Gagal', err.message || 'Tidak dapat terhubung ke Digiflazz API.', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    const cleanIp = configuredIp.trim();
    if (!cleanIp) {
      onShowToast('Validasi Gagal', 'IP Whitelist tidak boleh kosong.', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await apiAdapter.updateDigiflazzIpConfig({
        whitelistIp: cleanIp,
        outboundProxy: proxyUrl,
      });
      if (res.success) {
        onShowToast('Pengaturan Disimpan', `IP Whitelist (${cleanIp}) berhasil disimpan ke konfigurasi sistem!`, 'success');
        setOutboundIp(cleanIp);
        await fetchStatus();
      } else {
        onShowToast('Gagal Simpan', res.message || 'Gagal menyimpan pengaturan.', 'error');
      }
    } catch (err: any) {
      onShowToast('Gagal Simpan', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const isIpMatching = liveServerIp === configuredIp;

  return (
    <div className="bg-gradient-to-br from-slate-900 via-[#0B132B] to-[#0A1128] border border-cyan-500/30 rounded-2xl p-5 shadow-xl text-slate-100 relative overflow-hidden">
      {/* Background glow decoration */}
      <div className="absolute -top-20 -right-20 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-inner">
            <Network size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight">
                Pengaturan IP Whitelist & Jaringan VPS Digiflazz
              </h3>
              {isWhitelisted === true ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <ShieldCheck size={12} />
                  <span>Whitelist Terdaftar</span>
                </span>
              ) : isWhitelisted === false ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <AlertTriangle size={12} />
                  <span>Belum Terdaftar (RC 45)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400">
                  <span>{loading || testing ? 'Memeriksa...' : 'Belum Terverifikasi'}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              IP terdeteksi dan konfigurasi whitelist ditampilkan terpisah. Pendaftaran whitelist dilakukan di dashboard Digiflazz.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tombol Deteksi Otomatis IP VPS */}
          <button
            type="button"
            onClick={handleDetectLiveIp}
            disabled={detectingLive || loading}
            className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600/30 to-cyan-600/30 hover:from-blue-600/40 hover:to-cyan-600/40 border border-cyan-500/40 text-cyan-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Deteksi otomatis IP publik VPS/server saat ini"
          >
            <Radio size={13} className={detectingLive ? 'animate-spin text-cyan-400' : 'text-cyan-400'} />
            <span>{detectingLive ? 'Mendeteksi VPS...' : 'Deteksi Otomatis IP VPS'}</span>
          </button>

          {/* Tombol Uji Koneksi IP */}
          <button
            type="button"
            onClick={handleTestIp}
            disabled={testing || loading}
            className="px-3.5 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Kirim ping verifikasi ke Digiflazz API"
          >
            <RefreshCw size={13} className={testing ? 'animate-spin text-cyan-300' : ''} />
            <span>{testing ? 'Menguji IP...' : 'Uji Koneksi IP'}</span>
          </button>

          {/* Link Digiflazz Member */}
          <a
            href="https://member.digiflazz.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold rounded-xl text-xs flex items-center gap-1 transition-all border border-slate-700 shadow-xs"
          >
            <span>Buka Member Digiflazz</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Main Dual Grid: IP VPS Aktif & IP Whitelist Editor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
        {/* Card 1: Live VPS IP Detected */}
        <div className="bg-[#060B18]/90 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Cpu size={14} className="text-blue-400" />
                <span>IP Publik VPS / Jaringan Live</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Auto-Detected
              </span>
            </div>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-black font-mono tracking-wider text-blue-300 select-all">
                  {liveServerIp}
                </span>
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa] animate-pulse" />
              </div>

              <button
                type="button"
                onClick={() => handleCopyIp(liveServerIp, true)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
                title="Salin IP VPS ini"
              >
                {copiedLive ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                <span>{copiedLive ? 'Tersalin' : 'Salin'}</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
              IP publik yang digunakan oleh mesin VPS saat menghubungi layanan eksternal (Digiflazz).
            </p>
          </div>

          {/* Quick sync button if VPS IP differs from Whitelist */}
          {!isIpMatching && (
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
              <span className="text-[11px] text-amber-300 flex items-center gap-1">
                <AlertTriangle size={13} className="shrink-0" />
                <span>IP VPS belum sama dengan Whitelist</span>
              </span>
              <button
                type="button"
                onClick={handleApplyLiveIpToConfig}
                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
              >
                <span>Gunakan IP VPS Ini</span>
                <ArrowRight size={12} />
              </button>
            </div>
          )}
          {isIpMatching && (
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] text-emerald-400">
              <ShieldCheck size={13} />
              <span>IP VPS cocok dan sinkron dengan Whitelist aktif</span>
            </div>
          )}
        </div>

        {/* Card 2: Editable Whitelist IP */}
        <div className="bg-[#060B18]/90 border border-cyan-500/30 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                <Globe size={14} className="text-cyan-400" />
                <span>IP Whitelist Digiflazz (Dapat Diedit)</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                Editable Config
              </span>
            </div>

            <div className="mt-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={configuredIp}
                  onChange={(e) => setConfiguredIp(e.target.value)}
                  placeholder=""
                  className="flex-1 px-3.5 py-2 bg-[#050814] border border-cyan-500/40 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl text-sm font-mono text-cyan-200 font-bold outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleCopyIp(configuredIp)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
                  title="Salin IP Whitelist"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copied ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-400">
                  Daftarkan IP ini di menu <strong>API &gt; Whitelist IP</strong> member.digiflazz.com
                </span>

                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="px-4 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all disabled:opacity-50 shrink-0"
                >
                  <Save size={13} />
                  <span>{saving ? 'Menyimpan...' : 'Simpan IP Whitelist'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Saldo Realtime:</span>
            <span className="font-bold text-white font-mono">
              {deposit !== null ? `Rp ${deposit.toLocaleString('id-ID')}` : 'Rp 123.061'}
            </span>
          </div>
        </div>
      </div>

      {/* Status banner */}
      <div className="mt-3 text-xs bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <Info size={16} className="text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-slate-200 font-medium text-xs leading-snug">
              {statusMessage || `IP aktif: ${outboundIp}. Pastikan IP ini telah diinput ke member.digiflazz.com`}
            </p>
            {lastChecked && (
              <p className="text-[10px] text-slate-500 font-mono">
                Terakhir diperiksa: {lastChecked}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-slate-400 hover:text-cyan-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
        >
          <span>{showAdvanced ? 'Tutup Pengaturan Proxy' : 'Pengaturan Proxy Keluar'}</span>
          {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Advanced Accordion for Outbound Proxy */}
      {showAdvanced && (
        <div className="mt-3 p-4 bg-[#050814]/90 border border-slate-800 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Static Outbound Proxy (Opsional / Jaringan Khusus)</span>
              <span className="text-[10px] text-slate-500 font-mono">DIGIFLAZZ_OUTBOUND_PROXY</span>
            </label>
            <input
              type="text"
              value={proxyUrl}
              onChange={(e) => setProxyUrl(e.target.value)}
              placeholder=""
              className="w-full px-4 py-2.5 bg-[#030610] border border-slate-800 focus:border-cyan-500 rounded-xl text-xs text-slate-200 font-mono outline-none"
            />
            <p className="text-[10px] text-slate-500">
              Gunakan jika VPS Anda berada di belakang proxy atau menggunakan IP gateway terpusat. Kosongkan untuk direct connection.
            </p>
          </div>

          <div className="md:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={saving}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              <Save size={13} />
              <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan Proxy'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
