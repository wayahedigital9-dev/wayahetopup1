import React, { useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  Copy, 
  Zap, 
  ShieldCheck, 
  ExternalLink,
  Info,
  RefreshCw,
  CheckCircle2,
  ShieldAlert,
  MessageCircle,
  Wifi,
  Eye,
  EyeOff,
  Key,
  QrCode
} from 'lucide-react';
import QRCode from 'qrcode';
import { Order } from '../types';
import { formatRupiah, formatDateWIB } from '../utils/operator';
import { PaymentStatusBadge, FulfillmentStatusBadge } from './StatusBadge';
import { ProductLogo } from './ProductLogo';
import { storage } from '../services/storage';

interface InvoiceModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onCopyText: (text: string, label: string) => void;
}

export function InvoiceModal({ order, isOpen, onClose, onCopyText }: InvoiceModalProps) {
  const [currentOrder, setCurrentOrder] = useState<Order | null>(order);
  const [isPollingFulfillment, setIsPollingFulfillment] = useState<boolean>(false);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<number, boolean>>({});
  const [wifiQrDataUrl, setWifiQrDataUrl] = useState<string>('');
  const [showWifiQr, setShowWifiQr] = useState<boolean>(false);

  const togglePasswordVisibility = (index: number) => {
    setShowPasswordMap(prev => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Sinkronkan prop order ke local state saat berubah
  useEffect(() => {
    setCurrentOrder(order);
  }, [order]);

  // Auto-polling status transaksi dari backend/database setiap 3-4 detik
  // Berjalan saat order berstatus PENDING atau PROCESSING
  // Otomatis berhenti setelah status menjadi SUCCESS atau FAILED
  useEffect(() => {
    if (!isOpen || !currentOrder) return;

    const fulStatus = String(currentOrder.fulfillmentStatus || '').toUpperCase();
    const isStillProcessing = 
      currentOrder.paymentStatus === 'PAID' &&
      (fulStatus === 'PROCESSING' || fulStatus === 'PENDING' || fulStatus === 'NOT_STARTED' || fulStatus === 'QUEUED');

    if (!isStillProcessing) {
      setIsPollingFulfillment(false);
      return;
    }

    setIsPollingFulfillment(true);
    const identifier = currentOrder.supplierRefId || currentOrder.invoiceNumber || currentOrder.id;

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(identifier)}`);
        if (res.ok) {
          const json = await res.json();
          const backendData = json?.data;
          const newFulfillmentStatus = json?.fulfillmentStatus || backendData?.fulfillmentStatus;
          const newSN = json?.serialNumber || backendData?.serialNumber || backendData?.fulfillmentResult?.serialNumber;
          const newSupplierRef = json?.supplierRefId || backendData?.supplierRefId;

          if (newFulfillmentStatus && newFulfillmentStatus !== currentOrder.fulfillmentStatus) {
            const isFailed = newFulfillmentStatus === 'FAILED' || json?.paymentStatus === 'REFUNDED' || backendData?.paymentStatus === 'REFUNDED';
            setCurrentOrder(prev => {
              if (!prev) return null;
              const nextOrder: Order = {
                ...prev,
                fulfillmentStatus: newFulfillmentStatus,
                paymentStatus: isFailed ? 'REFUNDED' : prev.paymentStatus,
                supplierRefId: newSupplierRef || prev.supplierRefId,
                serialNumber: newSN || prev.serialNumber,
                fulfillmentResult: {
                  ...(prev.fulfillmentResult || {}),
                  serialNumber: newSN || prev.fulfillmentResult?.serialNumber || prev.serialNumber,
                  supplierRefId: newSupplierRef || prev.fulfillmentResult?.supplierRefId || prev.supplierRefId,
                  notes: backendData?.notes || prev.fulfillmentResult?.notes,
                },
              };

              // Simpan ke storage lokal agar konsisten di seluruh aplikasi
              try {
                const orders = storage.getOrders();
                const idx = orders.findIndex(o => o.id === prev.id || o.invoiceNumber === prev.invoiceNumber);
                if (idx !== -1) {
                  orders[idx] = nextOrder;
                  storage.saveOrders(orders);
                }

                // Otomatis kembalikan dana ke saldo akun member jika transaksi gagal
                if (isFailed && prev.paymentStatus !== 'REFUNDED') {
                  const members = storage.getRegisteredMembers();
                  const matchedMember = members.find(u => 
                    (prev.customerPhone && (u.phone === prev.customerPhone || u.email === prev.customerPhone)) ||
                    (prev.customerEmail && u.email === prev.customerEmail) ||
                    (prev.targetDestination && u.phone === prev.targetDestination)
                  );
                  const refundAmount = prev.totalAmount || (prev as any).totalPayment || 0;
                  if (matchedMember && refundAmount > 0) {
                    matchedMember.balance = (matchedMember.balance || 0) + refundAmount;
                    storage.saveRegisteredMember(matchedMember);
                    const activeUser = storage.getUser();
                    if (activeUser && activeUser.id === matchedMember.id) {
                      void storage.hydrateMemberFromBackend();
                    }
                  }
                }
              } catch (_) {}

              return nextOrder;
            });

            // Stop polling setelah mencapai status terminal
            if (newFulfillmentStatus === 'SUCCESS' || newFulfillmentStatus === 'FAILED' || newFulfillmentStatus === 'MANUAL_REVIEW') {
              setIsPollingFulfillment(false);
              clearInterval(intervalId);
            }
          }
        }
      } catch (_) {
        // Abaikan kendala jaringan sesaat
      }
    }, 3500);

    return () => {
      clearInterval(intervalId);
    };
  }, [isOpen, currentOrder?.id, currentOrder?.fulfillmentStatus, currentOrder?.paymentStatus]);

  // Auto-allocate / ensure WiFi voucher is present if order is PAID
  useEffect(() => {
    if (!isOpen || !currentOrder || currentOrder.paymentStatus !== 'PAID') return;
    const isWifiOrder = currentOrder.category === 'wifi' || 
      (currentOrder.items && currentOrder.items[0]?.category === 'wifi') ||
      String(currentOrder.productName || '').toLowerCase().includes('wifi');
    
    const existingCode = currentOrder.voucherCode || currentOrder.fulfillmentResult?.voucherCode;
    if (isWifiOrder && !existingCode) {
      const vouchers = storage.getWifiVouchers();
      let found = vouchers.find(v => v.orderId === currentOrder.id && v.status === 'SOLD');
      if (!found) {
        found = vouchers.find(v => v.status === 'AVAILABLE');
        if (found) {
          found.status = 'SOLD';
          found.orderId = currentOrder.id;
          storage.saveWifiVouchers(vouchers);
        }
      }
      const assignedCode = found?.code || `WF-${Math.floor(100000 + Math.random() * 900000)}`;
      const assignedPass = found?.password || '1234';
      const ssid = currentOrder.wifiSsid || 'MelatiNet_Warga_Hotspot';
      const loginUrl = currentOrder.wifiLoginUrl || 'http://hotspot.wayahedigital.id';

      const updated: Order = {
        ...currentOrder,
        fulfillmentStatus: 'SUCCESS',
        voucherCode: assignedCode,
        voucherPassword: assignedPass,
        wifiSsid: ssid,
        wifiLoginUrl: loginUrl,
        fulfillmentResult: {
          ...(currentOrder.fulfillmentResult || {}),
          voucherCode: assignedCode,
          voucherPassword: assignedPass,
          wifiSsid: ssid,
          wifiLoginUrl: loginUrl,
          notes: 'Voucher WiFi aktif siap digunakan.',
        },
      };
      setCurrentOrder(updated);

      const allOrders = storage.getOrders();
      const idx = allOrders.findIndex(o => o.id === currentOrder.id || o.invoiceNumber === currentOrder.invoiceNumber);
      if (idx !== -1) {
        allOrders[idx] = updated;
        storage.saveOrders(allOrders);
      }

      // Sinkronkan ke serverless backend
      try {
        fetch('/api/sync/entity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity: 'orders', data: allOrders }),
        }).catch(() => {});
      } catch (_) {}
    }
  }, [isOpen, currentOrder?.id, currentOrder?.paymentStatus]);

  if (!isOpen || !currentOrder) return null;

  const item = currentOrder.items?.[0];

  const handlePrint = () => {
    window.print();
  };

  const isWifi = currentOrder.category === 'wifi' || 
    (currentOrder.items && currentOrder.items[0]?.category === 'wifi') ||
    String(currentOrder.productName || '').toLowerCase().includes('wifi') ||
    String(item?.productName || '').toLowerCase().includes('wifi');

  const wifiVoucherCode = 
    currentOrder.voucherCode || 
    currentOrder.fulfillmentResult?.voucherCode || 
    (isWifi && currentOrder.serialNumber && !currentOrder.serialNumber.startsWith('SN') ? currentOrder.serialNumber : '') ||
    '';

  const settings = storage.getSettings();
  const wifiPassword = currentOrder.voucherPassword || currentOrder.fulfillmentResult?.voucherPassword || settings.wifiDefaultPassword || '1234';
  const wifiSsid = currentOrder.wifiSsid || currentOrder.fulfillmentResult?.wifiSsid || settings.wifiHotspotSsid || 'MelatiNet_Warga_Hotspot';
  const wifiLoginUrl = currentOrder.wifiLoginUrl || currentOrder.fulfillmentResult?.wifiLoginUrl || settings.wifiLoginUrl || 'http://hotspot.wayahedigital.id';

  const activeSerialNumber = currentOrder.fulfillmentResult?.serialNumber || currentOrder.serialNumber;
  const activeSupplierRef = currentOrder.fulfillmentResult?.supplierRefId || currentOrder.supplierRefId;

  const fulStatus = String(currentOrder.fulfillmentStatus || '').toUpperCase();
  const isPaid = currentOrder.paymentStatus === 'PAID';
  const isFailedOrRefunded = currentOrder.fulfillmentStatus === 'FAILED' || currentOrder.paymentStatus === 'REFUNDED';
  const isFulfillmentSuccess = currentOrder.fulfillmentStatus === 'SUCCESS' || Boolean(activeSerialNumber) || Boolean(wifiVoucherCode);
  const isProcessingFulfillment = isPaid && !isFulfillmentSuccess && !isFailedOrRefunded;

  const rawSupportWa = settings.supportWhatsApp || settings.wifiContactSupport || '0812-3456-7890';
  const cleanAdminWa = rawSupportWa.replace(/[^0-9]/g, '').replace(/^0/, '62') || '6281234567890';

  useEffect(() => {
    if (isWifi && isPaid && wifiVoucherCode) {
      const qrTarget = wifiLoginUrl
        ? `${wifiLoginUrl}${wifiLoginUrl.includes('?') ? '&' : '?'}username=${encodeURIComponent(wifiVoucherCode)}&password=${encodeURIComponent(wifiPassword)}`
        : `WIFI:S:${wifiSsid};T:WPA;P:${wifiPassword};;`;
      QRCode.toDataURL(qrTarget, { margin: 1, width: 220 })
        .then(url => setWifiQrDataUrl(url))
        .catch(() => {});
    }
  }, [isWifi, isPaid, wifiVoucherCode, wifiLoginUrl, wifiPassword, wifiSsid]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div 
        id={`invoice-modal-${currentOrder.id}`}
        className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 my-auto"
        role="dialog"
        aria-labelledby="invoice-modal-title"
      >
        {/* Modal Top Bar */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Bukti Transaksi Resmi
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors"
              title="Cetak Invoice"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Cetak</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              aria-label="Tutup invoice"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-y-auto print:p-0 print:overflow-visible">
          {/* Header Brand & Invoice ID */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <Zap size={15} className="text-teal-300 fill-teal-300" />
                </div>
                <span className="font-extrabold text-base tracking-tight text-slate-900">
                  Wayahe<span className="text-indigo-600">Digital</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Kebutuhan digitalmu, dalam satu tempat.
              </p>
            </div>
            <div className="text-right">
              <span className="font-mono text-xs md:text-sm font-bold text-slate-900 block">
                {currentOrder.invoiceNumber}
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                {formatDateWIB(currentOrder.createdAt)}
              </span>
            </div>
          </div>

          {/* Dual Status Bar */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Status Pembayaran:</span>
              <PaymentStatusBadge status={currentOrder.paymentStatus} size="sm" />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Status Pengiriman:</span>
              <FulfillmentStatusBadge status={currentOrder.fulfillmentStatus} size="sm" />
            </div>
          </div>

          {/* 1. KARTU STATUS: SEDANG DIPROSES OPERATOR (PULSA, KUOTA, GAME, DLL) */}
          {isProcessingFulfillment && (
            <div className="bg-gradient-to-br from-indigo-50/90 via-sky-50/80 to-blue-50/90 border-2 border-indigo-300/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <RefreshCw size={20} className="animate-spin text-teal-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-300 animate-ping"></span>
                      Sedang Diproses
                    </span>
                    <span className="text-[11px] text-indigo-700 font-semibold">Injeksi Operator</span>
                  </div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 mt-1">
                    Pesanan Sedang Diproses Masuk ke Nomor/Akun Anda
                  </h3>
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-xs p-3 rounded-xl border border-indigo-100 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Nomor / Akun Tujuan:</span>
                  <span className="font-mono font-bold text-slate-900 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    {currentOrder.targetDestination}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed pt-1">
                  Pembayaran Anda telah <strong className="text-emerald-600">LUNAS & AMAN</strong>. Sistem sedang memproses pengisian {item?.productName || 'produk'} langsung ke nomor tujuan. Status akan otomatis diperbarui begitu Serial Number (SN) sukses terbit.
                </p>
              </div>

              <div className="w-full bg-indigo-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full rounded-full animate-pulse w-full"></div>
              </div>
            </div>
          )}

          {/* 2. KARTU JAMINAN UANG KEMBALI 100% (TRANSAKSI GAGAL / REFUND) */}
          {isFailedOrRefunded && (
            <div className="bg-rose-50/90 border-2 border-rose-300 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 animate-fadeIn">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <ShieldAlert size={22} className="text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white uppercase tracking-wider mb-1">
                    Jaminan Uang Kembali 100%
                  </span>
                  <h3 className="text-xs sm:text-sm font-extrabold text-rose-950">
                    Transaksi Gagal — Dana Dikembalikan ke Pembeli
                  </h3>
                </div>
              </div>

              <div className="bg-white/95 p-3 rounded-xl border border-rose-200 space-y-2 text-xs text-rose-900 leading-relaxed">
                <p>
                  Mohon maaf, transaksi pengisian produk ke operator mengalami kendala ({currentOrder.fulfillmentResult?.notes || currentOrder.errorReason || 'Gangguan sistem operator'}).
                </p>
                <div className="p-2.5 bg-rose-100/80 rounded-lg border border-rose-200 font-semibold text-rose-950 text-[11px] flex items-start gap-2">
                  <span className="text-base leading-none">🔒</span>
                  <span>
                    <strong>Uang Anda TIDAK masuk ke penjual.</strong> Pesanan ini otomatis berstatus <strong>REFUNDED (Dana Aman)</strong> agar pembeli tidak dirugikan sama sekali.
                  </span>
                </div>
                <ul className="text-[11px] text-rose-800 space-y-1 list-disc list-inside">
                  <li><strong>Pembeli dengan Akun Member:</strong> Saldo senilai <strong>{formatRupiah(currentOrder.totalAmount)}</strong> telah otomatis dikembalikan ke saldo akun Anda.</li>
                  <li><strong>Pembeli QRIS / Transfer Bank:</strong> Hubungi Admin melalui WhatsApp di bawah untuk konfirmasi pencairan refund 100% instan ke rekening atau e-wallet Anda.</li>
                </ul>
              </div>

              <a
                href={`https://wa.me/${cleanAdminWa}?text=${encodeURIComponent(
                  `Halo Admin WayaheDigital, transaksi saya GAGAL dan mohon konfirmasi pengembalian dana:\n` +
                  `• No Invoice: ${currentOrder.invoiceNumber}\n` +
                  `• Produk: ${item?.productName || currentOrder.category}\n` +
                  `• Nomor/Tujuan: ${currentOrder.targetDestination}\n` +
                  `• Nominal: ${formatRupiah(currentOrder.totalAmount)}\n` +
                  `Mohon dibantu refund dana saya. Terima kasih!`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <MessageCircle size={16} />
                Hubungi WhatsApp Admin untuk Konfirmasi Refund
              </a>
            </div>
          )}

          {/* Indikator Auto-Polling Sederhana saat belum final */}
          {isPollingFulfillment && !isProcessingFulfillment && !isFailedOrRefunded && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl animate-pulse">
              <RefreshCw size={15} className="animate-spin text-amber-600 shrink-0" />
              <div>
                <p className="font-bold">Menunggu Konfirmasi Operator / Supplier...</p>
                <p className="text-[11px] text-amber-700">Status pesanan diperbarui otomatis setiap beberapa detik tanpa perlu refresh halaman.</p>
              </div>
            </div>
          )}

          {/* KODE VOUCHER WIFI UTAMA (HERO CARD - SELALU MUNCUL SAAT ORDER WIFI BERSTATUS PAID) */}
          {isWifi && isPaid && (
            <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-amber-500/10 border-2 border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30">
                    <Wifi size={22} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                      Kode Voucher WiFi Anda
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <CheckCircle2 size={11} /> Aktif Siap Pakai
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500">Gunakan kode voucher di bawah untuk login ke jaringan Hotspot.</p>
                  </div>
                </div>

                {wifiQrDataUrl && (
                  <button
                    type="button"
                    onClick={() => setShowWifiQr(!showWifiQr)}
                    className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    title="Tampilkan / Sembunyikan QR Code Login"
                  >
                    <QrCode size={14} />
                    <span>{showWifiQr ? 'Tutup QR' : 'Scan QR'}</span>
                  </button>
                )}
              </div>

              {/* QR Code Container Toggle */}
              {showWifiQr && wifiQrDataUrl && (
                <div className="p-4 bg-white rounded-xl border border-emerald-200 text-center space-y-2 shadow-xs animate-fadeIn">
                  <div className="text-xs font-bold text-slate-800 flex items-center justify-center gap-1.5">
                    <QrCode size={16} className="text-emerald-600" />
                    <span>Scan untuk Langsung Konek / Login Hotspot</span>
                  </div>
                  <img
                    src={wifiQrDataUrl}
                    alt="QR Login Hotspot WiFi"
                    className="w-44 h-44 mx-auto rounded-lg border border-slate-100 p-1 bg-white shadow-2xs"
                  />
                  <p className="text-[10px] text-slate-500">
                    Scan via kamera HP yang telah terhubung ke WiFi <b>{wifiSsid}</b>
                  </p>
                </div>
              )}

              {/* Box Kode Voucher Monospace Besar */}
              <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">
                    KODE VOUCHER HOTSPOT:
                  </span>
                  <span className="font-mono text-2xl sm:text-3xl font-black text-emerald-700 tracking-widest select-all">
                    {wifiVoucherCode || 'WF-' + currentOrder.id.slice(-6).toUpperCase()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onCopyText(wifiVoucherCode || 'WF-' + currentOrder.id.slice(-6).toUpperCase(), 'Kode Voucher WiFi')}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 transition-all cursor-pointer"
                >
                  <Copy size={15} />
                  <span>Salin Kode</span>
                </button>
              </div>

              {/* Rincian Login & SSID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-100 shadow-2xs">
                  <span className="text-[10px] text-slate-400 block">Nama WiFi (SSID):</span>
                  <span className="font-bold text-slate-800">{wifiSsid}</span>
                </div>
                <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-100 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Password / Sandi:</span>
                    <span className="font-mono font-bold text-slate-800">{wifiPassword}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCopyText(wifiPassword, 'Password')}
                    className="text-slate-400 hover:text-slate-700 p-1 rounded"
                    title="Salin Password"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>

              {/* Portal Login + Direct Button */}
              {wifiLoginUrl && (
                <div className="text-xs text-slate-600 bg-white/90 p-3 rounded-xl border border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Portal Login Hotspot:</span>
                    <a
                      href={wifiLoginUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-700 font-bold hover:underline inline-flex items-center gap-1 text-xs"
                    >
                      {wifiLoginUrl}
                      <ExternalLink size={12} />
                    </a>
                  </div>
                  <a
                    href={wifiLoginUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs inline-flex items-center justify-center gap-1.5 self-start sm:self-auto cursor-pointer"
                  >
                    <ExternalLink size={13} />
                    <span>Buka Portal Login</span>
                  </a>
                </div>
              )}

              {/* Petunjuk Pemakaian */}
              <div className="bg-slate-50/90 rounded-xl p-3 border border-slate-200/80 text-[11px] text-slate-600 space-y-1.5">
                <p className="font-bold text-slate-800 text-xs">Cara Menggunakan Voucher:</p>
                {settings.wifiLoginInstructions ? (
                  <div className="whitespace-pre-line text-slate-600 leading-relaxed font-sans text-xs">
                    {settings.wifiLoginInstructions}
                  </div>
                ) : (
                  <ol className="list-decimal list-inside space-y-0.5 text-slate-600">
                    <li>Sambungkan HP / Laptop Anda ke WiFi <b>{wifiSsid}</b></li>
                    <li>Buka browser atau klik notifikasi <b>Masuk ke Jaringan Hotspot</b></li>
                    <li>Masukkan <b>Kode Voucher</b> di atas dan klik <b>Login</b></li>
                  </ol>
                )}
              </div>
            </div>
          )}

          {/* Detail Hasil Pemenuhan Akun Premium (Credentials: Email & Password) */}
          {currentOrder.paymentStatus === 'PAID' && (Boolean(currentOrder.credentials?.length) || Boolean(currentOrder.fulfillmentResult?.credentials?.length)) && (
            <div className="bg-gradient-to-br from-indigo-50 via-purple-50/50 to-pink-50/30 border-2 border-indigo-200 rounded-2xl p-4 sm:p-5 shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                    <Key size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-indigo-950 flex items-center gap-1.5">
                      Data Akun Premium (Akses Resmi)
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <CheckCircle2 size={11} /> Siap Pakai
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500">Gunakan akun login berikut pada aplikasi/situs terkait.</p>
                  </div>
                </div>
              </div>

              {/* Daftar Akun */}
              <div className="space-y-2.5">
                {(currentOrder.credentials || currentOrder.fulfillmentResult?.credentials || []).map((cred, idx) => {
                  const isVisible = Boolean(showPasswordMap[idx]);
                  return (
                    <div key={idx} className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                          Akun #{idx + 1}
                        </span>
                        {currentOrder.providerOrderId && (
                          <span className="text-[9px] font-mono text-slate-400">
                            Ref: {currentOrder.providerOrderId}
                          </span>
                        )}
                      </div>

                      {/* Email Row */}
                      <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <div className="min-w-0 flex-1 pr-2">
                          <span className="text-[10px] text-slate-500 block">Email / Username:</span>
                          <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 truncate block select-all">
                            {cred.email}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onCopyText(cred.email, 'Email Akun')}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-md shadow-2xs flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <Copy size={12} /> Salin
                        </button>
                      </div>

                      {/* Password Row */}
                      {cred.password && (
                        <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <div className="min-w-0 flex-1 pr-2">
                            <span className="text-[10px] text-slate-500 block">Kata Sandi / Password:</span>
                            <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 truncate block select-all">
                              {isVisible ? cred.password : '••••••••••••'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(idx)}
                              className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-md shadow-2xs"
                              title={isVisible ? 'Sembunyikan' : 'Lihat Password'}
                            >
                              {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => onCopyText(cred.password || '', 'Password Akun')}
                              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-md shadow-2xs flex items-center gap-1 cursor-pointer"
                            >
                              <Copy size={12} /> Salin
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="bg-indigo-50/80 rounded-xl p-2.5 border border-indigo-100 text-[11px] text-indigo-900">
                <p>🔒 <strong>Keamanan:</strong> Jangan membagikan data login ini kepada orang lain. Masa aktif akun berjalan sesuai durasi paket yang Anda pilih.</p>
              </div>
            </div>
          )}

          {/* SMM Order Tracking Card */}
          {currentOrder.category === 'smm' && (
            <div className="bg-sky-50/70 border border-sky-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center">
                    <RefreshCw size={16} className={currentOrder.fulfillmentStatus === 'WAITING' || currentOrder.fulfillmentStatus === 'PROCESSING' ? 'animate-spin' : ''} />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-sky-950">
                      Layanan SMM (Social Media)
                    </h3>
                    <p className="text-[11px] text-slate-500">Status pengerjaan pesanan ke sistem penyedia.</p>
                  </div>
                </div>
                <FulfillmentStatusBadge status={currentOrder.fulfillmentStatus} />
              </div>

              <div className="bg-white p-3 rounded-xl border border-sky-100 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Akun / Link Target:</span>
                  <span className="font-mono font-bold text-slate-900 truncate max-w-[220px]">
                    {currentOrder.smmTarget || currentOrder.targetDestination}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Jumlah Pesanan:</span>
                  <span className="font-bold text-slate-900">
                    {(currentOrder.smmQty || 1).toLocaleString('id-ID')} unit
                  </span>
                </div>
                {currentOrder.providerOrderId && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">ID Gateway:</span>
                    <span className="font-mono text-slate-600">
                      {currentOrder.providerOrderId}
                    </span>
                  </div>
                )}
                {currentOrder.providerRawStatus && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status Provider:</span>
                    <span className="font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                      {currentOrder.providerRawStatus}
                    </span>
                  </div>
                )}
              </div>

              {currentOrder.fulfillmentResult?.notes && (
                <p className="text-xs text-slate-600 leading-relaxed bg-white/70 p-2.5 rounded-lg border border-sky-100">
                  {currentOrder.fulfillmentResult.notes}
                </p>
              )}
            </div>
          )}

          {/* Detail Hasil Pemenuhan Non-WiFi (SN Digiflazz / Akses Premium Standar) */}
          {currentOrder.paymentStatus === 'PAID' && !isWifi && (activeSerialNumber || (currentOrder.fulfillmentResult?.voucherCode && !currentOrder.credentials?.length)) && (
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-teal-600 shrink-0" />
                <h3 className="text-xs md:text-sm font-bold text-indigo-950 flex items-center gap-1.5">
                  Hasil Pemenuhan Produk
                  {currentOrder.fulfillmentStatus === 'SUCCESS' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={11} /> Sukses
                    </span>
                  )}
                </h3>
              </div>

              {/* Digiflazz Serial Number (SN) */}
              {activeSerialNumber && (
                <div className="bg-white p-3 rounded-lg border border-indigo-100 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Serial Number (SN):</span>
                    <span className="font-mono text-xs md:text-sm font-bold text-slate-800">
                      {activeSerialNumber}
                    </span>
                    {activeSupplierRef && (
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Ref: {activeSupplierRef}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onCopyText(activeSerialNumber, 'Serial Number')}
                    className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Salin SN"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              )}

              {/* Premium Voucher Code / License */}
              {currentOrder.fulfillmentResult?.voucherCode && currentOrder.category === 'premium' && (
                <div className="bg-white p-3 rounded-lg border border-indigo-100 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Kode Lisensi Resmi:</span>
                    <span className="font-mono text-sm font-bold text-indigo-700">
                      {currentOrder.fulfillmentResult.voucherCode}
                    </span>
                  </div>
                  <button
                    onClick={() => onCopyText(currentOrder.fulfillmentResult?.voucherCode || '', 'Kode Lisensi')}
                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                    title="Salin Lisensi"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              )}

              {/* Notes / Manual Review instructions */}
              {currentOrder.fulfillmentResult?.notes && (
                <p className="text-xs text-slate-600 leading-relaxed bg-white/70 p-2.5 rounded-lg border border-indigo-100/60">
                  {currentOrder.fulfillmentResult.notes}
                </p>
              )}
            </div>
          )}


          {/* Rincian Produk & Tujuan */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Rincian Pembelian
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              <div className="p-3.5 bg-slate-50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ProductLogo
                    provider={item?.provider}
                    name={item?.productName}
                    category={currentOrder.category}
                    iconUrl={item?.iconUrl}
                    size="md"
                  />
                  <div>
                    <p className="text-xs md:text-sm font-bold text-slate-900">{item?.productName}</p>
                    <p className="text-xs text-slate-500">Provider / Mitra: {item?.provider}</p>
                  </div>
                </div>
                <span className="text-xs md:text-sm font-bold text-slate-800 shrink-0">
                  {formatRupiah(item?.sellingPrice || 0)}
                </span>
              </div>

              <div className="p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nomor / Akun Tujuan:</span>
                  <span className="font-semibold text-slate-900">{currentOrder.targetDestination}</span>
                </div>
                {item?.networkLocation && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Lokasi WiFi:</span>
                    <span className="font-medium text-slate-800">{item.networkLocation}</span>
                  </div>
                )}
                {currentOrder.customerPhone && currentOrder.customerPhone !== currentOrder.targetDestination && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">No. WhatsApp Pembeli:</span>
                    <span className="text-slate-700">{currentOrder.customerPhone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Metode Pembayaran:</span>
                  <span className="font-medium text-slate-800">{currentOrder.paymentMethod || 'QRIS'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Ringkasan Total */}
          <div className="space-y-2 border-t border-slate-200 pt-4 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal Produk</span>
              <span>{formatRupiah(currentOrder.subtotal)}</span>
            </div>
            {currentOrder.discount > 0 && (
              <div className="flex justify-between text-teal-600 font-semibold">
                <span>Diskon ({currentOrder.promoCode || 'Promo'})</span>
                <span>-{formatRupiah(currentOrder.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Biaya Layanan</span>
              <span>{currentOrder.adminFee === 0 ? 'Gratis' : formatRupiah(currentOrder.adminFee)}</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-200">
              <span>Total Pembayaran</span>
              <span className="text-indigo-600">{formatRupiah(currentOrder.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Token Akses: {currentOrder.guestAccessToken ? `${currentOrder.guestAccessToken.substring(0, 10)}***` : 'GUEST'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-xl text-xs transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
