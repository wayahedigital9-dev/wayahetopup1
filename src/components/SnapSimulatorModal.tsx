import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ShieldCheck,
  QrCode,
  CheckCircle2,
  Clock,
  RefreshCw,
  Copy,
  Check,
  Smartphone,
  AlertCircle,
  ExternalLink,
  Zap,
  Download,
} from 'lucide-react';
import QRCode from 'qrcode';
import { Order } from '../types';
import { formatRupiah } from '../utils/operator';
import {
  generateDynamicQRIS,
  convertStaticToDynamicQRIS
} from '../utils/qris';
import { storage } from '../services/storage';
import { apiAdapter } from '../services/apiAdapter';

interface SnapSimulatorModalProps {
  order: Order;
  snapToken: string;
  isOpen: boolean;
  onClose: () => void;
  onSimulateResult: (status: 'PAID' | 'FAILED' | 'EXPIRED', method: string, withFulfillmentError?: boolean) => void;
  onCopyText: (text: string, label: string) => void;
}

export function SnapSimulatorModal({
  order,
  snapToken,
  isOpen,
  onClose,
  onSimulateResult,
  onCopyText,
}: SnapSimulatorModalProps) {
  const [loadingDeposit, setLoadingDeposit] = useState<boolean>(false);
  const [pollStatus, setPollStatus] = useState<string>('Menunggu scan pembayaran QRIS...');
  const [isCheckingManual, setIsCheckingManual] = useState<boolean>(false);
  const [isPaymentSuccess, setIsPaymentSuccess] = useState<boolean>(false);
  const [copiedNominal, setCopiedNominal] = useState<boolean>(false);
  const [copiedInvoice, setCopiedInvoice] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(900); // 15 menit
  const [qrImgError, setQrImgError] = useState<boolean>(false);
  const [localQrDataUrl, setLocalQrDataUrl] = useState<string>('');

  const countdownTimerRef = useRef<any>(null);
  const pollingTimerRef = useRef<any>(null);

  const settings = storage.getSettings();
  const selectedProvider = (order?.paymentGatewayProvider || settings.paymentGatewayProvider || 'QIOSPAY').toUpperCase();
  const isPakasir = selectedProvider === 'PAKASIR';
  const isQiospay = selectedProvider === 'QIOSPAY';
  const activeGateway = isPakasir ? 'PAKASIR' : 'QIOSPAY';
  const gatewayTitle = isPakasir ? 'Pakasir API v2' : 'Qiospay QRIS';
  const isPakasirSandbox = Boolean(
    isPakasir && (
      order?.isSandbox ||
      settings.pakasirIsSandbox ||
      (order?.qrString && order.qrString.includes('lorem-ipsum'))
    )
  );
  const [isSimulatingSandbox, setIsSimulatingSandbox] = useState<boolean>(false);

  const merchantStoreName = isPakasir
    ? (settings.pakasirMerchantName || settings.siteName || 'WAYAHE DIGITAL')
    : (settings.qiospayMerchantName || 'Waroeng Digital QP48797');

  const rawQrString = (
    order?.qrString ||
    (isPakasir ? (settings.pakasirQrString || '') : (settings.qiospayQrString || settings.staticQrisString || '')) ||
    ''
  ).trim();

  // Dynamic QR String (Dipisahkan Murni Sesuai Payment Gateway Masing-Masing)
  const targetAmount = Math.max(1, Math.round(Number(order?.totalAmount || 10000)));
  let activeQRString = '';

  if (isPakasir) {
    // ══════════════════════════════════════════════════════════════
    // JALUR PAKASIR API v2 (MURNI TANPA DATA QIOSPAY)
    // ══════════════════════════════════════════════════════════════
    if (order?.qrString && order.qrString.startsWith('000201') && !order.qrString.includes('COM.NOBUBANK')) {
      activeQRString = order.qrString;
    } else if (settings.pakasirQrString && settings.pakasirQrString.startsWith('000201')) {
      activeQRString = settings.pakasirQrString;
    } else {
      activeQRString = generateDynamicQRIS({
        amount: targetAmount,
        invoiceNumber: order?.invoiceNumber || 'INV-WD',
        merchantName: merchantStoreName,
        merchantCity: 'SURABAYA',
        nmid: settings.pakasirNmid || undefined,
        gateway: 'PAKASIR',
      });
    }
  } else {
    // ══════════════════════════════════════════════════════════════
    // JALUR QIOSPAY QRIS (MURNI NOBU BANK / ASPI QIOSPAY)
    // ══════════════════════════════════════════════════════════════
    if (order?.qrString && order.qrString.startsWith('000201') && order.qrString.includes('COM.NOBUBANK')) {
      activeQRString = order.qrString;
    } else {
      const qiospayOfficialStatic = (
        settings.qiospayQrString ||
        settings.staticQrisString ||
        '00020101021126670016COM.NOBUBANK.WWW01189360050300000907180214260525000007320303UMI51440014ID.CO.QRIS.WWW0215ID10265244964310303UMI5204581753033605802ID5923Waroeng Digital QP487976008SIDOARJO61056121162070703A01630472AF'
      ).trim();
      activeQRString = qiospayOfficialStatic;
    }
  }

  // JAMINAN MUTLAK: Selalu pastikan activeQRString menyematkan Tag 54 dengan nominal dinamis produk terkini
  if (activeQRString && activeQRString.startsWith('000201')) {
    try {
      activeQRString = convertStaticToDynamicQRIS(
        activeQRString,
        targetAmount,
        order?.invoiceNumber || 'INV-WD',
        {
          preserveTag62: true,
          forceDynamicPOI: true,
          merchantName: isPakasir ? merchantStoreName : undefined,
          gateway: isPakasir ? 'PAKASIR' : 'QIOSPAY',
        }
      );
    } catch (_) {}
  }

  // Generate QR Code secara lokal langsung di browser (0 ms, aman dari blokir adblock/CORS)
  useEffect(() => {
    if (!activeQRString) return;
    let isMounted = true;
    QRCode.toDataURL(activeQRString, {
      width: 420,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (isMounted) {
          setLocalQrDataUrl(url);
          setQrImgError(false);
        }
      })
      .catch((err) => {
        console.warn('[QRIS Local Render Warning]:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [activeQRString]);

  const primaryQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&margin=10&data=${encodeURIComponent(activeQRString)}`;
  const fallbackQrUrl = `https://quickchart.io/qr?size=350&text=${encodeURIComponent(activeQRString)}`;
  // Prioritaskan Data URL lokal langsung dari memori browser, baru fallback ke online image jika diperlukan
  const activeQrImage = localQrDataUrl || (!qrImgError ? primaryQrUrl : fallbackQrUrl);

  const orderId = order?.id;
  const invoiceNumber = order?.invoiceNumber;

  useEffect(() => {
    if (!isOpen || !orderId) return;

    setLoadingDeposit(false);
    setIsPaymentSuccess(false);
    setPollStatus(`Menunggu pembayaran via ${gatewayTitle}...`);
    setTimeLeft(900);
    setQrImgError(false);

    // Countdown Timer 15 Menit
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-Polling Status Pembayaran Otomatis Setiap 4 Detik
    let consecutiveErrors = 0;
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    pollingTimerRef.current = setInterval(async () => {
      try {
        const checkResult = await apiAdapter.checkOrderStatus(invoiceNumber || orderId);
        consecutiveErrors = 0;
        if (checkResult && checkResult.paymentStatus === 'PAID') {
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          setIsPaymentSuccess(true);

          if (checkResult.fulfillmentStatus === 'SUCCESS') {
            setPollStatus('✅ Pembayaran Berhasil! Membuka rincian invoice...');
          } else if (checkResult.fulfillmentStatus === 'FAILED' || checkResult.fulfillmentStatus === 'MANUAL_REVIEW') {
            setPollStatus('⚠️ Pembayaran berhasil, pengiriman produk dalam tinjauan admin.');
          } else {
            setPollStatus('⏳ Pembayaran terverifikasi! Menyiapkan produk...');
          }

          setTimeout(() => {
            onSimulateResult('PAID', isPakasir ? 'QRIS (Pakasir)' : 'QRIS');
          }, 1200);
        }
      } catch (e) {
        consecutiveErrors++;
        if (consecutiveErrors >= 3) {
          setPollStatus(`⚠️ Menghubungkan ke server pembayaran ${gatewayTitle}...`);
        }
      }
    }, 4000);

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [isOpen, orderId, gatewayTitle]);

  if (!isOpen || !order) return null;

  const formatMinutes = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleCopyNominal = () => {
    onCopyText(String(order.totalAmount), 'Nominal Pembayaran');
    setCopiedNominal(true);
    setTimeout(() => setCopiedNominal(false), 2000);
  };

  const handleCopyInvoice = () => {
    onCopyText(order.invoiceNumber, 'Nomor Invoice');
    setCopiedInvoice(true);
    setTimeout(() => setCopiedInvoice(false), 2000);
  };

  const handleManualCheckStatus = async () => {
    if (isCheckingManual) return;
    setIsCheckingManual(true);
    setPollStatus(`Memverifikasi pembayaran ${gatewayTitle}...`);
    try {
      const checkResult = await apiAdapter.checkOrderStatus(order.invoiceNumber || order.id);
      if (checkResult && checkResult.paymentStatus === 'PAID') {
        setIsPaymentSuccess(true);
        if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        if (checkResult.fulfillmentStatus === 'SUCCESS') {
          setPollStatus('✅ Pembayaran berhasil terverifikasi!');
        } else if (checkResult.fulfillmentStatus === 'FAILED' || checkResult.fulfillmentStatus === 'MANUAL_REVIEW') {
          setPollStatus('⚠️ Pembayaran terverifikasi, dalam antrean pemrosesan.');
        } else {
          setPollStatus('⏳ Pembayaran terverifikasi! Menyiapkan produk...');
        }
        setTimeout(() => {
          setIsCheckingManual(false);
          onSimulateResult('PAID', isPakasir ? 'QRIS (Pakasir)' : 'QRIS');
        }, 1000);
        return;
      }

      // Status response
      let msg = '⏳ Belum ada pembayaran terdeteksi. Silakan selesaikan scan di e-wallet/m-banking.';
      if (checkResult?.diagnosticCode === 'PROVIDER_NOT_CONFIGURED') {
        msg = `⚠️ Menunggu konfirmasi mutasi dari server ${gatewayTitle}...`;
      } else if (checkResult?.message) {
        msg = checkResult.message;
      }

      setTimeout(() => {
        setPollStatus(msg);
        setIsCheckingManual(false);
      }, 600);
    } catch (err: any) {
      setTimeout(() => {
        setPollStatus('⚠️ Terjadi kendala jaringan saat cek mutasi. Silakan coba lagi.');
        setIsCheckingManual(false);
      }, 600);
    }
  };

  const handleSimulatePakasirSandbox = async () => {
    if (isSimulatingSandbox) return;
    setIsSimulatingSandbox(true);
    setPollStatus('⚡ Mengirim simulasi pembayaran Sandbox ke Pakasir...');

    try {
      const res = await apiAdapter.simulatePakasirPayment(
        order.invoiceNumber || order.id,
        order.totalAmount || 1000
      );

      if (res.success) {
        setIsPaymentSuccess(true);
        setPollStatus('✅ Pembayaran Sandbox Berhasil Diverifikasi!');
        if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        setTimeout(() => {
          setIsSimulatingSandbox(false);
          onSimulateResult('PAID', 'QRIS (Pakasir Sandbox)');
        }, 1200);
      } else {
        setPollStatus(`⚠️ ${res.message || 'Gagal memproses simulasi sandbox'}`);
        setIsSimulatingSandbox(false);
      }
    } catch (err: any) {
      setPollStatus(`⚠️ Gagal memanggil simulasi: ${err.message}`);
      setIsSimulatingSandbox(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="snap-payment-dialog"
        className="bg-slate-900 rounded-3xl max-w-md w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-800 text-slate-100 my-auto"
        role="dialog"
        aria-labelledby="snap-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header QRIS Payment */}
        <div className={`p-5 border-b border-slate-800 text-white flex items-center justify-between ${isPakasir
            ? 'bg-gradient-to-r from-blue-600/30 via-slate-900 to-indigo-950'
            : 'bg-gradient-to-r from-indigo-600/30 via-slate-900 to-purple-950'
          }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${isPakasir
                ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
              }`}>
              <QrCode size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="snap-modal-title" className="font-extrabold text-base tracking-tight text-white">
                  Pembayaran QRIS Dinamis
                </h2>
                {isPakasir ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/40 uppercase tracking-wider flex items-center gap-1">
                      <Zap size={11} className="text-blue-400" /> Pakasir v2
                    </span>
                    {isPakasirSandbox ? (
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                        🧪 Sandbox
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                        🚀 Real
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase tracking-wider flex items-center gap-1">
                    <Smartphone size={11} className="text-indigo-400" /> Qiospay QRIS
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-400 font-mono">
                  {order.invoiceNumber}
                </span>
                <button
                  onClick={handleCopyInvoice}
                  className="text-slate-400 hover:text-amber-400 text-[11px] flex items-center gap-1 transition-colors"
                  title="Salin Invoice"
                >
                  {copiedInvoice ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  <span>{copiedInvoice ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Tutup popup pembayaran"
          >
            <X size={20} />
          </button>
        </div>

        {/* Amount Summary & Countdown */}
        <div className="bg-slate-950/80 px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Total Tagihan</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xl font-black text-amber-400 font-mono tracking-tight">
                {formatRupiah(order.totalAmount)}
              </span>
              <button
                onClick={handleCopyNominal}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1 transition-all cursor-pointer"
              >
                {copiedNominal ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedNominal ? 'Tersalin' : 'Salin'}</span>
              </button>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Sisa Waktu</span>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 text-amber-300 border border-slate-700 rounded-xl text-xs font-mono font-bold mt-0.5">
              <Clock size={12} className="text-amber-400 animate-spin" />
              <span>{formatMinutes(timeLeft)}</span>
            </div>
          </div>
        </div>

        {/* QRIS Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* QR Container */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-4 flex flex-col items-center text-center space-y-3 shadow-inner">
            <div className="p-3 bg-white rounded-2xl shadow-xl relative flex items-center justify-center min-w-[210px] min-h-[210px]">
              {loadingDeposit ? (
                <div className="flex flex-col items-center gap-2 p-6 text-slate-500">
                  <RefreshCw size={28} className="animate-spin text-amber-500" />
                  <span className="text-xs font-semibold">Memuat QRIS...</span>
                </div>
              ) : activeQrImage ? (
                <img
                  src={activeQrImage}
                  alt={`QRIS Pembayaran ${gatewayTitle}`}
                  className="w-48 h-48 sm:w-52 sm:h-52 object-contain rounded-lg"
                  onError={() => {
                    if (!localQrDataUrl) setQrImgError(true);
                  }}
                />
              ) : (
                <div className="w-48 h-48 sm:w-52 sm:h-52 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <RefreshCw size={24} className="animate-spin text-indigo-500" />
                  <span className="text-[11px] font-medium">Menyiapkan barcode...</span>
                </div>
              )}
            </div>

            {/* Merchant Name */}
            <div className="w-full text-center px-2">
              <div className="text-xs font-bold text-white font-mono tracking-wide">
                {merchantStoreName}
              </div>
            </div>

            {/* Quick Actions for QRIS (Download & Salin String) */}
            <div className="flex items-center gap-2 w-full justify-center pt-1">
              {activeQrImage && (
                <a
                  href={activeQrImage}
                  download={`QRIS-${order.invoiceNumber}.png`}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 hover:text-white border border-slate-800 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Download size={13} className="text-teal-400" />
                  <span>Unduh QRIS</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => onCopyText(activeQRString, 'Kode String QRIS')}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 hover:text-white border border-slate-800 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Copy size={13} className="text-blue-400" />
                <span>Salin String QRIS</span>
              </button>
            </div>

            {/* Status Poll Indicator */}
            <div className={`w-full flex items-center justify-center gap-2 text-[11px] px-3.5 py-2 rounded-2xl transition-all ${isPaymentSuccess
                ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                : 'bg-slate-900 text-slate-300 border border-slate-800'
              }`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${isPaymentSuccess ? 'bg-emerald-400 animate-ping' : 'bg-amber-400 animate-pulse'}`} />
              <span className="font-medium font-mono text-center text-xs">{pollStatus}</span>
            </div>
          </div>

          {/* Instruksi Singkat */}
          <div className="bg-slate-950/60 rounded-2xl p-3 border border-slate-800/80 text-[11px] text-slate-400 space-y-1.5">
            <div className="font-bold text-slate-200 flex items-center gap-1.5">
              <Smartphone size={13} className="text-amber-400" />
              <span>Cara Pembayaran:</span>
            </div>
            <ol className="list-decimal list-inside space-y-0.5 text-slate-400 text-[10.5px]">
              <li>Buka aplikasi m-Banking (BCA, Mandiri, BRI, BNI) atau E-Wallet (GoPay, OVO, DANA, ShopeePay).</li>
              <li>Pilih menu <strong>Scan QRIS</strong> lalu arahkan kamera ke barcode di atas.</li>
              <li>Periksa nama penerbit <strong>{isPakasir ? 'Pakasir' : 'Qiospay'}</strong>, nama toko <strong>{merchantStoreName}</strong>, dan nominal <strong>{formatRupiah(order.totalAmount)}</strong>, lalu selesaikan pembayaran.</li>
            </ol>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            {/* Fitur Khusus Sandbox Pakasir */}
            {isPakasir && isPakasirSandbox && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs text-amber-300 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-400" />
                    <span>Fitur Uji Coba Sandbox Pakasir</span>
                  </span>
                  <span className="text-[9.5px] bg-amber-500/20 px-2 py-0.5 rounded-full font-mono text-amber-400 border border-amber-500/30">
                    Mode Testing
                  </span>
                </div>
                <p className="text-[10.5px] text-amber-200/80 leading-relaxed">
                  Gateway sedang berjalan di mode <strong>Sandbox (Uji Coba)</strong>. Anda dapat mengonfirmasi pembayaran lunas secara instan via API Pakasir tanpa uang riil.
                </p>
                <button
                  type="button"
                  onClick={handleSimulatePakasirSandbox}
                  disabled={isSimulatingSandbox || isPaymentSuccess}
                  className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-950/40 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={13} className={isSimulatingSandbox ? 'animate-spin' : ''} />
                  <span>{isSimulatingSandbox ? 'Memproses Simulasi Pakasir...' : '⚡ Simulasi Bayar Sandbox (Pakasir)'}</span>
                </button>
              </div>
            )}

            {isPakasir && (
              <a
                href={order.paymentLink || `https://app.pakasir.com/pay/${encodeURIComponent(settings.pakasirSlug || 'waroengdigital')}/${order.totalAmount}?order_id=${encodeURIComponent(order.invoiceNumber)}&qris_only=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-900/30 cursor-pointer"
              >
                <ExternalLink size={14} />
                <span>Buka Link Pembayaran Resmi Pakasir (QRIS / E-Wallet)</span>
              </a>
            )}

            <div>
              <button
                type="button"
                onClick={handleManualCheckStatus}
                disabled={isCheckingManual}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-900/30 disabled:opacity-50"
              >
                <RefreshCw size={14} className={isCheckingManual ? 'animate-spin text-amber-300' : ''} />
                <span>{isCheckingManual ? 'Mengecek Pembayaran...' : 'Cek Status Pembayaran'}</span>
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-slate-500">
              <ShieldCheck size={13} className="text-emerald-400" />
              <span>QRIS Standar Bank Indonesia • Diproses Otomatis oleh {gatewayTitle}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SnapSimulatorModal;
