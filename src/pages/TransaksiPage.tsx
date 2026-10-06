import React, { useState } from 'react';
import { 
  ReceiptText, 
  Search, 
  Copy, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  XCircle, 
  FileText,
  ShieldCheck,
  Smartphone,
  Wifi,
  Sparkles,
  Lock
} from 'lucide-react';
import { Order, PaymentStatus, FulfillmentStatus } from '../types';
import { formatRupiah, formatDateWIB } from '../utils/operator';
import { PaymentStatusBadge, FulfillmentStatusBadge } from '../components/StatusBadge';
import { ProductLogo } from '../components/ProductLogo';
import { storage } from '../services/storage';

interface TransaksiPageProps {
  orders: Order[];
  onOpenInvoice: (order: Order) => void;
  onOpenPaymentSession?: (order: Order) => void;
  onCopyText: (text: string, label: string) => void;
}

export function TransaksiPage({
  orders,
  onOpenInvoice,
  onOpenPaymentSession,
  onCopyText,
}: TransaksiPageProps) {
  const [searchInvoice, setSearchInvoice] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'UNPAID' | 'PROCESSING' | 'SUCCESS' | 'FAILED'>('ALL');
  const [searchedOrder, setSearchedOrder] = useState<Order | null>(null);
  const [searchError, setSearchError] = useState('');

  // Handle order lookup with security check (Section K: Nomor invoice saja tidak boleh membuka data transaksi/voucher tanpa verifikasi nomor HP atau token)
  const handleTrackOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError('');
    setSearchedOrder(null);

    const cleanInvoice = searchInvoice.trim().toUpperCase();
    const cleanPhone = searchPhone.trim();

    if (!cleanInvoice) {
      setSearchError('Masukkan nomor invoice pesanan Anda (contoh: INV/20260916/WD/1001)');
      return;
    }

    if (!cleanPhone) {
      setSearchError('Demi keamanan data transaksi, masukkan nomor handphone/WhatsApp tujuan yang Anda daftarkan.');
      return;
    }

    const matched = orders.find(o => 
      (o.invoiceNumber.toUpperCase() === cleanInvoice || o.id === cleanInvoice) &&
      (o.targetDestination.includes(cleanPhone) || 
       (o.customerPhone && o.customerPhone.includes(cleanPhone)) ||
       o.guestAccessToken.toLowerCase() === cleanPhone.toLowerCase())
    );

    if (matched) {
      setSearchedOrder(matched);
    } else {
      setSearchError('Transaksi tidak ditemukan atau nomor HP tujuan tidak cocok. Mohon periksa kembali.');
    }
  };

  // Filter local order history
  const filteredOrders = orders.filter(o => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'UNPAID') return o.paymentStatus === 'UNPAID' || o.paymentStatus === 'PENDING';
    if (activeFilter === 'PROCESSING') return o.paymentStatus === 'PAID' && o.fulfillmentStatus !== 'SUCCESS' && o.fulfillmentStatus !== 'FAILED';
    if (activeFilter === 'SUCCESS') return o.paymentStatus === 'PAID' && o.fulfillmentStatus === 'SUCCESS';
    if (activeFilter === 'FAILED') return o.paymentStatus === 'FAILED' || o.paymentStatus === 'EXPIRED' || o.fulfillmentStatus === 'FAILED';
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
            <ReceiptText size={18} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Lacak & Riwayat Transaksi
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-500">
          Cek status pembayaran dan pemenuhan produk secara real-time. Dilindungi verifikasi kepemilikan aman.
        </p>
      </div>

      {/* 1. Lacak Order Spesifik (Tracking Tool) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <Search size={15} className="text-indigo-600" />
          Lacak Pesanan Cepat
        </h2>

        <form onSubmit={handleTrackOrder} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="track-invoice-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Nomor Invoice *
              </label>
              <input
                id="track-invoice-input"
                type="text"
                placeholder="Contoh: INV/20260916/WD/1001"
                value={searchInvoice}
                onChange={(e) => setSearchInvoice(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-xs uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="track-phone-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Nomor HP / WA Tujuan (Verifikasi Keamanan) *
              </label>
              <input
                id="track-phone-input"
                type="tel"
                placeholder="Contoh: 08123456789"
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Lock size={12} className="text-teal-600" />
              Perlindungan data: nomor invoice saja tidak dapat membuka kode voucher tanpa nomor HP.
            </span>

            <button
              type="submit"
              id="track-submit-button"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs shrink-0 cursor-pointer"
            >
              Lacak Pesanan
            </button>
          </div>
        </form>

        {searchError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{searchError}</span>
          </div>
        )}

        {/* Hasil Lacak Spesifik */}
        {searchedOrder && (
          <div className="mt-4 p-4 rounded-xl border-2 border-indigo-500/30 bg-indigo-50/20 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                  Hasil Pelacakan
                </span>
                <h3 className="font-extrabold text-base text-slate-900 mt-1">
                  {searchedOrder.invoiceNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  Dibuat pada {formatDateWIB(searchedOrder.createdAt)}
                </p>
              </div>

              <button
                onClick={() => onOpenInvoice(searchedOrder)}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-700 shadow-xs"
              >
                Buka Invoice Penuh
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 block mb-1">Status Pembayaran:</span>
                <PaymentStatusBadge status={searchedOrder.paymentStatus} size="sm" />
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 block mb-1">Status Pengiriman:</span>
                <FulfillmentStatusBadge status={searchedOrder.fulfillmentStatus} size="sm" />
              </div>
            </div>

            {/* If paid and has voucher, show quick copy */}
            {searchedOrder.paymentStatus === 'PAID' && searchedOrder.fulfillmentResult?.voucherCode && (
              <div className="bg-white p-3.5 rounded-xl border border-indigo-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block">Kode Voucher:</span>
                  <span className="font-mono text-base font-extrabold text-indigo-600">
                    {searchedOrder.fulfillmentResult.voucherCode}
                  </span>
                </div>
                <button
                  onClick={() => onCopyText(searchedOrder.fulfillmentResult?.voucherCode || '', 'Kode Voucher')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs"
                >
                  <Copy size={13} />
                  Salin Kode
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Riwayat Transaksi Lokal */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900">
            Daftar Transaksi Terakhir ({filteredOrders.length})
          </h2>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setActiveFilter('UNPAID')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeFilter === 'UNPAID' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Menunggu Bayar
            </button>
            <button
              onClick={() => setActiveFilter('SUCCESS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeFilter === 'SUCCESS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Berhasil
            </button>
            <button
              onClick={() => setActiveFilter('FAILED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeFilter === 'FAILED' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Kendala / Batal
            </button>
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-500">
            <ReceiptText size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold">Belum ada transaksi pada filter ini.</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredOrders.map((ord) => {
              const item = ord.items[0];

              return (
                <div
                  key={ord.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-indigo-200 transition-all space-y-4"
                >
                  {/* Top: Invoice + Date + Category */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {ord.invoiceNumber}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded-md">
                          {ord.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {formatDateWIB(ord.createdAt)}
                      </p>
                    </div>

                    {/* Dual Status Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <PaymentStatusBadge status={ord.paymentStatus} size="sm" />
                      <FulfillmentStatusBadge status={ord.fulfillmentStatus} size="sm" />
                    </div>
                  </div>

                  {/* Middle Product Info */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <ProductLogo
                        provider={item?.provider}
                        name={item?.productName}
                        category={ord.category}
                        iconUrl={item?.iconUrl}
                        size="md"
                      />
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">
                          {item?.productName}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Tujuan: <span className="font-semibold text-slate-700">{ord.targetDestination}</span>
                        </p>
                        {item?.networkLocation && (
                          <p className="text-[11px] text-slate-400">
                            Lokasi: {item.networkLocation}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-400 block">Total Bayar</span>
                      <span className="text-base font-extrabold text-indigo-600">
                        {formatRupiah(ord.totalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Serial Number Digiflazz / Voucher Code WiFi */}
                  {ord.paymentStatus === 'PAID' && ord.fulfillmentResult && (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                      {ord.fulfillmentResult.voucherCode ? (
                        <div>
                          <span className="text-slate-500 block text-[10px]">Kode Voucher:</span>
                          <span className="font-mono font-bold text-indigo-700 text-sm">
                            {ord.fulfillmentResult.voucherCode}
                          </span>
                        </div>
                      ) : ord.fulfillmentResult.serialNumber ? (
                        <div>
                          <span className="text-slate-500 block text-[10px]">Serial Number:</span>
                          <span className="font-mono font-bold text-slate-800 text-xs">
                            {ord.fulfillmentResult.serialNumber}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs">{ord.fulfillmentResult.notes}</span>
                      )}

                      {ord.fulfillmentResult.voucherCode && (
                        <button
                          onClick={() => onCopyText(ord.fulfillmentResult?.voucherCode || '', 'Kode Voucher')}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs"
                        >
                          <Copy size={12} />
                          Salin
                        </button>
                      )}
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400">
                      Metode: {ord.paymentMethod || 'QRIS'}
                    </span>

                    <div className="flex items-center gap-2">
                      {(ord.paymentStatus === 'UNPAID' || ord.paymentStatus === 'PENDING') && onOpenPaymentSession && (
                        <button
                          onClick={() => onOpenPaymentSession(ord)}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                        >
                          Bayar Sekarang
                        </button>
                      )}

                      <button
                        onClick={() => onOpenInvoice(ord)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <FileText size={13} />
                        Lihat Bukti / Invoice
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
