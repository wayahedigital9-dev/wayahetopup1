import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  DollarSign, 
  Send, 
  Wifi, 
  Smartphone, 
  RefreshCw, 
  ExternalLink, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { Order, AppSettings } from '../types';
import { formatRupiah } from '../utils/operator';

interface AdminRealtimeRevenueCardsProps {
  orders: Order[];
  settings?: AppSettings;
  onOpenDigiflazzTab?: () => void;
  onShowToast?: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export function AdminRealtimeRevenueCards({
  orders,
  settings,
  onOpenDigiflazzTab,
  onShowToast,
}: AdminRealtimeRevenueCardsProps) {
  // ── Saldo Digiflazz State ──
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceStatus, setBalanceStatus] = useState<'CONNECTED' | 'UNCONFIGURED' | 'ERROR' | 'LOADING'>('LOADING');
  const [balanceMessage, setBalanceMessage] = useState<string>('');
  const [isRefreshingBalance, setIsRefreshingBalance] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showDepositModal, setShowDepositModal] = useState<boolean>(false);

  // Helper formatting compact nominal (e.g. 123100 -> "123.1rb")
  const formatCompact = (num: number): string => {
    if (num >= 1_000_000_000) {
      return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'jt';
    }
    if (num >= 1_000) {
      return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'rb';
    }
    return num.toLocaleString('id-ID');
  };

  // Fetch real-time Digiflazz balance
  const fetchBalance = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshingBalance(true);
    try {
      // Build query with fallback from client settings if available
      const queryParams = new URLSearchParams();
      if (settings?.digiflazzUsername || settings?.digiflazzUser) {
        queryParams.set('username', (settings.digiflazzUsername || settings.digiflazzUser || '').trim());
      }
      if (settings?.digiflazzApiKey || settings?.digiflazzProductionKey) {
        queryParams.set('apiKey', (settings.digiflazzApiKey || settings.digiflazzProductionKey || '').trim());
      }

      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const res = await fetch(`/api/digiflazz/balance${queryString}`);
      const json = await res.json();

      if (json.success && json.data) {
        setBalance(Number(json.data.deposit || 0));
        setBalanceStatus('CONNECTED');
        setBalanceMessage('');
        setLastUpdated(new Date());
        if (isManual && onShowToast) {
          onShowToast('Saldo Digiflazz Terupdate', `Saldo realtime: ${formatRupiah(Number(json.data.deposit || 0))}`, 'success');
        }
      } else {
        const depositVal = json.data?.deposit !== undefined ? Number(json.data.deposit) : null;
        setBalance(depositVal);
        setBalanceStatus(json.data?.status || 'UNCONFIGURED');
        setBalanceMessage(json.message || 'Kredensial Digiflazz belum diatur.');
        setLastUpdated(new Date());
        if (isManual && onShowToast) {
          onShowToast('Cek Saldo', json.message || 'Kredensial Digiflazz belum terkonfigurasi', 'info');
        }
      }
    } catch (err: any) {
      setBalanceStatus('ERROR');
      setBalanceMessage(err.message || 'Gagal tersambung ke backend.');
    } finally {
      if (isManual) setIsRefreshingBalance(false);
    }
  }, [settings?.digiflazzUsername, settings?.digiflazzUser, settings?.digiflazzApiKey, settings?.digiflazzProductionKey, onShowToast]);

  // Initial fetch and auto-polling every 25 seconds
  useEffect(() => {
    fetchBalance(false);
    const interval = setInterval(() => {
      fetchBalance(false);
    }, 25000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  // ── Realtime Revenue Calculations from Successful Orders ──
  const successfulOrders = useMemo(() => {
    return orders.filter(o => o.paymentStatus === 'PAID' && o.fulfillmentStatus === 'SUCCESS');
  }, [orders]);

  const totalSuccessfulRevenue = useMemo(() => {
    return successfulOrders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
  }, [successfulOrders]);

  // 1. Pemasukan Digiflazz (Produk yang dikirim via Digiflazz H2H: Pulsa, Data, Game, PLN, dll)
  const digiflazzMetrics = useMemo(() => {
    const dfOrders = successfulOrders.filter(o => {
      const hasDfItem = o.items.some(it => 
        it.category === 'pulsa' || 
        it.category === 'kuota' || 
        it.category === 'game' || 
        Boolean((it as any).supplierSku) || 
        Boolean((it as any).digiflazzCategory)
      );
      return hasDfItem || Boolean(o.digiflazzRefId);
    });

    const revenue = dfOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const percent = totalSuccessfulRevenue > 0 ? (revenue / totalSuccessfulRevenue) * 100 : 0;
    return {
      revenue,
      count: dfOrders.length,
      percent: Math.round(percent),
    };
  }, [successfulOrders, totalSuccessfulRevenue]);

  // 2. Pemasukan Voucher WiFi RT/RW Net
  const wifiMetrics = useMemo(() => {
    const wifiOrders = successfulOrders.filter(o => {
      return o.items.some(it => it.category === 'wifi');
    });

    const revenue = wifiOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const percent = totalSuccessfulRevenue > 0 ? (revenue / totalSuccessfulRevenue) * 100 : 0;
    return {
      revenue,
      count: wifiOrders.length,
      percent: Math.round(percent),
    };
  }, [successfulOrders, totalSuccessfulRevenue]);

  // 3. Pemasukan Pulsa dan Kuota (Paket Data Internet & Pulsa Reguler)
  const pulsaKuotaMetrics = useMemo(() => {
    const pkOrders = successfulOrders.filter(o => {
      return o.items.some(it => it.category === 'pulsa' || it.category === 'kuota');
    });

    const revenue = pkOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const percent = totalSuccessfulRevenue > 0 ? (revenue / totalSuccessfulRevenue) * 100 : 0;
    return {
      revenue,
      count: pkOrders.length,
      percent: Math.round(percent),
    };
  }, [successfulOrders, totalSuccessfulRevenue]);

  return (
    <div className="space-y-3">
      {/* SECTION HEADER: REALTIME FINANCIAL & BALANCE METRICS */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <span>Metrik Keuangan & Saldo Realtime</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
              Live Sync
            </span>
          </h3>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <Clock size={12} className="text-slate-400" />
          <span>
            Update: {lastUpdated ? lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Menghubungkan...'}
          </span>
          <button
            type="button"
            onClick={() => fetchBalance(true)}
            disabled={isRefreshingBalance}
            title="Segarkan Saldo Digiflazz"
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={isRefreshingBalance ? 'animate-spin text-emerald-600' : ''} />
          </button>
        </div>
      </div>

      {/* 4 CARDS GRID: SALDO DGF + 3 PEMASUKAN REALTIME */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* CARD 1: SALDO DIGIFLAZZ (DGF) - PERSIS SEPERTI GAMBAR USER */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-all group">
          {/* Top Bar: Title & Refresh Action */}
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-extrabold text-[#374151] tracking-tight">
              Saldo DGF
            </h4>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${
                balanceStatus === 'CONNECTED' ? 'bg-emerald-500' :
                balanceStatus === 'UNCONFIGURED' ? 'bg-amber-400' : 'bg-rose-500'
              }`} />
              <button
                type="button"
                onClick={() => fetchBalance(true)}
                disabled={isRefreshingBalance}
                className="text-slate-400 hover:text-emerald-600 transition-colors p-0.5 rounded cursor-pointer"
                title="Cek Saldo Realtime"
              >
                <RefreshCw size={13} className={isRefreshingBalance ? 'animate-spin text-emerald-600' : ''} />
              </button>
            </div>
          </div>

          {/* Main Body: Circular Green $ Badge + Big Bold Nominal */}
          <div className="flex items-center gap-4 my-3">
            {/* Green Circular Badge matching user's image */}
            <div className="w-14 h-14 rounded-full bg-[#E5F7EC] text-[#10B981] flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
              <DollarSign size={28} strokeWidth={2.5} />
            </div>

            {/* Nominal Display */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-3xl font-black text-[#002B66] tracking-tight block">
                  {balance !== null 
                    ? formatCompact(balance) 
                    : (balanceStatus === 'LOADING' ? '...' : '0rb')
                  }
                </span>
                {balance !== null && balance > 0 && (
                  <span className="text-[11px] font-bold text-slate-400">
                    ({formatRupiah(balance)})
                  </span>
                )}
              </div>

              {/* Subtitle & "isi ulang" Action Link */}
              <div className="mt-1 flex items-center gap-1 text-xs text-slate-500 flex-wrap">
                <span>Digiflazz Balance,</span>
                <button
                  type="button"
                  onClick={() => setShowDepositModal(true)}
                  className="font-bold text-[#2563EB] hover:text-blue-700 hover:underline cursor-pointer inline-flex items-center gap-0.5"
                >
                  isi ulang
                </button>
              </div>
            </div>
          </div>

          {/* Footer Status Information */}
          <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-[10px]">
            <span className="text-slate-400">
              Status Server:
            </span>
            <span className={`font-bold flex items-center gap-1 ${
              balanceStatus === 'CONNECTED' ? 'text-emerald-600' :
              balanceStatus === 'UNCONFIGURED' ? 'text-amber-600' : 'text-rose-600'
            }`}>
              {balanceStatus === 'CONNECTED' && <CheckCircle2 size={11} />}
              {balanceStatus === 'CONNECTED' ? 'Tersambung Live' : 
               balanceStatus === 'UNCONFIGURED' ? 'Kredensial Standby' : 'Gagal Konek'}
            </span>
          </div>
        </div>

        {/* CARD 2: PEMASUKAN DARI DIGIFLAZZ (REALTIME) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Pemasukan Digiflazz
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
              <Send size={15} />
            </div>
          </div>

          <div className="my-3">
            <span className="text-2xl font-black text-slate-900 tracking-tight block">
              {formatRupiah(digiflazzMetrics.revenue)}
            </span>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[11px] font-bold text-teal-600 flex items-center gap-1">
                <TrendingUp size={12} />
                {digiflazzMetrics.count} Transaksi Sukses
              </span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200/60">
                {digiflazzMetrics.percent}% Total
              </span>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-[10px] text-slate-400">
            <span>H2H Otomatis Server</span>
            <span className="text-teal-600 font-bold">Auto Fulfill</span>
          </div>
        </div>

        {/* CARD 3: PEMASUKAN DARI VOUCHER WIFI (REALTIME) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Pemasukan Voucher WiFi
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Wifi size={15} />
            </div>
          </div>

          <div className="my-3">
            <span className="text-2xl font-black text-slate-900 tracking-tight block">
              {formatRupiah(wifiMetrics.revenue)}
            </span>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[11px] font-bold text-indigo-600 flex items-center gap-1">
                <TrendingUp size={12} />
                {wifiMetrics.count} Voucher Terjual
              </span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                {wifiMetrics.percent}% Total
              </span>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-[10px] text-slate-400">
            <span>WiFi Hotspot RT/RW Net</span>
            <span className="text-indigo-600 font-bold">Instant Code</span>
          </div>
        </div>

        {/* CARD 4: PEMASUKAN PULSA & KUOTA (REALTIME) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Pemasukan Pulsa & Kuota
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              <Smartphone size={15} />
            </div>
          </div>

          <div className="my-3">
            <span className="text-2xl font-black text-slate-900 tracking-tight block">
              {formatRupiah(pulsaKuotaMetrics.revenue)}
            </span>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[11px] font-bold text-sky-600 flex items-center gap-1">
                <TrendingUp size={12} />
                {pulsaKuotaMetrics.count} Order Berhasil
              </span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200/60">
                {pulsaKuotaMetrics.percent}% Total
              </span>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-[10px] text-slate-400">
            <span>Paket Data & Pulsa All Op</span>
            <span className="text-sky-600 font-bold">Realtime</span>
          </div>
        </div>

      </div>

      {/* QUICK DEPOSIT / ISI ULANG MODAL DIALOG */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <DollarSign size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Isi Ulang Saldo Digiflazz</h3>
                  <p className="text-xs text-slate-500">Deposit saldo akun buyer Digiflazz</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDepositModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Saldo Saat Ini:</span>
                <span className="font-extrabold text-[#002B66] text-sm">
                  {balance !== null ? formatRupiah(balance) : 'Rp 0'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Username Akun:</span>
                <span className="font-mono font-bold text-slate-800">
                  {settings?.digiflazzUsername || settings?.digiflazzUser || '-'}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed bg-blue-50/70 p-3.5 rounded-2xl border border-blue-100">
              <p className="font-bold text-blue-900 flex items-center gap-1.5">
                <Sparkles size={14} className="text-blue-600" />
                Cara Melakukan Topup Deposit Digiflazz:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-slate-700 text-[11px]">
                <li>Login ke member area Digiflazz di <strong>member.digiflazz.com</strong></li>
                <li>Pilih menu <strong>Deposit / Saldo</strong> lalu klik <strong>Tambah Deposit</strong></li>
                <li>Pilih metode transfer (BCA, Mandiri, BRI, BNI atau Virtual Account)</li>
                <li>Transfer sesuai tiket nominal unik agar saldo otomatis masuk dalam 1–5 menit</li>
              </ol>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <a
                href="https://member.digiflazz.com/deposit"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <span>Buka Web Digiflazz</span>
                <ExternalLink size={14} />
              </a>

              {onOpenDigiflazzTab && (
                <button
                  type="button"
                  onClick={() => {
                    setShowDepositModal(false);
                    onOpenDigiflazzTab();
                  }}
                  className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Buka Tab Digiflazz
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
