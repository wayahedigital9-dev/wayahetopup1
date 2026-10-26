import React, { useEffect, useState } from 'react';
import { Product } from '../types';
import { storage } from '../services/storage';

/** One inventory unit per nonblank line; never split passwords on commas. */
export function parsePremiumStock(raw: string): string[] {
  const lines = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const seen = new Set<string>();
  for (const [index, line] of lines.entries()) {
    const divider = line.indexOf('|');
    if (divider >= 0 && (!line.slice(0, divider).trim() || !line.slice(divider + 1).trim())) {
      throw new Error(`Format stok baris ${index + 1} tidak valid: login|password atau kode saja.`);
    }
    if (seen.has(line)) throw new Error(`Stok duplikat pada baris ${index + 1}.`);
    seen.add(line);
  }
  return lines;
}

export function isManualPremium(product: Product): boolean {
  return product.categoryId === 'premium' && (product.isManualCustom === true || (!product.providerProductId && !product.supplierSku && !product.providerCode));
}

/** Public catalogs carry confirmed counts, not credential arrays. */
export function premiumAvailableStock(product: Product): number {
  const count = (stock?: number) => Number.isFinite(stock) && Number(stock) > 0 ? Math.floor(Number(stock)) : 0;
  return product.hasVariants && product.variants?.length
    ? product.variants.reduce((sum, variant) => sum + count(variant.stock), 0)
    : count(product.stock);
}

interface Props {
  selectedProductId?: string;
  onAddProduct: () => void;
  onRefreshData: () => void;
  onShowToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}
interface Draft {
  product: Product;
  revision: number;
  rawCodes: string;
  variantCodes: Record<string, string>;
}

export function PremiumManualStockPanel({ selectedProductId, onAddProduct, onRefreshData, onShowToast }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  const readProducts = () => storage.getProducts().filter(p => isManualPremium(p) && !p.isDeleted);
  const edit = (product: Product) => {
    const revision = storage.getManualInventoryRevision();
    if (revision === null) { setError('Muat inventori database sebelum mengubah stok.'); return; }
    setDraft({ product: structuredClone(product), revision, rawCodes: (product.voucherCodes || []).join('\n'), variantCodes: Object.fromEntries((product.variants || []).map(v => [v.id, (v.voucherCodes || []).join('\n')])) });
    setError('');
  };

  useEffect(() => {
    let active = true;
    storage.hydrateManualInventory().then(state => {
      if (!active) return;
      const manual = state.products.filter(p => isManualPremium(p) && !p.isDeleted);
      setProducts(manual);
      setReady(state.revision !== undefined);
      if (state.revision === undefined) setError('Server belum menyediakan revisi inventori. Penyimpanan dinonaktifkan.');
      const selected = manual.find(p => p.id === selectedProductId);
      if (selected && state.revision !== undefined) edit(selected);
    }).catch(err => { if (active) setError(err.message || 'Inventori tidak dapat dimuat.'); });
    return () => { active = false; };
  }, [selectedProductId]);

  const mutate = async (allProducts: Product[], revision: number) => {
    setBusy(true); setError('');
    try {
      await storage.saveManualInventory(allProducts, storage.getVoucherBatches(), revision);
      setProducts(readProducts()); onRefreshData();
      return true;
    } catch (err: any) {
      setProducts(readProducts()); onRefreshData();
      const message = err?.message || 'Inventori belum tersimpan.';
      setError(message); onShowToast('Gagal Simpan', message, 'error');
      return false;
    } finally { setBusy(false); }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || busy) return;
    try {
      if (!draft.product.name.trim() || !Number.isFinite(draft.product.sellingPrice) || draft.product.sellingPrice <= 0) throw new Error('Nama dan harga jual positif wajib diisi.');
      const voucherCodes = parsePremiumStock(draft.rawCodes);
      const variants = draft.product.variants?.map(v => {
        const codes = parsePremiumStock(draft.variantCodes[v.id] || '');
        return { ...v, voucherCodes: codes, stock: codes.length };
      });
      const updated: Product = { ...draft.product, name: draft.product.name.trim(), isManualCustom: true, voucherCodes: draft.product.hasVariants ? [] : voucherCodes, variants,
        stock: draft.product.hasVariants ? (variants || []).reduce((sum, v) => sum + v.stock, 0) : voucherCodes.length };
      const all = storage.getProducts();
      if (!all.some(p => p.id === updated.id)) throw new Error('Produk sudah dihapus. Muat ulang inventori.');
      if (await mutate(all.map(p => p.id === updated.id ? updated : p), draft.revision)) {
        setDraft(null); onShowToast('Inventori Tersimpan', 'Stok dikonfirmasi oleh database.', 'success');
      }
    } catch (err: any) { setError(err.message); onShowToast('Gagal Simpan', err.message, 'error'); }
  };

  const remove = async (product: Product) => {
    if (busy || !window.confirm(`Hapus produk ${product.name} dan seluruh stok privatnya?`)) return;
    const revision = storage.getManualInventoryRevision();
    if (revision === null) return;
    if (await mutate(storage.getProducts().filter(p => p.id !== product.id), revision)) {
      if (draft?.product.id === product.id) setDraft(null);
      onShowToast('Produk Dihapus', 'Penghapusan dikonfirmasi database.', 'success');
    }
  };

  const reload = async () => {
    if (draft && !window.confirm('Buang draf yang belum disimpan dan muat stok terbaru?')) return;
    setBusy(true);
    try { const state = await storage.hydrateManualInventory(); setProducts(readProducts()); setDraft(null); setReady(state.revision !== undefined); setError(state.revision === undefined ? 'Revisi inventori belum tersedia.' : ''); onRefreshData(); }
    catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  };

  const importFile = async (event: React.ChangeEvent<HTMLInputElement>, variantId?: string) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !draft) return;
    try {
      if (file.size > 2_000_000) throw new Error('File maksimal 2 MB.');
      const imported = await file.text(); parsePremiumStock(imported);
      setDraft(current => !current ? current : variantId
        ? { ...current, variantCodes: { ...current.variantCodes, [variantId]: [current.variantCodes[variantId], imported].filter(Boolean).join('\n') } }
        : { ...current, rawCodes: [current.rawCodes, imported].filter(Boolean).join('\n') });
    } catch (err: any) { setError(err.message); }
  };

  const stockInput = (label: string, raw: string, variantId?: string) => <div key={variantId || 'single'} className="space-y-2">
    <label className="block font-bold">{label}: login|password atau kode saja, satu stok per baris</label>
    <textarea aria-label={label} autoComplete="off" spellCheck={false} rows={5} value={raw} disabled={busy}
      onChange={e => setDraft(current => !current ? current : variantId ? { ...current, variantCodes: { ...current.variantCodes, [variantId]: e.target.value } } : { ...current, rawCodes: e.target.value })}
      className="w-full border border-slate-300 rounded-xl p-3 font-mono text-slate-900 bg-white" />
    <p>{raw.split(/\r?\n/).filter(line => line.trim()).length} baris stok nyata. Hapus baris untuk menghapus stok; kosong = 0.</p>
    <label className="inline-block cursor-pointer underline">Import / tambahkan file teks <input aria-label={`Import ${label}`} disabled={busy} type="file" accept=".txt,text/plain" onChange={e => void importFile(e, variantId)} className="block" /></label>
  </div>;

  return <section id="premium-manual-stock" className="bg-white text-slate-800 border border-slate-200 rounded-2xl p-5 space-y-4 text-xs">
    <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold text-base">Inventori Premium Manual — Database Admin</h3>
      <div className="flex gap-3"><button type="button" disabled={busy} onClick={() => void reload()}>Muat ulang</button><button type="button" disabled={busy || !ready} onClick={onAddProduct}>+ Tambah Produk</button></div></div>
    <p className="bg-amber-50 border border-amber-200 p-3 rounded-xl">Rahasia privat admin: kredensial / kode stok bukan deskripsi publik. Jangan menaruh password atau key pada nama, deskripsi, atau catatan pembeli. Stok dikirim hanya kepada pembeli yang berhak setelah pembayaran terkonfirmasi.</p>
    {error && <p role="alert" className="text-rose-700">{error}</p>}
    <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Produk</th><th>Stok database</th><th>Aksi</th></tr></thead>
      <tbody>{products.map(product => <tr key={product.id} className="border-t"><td className="py-3">{product.name}</td><td>{premiumAvailableStock(product)}</td><td className="space-x-3"><button type="button" disabled={busy || !ready} onClick={() => { if (!draft || window.confirm('Buang draf dan buka produk lain?')) edit(product); }}>Edit / Import Stok</button><button type="button" disabled={busy || !ready} onClick={() => void remove(product)}>Hapus</button></td></tr>)}</tbody></table></div>
    {draft && <form onSubmit={save} className="space-y-4 border-t pt-4">
      <p>Revisi draf: {draft.revision}. Konflik tidak menimpa draf; gunakan Muat ulang setelah meninjau perubahan.</p>
      <label className="block">Nama Produk<input required disabled={busy} className="block w-full border rounded-lg p-2" value={draft.product.name} onChange={e => setDraft({ ...draft, product: { ...draft.product, name: e.target.value } })} /></label>
      <label className="block">Harga Jual<input required min="1" type="number" disabled={busy} className="block w-full border rounded-lg p-2" value={draft.product.sellingPrice} onChange={e => setDraft({ ...draft, product: { ...draft.product, sellingPrice: Number(e.target.value) } })} /></label>
      <label className="block">Deskripsi Publik (tanpa rahasia)<textarea disabled={busy} className="block w-full border rounded-lg p-2" value={draft.product.description} onChange={e => setDraft({ ...draft, product: { ...draft.product, description: e.target.value } })} /></label>
      {draft.product.hasVariants ? draft.product.variants?.map(v => stockInput(`Stok ${v.name}`, draft.variantCodes[v.id] || '', v.id)) : stockInput('Stok Privat', draft.rawCodes)}
      <button disabled={busy || !ready} className="bg-blue-600 text-white rounded-xl px-4 py-2 font-bold" type="submit">{busy ? 'Menyimpan…' : 'Simpan ke Database'}</button>
    </form>}
  </section>;
}
