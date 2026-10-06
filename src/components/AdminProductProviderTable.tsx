import React, { useState } from 'react';
import { 
  Package, 
  Search, 
  Filter, 
  RefreshCw, 
  Settings as SettingsIcon, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  DollarSign, 
  Layers, 
  Sparkles, 
  Eye, 
  EyeOff, 
  HelpCircle,
  ExternalLink,
  Save,
  X,
  Plus
} from 'lucide-react';
import { Product, ProductVariant, ApiProviderConfig } from '../types';
import { providerIntegrationService } from '../services/providerIntegrationService';
import { storage } from '../services/storage';
import { formatRupiah, formatDateWIB } from '../utils/operator';
import { triggerTopLoading } from './TopProgressBar';

interface AdminProductProviderTableProps {
  category: 'premium' | 'smm' | 'game' | 'gateway_tambahan';
  title: string;
  subtitle: string;
  onNavigateToSettings: (category: 'premium' | 'smm' | 'game' | 'gateway_tambahan') => void;
  onRefreshData: () => void;
  onShowToast: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export function AdminProductProviderTable({
  category,
  title,
  subtitle,
  onNavigateToSettings,
  onRefreshData,
  onShowToast,
}: AdminProductProviderTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'REVIEW' | 'DELETED'>('ALL');
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form state for manual product creation modal
  const [showAddManualModal, setShowAddManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    name: '',
    provider: category === 'premium' ? 'Netflix' : 'Custom',
    subCategory: category === 'premium' ? 'Streaming' : 'General',
    duration: '1 Bulan',
    accountType: 'Private',
    supplierPrice: 15000,
    sellingPrice: 25000,
    discountPrice: 35000,
    stock: 25,
    warranty: 'Garansi Penuh 30 Hari',
    description: '',
    iconUrl: '',
  });

  // Form state for editing product modal
  const [editName, setEditName] = useState('');
  const [editLocalCost, setEditLocalCost] = useState<number | undefined>(undefined);
  const [editSellingPrice, setEditSellingPrice] = useState<number>(0);
  const [editPriceMode, setEditPriceMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);

  const configs = providerIntegrationService.getApiConfigs();
  const currentConfig: ApiProviderConfig | undefined = configs[category];
  const allProducts = storage.getProducts();

  // Filter products for this specific category
  const categoryProducts = allProducts.filter(p => {
    if (category === 'smm') return p.categoryId === 'smm';
    if (category === 'premium') return p.categoryId === 'premium';
    if (category === 'game') return p.categoryId === 'game';
    return p.categoryId === 'gateway_tambahan';
  });

  // Apply filters and search
  const filteredProducts = categoryProducts.filter(p => {
    // Status filter
    if (statusFilter === 'ACTIVE' && (!p.isActive || p.isDeleted)) return false;
    if (statusFilter === 'INACTIVE' && (p.isActive || p.isDeleted)) return false;
    if (statusFilter === 'REVIEW' && (!p.needsPriceReview || p.isDeleted)) return false;
    if (statusFilter === 'DELETED' && !p.isDeleted) return false;
    if (statusFilter !== 'DELETED' && p.isDeleted) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchProvider = (p.provider || '').toLowerCase().includes(q);
      const matchCode = (p.providerProductId || String(p.smmServiceId || '') || p.id).toLowerCase().includes(q);
      const matchCat = (p.smmCategory || '').toLowerCase().includes(q);
      return matchName || matchProvider || matchCode || matchCat;
    }
    return true;
  });

  const isConfigured = Boolean(currentConfig && currentConfig.apiUrl);
  const totalCount = categoryProducts.filter(p => !p.isDeleted).length;
  const activeCount = categoryProducts.filter(p => p.isActive && !p.isDeleted).length;
  const reviewCount = categoryProducts.filter(p => p.needsPriceReview && !p.isDeleted).length;
  const deletedCount = categoryProducts.filter(p => p.isDeleted).length;

  const handleSync = async () => {
    setIsSyncing(true);
    triggerTopLoading.start();
    try {
      const res = await providerIntegrationService.syncCatalog(category);
      onShowToast('Sinkronisasi Berhasil', res.message, 'success');
      onRefreshData();
    } catch (err: any) {
      onShowToast('Sinkronisasi Gagal', err?.message || 'Gagal menyinkronkan produk', 'error');
    } finally {
      setIsSyncing(false);
      triggerTopLoading.done();
    }
  };

  const handleToggleProductActive = (p: Product) => {
    const updated = storage.updateProduct(p.id, { isActive: !p.isActive });
    if (updated) {
      onRefreshData();
      onShowToast(
        p.isActive ? 'Produk Dinonaktifkan' : 'Produk Diaktifkan',
        `${p.name} kini ${p.isActive ? 'tidak tampil' : 'aktif'} di toko.`,
        'info'
      );
    }
  };

  const handleSoftDelete = (p: Product) => {
    if (!window.confirm(`Yakin ingin menghapus produk "${p.name}" dari katalog website? Produk tidak akan muncul lagi di toko dan tidak akan diimpor ulang saat sinkronisasi.`)) return;
    const ok = storage.softDeleteProduct(p.id);
    if (ok) {
      onRefreshData();
      onShowToast('Produk Dihapus', `Produk "${p.name}" berhasil dihapus dan disimpan ke arsip.`, 'info');
    }
  };

  const handleRestore = (p: Product) => {
    const ok = storage.restoreProduct(p.id);
    if (ok) {
      onRefreshData();
      onShowToast('Produk Dipulihkan', `Produk "${p.name}" telah dipulihkan. Silakan tinjau harga dan aktifkan kembali.`, 'success');
    }
  };

  const handleResetToApiCost = (p: Product) => {
    const ok = storage.updateProduct(p.id, {
      localCostAdjustment: undefined,
    });
    if (ok) {
      onRefreshData();
      onShowToast('Modal Direset', `Modal lokal ${p.name} kembali mengikuti harga seller dari API.`, 'success');
    }
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setEditName(p.name);
    setEditLocalCost(p.localCostAdjustment);
    setEditSellingPrice(p.sellingPrice);
    setEditPriceMode(p.priceMode || 'AUTO');
    setEditIsActive(Boolean(p.isActive));
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    if (editSellingPrice <= 0) {
      onShowToast('Harga Tidak Valid', 'Harga jual harus berupa angka lebih besar dari 0.', 'error');
      return;
    }

    const sellerCost = editingProduct.localCostAdjustment || editingProduct.rawSellerPrice || editingProduct.supplierPrice;
    if (editSellingPrice < sellerCost) {
      if (!window.confirm(`Peringatan: Harga jual (${formatRupiah(editSellingPrice)}) lebih rendah daripada modal seller (${formatRupiah(sellerCost)}). Tetap simpan?`)) {
        return;
      }
    }

    const ok = storage.updateProduct(editingProduct.id, {
      name: editName.trim(),
      localCostAdjustment: editLocalCost,
      sellingPrice: editSellingPrice,
      ratePer1000: category === 'smm' ? editSellingPrice : undefined,
      priceMode: editPriceMode,
      isActive: editIsActive,
      needsPriceReview: false,
    });

    if (ok) {
      onRefreshData();
      onShowToast('Perubahan Disimpan', `Produk "${editName}" berhasil diperbarui.`, 'success');
      setEditingProduct(null);
    }
  };

  const handleSaveManualProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.name.trim()) {
      onShowToast('Validasi Gagal', 'Nama produk wajib diisi.', 'error');
      return;
    }
    if (manualForm.sellingPrice <= 0) {
      onShowToast('Validasi Gagal', 'Harga jual harus lebih besar dari Rp 0.', 'error');
      return;
    }

    const cleanCat = category || 'premium';
    const sku = `${cleanCat.toUpperCase().slice(0, 3)}-MAN-${Date.now().toString().slice(-6)}`;
    const newProduct: Product = {
      id: `prod-man-${Date.now()}`,
      categoryId: cleanCat,
      provider: manualForm.provider.trim() || 'Manual',
      name: manualForm.name.trim(),
      sku,
      digiflazzCategory: manualForm.subCategory,
      description: manualForm.description.trim() || `• Durasi: ${manualForm.duration}\n• Tipe: ${manualForm.accountType}\n• Garansi: ${manualForm.warranty}`,
      supplierPrice: Number(manualForm.supplierPrice) || 0,
      basePrice: Number(manualForm.supplierPrice) || 0,
      sellingPrice: Number(manualForm.sellingPrice),
      discountPrice: manualForm.discountPrice ? Number(manualForm.discountPrice) : undefined,
      duration: manualForm.duration,
      deliveryMethod: 'MANUAL',
      isActive: true,
      stock: Number(manualForm.stock) >= 0 ? Number(manualForm.stock) : 10,
      badge: manualForm.accountType || undefined,
      iconUrl: manualForm.iconUrl.trim() || undefined,
    };

    storage.addProduct(newProduct);
    onRefreshData();
    onShowToast('Produk Berhasil Ditambahkan', `Produk "${newProduct.name}" berhasil dibuat secara manual dan tampil di etalase.`, 'success');
    setShowAddManualModal(false);
    setManualForm({
      name: '',
      provider: category === 'premium' ? 'Netflix' : 'Custom',
      subCategory: category === 'premium' ? 'Streaming' : 'General',
      duration: '1 Bulan',
      accountType: 'Private',
      supplierPrice: 15000,
      sellingPrice: 25000,
      discountPrice: 35000,
      stock: 25,
      warranty: 'Garansi Penuh 30 Hari',
      description: '',
      iconUrl: '',
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn font-sans text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              {title}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {currentConfig?.providerName || 'Provider'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowAddManualModal(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-lg shadow-amber-500/25 border border-amber-400/40 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} className="stroke-[3]" />
            <span>Tambah Produk Manual</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToSettings(category)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <SettingsIcon size={14} />
            <span>Pengaturan API & Margin</span>
          </button>

          <button
            type="button"
            disabled={isSyncing}
            onClick={handleSync}
            className="px-4 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/25 border border-emerald-400/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Produk'}</span>
          </button>
        </div>
      </div>

      {/* Quick Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#0B101E] border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Produk</span>
          <span className="text-xl sm:text-2xl font-black text-white mt-1 block">{totalCount}</span>
          <span className="text-[10px] text-slate-500">Tersedia di katalog</span>
        </div>

        <div className="bg-[#0B101E] border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Tayang di Toko</span>
          <span className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 block">{activeCount}</span>
          <span className="text-[10px] text-emerald-500/80">Siap dibeli pelanggan</span>
        </div>

        <div className="bg-[#0B101E] border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Perlu Tinjau Harga</span>
          <span className={`text-xl sm:text-2xl font-black mt-1 block ${reviewCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
            {reviewCount}
          </span>
          <span className="text-[10px] text-slate-500">Modal API naik</span>
        </div>

        <div className="bg-[#0B101E] border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Arsip / Dihapus</span>
          <span className="text-xl sm:text-2xl font-black text-slate-400 mt-1 block">{deletedCount}</span>
          <span className="text-[10px] text-slate-500">Dikecualikan dari sinkron</span>
        </div>
      </div>

      {/* Empty State When Not Configured / No Products */}
      {categoryProducts.length === 0 && (
        <div className="bg-[#0B101E] border border-slate-800/80 rounded-3xl p-8 sm:p-12 text-center shadow-2xl space-y-4 my-6">
          <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/10">
            <Package size={32} />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-lg font-black text-white">
              Belum Ada Produk {title}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Hubungkan API untuk mengambil produk secara otomatis dari provider resmi dan menampilkannya di katalog toko.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToSettings(category)}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-extrabold rounded-2xl text-xs transition-all shadow-lg shadow-indigo-600/30 inline-flex items-center gap-2 cursor-pointer active:scale-95 border border-indigo-400/30"
          >
            <SettingsIcon size={15} />
            <span>Hubungkan API {title}</span>
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      {categoryProducts.length > 0 && (
        <div className="bg-[#0B101E] border border-slate-800/80 rounded-2xl p-3.5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama produk, provider, ID..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#141A29] border border-slate-700 text-white text-xs placeholder-slate-500 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Semua ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === 'ACTIVE' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Aktif ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === 'INACTIVE' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Nonaktif
            </button>
            {reviewCount > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter('REVIEW')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === 'REVIEW' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-rose-400 hover:text-white'
                }`}
              >
                Tinjau ({reviewCount})
              </button>
            )}
            {deletedCount > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter('DELETED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === 'DELETED' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-500 hover:text-white'
                }`}
              >
                Arsip ({deletedCount})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Table */}
      {categoryProducts.length > 0 && (
        <div className="bg-[#0B101E] border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#070B14] text-[11px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Produk</th>
                  <th className="py-3.5 px-3">Kode Provider</th>
                  <th className="py-3.5 px-3">Kategori / Platform</th>
                  <th className="py-3.5 px-3">Harga Seller API</th>
                  <th className="py-3.5 px-3">Modal Lokal</th>
                  <th className="py-3.5 px-3">Harga Jual</th>
                  <th className="py-3.5 px-3">Margin</th>
                  <th className="py-3.5 px-3">Mode</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredProducts.map((p) => {
                  const effectiveCost = p.localCostAdjustment || p.rawSellerPrice || p.supplierPrice;
                  const profit = p.sellingPrice - effectiveCost;
                  const isSmm = category === 'smm';
                  const isCustomModal = Boolean(p.localCostAdjustment && p.localCostAdjustment !== p.rawSellerPrice);

                  return (
                    <tr 
                      key={p.id} 
                      className={`hover:bg-slate-800/30 transition-colors ${
                        p.isDeleted ? 'opacity-50 bg-slate-900/40' : p.needsPriceReview ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      {/* Produk */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {p.iconUrl ? (
                            <img src={p.iconUrl} alt={p.name} className="w-8 h-8 rounded-lg object-cover shrink-0 border border-slate-700" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                              <Package size={16} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-bold text-white block truncate max-w-[200px]" title={p.name}>
                              {p.name}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {p.provider || currentConfig?.providerName}
                              {p.duration && ` • ${p.duration}`}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Kode Provider */}
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-300">
                        {p.smmServiceId || p.providerProductId || (p.id.replace(/^(prem-xav-|smm-xav-)/, ''))}
                      </td>

                      {/* Kategori */}
                      <td className="py-3 px-3 text-slate-300">
                        {p.smmCategory || p.categoryId}
                        {p.smmRefill && (
                          <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            Refill
                          </span>
                        )}
                      </td>

                      {/* Harga Seller API */}
                      <td className="py-3 px-3 text-slate-300 font-mono">
                        {formatRupiah(p.rawSellerPrice || p.supplierPrice)}
                        {isSmm && <span className="text-[9px] text-slate-500 block">/ 1.000 unit</span>}
                      </td>

                      {/* Modal Lokal */}
                      <td className="py-3 px-3 font-mono">
                        {isCustomModal ? (
                          <div>
                            <span className="text-amber-300 font-bold block">
                              {formatRupiah(p.localCostAdjustment || 0)}
                            </span>
                            <span className="text-[9px] text-amber-400/80 block">Disesuaikan manual</span>
                            <button
                              type="button"
                              onClick={() => handleResetToApiCost(p)}
                              className="text-[9px] text-indigo-400 hover:underline cursor-pointer block mt-0.5"
                            >
                              Reset ke API
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400">
                            {formatRupiah(p.rawSellerPrice || p.supplierPrice)}
                          </span>
                        )}
                      </td>

                      {/* Harga Jual Saya */}
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                        {formatRupiah(p.sellingPrice)}
                        {isSmm && <span className="text-[9px] text-slate-500 block">/ 1.000 unit</span>}
                      </td>

                      {/* Margin Keuntungan */}
                      <td className="py-3 px-3 font-mono">
                        <span className={profit >= 0 ? 'text-teal-400 font-semibold' : 'text-rose-400 font-bold'}>
                          {profit >= 0 ? `+${formatRupiah(profit)}` : `-${formatRupiah(Math.abs(profit))}`}
                        </span>
                      </td>

                      {/* Mode Harga */}
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          p.priceMode === 'MANUAL'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        }`}>
                          {p.priceMode || 'AUTO'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        {p.isDeleted ? (
                          <span className="text-rose-400 text-[10px] font-bold flex items-center gap-1">
                            <XCircle size={12} /> Dihapus
                          </span>
                        ) : p.needsPriceReview ? (
                          <span className="text-amber-400 text-[10px] font-bold flex items-center gap-1">
                            <AlertTriangle size={12} /> Tinjau Harga
                          </span>
                        ) : p.isActive ? (
                          <span className="text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle2 size={12} /> Aktif
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px] font-bold flex items-center gap-1">
                            <XCircle size={12} /> Nonaktif
                          </span>
                        )}
                      </td>

                      {/* Tindakan */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {p.isDeleted ? (
                            <button
                              type="button"
                              onClick={() => handleRestore(p)}
                              className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              title="Pulihkan Produk"
                            >
                              <RotateCcw size={12} /> Pulihkan
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(p)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-500/20 text-slate-300 hover:text-indigo-300 transition-colors cursor-pointer"
                                title="Edit Produk & Harga"
                              >
                                <Edit3 size={13} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleProductActive(p)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  p.isActive 
                                    ? 'bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300' 
                                    : 'bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300'
                                }`}
                                title={p.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                              >
                                {p.isActive ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSoftDelete(p)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Hapus Produk (Arsip)"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0B101E] rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-800 text-slate-100">
            <div className="px-6 py-4 bg-[#070B14] border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white">Edit Produk & Harga</h3>
                <p className="text-xs text-slate-400">ID Provider: {editingProduct.providerProductId || editingProduct.smmServiceId || editingProduct.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {/* Product Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">Nama Tampilan Produk</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#141A29] border border-slate-700 text-white text-xs font-semibold focus:border-indigo-500"
                />
              </div>

              {/* Reference API Seller Price (Read only) */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Harga Asli Seller (API):</span>
                <span className="font-mono font-bold text-slate-200">
                  {formatRupiah(editingProduct.rawSellerPrice || editingProduct.supplierPrice)}
                  {category === 'smm' && ' / 1.000'}
                </span>
              </div>

              {/* Local Cost Adjustment (Modal Lokal) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Modal Lokal (Penyesuaian Admin)</span>
                  <span className="text-[10px] text-slate-500">Opsional</span>
                </label>
                <input
                  type="number"
                  value={editLocalCost !== undefined ? editLocalCost : ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : undefined;
                    setEditLocalCost(val);
                  }}
                  placeholder={`Kosongkan untuk mengikuti harga API (${formatRupiah(editingProduct.rawSellerPrice || editingProduct.supplierPrice)})`}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#141A29] border border-slate-700 text-white text-xs font-mono focus:border-indigo-500"
                />
              </div>

              {/* Selling Price */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Harga Jual Saya {category === 'smm' ? '(Tarif per 1.000 unit)' : ''}</span>
                  <span className="text-[10px] text-emerald-400 font-semibold">Tampil di Toko</span>
                </label>
                <input
                  type="number"
                  required
                  value={editSellingPrice}
                  onChange={(e) => {
                    setEditSellingPrice(Number(e.target.value));
                    setEditPriceMode('MANUAL'); // PRD 6.2: Mengedit harga jual langsung mengubah produk ke mode Manual
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#141A29] border border-slate-700 text-white text-xs font-mono font-bold focus:border-indigo-500 text-emerald-400"
                />
              </div>

              {/* Price Mode */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">Mode Penetapan Harga</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditPriceMode('AUTO');
                      // Hitung ulang harga otomatis jika kembali ke auto
                      const cost = editLocalCost || editingProduct.rawSellerPrice || editingProduct.supplierPrice;
                      const calculated = providerIntegrationService.calculateSellingPrice(cost, currentConfig);
                      setEditSellingPrice(calculated);
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      editPriceMode === 'AUTO'
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Otomatis (Margin Aturan)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPriceMode('MANUAL')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      editPriceMode === 'MANUAL'
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Manual (Harga Tetap)
                  </button>
                </div>
              </div>

              {/* Active Toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-700"
                  />
                  <span className="text-xs text-slate-300 font-semibold">
                    Tayangkan produk ini di Toko (Pelanggan dapat membeli)
                  </span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TAMBAH PRODUK SECARA MANUAL */}
      {showAddManualModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#0D1527] border border-amber-500/40 rounded-3xl max-w-xl w-full p-5 sm:p-6 space-y-4 shadow-2xl text-slate-100 my-8">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-white leading-tight">
                    Tambah Produk Manual {category === 'premium' ? 'Aplikasi Premium' : title}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Input produk langsung tanpa tergantung API eksternal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddManualModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveManualProduct} className="space-y-4 text-xs">
              {/* Preset Pilihan Cepat */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                  Preset Cepat (Klik untuk isi otomatis):
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { prov: 'Netflix', sub: 'Streaming', name: 'Netflix Premium UHD 4K (1 Bulan Private)', cost: 18000, price: 24500, dur: '1 Bulan', icon: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=200&q=80' },
                    { prov: 'Spotify', sub: 'Musik', name: 'Spotify Premium Individual (1 Bulan)', cost: 12000, price: 19000, dur: '1 Bulan', icon: 'https://images.unsplash.com/photo-1614680376593-902f749f7ffc?auto=format&fit=crop&w=200&q=80' },
                    { prov: 'Canva', sub: 'Editing & Desain', name: 'Canva Pro Edu Lifetime Private', cost: 10000, price: 19000, dur: 'Lifetime', icon: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&q=80' },
                    { prov: 'YouTube', sub: 'Streaming', name: 'YouTube Premium No Ads (1 Bulan)', cost: 9000, price: 15000, dur: '1 Bulan', icon: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=200&q=80' },
                    { prov: 'ChatGPT', sub: 'AI & Tools', name: 'ChatGPT Plus Shared (1 Bulan)', cost: 40000, price: 65000, dur: '1 Bulan', icon: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=200&q=80' },
                    { prov: 'Disney+', sub: 'Streaming', name: 'Disney+ Hotstar Premium (1 Bulan)', cost: 18000, price: 25000, dur: '1 Bulan', icon: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=200&q=80' },
                    { prov: 'CapCut', sub: 'Editing & Desain', name: 'CapCut Pro 1 Bulan Private', cost: 15000, price: 24000, dur: '1 Bulan', icon: '' },
                    { prov: 'Viu', sub: 'Streaming', name: 'Viu Premium VIP 1 Bulan Private', cost: 8000, price: 14000, dur: '1 Bulan', icon: '' },
                  ].map((preset) => (
                    <button
                      key={preset.prov}
                      type="button"
                      onClick={() => {
                        setManualForm(prev => ({
                          ...prev,
                          provider: preset.prov,
                          subCategory: preset.sub,
                          name: preset.name,
                          supplierPrice: preset.cost,
                          sellingPrice: preset.price,
                          discountPrice: preset.price + 10000,
                          duration: preset.dur,
                          iconUrl: preset.icon,
                        }));
                      }}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer font-bold ${
                        manualForm.provider.toLowerCase() === preset.prov.toLowerCase()
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-xs'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {preset.prov}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid Baris 1: Provider & Subkategori */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Provider / Platform *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Netflix, Spotify, Canva"
                    value={manualForm.provider}
                    onChange={(e) => setManualForm({ ...manualForm, provider: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-bold focus:border-amber-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Kategori / Subkategori
                  </label>
                  <select
                    value={manualForm.subCategory}
                    onChange={(e) => setManualForm({ ...manualForm, subCategory: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-bold focus:border-amber-500 focus:outline-hidden"
                  >
                    <option value="Streaming">Streaming Film & Video</option>
                    <option value="Musik">Musik & Audio</option>
                    <option value="Editing & Desain">Editing & Desain Grafis</option>
                    <option value="AI & Tools">AI & Developer Tools</option>
                    <option value="VPN & Security">VPN & Keamanan</option>
                    <option value="Akun Game">Akun Game & Hiburan</option>
                    <option value="Edukasi">Edukasi & Belajar</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </div>

              {/* Nama Produk */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Nama Produk Lengkap *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Netflix Premium UHD 4K (1 Bulan Private Profile)"
                  value={manualForm.name}
                  onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-bold focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Grid Baris 2: Durasi, Tipe Akun, Stok */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Durasi</label>
                  <input
                    type="text"
                    value={manualForm.duration}
                    onChange={(e) => setManualForm({ ...manualForm, duration: e.target.value })}
                    placeholder="1 Bulan / 1 Tahun"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:border-amber-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Tipe / Badge</label>
                  <input
                    type="text"
                    value={manualForm.accountType}
                    onChange={(e) => setManualForm({ ...manualForm, accountType: e.target.value })}
                    placeholder="Private / Shared / 4K"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:border-amber-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Stok Akun</label>
                  <input
                    type="number"
                    min="0"
                    value={manualForm.stock}
                    onChange={(e) => setManualForm({ ...manualForm, stock: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-bold focus:border-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Grid Baris 3: Modal, Harga Jual, Harga Coret */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Harga Modal (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={manualForm.supplierPrice}
                    onChange={(e) => setManualForm({ ...manualForm, supplierPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-mono focus:border-amber-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-400 mb-1">Harga Jual (Rp) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={manualForm.sellingPrice}
                    onChange={(e) => setManualForm({ ...manualForm, sellingPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-emerald-500/60 text-emerald-300 font-bold font-mono focus:border-emerald-400 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Harga Coret (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={manualForm.discountPrice || ''}
                    onChange={(e) => setManualForm({ ...manualForm, discountPrice: Number(e.target.value) })}
                    placeholder="Opsional"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 font-mono focus:border-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Deskripsi & Garansi */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Catatan / Format / Garansi
                </label>
                <textarea
                  rows={2}
                  value={manualForm.description}
                  onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                  placeholder="Contoh: Akun Private 1 Profile PIN. Garansi full 30 hari replace baru jika ada kendala."
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Icon URL */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  URL Icon / Logo Gambar (Opsional)
                </label>
                <input
                  type="text"
                  value={manualForm.iconUrl}
                  onChange={(e) => setManualForm({ ...manualForm, iconUrl: e.target.value })}
                  placeholder="https://... atau biarkan kosong"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 font-mono text-[11px] focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Tombol Simpan */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddManualModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-lg shadow-amber-500/25 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus size={15} className="stroke-[3]" />
                  <span>Tambahkan ke Katalog</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
