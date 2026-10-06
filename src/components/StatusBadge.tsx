import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  XCircle, 
  RefreshCw, 
  HelpCircle,
  FileCheck
} from 'lucide-react';
import { PaymentStatus, FulfillmentStatus } from '../types';

interface PaymentBadgeProps {
  status: PaymentStatus;
  size?: 'sm' | 'md';
}

export function PaymentStatusBadge({ status, size = 'md' }: PaymentBadgeProps) {
  const isSmall = size === 'sm';
  const sizeClass = isSmall ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs md:text-sm';
  const iconSize = isSmall ? 14 : 16;

  switch (status) {
    case 'PAID':
      return (
        <span 
          id={`payment-badge-${status}`}
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClass}`}
        >
          <CheckCircle2 size={iconSize} className="text-emerald-600 shrink-0" aria-hidden="true" />
          <span>Lunas (Terverifikasi)</span>
        </span>
      );
    case 'PENDING':
    case 'UNPAID':
      return (
        <span 
          id={`payment-badge-${status}`}
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-amber-50 text-amber-700 border border-amber-200 ${sizeClass}`}
        >
          <Clock size={iconSize} className="text-amber-600 shrink-0" aria-hidden="true" />
          <span>Menunggu Pembayaran</span>
        </span>
      );
    case 'FAILED':
      return (
        <span 
          id={`payment-badge-${status}`}
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-rose-50 text-rose-700 border border-rose-200 ${sizeClass}`}
        >
          <XCircle size={iconSize} className="text-rose-600 shrink-0" aria-hidden="true" />
          <span>Gagal</span>
        </span>
      );
    case 'EXPIRED':
      return (
        <span 
          id={`payment-badge-${status}`}
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-slate-100 text-slate-700 border border-slate-300 ${sizeClass}`}
        >
          <AlertCircle size={iconSize} className="text-slate-500 shrink-0" aria-hidden="true" />
          <span>Kedaluwarsa</span>
        </span>
      );
    case 'REFUND_PENDING':
      return (
        <span 
          id={`payment-badge-${status}`}
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-orange-50 text-orange-700 border border-orange-200 ${sizeClass}`}
        >
          <RefreshCw size={iconSize} className="text-orange-600 shrink-0 animate-spin" aria-hidden="true" />
          <span>Proses Refund</span>
        </span>
      );
    case 'REFUNDED':
      return (
        <span 
          id={`payment-badge-${status}`}
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-purple-50 text-purple-700 border border-purple-200 ${sizeClass}`}
        >
          <RefreshCw size={iconSize} className="text-purple-600 shrink-0" aria-hidden="true" />
          <span>Dana Dikembalikan</span>
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-slate-100 text-slate-700 ${sizeClass}`}>
          <HelpCircle size={iconSize} />
          <span>{status}</span>
        </span>
      );
  }
}

interface FulfillmentBadgeProps {
  status: FulfillmentStatus;
  size?: 'sm' | 'md';
}

export function FulfillmentStatusBadge({ status, size = 'md' }: FulfillmentBadgeProps) {
  const isSmall = size === 'sm';
  const sizeClass = isSmall ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs md:text-sm';
  const iconSize = isSmall ? 14 : 16;

  switch (status) {
    case 'SUCCESS':
      return (
        <span 
          id={`fulfillment-badge-${status}`}
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-teal-50 text-teal-700 border border-teal-200 ${sizeClass}`}
        >
          <FileCheck size={iconSize} className="text-teal-600 shrink-0" aria-hidden="true" />
          <span>Terkirim & Berhasil</span>
        </span>
      );
    case 'PROCESSING':
    case 'QUEUED':
      return (
        <span 
          id={`fulfillment-badge-${status}`}
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-sky-50 text-sky-700 border border-sky-200 ${sizeClass}`}
        >
          <RefreshCw size={iconSize} className="text-sky-600 shrink-0 animate-spin" aria-hidden="true" />
          <span>Sedang Diproses Supplier</span>
        </span>
      );
    case 'MANUAL_REVIEW':
      return (
        <span 
          id={`fulfillment-badge-${status}`}
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 ${sizeClass}`}
        >
          <Clock size={iconSize} className="text-indigo-600 shrink-0" aria-hidden="true" />
          <span>Dalam Antrean Aktivasi Admin</span>
        </span>
      );
    case 'FAILED':
      return (
        <span 
          id={`fulfillment-badge-${status}`}
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-rose-50 text-rose-700 border border-rose-200 ${sizeClass}`}
        >
          <AlertCircle size={iconSize} className="text-rose-600 shrink-0" aria-hidden="true" />
          <span>Kendala Pengiriman (Hubungi CS)</span>
        </span>
      );
    case 'NOT_STARTED':
    default:
      return (
        <span 
          id={`fulfillment-badge-${status}`}
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-slate-100 text-slate-600 border border-slate-200 ${sizeClass}`}
        >
          <Clock size={iconSize} className="text-slate-400 shrink-0" aria-hidden="true" />
          <span>Belum Dimulai</span>
        </span>
      );
  }
}
