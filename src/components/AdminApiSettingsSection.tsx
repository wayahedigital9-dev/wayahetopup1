import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Link2, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Save, 
  Power, 
  DollarSign, 
  Percent, 
  Sliders, 
  HelpCircle, 
  AlertTriangle, 
  Sparkles, 
  Layers, 
  Check, 
  ArrowRight,
  Send
} from 'lucide-react';
import { ApiProviderConfig } from '../types';
import { providerIntegrationService, DEFAULT_API_CONFIGS } from '../services/providerIntegrationService';
import { formatRupiah, formatDateWIB } from '../utils/operator';
import { triggerTopLoading } from './TopProgressBar';

interface AdminApiSettingsSectionProps {
  onShowToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onRefreshData: () => void;
  initialCategory?: 'premium' | 'smm' | 'game' | 'gateway_tambahan';
}

export function AdminApiSettingsSection({
  onShowToast,
  onRefreshData,
  initialCategory = 'premium',
}: AdminApiSettingsSectionProps) {
  const [activeCategory, setActiveCategory] = useState<'premium' | 'smm' | 'game' | 'gateway_tambahan'>(initialCategory);
  const [configs, setConfigs] = useState<Record<string, ApiProviderConfig>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState<{ message: string; added: number; updated: number; skipped: number } | null>(null);

  // Load configs on mount
  useEffect(() => {
    const loaded = providerIntegrationService.getApiConfigs();
    setConfigs(loaded);
  }, []);

  const currentConfig: ApiProviderConfig = configs[activeCategory] || DEFAULT_API_CONFIGS[activeCategory] || {
    id: activeCategory,
    category: activeCategory,
    providerName: activeCategory === 'premium' ? 'Xaviera Store' : activeCategory === 'smm' ? 'Xaviera Store' : 'Provider Game',
    apiUrl: '',
    apiKey: '',
    isActive: false,
    marginType: 'PERCENTAGE',
    marginValue: 15,
    autoPublish: true,
    connectionStatus: 'UNTESTED',
    roundingRule: 'CEIL',
  };

  const updateCurrentConfig = (updates: Partial<ApiProviderConfig>) => {
    setConfigs(prev => ({
      ...prev,
      [activeCategory]: {
        ...(prev[activeCategory] || currentConfig),
        ...updates,
      },
    }));
  };

  const handleSaveConfig = () => {
    triggerTopLoading.start();
    try {
      providerIntegrationService.saveApiConfig(currentConfig);
      onShowToast(
        'Konfigurasi Disimpan',
        `Pengaturan API untuk ${currentConfig.providerName} (${activeCategory.toUpperCase()}) berhasil disimpan di server.`,
        'success'
      );
    } catch (err: any) {
      onShowToast('Gagal Menyimpan', err?.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setTimeout(() => triggerTopLoading.done(), 200);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    triggerTopLoading.start();
    try {
      const result = await providerIntegrationService.testConnection(activeCategory, currentConfig);
      if (result.success) {
        onShowToast('Koneksi Berhasil', result.message, 'success');
        updateCurrentConfig({
          connectionStatus: 'CONNECTED',
          lastTestedAt: new Date().toISOString(),
        });
      } else {
        onShowToast('Koneksi Gagal', result.message, 'error');
        updateCurrentConfig({
          connectionStatus: 'FAILED',
          lastTestedAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      onShowToast('Uji Koneksi Error', err?.message || 'Gagal menghubungi server endpoint', 'error');
      updateCurrentConfig({
        connectionStatus: 'FAILED',
        lastTestedAt: new Date().toISOString(),
      });
    } finally {
      setIsTesting(false);
      triggerTopLoading.done();
    }
  };

  const handleToggleActive = () => {
    const nextState = !currentConfig.isActive;
    const updated = {
      ...currentConfig,
      isActive: nextState,
    };
    updateCurrentConfig({ isActive: nextState });
    providerIntegrationService.saveApiConfig(updated);
    onShowToast(
      nextState ? 'Integrasi Diaktifkan' : 'Integrasi Dinonaktifkan',
      `Integrasi ${currentConfig.providerName} untuk kategori ${activeCategory.toUpperCase()} kini ${nextState ? 'AKTIF' : 'NONAKTIF'}.`,
      nextState ? 'success' : 'info'
    );
  };

  const handleSyncProducts = async () => {
    setIsSyncing(true);
    setSyncSummary(null);
    triggerTopLoading.start();
    try {
      const result = await providerIntegrationService.syncCatalog(activeCategory);
      setSyncSummary(result);
      onShowToast(
        'Sinkronisasi Sukses',
        `Berhasil menyinkronkan produk: +${result.added} baru, ${result.updated} diperbarui.`,
        'success'
      );
      onRefreshData();
    } catch (err: any) {
      onShowToast('Sinkronisasi Gagal', err?.message || 'Gagal mengambil katalog provider', 'error');
    } finally {
      setIsSyncing(false);
      triggerTopLoading.done();
    }
  };

  return (
    <div className="space-y-6">
      {/* Category Tabs */}
      <div className="bg-[#0B101E] p-2 rounded-2xl border border-slate-800/80 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { setActiveCategory('premium'); setSyncSummary(null); }}
          className={`flex-1 min-w-[160px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeCategory === 'premium'
              ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Sparkles size={14} className={activeCategory === 'premium' ? 'text-amber-300' : 'text-slate-400'} />
          <span>Aplikasi Premium (Xaviera)</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveCategory('smm'); setSyncSummary(null); }}
          className={`flex-1 min-w-[160px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeCategory === 'smm'
              ? 'bg-gradient-to-r from-sky-600 to-sky-700 text-white shadow-lg shadow-sky-600/30 border border-sky-400/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Layers size={14} className={activeCategory === 'smm' ? 'text-sky-300' : 'text-slate-400'} />
          <span>SMM Gateway (Xaviera)</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveCategory('game'); setSyncSummary(null); }}
          className={`flex-1 min-w-[160px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeCategory === 'game'
              ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-600/30 border border-emerald-400/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Send size={14} className={activeCategory === 'game' ? 'text-emerald-300' : 'text-slate-400'} />
          <span>Top Up Game</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveCategory('gateway_tambahan'); setSyncSummary(null); }}
          className={`flex-1 min-w-[160px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeCategory === 'gateway_tambahan'
              ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg shadow-purple-600/30 border border-purple-400/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Key size={14} className={activeCategory === 'gateway_tambahan' ? 'text-purple-300' : 'text-slate-400'} />
          <span>API Gateway AI (Clouvia)</span>
        </button>
      </div>

      {/* Main Settings Card */}
      <div className="bg-[#0B101E] border border-slate-800/80 rounded-3xl p-6 shadow-2xl space-y-6">
        {/* Top Header of Selected Provider */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
              activeCategory === 'premium' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' :
              activeCategory === 'smm' ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30' :
              activeCategory === 'game' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' :
              'bg-purple-600/20 text-purple-400 border border-purple-500/30'
            }`}>
              {activeCategory === 'premium' && <Sparkles size={24} />}
              {activeCategory === 'smm' && <Layers size={24} />}
              {activeCategory === 'game' && <Send size={24} />}
              {activeCategory === 'gateway_tambahan' && <Key size={24} />}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-black text-white">
                  Konfigurasi API: {currentConfig.providerName}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  currentConfig.isActive
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {currentConfig.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeCategory === 'premium' && 'Adaptor resmi Xaviera Store untuk impor katalog dan eksekusi akun premium otomatis.'}
                {activeCategory === 'smm' && 'Adaptor SMM Xaviera Store dengan tarif per 1.000 unit dan rumus pembulatan ceil.'}
                {activeCategory === 'game' && 'Integrasi produk top up voucher game dan nominal diamond/token.'}
                {activeCategory === 'gateway_tambahan' && 'Konfigurasi router AI OpenAI-compatible (https://router.clouvia.id/v1) model coding-high.'}
              </p>
            </div>
          </div>

          {/* Action buttons on Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleToggleActive}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                currentConfig.isActive
                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}
            >
              <Power size={13} />
              <span>{currentConfig.isActive ? 'Nonaktifkan' : 'Aktifkan Integrasi'}</span>
            </button>

            <button
              type="button"
              disabled={isTesting}
              onClick={handleTestConnection}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={isTesting ? 'animate-spin' : ''} />
              <span>{isTesting ? 'Menguji...' : 'Uji Koneksi'}</span>
            </button>

            <button
              type="button"
              disabled={isSyncing}
              onClick={handleSyncProducts}
              className="px-4 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/25 border border-emerald-400/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
              <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Produk'}</span>
            </button>
          </div>
        </div>

        {/* Sync Summary Banner if available */}
        {syncSummary && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex items-center justify-between gap-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
              <div>
                <p className="font-bold">{syncSummary.message}</p>
                <p className="text-[11px] text-emerald-300/80 mt-0.5">
                  +{syncSummary.added} baru • {syncSummary.updated} diperbarui • {syncSummary.skipped} dilewati (arsip/hapus)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSyncSummary(null)}
              className="text-emerald-400 hover:text-white p-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Status Indicators Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-[#070B14] border border-slate-800 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Status Koneksi:</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {currentConfig.connectionStatus === 'CONNECTED' ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 size={13} /> Terhubung
                </span>
              ) : currentConfig.connectionStatus === 'FAILED' ? (
                <span className="text-rose-400 font-bold flex items-center gap-1">
                  <XCircle size={13} /> Gagal Terhubung
                </span>
              ) : (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <HelpCircle size={13} /> Belum Diuji
                </span>
              )}
            </div>
            {currentConfig.lastTestedAt && (
              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                Dicek: {formatDateWIB(currentConfig.lastTestedAt)}
              </span>
            )}
          </div>

          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Terakhir Sinkron:</span>
            <span className="font-semibold text-slate-200 block mt-0.5">
              {currentConfig.lastSyncAt ? formatDateWIB(currentConfig.lastSyncAt) : 'Belum pernah'}
            </span>
            {currentConfig.lastSyncSummary && (
              <span className="text-[10px] text-slate-500 block truncate mt-0.5" title={currentConfig.lastSyncSummary}>
                {currentConfig.lastSyncSummary}
              </span>
            )}
          </div>

          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Penayangan Otomatis:</span>
            <span className="font-bold text-slate-200 flex items-center gap-1 mt-0.5">
              {currentConfig.autoPublish ? (
                <span className="text-emerald-400">Aktif (Langsung Tayang di Toko)</span>
              ) : (
                <span className="text-slate-400">Manual (Review Dulu)</span>
              )}
            </span>
          </div>
        </div>

        {/* Input Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Provider Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Nama Provider
            </label>
            <input
              type="text"
              value={currentConfig.providerName}
              onChange={(e) => updateCurrentConfig({ providerName: e.target.value })}
              placeholder="Contoh: Xaviera Store"
              className="w-full px-4 py-2.5 rounded-xl bg-[#141A29] border border-slate-700/80 text-white text-xs font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <p className="text-[10px] text-slate-500">
              Penyedia katalog produk resmi sesuai dokumentasi.
            </p>
          </div>

          {/* Endpoint URL */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Alamat API Katalog</span>
              <span className="text-[10px] font-mono text-indigo-400">GET Endpoint</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={currentConfig.apiUrl}
                onChange={(e) => updateCurrentConfig({ apiUrl: e.target.value })}
                placeholder={
                  activeCategory === 'premium'
                    ? 'https://xavierastore.com/api/v1/products'
                    : activeCategory === 'smm'
                    ? 'https://xavierastore.com/api/v1/smm/services'
                    : 'https://api.provider.com/v1/catalog'
                }
                className="w-full px-4 py-2.5 rounded-xl bg-[#141A29] border border-slate-700/80 text-white font-mono text-xs focus:border-indigo-500"
              />
            </div>
            <p className="text-[10px] text-slate-500">
              {activeCategory === 'premium' && 'Default: https://xavierastore.com/api/v1/products'}
              {activeCategory === 'smm' && 'Default: https://xavierastore.com/api/v1/smm/services'}
              {activeCategory === 'game' && 'Endpoint katalog provider top up game.'}
              {activeCategory === 'gateway_tambahan' && 'Default: https://router.clouvia.id/v1 (Model coding-high)'}
            </p>
          </div>

          {/* API Key / Token */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Kredensial API (Bearer Token / Secret Key)</span>
              <span className="text-[10px] text-emerald-400 font-semibold">🔒 Server Secured</span>
            </label>
            <input
              type="password"
              value={currentConfig.apiKey || ''}
              onChange={(e) => updateCurrentConfig({ apiKey: e.target.value })}
              placeholder="Masukkan API Token Provider Anda..."
              className="w-full px-4 py-2.5 rounded-xl bg-[#141A29] border border-slate-700/80 text-white font-mono text-xs focus:border-indigo-500"
            />
            <p className="text-[10px] text-slate-500">
              Kredensial disimpan aman di sisi server. Token tidak pernah dikirim ke browser pembeli.
            </p>
          </div>

          {/* Auto Publish Toggle */}
          <div className="space-y-1.5 flex flex-col justify-end">
            <label className="block text-xs font-bold text-slate-300">
              Pengaturan Penayangan Toko
            </label>
            <label className="flex items-center gap-3 p-2.5 rounded-xl bg-[#141A29] border border-slate-700/80 cursor-pointer">
              <input
                type="checkbox"
                checked={currentConfig.autoPublish}
                onChange={(e) => updateCurrentConfig({ autoPublish: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
              />
              <span className="text-xs text-slate-300">
                Otomatis tampilkan produk di Toko setelah sinkronisasi berhasil
              </span>
            </label>
            <p className="text-[10px] text-slate-500">
              Produk dengan harga & stok valid otomatis aktif tanpa perlu disetujui satu per satu.
            </p>
          </div>
        </div>

        {/* Pricing & Profit Margin Settings Box */}
        <div className="p-5 rounded-2xl bg-[#070B14] border border-indigo-500/20 space-y-4">
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-indigo-400" />
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-300">
              Aturan Margin & Harga Jual Otomatis
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Margin Type */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-400">
                Tipe Margin Keuntungan
              </label>
              <select
                value={currentConfig.marginType}
                onChange={(e) => updateCurrentConfig({ marginType: e.target.value as 'PERCENTAGE' | 'NOMINAL' })}
                className="w-full px-3 py-2 rounded-xl bg-[#141A29] border border-slate-700 text-white text-xs font-bold"
              >
                <option value="PERCENTAGE">Persentase (%)</option>
                <option value="NOMINAL">Nominal Tetap (Rp)</option>
              </select>
            </div>

            {/* Margin Value */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-400">
                Besar Margin {currentConfig.marginType === 'PERCENTAGE' ? '(%)' : '(Rp / 1.000 untuk SMM)'}
              </label>
              <input
                type="number"
                value={currentConfig.marginValue}
                onChange={(e) => updateCurrentConfig({ marginValue: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-[#141A29] border border-slate-700 text-white text-xs font-mono font-bold"
              />
            </div>

            {/* Rounding Rule */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-400">
                Aturan Pembulatan
              </label>
              <select
                value={currentConfig.roundingRule}
                onChange={(e) => updateCurrentConfig({ roundingRule: e.target.value as 'CEIL' | 'ROUND' | 'NONE' })}
                className="w-full px-3 py-2 rounded-xl bg-[#141A29] border border-slate-700 text-white text-xs font-bold"
              >
                <option value="CEIL">Bulatkan ke Atas (Ceil Rupiah)</option>
                <option value="ROUND">Bulatkan Standar (Ratusan)</option>
                <option value="NONE">Tanpa Pembulatan</option>
              </select>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#0D1527] border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
            <span className="font-bold text-indigo-300">💡 Simulasi Perhitungan:</span>
            {activeCategory === 'smm' ? (
              <span> Untuk rate seller Rp15.000 / 1.000 unit dengan margin {currentConfig.marginValue}{currentConfig.marginType === 'PERCENTAGE' ? '%' : ' Rp'}, harga jual pelanggan otomatis menjadi <strong className="text-white">{formatRupiah(providerIntegrationService.calculateSellingPrice(15000, currentConfig))}</strong> / 1.000 unit.</span>
            ) : (
              <span> Untuk modal seller Rp25.000 dengan margin {currentConfig.marginValue}{currentConfig.marginType === 'PERCENTAGE' ? '%' : ' Rp'}, harga jual otomatis menjadi <strong className="text-white">{formatRupiah(providerIntegrationService.calculateSellingPrice(25000, currentConfig))}</strong>.</span>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={handleSaveConfig}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-extrabold rounded-2xl text-xs transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer active:scale-95 border border-indigo-400/30"
          >
            <Save size={15} />
            <span>Simpan Konfigurasi {currentConfig.providerName}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
