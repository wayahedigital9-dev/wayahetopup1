import React, { useMemo, useState } from 'react';
import { ArrowRight, Check, Clock, HelpCircle, Layers, MapPin, Search, ShieldCheck, Wifi, Zap } from 'lucide-react';
import { Product, ProductVariant } from '../types';
import { formatRupiah } from '../utils/operator';
import { ProductLogo } from '../components/ProductLogo';

interface WifiVoucherPageProps {
  products: Product[];
  onSelectProductToCheckout: (product: Product, targetDestination: string) => void;
}

// Availability is an admin/server count, never inferred from secret voucher arrays.
const hasStock = (stock: number | undefined) => typeof stock === 'number' && Number.isFinite(stock) && stock > 0;
const activeVariants = (product: Product) => (product.variants || []).filter(v => v.isActive !== false && !v.isDeleted);

export function WifiVoucherPage({ products, onSelectProductToCheckout }: WifiVoucherPageProps) {
  const [buyerName, setBuyerName] = useState('');
  const [search, setSearch] = useState('');
  const [duration, setDuration] = useState('');
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const catalog = useMemo(() => products.filter(p => p.categoryId === 'wifi' && p.isActive && !p.isDeleted), [products]);
  const durations = useMemo(() => [...new Set(catalog.flatMap(p => p.hasVariants || p.variants?.length ? activeVariants(p).map(v => v.duration || p.duration || '') : [p.duration || '']).filter(Boolean))], [catalog]);
  const visible = catalog.filter(p => {
    const variants = activeVariants(p);
    const query = search.trim().toLowerCase();
    const matchesSearch = [p.name, p.description, p.networkLocation, p.duration, ...variants.flatMap(v => [v.name, v.description, v.duration])].some(text => text?.toLowerCase().includes(query));
    const matchesDuration = !duration || (p.hasVariants || p.variants?.length ? variants.some(v => (v.duration || p.duration) === duration) : p.duration === duration);
    return matchesSearch && matchesDuration;
  });

  function checkout(product: Product, variant?: ProductVariant) {
    const stock = variant ? variant.stock : product.stock;
    const price = variant ? variant.sellingPrice : product.sellingPrice;
    if (!hasStock(stock) || !Number.isFinite(price) || price <= 0 || ((product.hasVariants || product.variants?.length) && !variant)) return;
    // Do not carry stock codes into checkout state; the backend allocates a purchased code.
    const { voucherCodes: _codes, variants: _variants, ...publicProduct } = product;
    const payload: Product = {
      ...publicProduct,
      variants: activeVariants(product).map(({ voucherCodes: _variantCodes, ...publicVariant }) => publicVariant),
      ...(variant ? {
        name: `${product.name} - ${variant.name}`,
        sellingPrice: variant.sellingPrice,
        supplierPrice: variant.supplierPrice ?? product.supplierPrice,
        discountPrice: variant.discountPrice,
        duration: variant.duration || product.duration,
        speed: variant.speed || product.speed,
        stock: variant.stock,
        badge: variant.badge || product.badge,
        selectedVariantId: variant.id,
        selectedVariantName: variant.name,
      } : {}),
    };
    onSelectProductToCheckout(payload, buyerName.trim() || 'Pelanggan WiFi');
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 text-slate-900">
      <section className="relative overflow-hidden rounded-3xl bg-slate-950 text-white p-7 sm:p-10 border border-slate-800 shadow-xl">
        <div aria-hidden="true" className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="relative grid md:grid-cols-[1fr_auto] gap-8 items-center">
          <div className="max-w-xl">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-indigo-300"><Wifi size={16} /> WiFi / Katalog voucher</p>
            <h1 className="mt-4 text-3xl sm:text-5xl font-semibold tracking-tight leading-tight">Koneksi untuk<br />keseharian Anda.</h1>
            <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed">Pilih jaringan dan paket dari katalog admin. Voucher pembelian tersedia di invoice setelah pembayaran terverifikasi dan pengiriman selesai.</p>
            <div className="mt-6 flex flex-wrap gap-4 text-xs text-slate-300"><span className="inline-flex items-center gap-2"><Layers size={15} /> {catalog.length} paket dalam katalog</span><span className="inline-flex items-center gap-2"><ShieldCheck size={15} /> Verifikasi pembayaran oleh server</span></div>
          </div>
          <div className="hidden md:flex w-32 h-32 rounded-3xl border border-white/10 bg-white/5 items-center justify-center"><Wifi size={60} strokeWidth={1.25} className="text-indigo-300" /></div>
        </div>
      </section>

      <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 flex flex-col sm:flex-row gap-5 sm:items-center">
        <div className="flex-1"><label htmlFor="wifi-buyer-phone" className="font-semibold text-sm">Nama pembeli <span className="font-normal text-slate-400">/ opsional</span></label><p className="text-xs text-slate-500 mt-1">Simpan invoice Anda untuk melihat status dan voucher pembelian.</p></div>
        <input id="wifi-buyer-phone" value={buyerName} onChange={e => setBuyerName(e.target.value)} maxLength={120} placeholder="Nama Anda" className="w-full sm:w-72 border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </section>

      <section className="space-y-5" aria-labelledby="wifi-catalog-title">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div><p className="text-xs uppercase tracking-widest font-semibold text-indigo-600">Pilih paket</p><h2 id="wifi-catalog-title" className="text-2xl font-semibold tracking-tight mt-1">Voucher WiFi</h2><p className="text-sm text-slate-500 mt-1">Harga dan ketersediaan mengikuti varian yang Anda pilih.</p></div>
          <div className="relative w-full md:w-80"><Search size={17} aria-hidden="true" className="absolute left-3 top-3.5 text-slate-400" /><input aria-label="Cari paket WiFi" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari paket atau lokasi" className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
        </div>
        {durations.length > 0 && <div className="flex flex-wrap gap-2"><button type="button" aria-pressed={!duration} onClick={() => setDuration('')} className={`px-4 py-2 rounded-full text-xs font-semibold ${!duration ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>Semua durasi</button>{durations.map(value => <button type="button" key={value} aria-pressed={duration === value} onClick={() => setDuration(value)} className={`px-4 py-2 rounded-full text-xs font-semibold ${duration === value ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{value}</button>)}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visible.map(product => {
            const variants = activeVariants(product);
            const needsVariant = Boolean(product.hasVariants || product.variants?.length);
            const variant = needsVariant ? variants.find(v => v.id === selectedVariants[product.id]) || variants.find(v => !duration || (v.duration || product.duration) === duration) || variants[0] : undefined;
            const stock = variant ? variant.stock : needsVariant ? undefined : product.stock;
            const price = variant ? variant.sellingPrice : product.sellingPrice;
            const available = hasStock(stock) && Number.isFinite(price) && price > 0 && (!needsVariant || Boolean(variant));
            const currentDuration = variant?.duration || product.duration;
            const currentSpeed = variant?.speed || product.speed;
            return <article key={product.id} className="flex flex-col rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-shadow">
              <div className="flex items-start gap-3"><div className="rounded-xl bg-indigo-50 p-2.5"><ProductLogo provider={product.provider} name={product.name} category="wifi" iconUrl={product.iconUrl} size="md" /></div><div className="min-w-0"><h3 className="font-semibold text-lg leading-snug break-words">{product.name}</h3>{product.networkLocation && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} />{product.networkLocation}</p>}</div></div>
              {product.description && <p className="mt-4 text-sm leading-relaxed text-slate-500">{product.description}</p>}
              {needsVariant && <fieldset className="mt-5"><legend className="text-xs font-semibold text-slate-500 mb-2">Pilih varian</legend><div className="flex flex-wrap gap-2">{variants.map(v => <button key={v.id} type="button" aria-pressed={variant?.id === v.id} onClick={() => setSelectedVariants(prev => ({ ...prev, [product.id]: v.id }))} className={`rounded-lg px-3 py-2 text-xs font-semibold border focus-visible:outline-indigo-500 ${variant?.id === v.id ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>{v.name}</button>)}</div>{!variants.length && <p className="text-xs text-slate-500">Belum ada varian aktif.</p>}</fieldset>}
              <dl className="mt-5 space-y-3 text-xs border-t border-slate-100 pt-4">
                {currentDuration && <div className="flex justify-between gap-3"><dt className="text-slate-500 flex items-center gap-2"><Clock size={14} />Masa aktif</dt><dd className="font-medium text-right">{currentDuration}</dd></div>}
                {currentSpeed && <div className="flex justify-between gap-3"><dt className="text-slate-500 flex items-center gap-2"><Zap size={14} />Kecepatan</dt><dd className="font-medium text-right">{currentSpeed}</dd></div>}
                {product.quotaDetails && <div className="flex justify-between gap-3"><dt className="text-slate-500">Kuota</dt><dd className="font-medium text-right">{product.quotaDetails}</dd></div>}
                <div className="flex justify-between gap-3"><dt className="text-slate-500 flex items-center gap-2"><Layers size={14} />Stok varian</dt><dd className={`font-semibold ${available ? 'text-emerald-700' : 'text-slate-500'}`}>{stock === undefined || !Number.isFinite(stock) ? 'Belum tersedia' : stock > 0 ? `${stock} tersedia` : 'Stok habis'}</dd></div>
              </dl>
              {(variant?.snk || product.terms?.length) && <details className="mt-4 text-xs text-slate-500"><summary className="cursor-pointer font-medium">Ketentuan paket</summary><p className="mt-2 whitespace-pre-line leading-relaxed">{variant?.snk || product.terms?.join('\n')}</p></details>}
              <div className="mt-auto pt-6"><p className="text-xs text-slate-500">{variant ? 'Harga varian terpilih' : 'Harga voucher'}</p><p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{Number.isFinite(price) && price > 0 ? formatRupiah(price) : 'Belum tersedia'}</p><button id={`buy-wifi-${product.id}`} type="button" onClick={() => checkout(product, variant)} disabled={!available} className="mt-4 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white py-3 text-sm font-semibold flex items-center justify-center gap-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">{available ? 'Lanjut ke pembayaran' : 'Belum tersedia'}<ArrowRight size={16} /></button></div>
            </article>;
          })}
        </div>
        {!visible.length && <div className="p-10 rounded-2xl border border-dashed border-slate-300 text-center bg-white"><Wifi size={32} className="mx-auto text-slate-300 mb-3" /><h3 className="font-semibold">Belum ada paket yang sesuai</h3><p className="mt-2 text-sm text-slate-500">Coba kata kunci lain atau tunggu katalog diperbarui.</p><button type="button" onClick={() => { setSearch(''); setDuration(''); }} className="mt-4 text-sm text-indigo-600 font-semibold">Reset filter</button></div>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"><h2 className="flex items-center gap-2 font-semibold text-lg"><HelpCircle size={20} className="text-indigo-600" />Dari pembayaran ke koneksi</h2><div className="grid sm:grid-cols-3 gap-6 mt-6">{[
        ['Pilih jaringan', 'Pastikan lokasi jaringan dan ketentuan paket sesuai kebutuhan Anda.'],
        ['Bayar sesuai tagihan', 'Scan QRIS dan periksa nominal. Status pembayaran diperbarui dari server.'],
        ['Buka invoice', 'Setelah pembayaran PAID dan pengiriman SUCCESS, gunakan voucher yang tertera sesuai panduan jaringan.'],
      ].map(([title, description], index) => <div key={title}><span className="text-xs text-indigo-600 font-semibold">0{index + 1}</span><h3 className="mt-2 font-semibold text-sm">{title}</h3><p className="mt-2 text-xs text-slate-500 leading-relaxed">{description}</p></div>)}</div><p className="mt-6 pt-4 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500"><Check size={15} className="shrink-0" />Masa aktif, batas perangkat, dan kecepatan mengikuti informasi paket dari pengelola jaringan.</p></section>
    </main>
  );
}
