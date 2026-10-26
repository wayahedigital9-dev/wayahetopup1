import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Copy, Eye, EyeOff, KeyRound, LockKeyhole, Printer, RefreshCw, ShieldAlert, ShieldCheck, Wifi, X } from 'lucide-react';
import { Order } from '../types';
import { formatDateWIB, formatRupiah } from '../utils/operator';
import { PaymentStatusBadge, FulfillmentStatusBadge } from './StatusBadge';
import { ProductLogo } from './ProductLogo';

interface InvoiceModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onCopyText: (text: string, label: string) => void;
}

export function InvoiceModal({ order, isOpen, onClose, onCopyText }: InvoiceModalProps) {
  const [snapshot, setSnapshot] = useState<{ key: string; order: Order } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  const orderId = order?.id || order?.invoiceNumber;
  const accessToken = order?.guestAccessToken || '';
  const snapshotKey = `${orderId || ''}:${accessToken}:${refresh}`;
  const currentOrder = isOpen && snapshot?.key === snapshotKey ? snapshot.order : null;

  // The prop identifies a purchase; it is never proof of payment or delivery.
  // No browser inventory/order lookup and no merge with stale local credentials.
  useEffect(() => {
    setSnapshot(null);
    setVisibleSecrets({});
    setError('');
    if (!isOpen || !orderId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const readCanonicalOrder = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
          credentials: 'same-origin',
          headers: accessToken ? { 'x-guest-token': accessToken } : {},
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('Status invoice belum dapat diverifikasi. Periksa koneksi atau akses pembelian Anda.');
        const json = await res.json();
        const serverOrder: Order = json?.data || json?.order || json;
        if (!serverOrder || (serverOrder.id !== orderId && serverOrder.invoiceNumber !== orderId) || !Array.isArray(serverOrder.items) || !serverOrder.paymentStatus || !serverOrder.fulfillmentStatus) {
          throw new Error('Data invoice belum lengkap. Silakan periksa kembali.');
        }
        if (stopped) return;
        setSnapshot({ key: snapshotKey, order: serverOrder });
        setError('');
        const finished = (serverOrder.paymentStatus === 'PAID' && serverOrder.fulfillmentStatus === 'SUCCESS') || ['FAILED', 'EXPIRED', 'REFUNDED'].includes(serverOrder.paymentStatus) || ['FAILED', 'CANCELED'].includes(serverOrder.fulfillmentStatus);
        if (!finished) timer = setTimeout(() => { void readCanonicalOrder(); }, 3000);
      } catch (err) {
        if (stopped) return;
        setSnapshot(null); // Fail closed: no retained credential on an unverifiable receipt.
        setError(err instanceof Error ? err.message : 'Gagal membaca status invoice.');
        timer = setTimeout(() => { void readCanonicalOrder(); }, 5000);
      } finally {
        if (!stopped) setLoading(false);
      }
    };
    void readCanonicalOrder();
    return () => { stopped = true; controller.abort(); if (timer) clearTimeout(timer); };
  }, [isOpen, orderId, accessToken, snapshotKey]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => { document.body.style.overflow = bodyOverflow; previous?.focus(); };
  }, [isOpen]);

  if (!isOpen || !order) return null;
  const isPaid = currentOrder?.paymentStatus === 'PAID';
  const isFulfillmentSuccess = currentOrder?.fulfillmentStatus === 'SUCCESS';
  const mayReveal = Boolean(isPaid && isFulfillmentSuccess);
  const isWifi = currentOrder?.category === 'wifi';
  const isPremium = currentOrder?.category === 'premium';
  const result = currentOrder?.fulfillmentResult;
  const wifiVoucherCode = result?.voucherCode || currentOrder?.voucherCode || '';
  // Receipt is voucher-code only: kata sandi WiFi tidak ditampilkan.

  const credentials = result?.credentials?.length ? result.credentials : currentOrder?.credentials || [];
  const serialNumber = result?.serialNumber || currentOrder?.serialNumber;
  const failed = currentOrder && (['FAILED', 'CANCELED', 'MANUAL_REVIEW', 'NEEDS_REVIEW', 'PARTIAL'].includes(currentOrder.fulfillmentStatus) || ['FAILED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED'].includes(currentOrder.paymentStatus));
  const fulfilledDataMissing = mayReveal && ((isWifi && !wifiVoucherCode) || (isPremium && !credentials.length && !wifiVoucherCode && !serialNumber && !result?.premiumInstructions));
  const total = currentOrder?.totalPayment ?? currentOrder?.totalAmount ?? 0;

  function secret(label: string, value: string, key: string, conceal = true) {
    const revealed = !conceal || Boolean(visibleSecrets[key]);
    return <div key={key} className="rounded-xl bg-slate-900 border border-slate-700/80 p-3 sm:p-4 space-y-2 text-white shadow-inner">
      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">{label}</p>
      <div className="flex items-center gap-2"><span className="font-mono text-base sm:text-lg font-extrabold tracking-wider break-all min-w-0 flex-1 select-all text-white">{revealed ? value : '••••••••••••'}</span>
        {conceal && <button type="button" aria-label={`${revealed ? 'Sembunyikan' : 'Tampilkan'} ${label}`} aria-pressed={revealed} onClick={() => setVisibleSecrets(prev => ({ ...prev, [key]: !prev[key] }))} className="p-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-emerald-500">{revealed ? <EyeOff size={16} /> : <Eye size={16} />}</button>}
        <button type="button" aria-label={`Salin ${label}`} onClick={() => onCopyText(value, label)} className="p-2.5 rounded-lg border border-emerald-500/50 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/40 hover:text-white focus-visible:outline-emerald-500"><Copy size={16} /></button>
      </div>
    </div>;
  }
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') { onClose(); return; }
    if (event.key !== 'Tab') return;
    const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]');
    if (!controls?.length) return;
    const first = controls[0]; const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return <div className="fixed inset-0 z-50 p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md flex items-center justify-center">
    <div ref={dialogRef} tabIndex={-1} onKeyDown={handleKeyDown} role="dialog" aria-modal="true" aria-labelledby="invoice-modal-title" id={`invoice-modal-${orderId}`} className="w-full max-w-2xl max-h-[92dvh] flex flex-col overflow-hidden rounded-3xl bg-white shadow-2xl outline-none">
      <header className="px-5 sm:px-7 py-5 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white flex items-center justify-between gap-3">
        <div><p className="text-[10px] sm:text-xs font-medium tracking-[0.3em] uppercase text-emerald-300/90">Wayahe Digital</p><h2 id="invoice-modal-title" className="text-lg sm:text-xl font-semibold tracking-tight mt-1 text-white">Invoice Pembelian Premium</h2></div>
        <div className="flex gap-2"><button type="button" aria-label="Cetak invoice" disabled={!currentOrder || loading || Boolean(error)} onClick={() => window.print()} className="p-2.5 border border-white/20 rounded-xl text-white/80 hover:bg-white/10 disabled:opacity-40"><Printer size={18} /></button><button type="button" aria-label="Tutup invoice" onClick={onClose} className="p-2.5 border border-white/20 rounded-xl text-white/80 hover:bg-white/10"><X size={18} /></button></div>
      </header>
      <div className="p-5 sm:p-7 overflow-y-auto space-y-6">
        {!currentOrder && <div role="status" aria-live="polite" className="rounded-2xl bg-slate-50 border border-slate-200 p-6 flex items-start gap-3">{error ? <ShieldAlert className="text-amber-600 shrink-0" size={22} /> : <RefreshCw className="animate-spin text-indigo-600 shrink-0" size={22} />}<div><h3 className="font-semibold text-sm">{error ? 'Invoice belum terverifikasi' : 'Memverifikasi invoice'}</h3><p className="text-xs text-slate-500 leading-relaxed mt-1">{error || 'Mengambil status pembayaran dan hasil pengiriman langsung dari server.'}</p>{error && <button type="button" onClick={() => setRefresh(v => v + 1)} className="mt-3 text-sm text-indigo-600 font-semibold">Coba lagi</button>}</div></div>}
        {currentOrder && <>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div><p className="text-xs text-slate-500">Nomor invoice</p><p className="font-mono font-semibold break-all mt-1">{currentOrder.invoiceNumber}</p><p className="text-xs text-slate-400 mt-1">{formatDateWIB(currentOrder.createdAt)}</p></div><button type="button" onClick={() => onCopyText(currentOrder.invoiceNumber, 'Nomor Invoice')} className="flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600"><Copy size={14} />Salin invoice</button></div>
          <section className="relative overflow-hidden rounded-2xl p-5 sm:p-6 text-white bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-950 ring-1 ring-emerald-500/30 shadow-lg shadow-emerald-900/20"><div aria-hidden="true" className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" /><p className="text-xs uppercase tracking-[0.25em] text-emerald-300/80">Total Pembayaran</p><p className="text-3xl sm:text-5xl tracking-tight font-semibold tabular-nums mt-2 bg-gradient-to-r from-white via-emerald-100 to-emerald-200 bg-clip-text text-transparent">{formatRupiah(total)}</p><div className="mt-5 space-y-3 text-xs"><div className="flex flex-wrap gap-2 justify-between items-center"><span className="text-slate-300">Pembayaran</span><PaymentStatusBadge status={currentOrder.paymentStatus} size="sm" /></div><div className="flex flex-wrap gap-2 justify-between items-center"><span className="text-slate-300">Pengiriman produk</span><FulfillmentStatusBadge status={currentOrder.fulfillmentStatus} size="sm" /></div></div>{currentOrder.expiredAt && !isPaid && <p className="mt-4 text-xs text-slate-400">Batas pembayaran: {formatDateWIB(currentOrder.expiredAt)}</p>}</section>
          <div role="status" aria-live="polite" className={`flex items-start gap-3 rounded-xl p-4 border ${failed || fulfilledDataMissing ? 'bg-amber-50 border-amber-200 text-amber-900' : mayReveal ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-indigo-50 border-indigo-100 text-indigo-900'}`}>
            {failed || fulfilledDataMissing ? <ShieldAlert size={20} className="shrink-0" /> : mayReveal ? <CheckCircle2 size={20} className="shrink-0" /> : <RefreshCw size={20} className="shrink-0" />}
            <div><p className="font-semibold text-sm">{fulfilledDataMissing ? 'Hasil pengiriman belum lengkap' : failed ? 'Pesanan memerlukan perhatian' : mayReveal ? 'Pembayaran dan pengiriman selesai' : isPaid ? 'Pembayaran terverifikasi, produk sedang disiapkan' : 'Menunggu pembayaran terverifikasi'}</p><p className="text-xs leading-relaxed mt-1 opacity-80">{failed ? currentOrder.errorReason || result?.errorReason || 'Periksa status di atas. Hubungi dukungan toko dengan nomor invoice; jangan membayar ulang tanpa arahan.' : fulfilledDataMissing ? 'Server belum mengembalikan data akses. Hubungi dukungan toko dengan nomor invoice.' : mayReveal ? 'Data pembelian di bawah berasal dari hasil pengiriman server.' : 'Status diperbarui otomatis. Kode dan data akses hanya tersedia setelah pembayaran PAID dan pengiriman SUCCESS.'}</p></div>
          </div>
          {mayReveal && isWifi && Boolean(wifiVoucherCode) && <section className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-5 sm:p-6 space-y-4 shadow-xl ring-1 ring-emerald-500/30 text-white"><h3 className="flex items-center gap-2 text-sm font-bold tracking-tight text-emerald-300"><Wifi size={18} className="text-emerald-400" />Voucher WiFi Resmi (Stok Admin)</h3>{secret('Kode Voucher WiFi', wifiVoucherCode, 'wifi-code', false)}{(result?.wifiSsid || currentOrder.wifiSsid) && <p className="text-xs text-emerald-200/80">Jaringan: <span className="font-semibold text-white">{result?.wifiSsid || currentOrder.wifiSsid}</span></p>}</section>}
          {mayReveal && isPremium && credentials.length > 0 && <section className="rounded-2xl border border-indigo-300/50 bg-gradient-to-br from-indigo-50 via-white to-indigo-50 p-5 sm:p-6 space-y-4 ring-1 ring-indigo-500/20 shadow-inner"><h3 className="flex items-center gap-2 text-sm font-semibold"><KeyRound size={18} className="text-indigo-600" />Data akun premium</h3>{credentials.map((credential, index) => <div key={index} className="space-y-2"><p className="text-xs text-slate-500">Akun {index + 1}</p>{secret(`Email / username akun ${index + 1}`, credential.email, `email-${index}`, false)}{credential.password && secret(`Kata sandi akun ${index + 1}`, credential.password, `password-${index}`)}</div>)}<p className="text-xs text-slate-500 flex items-start gap-2"><LockKeyhole size={14} className="shrink-0" />Jangan membagikan data akses ini kepada orang lain.</p></section>}
          {mayReveal && !isWifi && (serialNumber || (isPremium && wifiVoucherCode)) && <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3"><h3 className="font-semibold text-sm flex items-center gap-2"><ShieldCheck size={18} className="text-indigo-600" />Hasil pemenuhan produk</h3>{serialNumber && secret('Serial Number', serialNumber, 'serial', false)}{isPremium && wifiVoucherCode && secret('Kode lisensi', wifiVoucherCode, 'license', false)}</section>}
          {mayReveal && (result?.premiumInstructions || result?.notes) && <div className="rounded-xl border border-slate-200 p-4 text-xs whitespace-pre-line text-slate-600 leading-relaxed">{result.premiumInstructions || result.notes}</div>}
          <section><h3 className="font-semibold text-sm mb-3 tracking-tight">Rincian Pembelian</h3><div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">{currentOrder.items.map((item, index) => <div key={`${item.productId}-${index}`} className="p-4 flex items-start gap-3"><ProductLogo provider={item.provider} name={item.productName} category={item.category} iconUrl={item.iconUrl} size="md" /><div className="min-w-0 flex-1"><h4 className="text-sm font-semibold break-words">{item.productName}</h4>{item.variantName && <p className="text-xs text-slate-500 mt-1">{item.variantName}</p>}<p className="text-xs text-slate-500 mt-1 break-all">{item.targetNumberOrAccount || currentOrder.targetDestination}</p>{item.networkLocation && <p className="text-xs text-slate-500 mt-1">{item.networkLocation}</p>}</div><p className="text-sm font-semibold tabular-nums">{formatRupiah(item.sellingPrice)}</p></div>)}</div></section>
          <dl className="space-y-2 text-xs text-slate-500"><div className="flex justify-between gap-3"><dt>Metode pembayaran</dt><dd>{currentOrder.paymentMethod || 'Belum ditetapkan'}</dd></div><div className="flex justify-between gap-3"><dt>Subtotal</dt><dd>{formatRupiah(currentOrder.subtotal)}</dd></div><div className="flex justify-between gap-3"><dt>Biaya layanan</dt><dd>{formatRupiah(currentOrder.adminFee)}</dd></div>{currentOrder.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Diskon</dt><dd>-{formatRupiah(currentOrder.discount)}</dd></div>}{currentOrder.paidAt && <div className="flex justify-between gap-3"><dt>Dibayar pada</dt><dd className="text-right">{formatDateWIB(currentOrder.paidAt)}</dd></div>}{currentOrder.fulfilledAt && <div className="flex justify-between gap-3"><dt>Dikirim pada</dt><dd className="text-right">{formatDateWIB(currentOrder.fulfilledAt)}</dd></div>}</dl>
        </>}
      </div>
      <footer className="border-t border-emerald-100/70 px-5 sm:px-7 py-4 flex items-center justify-between gap-3 bg-gradient-to-r from-slate-50 via-emerald-50/60 to-slate-50"><p className="text-[11px] text-slate-500 flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-600" />Status terverifikasi server</p><button type="button" disabled={loading} onClick={() => setRefresh(v => v + 1)} className="text-xs font-semibold text-indigo-600 flex items-center gap-2 px-3 py-2 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Perbarui status</button></footer>
    </div>
  </div>;
}
