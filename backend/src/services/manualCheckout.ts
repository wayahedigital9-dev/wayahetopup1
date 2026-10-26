export class ManualCheckoutError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export function resolveManualCheckout(product: any, variantId?: string) {
  const category = String(product?.categoryId || '').toLowerCase();
  const manual = ['wifi', 'premium'].includes(category) && !product?.isDigiflazzSynced && !product?.sellerName && !product?.providerServiceId;
  if (!manual) return { product, variantId: undefined, variantName: undefined };
  if (product.isActive === false) throw new ManualCheckoutError('Produk tidak aktif.', 409);
  const variants = Array.isArray(product.variants) ? product.variants : [];
  let selected: any;
  if (variants.length) {
    selected = variants.find((v: any) => v.id === variantId);
    if (!selected || selected.isActive === false) throw new ManualCheckoutError('Pilih varian produk yang tersedia.', 400);
  } else if (variantId) {
    throw new ManualCheckoutError('Varian produk tidak ditemukan.', 400);
  }
  const stock = selected || product;
  const codes = Array.isArray(stock.voucherCodes) ? stock.voucherCodes.filter((value: unknown) => typeof value === 'string' && value.trim()) : [];
  if (!codes.length) throw new ManualCheckoutError('Stok produk kosong. Silakan pilih paket lain atau hubungi admin.', 409);
  const price = Number(stock.sellingPrice);
  if (!Number.isFinite(price) || price <= 0) throw new ManualCheckoutError('Harga produk belum valid.', 409);
  return {
    product: { ...product, sellingPrice: price, supplierPrice: stock.supplierPrice ?? product.supplierPrice,
      name: selected ? `${product.name} - ${selected.name}` : product.name,
      duration: stock.duration || product.duration, stock: codes.length },
    variantId: selected?.id, variantName: selected?.name,
  };
}
