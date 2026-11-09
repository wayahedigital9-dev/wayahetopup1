import { Product } from '../types';

export interface PremiumStockStatus {
  isApi: boolean;
  isAvailable: boolean;
  stockCount: number | null; // null if unlimited API
  isUnlimited: boolean;
  badgeLabel: string;
  badgeStyle: {
    bg: string;
    text: string;
    border: string;
    dot: string;
  };
  pillText: string;
}

/**
 * Memeriksa apakah produk terhubung ke Supplier/API Key (Digiflazz / Provider API / SMM)
 * atau merupakan produk manual buatan admin.
 */
export function isProductConnectedToApi(product: Product): boolean {
  if (product.isManualCustom === true) return false;
  return Boolean(
    product.isDigiflazzSynced ||
    product.providerProductId ||
    product.providerCode ||
    product.supplierSku ||
    product.sellerName ||
    (product.sku && String(product.sku).toLowerCase().startsWith('df-')) ||
    (product.id && String(product.id).toLowerCase().startsWith('df-'))
  );
}

/**
 * Menghitung dan menentukan stok produk premium:
 * 1. Jika terhubung ke API Key -> Stok mengikuti live API (seller status, unlimited, stock upstream).
 * 2. Jika manual -> Stok mengikuti input admin (voucherCodes, varian, atau stok numerik admin).
 */
export function getPremiumProductStock(product: Product): PremiumStockStatus {
  const isApi = isProductConnectedToApi(product);

  // ── 1. PRODUK TERHUBUNG KE API KEY ──
  if (isApi) {
    const isSupplierActive = product.isActive !== false &&
      product.sellerProductStatus !== false &&
      product.buyerProductStatus !== false;

    const isUnlimited = Boolean(product.unlimitedStock) || (typeof product.stock === 'number' && product.stock >= 9000);
    const apiStock = typeof product.stock === 'number' ? Math.max(0, product.stock) : 0;
    const hasStock = isUnlimited || apiStock > 0;
    const isAvailable = isSupplierActive && hasStock;

    if (!isAvailable) {
      const reason = product.statusNote || 'Stok Kosong (API)';
      return {
        isApi: true,
        isAvailable: false,
        stockCount: 0,
        isUnlimited: false,
        badgeLabel: reason,
        badgeStyle: {
          bg: 'bg-rose-500/10 dark:bg-rose-500/15',
          text: 'text-rose-600 dark:text-rose-400',
          border: 'border-rose-300 dark:border-rose-500/30',
          dot: 'bg-rose-500',
        },
        pillText: 'Stok Kosong dari Server Provider',
      };
    }

    if (isUnlimited) {
      return {
        isApi: true,
        isAvailable: true,
        stockCount: null,
        isUnlimited: true,
        badgeLabel: 'Ready (API)',
        badgeStyle: {
          bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
          text: 'text-emerald-700 dark:text-emerald-300',
          border: 'border-emerald-300 dark:border-emerald-500/30',
          dot: 'bg-emerald-500',
        },
        pillText: 'Stok Melimpah (API)',
      };
    }

    const isLow = apiStock <= 5;
    return {
      isApi: true,
      isAvailable: true,
      stockCount: apiStock,
      isUnlimited: false,
      badgeLabel: isLow ? `Sisa ${apiStock} (API)` : `Stok: ${apiStock} (API)`,
      badgeStyle: isLow ? {
        bg: 'bg-amber-500/10 dark:bg-amber-500/15',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-300 dark:border-amber-500/30',
        dot: 'bg-amber-500',
      } : {
        bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-300 dark:border-emerald-500/30',
        dot: 'bg-emerald-500',
      },
      pillText: `Sisa ${apiStock} Akun (API)`,
    };
  }

  // ── 2. PRODUK MANUAL (STOK SESUAI YANG DIINPUT ADMIN) ──
  let manualStock = 0;
  if (product.hasVariants && product.variants && product.variants.length > 0) {
    manualStock = product.variants.reduce((sum, v) => {
      const count = (Array.isArray(v.voucherCodes) && v.voucherCodes.length > 0)
        ? v.voucherCodes.length
        : (Number.isFinite(Number(v.stock)) ? Math.max(0, Number(v.stock)) : 0);
      return sum + count;
    }, 0);
  } else {
    const codes = Array.isArray(product.voucherCodes) ? product.voucherCodes.length : 0;
    manualStock = codes > 0 ? codes : (Number.isFinite(Number(product.stock)) ? Math.max(0, Number(product.stock)) : 0);
  }

  const isAvailable = product.isActive !== false && manualStock > 0;

  if (!isAvailable) {
    return {
      isApi: false,
      isAvailable: false,
      stockCount: 0,
      isUnlimited: false,
      badgeLabel: 'Stok Habis',
      badgeStyle: {
        bg: 'bg-rose-500/10 dark:bg-rose-500/15',
        text: 'text-rose-600 dark:text-rose-400',
        border: 'border-rose-300 dark:border-rose-500/30',
        dot: 'bg-rose-500',
      },
      pillText: 'Stok Habis (Admin)',
    };
  }

  const isLow = manualStock <= 5;
  return {
    isApi: false,
    isAvailable: true,
    stockCount: manualStock,
    isUnlimited: false,
    badgeLabel: isLow ? `Sisa ${manualStock} Slot` : `Stok: ${manualStock} Akun`,
    badgeStyle: isLow ? {
      bg: 'bg-amber-500/10 dark:bg-amber-500/15',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-300 dark:border-amber-500/30',
      dot: 'bg-amber-500',
    } : {
      bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-300 dark:border-emerald-500/30',
      dot: 'bg-emerald-500',
    },
    pillText: `Tersedia ${manualStock} Akun`,
  };
}

