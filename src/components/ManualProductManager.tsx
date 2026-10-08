import React, { useState, useMemo, useEffect } from 'react';
import { 
  Box, 
  Layers, 
  Save, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Eye, 
  EyeOff, 
  Database, 
  RefreshCw,
  FolderPlus
} from 'lucide-react';
import { Product, ProductVariant, WifiVoucherBatch } from '../types';
import { storage } from '../services/storage';
import { formatRupiah } from '../utils/operator';

interface ManualProductManagerProps {
  category: 'premium' | 'wifi';
  title?: string;
  subtitle?: string;
  viewMode?: 'STOCKS_ONLY' | 'FULL';
  onRefreshData?: () => void;
  onShowToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export function ManualProductManager({
  category,
  title,
  subtitle,
  viewMode = category === 'wifi' ? 'STOCKS_ONLY' : 'FULL',
  onRefreshData,
  onShowToast,
}: ManualProductManagerProps) {
  // Accordion / Collapsible states for Product & Variant creation
  const [showProductForms, setShowProductForms] = useState(viewMode === 'FULL');
  const [isAddProductOpen, setIsAddProductOpen] = useState(true);
  const [isAddVariantOpen, setIsAddVariantOpen] = useState(true);

  // Form 1: Tambah Produk Baru
  const [newProductName, setNewProductName] = useState('');
  const [newProductId, setNewProductId] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');

  // Form 2: Tambah Variant Baru
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState<string>('');
  const [variantProductId, setVariantProductId] = useState<string>('');
  const [newVariantDesc, setNewVariantDesc] = useState('');
  const [newVariantSnk, setNewVariantSnk] = useState('');

  // Form 3: Tambah Stock Individu
  const [stockProductSingle, setStockProductSingle] = useState<string>('');
  const [stockVariantSingle, setStockVariantSingle] = useState<string>('');
  const [stockAccountInfo, setStockAccountInfo] = useState('');
  const [stockExpirySingle, setStockExpirySingle] = useState<string>('7');

  // Form 4: Tambah Stock Massal
  const [stockProductBulk, setStockProductBulk] = useState<string>('');
  const [stockVariantBulk, setStockVariantBulk] = useState<string>('');
  const [stockExpiryBulk, setStockExpiryBulk] = useState<string>('');
  const [stockBulkData, setStockBulkData] = useState('');

  // Stock inspection modal
  const [inspectingVariant, setInspectingVariant] = useState<{
    product: Product;
    variant: ProductVariant;
  } | null>(null);
  const [revealedIndex, setRevealedIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Trigger re-render when local storage updates
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    storage.hydrateManualInventory().then(() => {
      if (active) setReloadKey(prev => prev + 1);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  // Get products of current category
  const products = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = reloadKey;
    return storage.getProducts().filter(p => p.categoryId === category && !p.isDeleted);
  }, [category, reloadKey]);

  // Derived variants for Form 3
  const singleProductVariants = useMemo(() => {
    if (!stockProductSingle) return [];
    const prod = products.find(p => p.id === stockProductSingle);
    return prod?.variants || [];
  }, [stockProductSingle, products]);

  // Derived variants for Form 4
  const bulkProductVariants = useMemo(() => {
    if (!stockProductBulk) return [];
    const prod = products.find(p => p.id === stockProductBulk);
    return prod?.variants || [];
  }, [stockProductBulk, products]);

  // Total statistics
  const totalStockCount = useMemo(() => {
    return products.reduce((acc, p) => {
      if (p.hasVariants && p.variants) {
        return acc + p.variants.reduce((vAcc, v) => vAcc + (v.voucherCodes?.length || v.stock || 0), 0);
      }
      return acc + (p.voucherCodes?.length || p.stock || 0);
    }, 0);
  }, [products]);

  const persistManualInventory = async (allProducts: Product[], wifiBatches: WifiVoucherBatch[]) => {
    await storage.saveManualInventory(allProducts, wifiBatches);
    setReloadKey(prev => prev + 1);
    onRefreshData?.();
  };

  // 1. Simpan Produk Baru
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) {
      onShowToast('Gagal', 'Nama produk (display name) wajib diisi', 'error');
      return;
    }

    let finalId = newProductId.trim();
    if (!finalId) {
      finalId = (category === 'premium' ? 'prem-' : 'wifi-') + newProductName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
    }

    const allProducts = storage.getProducts();
    if (allProducts.some(p => p.id === finalId && !p.isDeleted)) {
      onShowToast('Gagal', `Produk ID "${finalId}" sudah terdaftar. Gunakan ID unik lainnya.`, 'error');
      return;
    }

    const newProd: Product = {
      id: finalId,
      categoryId: category,
      provider: newProductName.trim(),
      name: newProductName.trim(),
      sku: (category === 'premium' ? 'PRM-' : 'WF-') + Math.floor(1000 + Math.random() * 9000),
      description: newProductDesc.trim() || (category === 'premium' ? 'Akun & Lisensi Premium Resmi' : 'Voucher Hotspot RT/RW Net'),
      supplierPrice: 0,
      basePrice: 0,
      sellingPrice: 0,
      deliveryMethod: 'AUTOMATIC',
      isActive: true,
      hasVariants: true,
      variants: [],
      stock: 0,
      isManualCustom: true,
    };

    allProducts.unshift(newProd);
    storage.saveProducts(allProducts);
    storage.addAuditLog(
      'MANUAL_PRODUCT_CREATED',
      category === 'premium' ? 'Admin Premium' : 'Admin WiFi',
      `Produk manual ${newProd.name} (${newProd.id}) berhasil dibuat.`
    );

    setNewProductName('');
    setNewProductId('');
    setNewProductDesc('');
    setReloadKey(prev => prev + 1);
    if (onRefreshData) onRefreshData();
    onShowToast('Berhasil', `Produk "${newProd.name}" berhasil disimpan!`, 'success');
  };

  // 2. Simpan Variant Baru
  const handleSaveVariant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVariantName.trim()) {
      onShowToast('Gagal', 'Nama variant wajib diisi', 'error');
      return;
    }
    const priceNum = Number(newVariantPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      onShowToast('Gagal', 'Harga (IDR) harus berupa nominal angka valid', 'error');
      return;
    }
    if (!variantProductId) {
      onShowToast('Gagal', 'Silakan pilih Kategori (Produk) induk terlebih dahulu', 'error');
      return;
    }

    const allProducts = storage.getProducts();
    const prodIdx = allProducts.findIndex(p => p.id === variantProductId);
    if (prodIdx === -1) {
      onShowToast('Gagal', 'Produk induk tidak ditemukan', 'error');
      return;
    }

    const variantId = 'var-' + Date.now().toString(36) + '-' + Math.floor(100 + Math.random() * 900);
    const newVariant: ProductVariant = {
      id: variantId,
      name: newVariantName.trim(),
      sellingPrice: priceNum,
      supplierPrice: 0,
      description: newVariantDesc.trim() || undefined,
      snk: newVariantSnk.trim() || undefined,
      stock: 0,
      voucherCodes: [],
      isActive: true,
      sku: 'SKU-' + Math.floor(1000 + Math.random() * 9000),
    };

    const targetProduct = { ...allProducts[prodIdx] };
    const curVariants = targetProduct.variants ? [...targetProduct.variants] : [];
    curVariants.push(newVariant);
    targetProduct.hasVariants = true;
    targetProduct.variants = curVariants;
    if (!targetProduct.sellingPrice || targetProduct.sellingPrice === 0) {
      targetProduct.sellingPrice = priceNum;
    }
    allProducts[prodIdx] = targetProduct;

    storage.saveProducts(allProducts);
    storage.addAuditLog(
      'MANUAL_VARIANT_CREATED',
      category === 'premium' ? 'Admin Premium' : 'Admin WiFi',
      `Varian ${newVariant.name} untuk produk ${targetProduct.name} berhasil ditambahkan.`
    );

    // If WiFi, also create linked batch
    if (category === 'wifi') {
      try {
        const curBatches = storage.getVoucherBatches();
        const newBatch: WifiVoucherBatch = {
          id: 'batch-' + Date.now().toString(36),
          name: `${targetProduct.name} - ${newVariant.name}`,
          productId: targetProduct.id,
          variantId: newVariant.id,
          speedProfile: 'Up to 10 Mbps',
          duration: newVariant.name,
          quotaLimit: 'Unlimited FUP',
          location: 'Hotspot Area RT/RW',
          vouchers: [],
          createdAt: new Date().toISOString(),
        };
        curBatches.unshift(newBatch);
        storage.saveVoucherBatches(curBatches);
      } catch (_) {}
    }

    setNewVariantName('');
    setNewVariantPrice('');
    setNewVariantDesc('');
    setNewVariantSnk('');
    setReloadKey(prev => prev + 1);
    if (onRefreshData) onRefreshData();
    onShowToast('Berhasil', `Variant "${newVariant.name}" berhasil disimpan ke produk ${targetProduct.name}!`, 'success');
  };

  // 3. Tambah Stock Individu
  const handleAddStockSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockProductSingle) {
      onShowToast('Gagal', 'Pilih Produk terlebih dahulu', 'error');
      return;
    }
    if (!stockVariantSingle) {
      onShowToast('Gagal', 'Pilih Variant terlebih dahulu', 'error');
      return;
    }
    const trimmedInfo = stockAccountInfo.trim();
    if (!trimmedInfo) {
      onShowToast('Gagal', 'Info (Data Akun / Kode Voucher) wajib diisi', 'error');
      return;
    }

    const allProducts = storage.getProducts();
    const prodIdx = allProducts.findIndex(p => p.id === stockProductSingle);
    if (prodIdx === -1) {
      onShowToast('Gagal', 'Produk tidak ditemukan', 'error');
      return;
    }

    const prod = { ...allProducts[prodIdx] };
    const variants = prod.variants ? [...prod.variants] : [];
    const varIdx = variants.findIndex(v => v.id === stockVariantSingle);
    if (varIdx === -1) {
      onShowToast('Gagal', 'Variant tidak ditemukan', 'error');
      return;
    }

    const variant = { ...variants[varIdx] };
    const codes = variant.voucherCodes ? [...variant.voucherCodes] : [];
    codes.push(trimmedInfo);
    variant.voucherCodes = codes;
    variant.stock = codes.length;
    variant.expiredDays = Number(stockExpirySingle) || 7;
    variants[varIdx] = variant;
    prod.variants = variants;
    prod.stock = variants.reduce((acc, v) => acc + (v.stock || 0), 0);
    allProducts[prodIdx] = prod;

    const wifiBatches = storage.getVoucherBatches();
    if (category === 'wifi') {
      let targetBatch = wifiBatches.find(b => b.productId === prod.id && b.variantId === variant.id);
      if (!targetBatch) {
        targetBatch = {
          id: 'batch-' + Date.now().toString(36), name: `${prod.name} - ${variant.name}`,
          productId: prod.id, variantId: variant.id, speedProfile: 'Up to 10 Mbps', duration: variant.name,
          quotaLimit: 'Unlimited', location: 'Hotspot Area RT/RW', vouchers: [], createdAt: new Date().toISOString(),
        };
        wifiBatches.unshift(targetBatch);
      }
      const [code, pass] = trimmedInfo.includes('|') ? trimmedInfo.split('|') : [trimmedInfo, trimmedInfo];
      targetBatch.vouchers.push({
        id: 'vch-' + Date.now().toString(36) + '-' + Math.floor(100 + Math.random() * 900),
        code: code.trim(), password: pass ? pass.trim() : undefined, status: 'AVAILABLE', createdAt: new Date().toISOString(),
      });
    }

    try {
      await persistManualInventory(allProducts, wifiBatches);
    } catch (error: any) {
      onShowToast('Gagal', error?.message || 'Stok belum tersimpan di database.', 'error');
      return;
    }

    setStockAccountInfo('');
    onShowToast('Berhasil', `1 Stok baru berhasil ditambahkan ke ${prod.name} - ${variant.name}!`, 'success');
  };

  // 4. Tambah Stock Massal
  const handleAddStockBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockProductBulk) {
      onShowToast('Gagal', 'Pilih Produk terlebih dahulu', 'error');
      return;
    }
    if (!stockVariantBulk) {
      onShowToast('Gagal', 'Pilih Variant terlebih dahulu', 'error');
      return;
    }
    const lines = stockBulkData
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length === 0) {
      onShowToast('Gagal', 'Masukkan minimal 1 baris data stok akun/voucher', 'error');
      return;
    }

    const allProducts = storage.getProducts();
    const prodIdx = allProducts.findIndex(p => p.id === stockProductBulk);
    if (prodIdx === -1) {
      onShowToast('Gagal', 'Produk tidak ditemukan', 'error');
      return;
    }

    const prod = { ...allProducts[prodIdx] };
    const variants = prod.variants ? [...prod.variants] : [];
    const varIdx = variants.findIndex(v => v.id === stockVariantBulk);
    if (varIdx === -1) {
      onShowToast('Gagal', 'Variant tidak ditemukan', 'error');
      return;
    }

    const variant = { ...variants[varIdx] };
    const codes = variant.voucherCodes ? [...variant.voucherCodes] : [];
    codes.push(...lines);
    variant.voucherCodes = codes;
    variant.stock = codes.length;
    if (stockExpiryBulk) {
      variant.expiredDays = Number(stockExpiryBulk);
    }
    variants[varIdx] = variant;
    prod.variants = variants;
    prod.stock = variants.reduce((acc, v) => acc + (v.stock || 0), 0);
    allProducts[prodIdx] = prod;

    const wifiBatches = storage.getVoucherBatches();
    if (category === 'wifi') {
      let targetBatch = wifiBatches.find(b => b.productId === prod.id && b.variantId === variant.id);
      if (!targetBatch) {
        targetBatch = {
          id: 'batch-' + Date.now().toString(36), name: `${prod.name} - ${variant.name}`,
          productId: prod.id, variantId: variant.id, speedProfile: 'Up to 10 Mbps', duration: variant.name,
          quotaLimit: 'Unlimited', location: 'Hotspot Area RT/RW', vouchers: [], createdAt: new Date().toISOString(),
        };
        wifiBatches.unshift(targetBatch);
      }
      lines.forEach(line => {
        const [code, password] = line.includes('|') ? line.split('|') : [line, line];
        targetBatch!.vouchers.push({
          id: 'vch-' + Date.now().toString(36) + '-' + Math.floor(100 + Math.random() * 900),
          code: code.trim(), password: password ? password.trim() : undefined, status: 'AVAILABLE', createdAt: new Date().toISOString(),
        });
      });
    }

    try {
      await persistManualInventory(allProducts, wifiBatches);
    } catch (error: any) {
      onShowToast('Gagal', error?.message || 'Stok belum tersimpan di database.', 'error');
      return;
    }

    setStockBulkData('');
    onShowToast('Berhasil', `${lines.length} Stok berhasil diunggah secara massal ke ${prod.name} - ${variant.name}!`, 'success');
  };

  // Delete product
  const handleDeleteProduct = (prodId: string, prodName: string) => {
    if (!window.confirm(`Hapus produk "${prodName}" beserta semua varian dan stoknya?`)) return;
    const allProducts = storage.getProducts().filter(p => p.id !== prodId);
    storage.saveProducts(allProducts);
    setReloadKey(prev => prev + 1);
    if (onRefreshData) onRefreshData();
    onShowToast('Dihapus', `Produk "${prodName}" berhasil dihapus.`, 'info');
  };

  // Delete variant
  const handleDeleteVariant = (prodId: string, variantId: string, variantName: string) => {
    if (!window.confirm(`Hapus varian "${variantName}"?`)) return;
    const allProducts = storage.getProducts();
    const prodIdx = allProducts.findIndex(p => p.id === prodId);
    if (prodIdx !== -1) {
      const prod = { ...allProducts[prodIdx] };
      prod.variants = (prod.variants || []).filter(v => v.id !== variantId);
      prod.stock = (prod.variants || []).reduce((acc, v) => acc + (v.stock || 0), 0);
      allProducts[prodIdx] = prod;
      storage.saveProducts(allProducts);
      setReloadKey(prev => prev + 1);
      if (onRefreshData) onRefreshData();
      onShowToast('Dihapus', `Varian "${variantName}" berhasil dihapus.`, 'info');
    }
  };

  // Delete single stock item from inspection modal
  const handleDeleteStockItem = async (itemIndex: number) => {
    if (!inspectingVariant) return;
    const allProducts = storage.getProducts();
    const prodIdx = allProducts.findIndex(p => p.id === inspectingVariant.product.id);
    if (prodIdx === -1) return;

    const prod = { ...allProducts[prodIdx] };
    const variants = [...(prod.variants || [])];
    const varIdx = variants.findIndex(v => v.id === inspectingVariant.variant.id);
    if (varIdx === -1) return;

    const variant = { ...variants[varIdx] };
    const codes = [...(variant.voucherCodes || [])];
    const removedCode = codes[itemIndex] || '';
    codes.splice(itemIndex, 1);
    variant.voucherCodes = codes;
    variant.stock = codes.length;
    variants[varIdx] = variant;
    prod.variants = variants;
    prod.stock = variants.reduce((acc, v) => acc + (v.stock || 0), 0);
    allProducts[prodIdx] = prod;

    const wifiBatches = storage.getVoucherBatches();
    if (category === 'wifi') {
      const batch = wifiBatches.find(b => b.productId === prod.id && b.variantId === variant.id);
      const code = removedCode.split('|')[0].trim();
      if (batch && code) batch.vouchers = batch.vouchers.filter(voucher => voucher.code !== code);
    }
    try {
      await persistManualInventory(allProducts, wifiBatches);
    } catch (error: any) {
      onShowToast('Gagal', error?.message || 'Stok belum tersimpan di database.', 'error');
      return;
    }
    setInspectingVariant({
      product: prod,
      variant: variant,
    });
    onShowToast('Dihapus', '1 Item stok berhasil dihapus.', 'info');
  };

  const handleCopyStock = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-5 animate-fadeInUp">
      {/* HEADER: EXACT TITLE "Stocks" */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <h1 className="text-2xl font-bold text-white tracking-tight">Stocks</h1>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowProductForms(!showProductForms)}
            className="px-3 py-1.5 bg-[#0e1626] hover:bg-[#152037] border border-[#1e2a3f] text-blue-400 hover:text-blue-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FolderPlus size={14} />
            <span>{showProductForms ? 'Sembunyikan Form Tambah Produk/Variant' : '+ Tambah Produk & Variant'}</span>
          </button>

          <button
            type="button"
            onClick={() => setReloadKey(prev => prev + 1)}
            className="p-1.5 bg-[#0e1626] hover:bg-[#152037] border border-[#1e2a3f] text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* OPTIONAL TOGGLE: TAMBAH PRODUK BARU & VARIANT BARU */}
      {showProductForms && (
        <div className="space-y-4 pb-2 border-b border-slate-800/80">
          {/* SECTION: TAMBAH PRODUK BARU */}
          <div className="bg-[#0e1626] border border-[#1e293b] rounded-xl shadow-lg overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setIsAddProductOpen(!isAddProductOpen)}
              className="w-full flex items-center justify-between px-5 py-3 bg-[#0a1120] hover:bg-[#0f192e] transition-colors border-b border-[#1c273e] text-left cursor-pointer"
            >
              <div className="flex items-center gap-2 text-blue-400 font-bold text-xs tracking-wider uppercase">
                <Box size={16} className="text-blue-400" />
                <span>TAMBAH PRODUK BARU</span>
              </div>
              <span className="text-slate-400">
                {isAddProductOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </span>
            </button>

            {isAddProductOpen && (
              <form onSubmit={handleSaveProduct} className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                      NAMA PRODUK (DISPLAY NAME)
                    </label>
                    <input
                      type="text"
                      required
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      placeholder={category === 'premium' ? 'Contoh: Netflix' : 'Contoh: WiFi Melati Net'}
                      className="w-full bg-[#080d19] border border-[#1e2a3f] focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 placeholder:text-slate-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                      PRODUK ID (unik / kode kategori)
                    </label>
                    <input
                      type="text"
                      value={newProductId}
                      onChange={(e) => setNewProductId(e.target.value)}
                      placeholder={category === 'premium' ? 'Contoh: netflix-prem' : 'Contoh: wifi-melati'}
                      className="w-full bg-[#080d19] border border-[#1e2a3f] focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                      DESKRIPSI
                    </label>
                    <input
                      type="text"
                      value={newProductDesc}
                      onChange={(e) => setNewProductDesc(e.target.value)}
                      placeholder={category === 'premium' ? 'Contoh: Layanan Streaming' : 'Contoh: Hotspot Warga Kecepatan Tinggi'}
                      className="w-full bg-[#080d19] border border-[#1e2a3f] focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 placeholder:text-slate-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#2563eb] hover:bg-blue-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                  >
                    <Save size={14} />
                    <span>Simpan Produk</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* SECTION: TAMBAH VARIANT BARU */}
          <div className="bg-[#0e1626] border border-[#1e293b] rounded-xl shadow-lg overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setIsAddVariantOpen(!isAddVariantOpen)}
              className="w-full flex items-center justify-between px-5 py-3 bg-[#0a1120] hover:bg-[#0f192e] transition-colors border-b border-[#1c273e] text-left cursor-pointer"
            >
              <div className="flex items-center gap-2 text-blue-400 font-bold text-xs tracking-wider uppercase">
                <Layers size={16} className="text-blue-400" />
                <span>TAMBAH VARIANT BARU</span>
              </div>
              <span className="text-slate-400">
                {isAddVariantOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </span>
            </button>

            {isAddVariantOpen && (
              <form onSubmit={handleSaveVariant} className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                      NAMA VARIANT
                    </label>
                    <input
                      type="text"
                      required
                      value={newVariantName}
                      onChange={(e) => setNewVariantName(e.target.value)}
                      placeholder={category === 'premium' ? 'Contoh: Netflix Premium 1 Bulan' : 'Contoh: Paket 24 Jam Unlimited'}
                      className="w-full bg-[#080d19] border border-[#1e2a3f] focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                      HARGA (IDR)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={newVariantPrice}
                      onChange={(e) => setNewVariantPrice(e.target.value)}
                      placeholder="50000"
                      className="w-full bg-[#080d19] border border-[#1e2a3f] focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                      KATEGORI (PRODUK)
                    </label>
                    <select
                      required
                      value={variantProductId}
                      onChange={(e) => setVariantProductId(e.target.value)}
                      className="w-full bg-[#080d19] border border-[#1e2a3f] focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none"
                    >
                      <option value="">-- Pilih Produk --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.id})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                      DESKRIPSI
                    </label>
                    <textarea
                      rows={2}
                      value={newVariantDesc}
                      onChange={(e) => setNewVariantDesc(e.target.value)}
                      placeholder="Deskripsi singkat..."
                      className="w-full bg-[#080d19] border border-[#1e2a3f] focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                      SNK (SYARAT & KETENTUAN)
                    </label>
                    <textarea
                      rows={2}
                      value={newVariantSnk}
                      onChange={(e) => setNewVariantSnk(e.target.value)}
                      placeholder="Syarat klaim garansi..."
                      className="w-full bg-[#080d19] border border-[#1e2a3f] focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 outline-none resize-none"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#2563eb] hover:bg-blue-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                  >
                    <Save size={14} />
                    <span>Simpan Variant</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. CARD: TAMBAH STOCK INDIVIDU (EXACT PHOTO 1:1)               */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#0e1626] border border-[#1e293b] rounded-xl p-5 shadow-lg">
        <div className="text-sm font-semibold text-slate-200 mb-4">
          Tambah Stock Individu
        </div>

        <form onSubmit={handleAddStockSingle}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            {/* PILIH PRODUCT */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                PILIH PRODUCT
              </label>
              <select
                required
                value={stockProductSingle}
                onChange={(e) => {
                  setStockProductSingle(e.target.value);
                  setStockVariantSingle('');
                }}
                className="w-full bg-[#080d19] border border-[#1e2a3f] focus:border-blue-500 text-slate-200 rounded-lg px-3 py-2 text-xs outline-none"
              >
                <option value="">-- Pilih Product --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* PILIH VARIANT */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                PILIH VARIANT
              </label>
              <select
                required
                disabled={!stockProductSingle}
                value={stockVariantSingle}
                onChange={(e) => setStockVariantSingle(e.target.value)}
                className="w-full bg-[#080d19] border border-[#1e2a3f] focus:border-blue-500 text-slate-200 rounded-lg px-3 py-2 text-xs outline-none disabled:opacity-40"
              >
                <option value="">-- Pilih Variant --</option>
                {singleProductVariants.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({formatRupiah(v.sellingPrice)}) - {v.voucherCodes?.length || v.stock || 0} stok
                  </option>
                ))}
              </select>
            </div>

            {/* INFO (DATA AKUN) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                INFO (DATA AKUN)
              </label>
              <input
                type="text"
                required
                value={stockAccountInfo}
                onChange={(e) => setStockAccountInfo(e.target.value)}
                placeholder="email|pass"
                className="w-full bg-[#080d19] border border-[#1e2a3f] focus:border-blue-500 text-slate-200 placeholder:text-slate-500 rounded-lg px-3 py-2 text-xs outline-none font-mono"
              />
            </div>

            {/* EXPIRED (HARI) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                EXPIRED (HARI)
              </label>
              <input
                type="number"
                min="1"
                value={stockExpirySingle}
                onChange={(e) => setStockExpirySingle(e.target.value)}
                placeholder="7"
                className="w-full bg-[#080d19] border border-[#1e2a3f] focus:border-blue-500 text-slate-200 placeholder:text-slate-500 rounded-lg px-3 py-2 text-xs outline-none font-mono"
              />
            </div>

            {/* TOMBOL ADD */}
            <div>
              <button
                type="submit"
                className="w-full bg-[#2563eb] hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg text-xs transition-colors cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. CARD: TAMBAH STOCK MASSAL (EXACT PHOTO 1:1)                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#0e1626] border border-[#1e293b] rounded-xl p-5 shadow-lg">
        <div className="text-sm font-semibold text-slate-200 mb-4">
          Tambah Stock Massal
        </div>

        <form onSubmit={handleAddStockBulk}>
          {/* Row 1: Pilih Product & Variant */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                PILIH PRODUCT
              </label>
              <select
                required
                value={stockProductBulk}
                onChange={(e) => {
                  setStockProductBulk(e.target.value);
                  setStockVariantBulk('');
                }}
                className="w-full bg-[#080d19] border border-[#1e2a3f] focus:border-blue-500 text-slate-200 rounded-lg px-3 py-2 text-xs outline-none"
              >
                <option value="">-- Pilih Product --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                PILIH VARIANT
              </label>
              <select
                required
                disabled={!stockProductBulk}
                value={stockVariantBulk}
                onChange={(e) => setStockVariantBulk(e.target.value)}
                className="w-full bg-[#080d19] border border-[#1e2a3f] focus:border-blue-500 text-slate-200 rounded-lg px-3 py-2 text-xs outline-none disabled:opacity-40"
              >
                <option value="">-- Pilih Variant --</option>
                {bulkProductVariants.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({formatRupiah(v.sellingPrice)}) - {v.voucherCodes?.length || v.stock || 0} stok
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Expired Hari */}
          <div className="mb-4">
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
              EXPIRED (HARI) — OPSIONAL
            </label>
            <input
              type="number"
              min="1"
              value={stockExpiryBulk}
              onChange={(e) => setStockExpiryBulk(e.target.value)}
              placeholder="Contoh: 30"
              className="w-full bg-[#080d19] border border-[#1e2a3f] focus:border-blue-500 text-slate-200 placeholder:text-slate-500 rounded-lg px-3 py-2 text-xs outline-none font-mono"
            />
          </div>

          {/* Row 3: Data Stock (1 baris = 1 stock) */}
          <div className="mb-4">
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
              DATA STOCK (1 BARIS = 1 STOCK)
            </label>
            <textarea
              rows={4}
              required
              value={stockBulkData}
              onChange={(e) => setStockBulkData(e.target.value)}
              placeholder={`user1|pass1\nuser2|pass2`}
              className="w-full bg-[#080d19] border border-[#1e2a3f] focus:border-blue-500 text-slate-200 placeholder:text-slate-500 rounded-lg p-3 text-xs outline-none font-mono resize-none leading-relaxed"
            />
          </div>

          {/* Row 4: Tombol Upload Massal */}
          <div>
            <button
              type="submit"
              className="bg-[#009b72] hover:bg-[#00b383] text-white font-semibold py-2.5 px-5 rounded-lg text-xs transition-colors cursor-pointer"
            >
              Upload Massal
            </button>
          </div>
        </form>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. INVENTORY OVERVIEW LIST                                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#0e1626] border border-[#1e293b] rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#1c273e]">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Database size={16} className="text-blue-400" />
              <span>Daftar Stok Tersimpan ({totalStockCount} Unit Ready)</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Voucher & akun yang siap dialokasikan otomatis ke pelanggan saat pembelian.
            </p>
          </div>
        </div>

        {products.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-xs">
            Belum ada produk terdaftar. Klik "+ Tambah Produk & Variant" di atas untuk membuat produk baru.
          </div>
        ) : (
          <div className="space-y-4">
            {products.map(prod => {
              const variants = prod.variants || [];
              const totalProdStock = variants.reduce((acc, v) => acc + (v.voucherCodes?.length || v.stock || 0), 0);

              return (
                <div
                  key={prod.id}
                  className="bg-[#080d19] border border-[#1c273e] rounded-xl p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="p-1 rounded bg-blue-500/10 text-blue-400">
                        <Box size={16} />
                      </span>
                      <div>
                        <span className="font-bold text-white text-xs">{prod.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono ml-2">ID: {prod.id}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-800/60 px-2 py-0.5 rounded-md">
                        {totalProdStock} Stok Ready
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(prod.id, prod.name)}
                        className="text-rose-400 hover:text-rose-300 p-1 hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                        title="Hapus Produk"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {variants.length === 0 ? (
                    <div className="text-[11px] text-slate-500 italic pl-6">
                      Belum ada varian untuk produk ini.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pl-2 sm:pl-6">
                      {variants.map(variant => {
                        const vStock = variant.voucherCodes?.length || variant.stock || 0;
                        return (
                          <div
                            key={variant.id}
                            className="bg-[#0e1626] border border-[#1e2a3f] rounded-xl p-3 space-y-2"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div>
                                <div className="font-bold text-slate-200 text-xs">{variant.name}</div>
                                <div className="text-emerald-400 font-mono font-bold text-xs">
                                  {formatRupiah(variant.sellingPrice)}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteVariant(prod.id, variant.id, variant.name)}
                                className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer"
                                title="Hapus Variant"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-[#1c273e] text-[10px]">
                              <span className={`font-bold font-mono px-1.5 py-0.5 rounded ${
                                vStock > 0 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                              }`}>
                                {vStock} Stok
                              </span>
                              <button
                                type="button"
                                onClick={() => setInspectingVariant({ product: prod, variant: variant })}
                                className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer underline hover:no-underline"
                              >
                                Lihat Data ({vStock})
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: LIHAT / KELOLA ISI STOK AKUN */}
      {inspectingVariant && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1626] border border-slate-700 rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-2xl max-h-[85vh] flex flex-col text-xs font-mono">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800 shrink-0">
              <div>
                <h4 className="text-sm font-bold text-white">
                  Stok: {inspectingVariant.product.name}
                </h4>
                <p className="text-[11px] text-slate-400">
                  Varian: <strong className="text-blue-400">{inspectingVariant.variant.name}</strong> • Total {inspectingVariant.variant.voucherCodes?.length || 0} unit
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingVariant(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {(!inspectingVariant.variant.voucherCodes || inspectingVariant.variant.voucherCodes.length === 0) ? (
                <div className="py-8 text-center text-slate-500">
                  Stok kosong. Gunakan form di atas untuk menambah stok.
                </div>
              ) : (
                inspectingVariant.variant.voucherCodes.map((codeItem, idx) => {
                  const isRevealed = revealedIndex === idx;
                  const isCopied = copiedIndex === idx;

                  return (
                    <div
                      key={idx}
                      className="bg-[#080d19] border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-slate-500 font-bold w-5">{idx + 1}.</span>
                        <div className="font-semibold text-slate-200 select-all truncate">
                          {isRevealed ? codeItem : codeItem.slice(0, 4) + '••••••••' + codeItem.slice(-3)}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setRevealedIndex(isRevealed ? null : idx)}
                          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                          title={isRevealed ? 'Sembunyikan' : 'Lihat'}
                        >
                          {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyStock(codeItem, idx)}
                          className="p-1 text-slate-400 hover:text-blue-400 rounded hover:bg-slate-800 cursor-pointer"
                          title="Salin Data"
                        >
                          {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStockItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 cursor-pointer"
                          title="Hapus Item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setInspectingVariant(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
