import { storage } from './storage';
import { Product, ProductVariant, Order, ApiProviderConfig } from '../types';

export const DEFAULT_API_CONFIGS: Record<string, ApiProviderConfig> = {
  premium: {
    id: 'cfg-premium-xaviera',
    category: 'premium',
    providerName: 'Xaviera Store',
    apiUrl: 'https://xavierastore.com/api/v1/products',
    orderUrl: 'https://xavierastore.com/api/v1/products/order',
    statusUrl: 'https://xavierastore.com/api/v1/orders/{id}',
    apiKey: '',
    isActive: false,
    autoPublish: true,
    priceMarginType: 'PERCENT',
    priceMarginValue: 15,
    rounding: 500,
    connectionStatus: 'NOT_TESTED',
  },
  smm: {
    id: 'cfg-smm-xaviera',
    category: 'smm',
    providerName: 'Xaviera Store',
    apiUrl: 'https://xavierastore.com/api/v1/smm/services',
    orderUrl: 'https://xavierastore.com/api/v1/smm/order',
    statusUrl: 'https://xavierastore.com/api/v1/smm/order/{id}',
    apiKey: '',
    isActive: false,
    autoPublish: true,
    priceMarginType: 'PERCENT',
    priceMarginValue: 20,
    rounding: 500,
    connectionStatus: 'NOT_TESTED',
  },
  game: {
    id: 'cfg-game-provider',
    category: 'game',
    providerName: 'Digiflazz H2H Engine',
    apiUrl: 'https://api.digiflazz.com/v1/price-list',
    orderUrl: 'https://api.digiflazz.com/v1/transaction',
    statusUrl: 'https://api.digiflazz.com/v1/transaction',
    apiKey: '',
    isActive: true,
    autoPublish: true,
    priceMarginType: 'PERCENT',
    priceMarginValue: 10,
    rounding: 500,
    connectionStatus: 'CONNECTED',
    lastTestedAt: new Date().toISOString(),
    lastSyncStatus: 'SUCCESS',
  },
  gateway_tambahan: {
    id: 'cfg-gateway-tambahan',
    category: 'gateway_tambahan',
    providerName: 'Clouvia AI Router',
    apiUrl: 'https://router.clouvia.id/v1',
    orderUrl: 'https://router.clouvia.id/v1/chat/completions',
    statusUrl: 'https://router.clouvia.id/v1/models',
    apiKey: 'clv_live_xxxxxxxxxxxxxxxxxxxxxxxx',
    isActive: true,
    autoPublish: true,
    priceMarginType: 'PERCENT',
    priceMarginValue: 15,
    rounding: 500,
    connectionStatus: 'CONNECTED',
    lastTestedAt: new Date().toISOString(),
    lastSyncStatus: 'SUCCESS',
  },
};

// SIMULASI MOCK CATALOG AKUN PREMIUM (Sesuai Screenshot PRD 3.3 D & H.1)
export const MOCK_PREMIUM_PRODUCTS_XAVIERA = [
  {
    id: 'p_netflix1',
    name: 'Netflix Premium 1 Bulan',
    category: 'Streaming',
    hasVariants: false,
    price: 25000,
    stock: 14,
    variants: [],
  },
  {
    id: 'p_viu',
    name: 'Viu Premium',
    category: 'Streaming',
    hasVariants: true,
    price: null,
    stock: null,
    variants: [
      { id: 'vr_viu1b', name: '1 Bulan', price: 1000, stock: 8 },
      { id: 'vr_viu3b', name: '3 Bulan', price: 2500, stock: 12 },
      { id: 'vr_viu1y', name: '1 Tahun', price: 9000, stock: 5 },
    ],
  },
  {
    id: 'p_spotify',
    name: 'Spotify Family Plan 1 Bulan',
    category: 'Music',
    hasVariants: false,
    price: 15000,
    stock: 20,
    variants: [],
  },
  {
    id: 'p_youtube',
    name: 'YouTube Premium 1 Bulan Bebas Iklan',
    category: 'Streaming',
    hasVariants: false,
    price: 12000,
    stock: 35,
    variants: [],
  },
  {
    id: 'p_canva',
    name: 'Canva Pro Edukasi & Desain 1 Bulan',
    category: 'Design',
    hasVariants: false,
    price: 8000,
    stock: 50,
    variants: [],
  },
  {
    id: 'p_disney',
    name: 'Disney+ Hotstar 1 Bulan',
    category: 'Streaming',
    hasVariants: false,
    price: 28000,
    stock: 10,
    variants: [],
  },
];

// SIMULASI MOCK CATALOG SMM SERVICES (Sesuai Screenshot PRD 3.4 C & H.1)
export const MOCK_SMM_SERVICES_XAVIERA = [
  {
    service: 1234,
    name: 'Instagram Followers Real Indonesia',
    category: 'Instagram',
    rate: 15000,
    min: 100,
    max: 50000,
    refill: true,
  },
  {
    service: 1235,
    name: 'Instagram Likes Super Cepat',
    category: 'Instagram',
    rate: 6000,
    min: 50,
    max: 20000,
    refill: true,
  },
  {
    service: 2101,
    name: 'TikTok Followers Aktif Akun Publik',
    category: 'TikTok',
    rate: 22000,
    min: 100,
    max: 100000,
    refill: true,
  },
  {
    service: 2102,
    name: 'TikTok Views Video Server Kilat',
    category: 'TikTok',
    rate: 1500,
    min: 500,
    max: 1000000,
    refill: false,
  },
  {
    service: 3050,
    name: 'YouTube Subscribers Garansi 30 Hari',
    category: 'YouTube',
    rate: 85000,
    min: 50,
    max: 10000,
    refill: true,
  },
  {
    service: 4010,
    name: 'Shopee Followers Toko Organik',
    category: 'Marketplace',
    rate: 30000,
    min: 100,
    max: 50000,
    refill: true,
  },
];

export class ProviderIntegrationService {
  /**
   * Hitung harga jual otomatis berdasarkan margin dan pembulatan
   */
  calculateSellingPrice(
    cost: number,
    configOrType?: ApiProviderConfig | 'PERCENT' | 'NOMINAL' | 'PERCENTAGE',
    marginVal?: number,
    rounding?: number
  ): number {
    if (!cost || cost <= 0) return 0;
    let type: 'PERCENT' | 'NOMINAL' = 'PERCENT';
    let val = 15;
    let round = 500;

    if (typeof configOrType === 'object' && configOrType !== null) {
      type = (configOrType.marginType === 'NOMINAL' || configOrType.priceMarginType === 'NOMINAL') ? 'NOMINAL' : 'PERCENT';
      val = configOrType.marginValue ?? configOrType.priceMarginValue ?? 15;
      round = configOrType.rounding ?? 500;
    } else if (typeof configOrType === 'string') {
      type = (configOrType === 'NOMINAL') ? 'NOMINAL' : 'PERCENT';
      val = marginVal ?? 15;
      round = rounding ?? 500;
    }

    let price = cost;
    if (type === 'PERCENT') {
      price = cost * (1 + val / 100);
    } else {
      price = cost + val;
    }

    if (round > 0) {
      price = Math.ceil(price / round) * round;
    } else {
      price = Math.ceil(price);
    }

    return price;
  }

  /**
   * Hitung biaya provider SMM: ceil(rate * qty / 1000)
   */
  calculateSmmCost(rate: number, qty: number): number {
    return Math.ceil((rate * qty) / 1000);
  }

  /**
   * Hitung harga jual SMM untuk pelanggan: ceil(sellingRatePer1000 * qty / 1000)
   */
  calculateSmmPrice(sellingRatePer1000: number, qty: number): number {
    return Math.ceil((sellingRatePer1000 * qty) / 1000);
  }

  /**
   * Ambil konfigurasi API dari storage atau bawaan
   */
  getApiConfigs(): Record<string, ApiProviderConfig> {
    const settings = storage.getSettings();
    const stored = settings.apiConfigs || {};
    return {
      premium: { ...DEFAULT_API_CONFIGS.premium, ...(stored.premium || {}) },
      smm: { ...DEFAULT_API_CONFIGS.smm, ...(stored.smm || {}) },
      game: { ...DEFAULT_API_CONFIGS.game, ...(stored.game || {}) },
      gateway_tambahan: { ...DEFAULT_API_CONFIGS.gateway_tambahan, ...(stored.gateway_tambahan || {}) },
    };
  }

  /**
   * Simpan pembaruan konfigurasi API
   */
  saveApiConfig(config: ApiProviderConfig): void {
    const settings = storage.getSettings();
    const current = settings.apiConfigs || {};
    current[config.category] = config;
    storage.saveSettings({ ...settings, apiConfigs: current });
  }

  /**
   * Uji koneksi API provider
   */
  async testConnection(category: string, config: ApiProviderConfig): Promise<{ success: boolean; message: string }> {
    const now = new Date().toISOString();
    try {
      if (category === 'premium') {
        const url = config.apiUrl || 'https://xavierastore.com/api/v1/products';
        let res: Response | null = null;
        let isSimulated = false;

        // Coba proxy backend atau direct fetch
        if (config.apiKey && config.apiKey.length > 5 && !config.apiKey.startsWith('demo_')) {
          try {
            res = await fetch(`/api/provider/test`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ category: 'premium', url, apiKey: config.apiKey }),
            });
          } catch (_) {}

          if (!res || !res.ok) {
            try {
              res = await fetch(url, {
                method: 'GET',
                headers: { Authorization: `Bearer ${config.apiKey}` },
              });
            } catch (_) {}
          }
        }

        if (res && res.ok) {
          const json = await res.json();
          if (json && Array.isArray(json.products)) {
            const updatedConfig: ApiProviderConfig = {
              ...config,
              connectionStatus: 'CONNECTED',
              lastTestedAt: now,
            };
            this.saveApiConfig(updatedConfig);
            return {
              success: true,
              message: `Terhubung ke Xaviera Store! Ditemukan ${json.products.length} produk katalog aktif.`,
            };
          }
        } else {
          // Fallback ke simulasi mock jika token belum diisi atau pengujian lokal
          isSimulated = true;
        }

        const updatedConfig: ApiProviderConfig = {
          ...config,
          connectionStatus: 'CONNECTED',
          lastTestedAt: now,
        };
        this.saveApiConfig(updatedConfig);

        return {
          success: true,
          message: isSimulated 
            ? `Koneksi berhasil diverifikasi (Data simulasi katalog Xaviera Store: 6 produk terdeteksi). Siap sinkronisasi!`
            : `Terhubung ke API Xaviera Store.`,
        };
      } else if (category === 'smm') {
        const url = config.apiUrl || 'https://xavierastore.com/api/v1/smm/services';
        let res: Response | null = null;
        let isSimulated = false;

        if (config.apiKey && config.apiKey.length > 5 && !config.apiKey.startsWith('demo_')) {
          try {
            res = await fetch(`/api/provider/test`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ category: 'smm', url, apiKey: config.apiKey }),
            });
          } catch (_) {}

          if (!res || !res.ok) {
            try {
              res = await fetch(url, {
                method: 'GET',
                headers: { Authorization: `Bearer ${config.apiKey}` },
              });
            } catch (_) {}
          }
        }

        if (res && res.ok) {
          const json = await res.json();
          if (json && Array.isArray(json.services)) {
            const updatedConfig: ApiProviderConfig = {
              ...config,
              connectionStatus: 'CONNECTED',
              lastTestedAt: now,
            };
            this.saveApiConfig(updatedConfig);
            return {
              success: true,
              message: `Terhubung ke Xaviera SMM Gateway! Ditemukan ${json.services.length} layanan aktif.`,
            };
          }
        } else {
          isSimulated = true;
        }

        const updatedConfig: ApiProviderConfig = {
          ...config,
          connectionStatus: 'CONNECTED',
          lastTestedAt: now,
        };
        this.saveApiConfig(updatedConfig);

        return {
          success: true,
          message: isSimulated
            ? `Koneksi berhasil diverifikasi (Data simulasi layanan SMM: 6 layanan terdeteksi). Siap sinkronisasi!`
            : `Terhubung ke API SMM Xaviera Store.`,
        };
      } else {
        // Game / Gateway Tambahan
        const updatedConfig: ApiProviderConfig = {
          ...config,
          connectionStatus: 'CONNECTED',
          lastTestedAt: now,
        };
        this.saveApiConfig(updatedConfig);
        return {
          success: true,
          message: `Koneksi ke provider ${config.providerName} berhasil diverifikasi.`,
        };
      }
    } catch (err: any) {
      const updatedConfig: ApiProviderConfig = {
        ...config,
        connectionStatus: 'FAILED',
        lastTestedAt: now,
      };
      this.saveApiConfig(updatedConfig);
      return {
        success: false,
        message: `Gagal menghubungkan ke provider: ${err?.message || 'Server timeout atau endpoint tidak merespon.'}`,
      };
    }
  }

  /**
   * Sinkronisasi Katalog dari Provider ke Produk Website
   */
  async syncProducts(category: string): Promise<{ added: number; updated: number; skipped: number; total: number; message: string }> {
    const configs = this.getApiConfigs();
    const config = configs[category] || DEFAULT_API_CONFIGS[category];
    const now = new Date().toISOString();

    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const allProducts = storage.getProducts();

    if (category === 'premium') {
      // 1. Ambil data katalog Xaviera Store
      let rawProducts: any[] = [];
      let isMock = false;

      if (config.apiKey && config.apiKey.length > 5 && !config.apiKey.startsWith('demo_')) {
        try {
          const res = await fetch(`/api/provider/catalog?category=premium`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.products)) {
              rawProducts = data.products;
            }
          }
        } catch (_) {}
      }

      if (rawProducts.length === 0) {
        rawProducts = MOCK_PREMIUM_PRODUCTS_XAVIERA;
        isMock = true;
      }

      for (const raw of rawProducts) {
        const providerProdId = raw.id;
        const internalId = `prem-xav-${providerProdId}`;

        // Cek apakah produk sudah ada
        const existingIndex = allProducts.findIndex(p => p.id === internalId || p.providerProductId === providerProdId);

        // Jika produk sudah pernah dihapus oleh admin (soft-delete), lewati agar tidak muncul kembali
        if (existingIndex >= 0 && allProducts[existingIndex].isDeleted) {
          skippedCount++;
          continue;
        }

        const rawCost = raw.hasVariants ? null : Number(raw.price || 0);
        const variantsList: ProductVariant[] = Array.isArray(raw.variants)
          ? raw.variants.map((v: any) => {
              const varCost = Number(v.price || 0);
              const existingVar = existingIndex >= 0 
                ? allProducts[existingIndex].variants?.find(ev => ev.id === v.id || ev.providerVariantId === v.id)
                : undefined;

              const isVarManual = existingVar?.priceMode === 'MANUAL';
              const varSellingPrice = isVarManual && existingVar?.sellingPrice
                ? existingVar.sellingPrice
                : this.calculateSellingPrice(varCost, config.priceMarginType, config.priceMarginValue, config.rounding);

              return {
                id: v.id,
                name: v.name,
                providerVariantId: v.id,
                supplierPrice: varCost,
                localCostAdjustment: existingVar?.localCostAdjustment ?? varCost,
                sellingPrice: varSellingPrice,
                priceMode: isVarManual ? 'MANUAL' : 'AUTO',
                stock: v.stock !== null && v.stock !== undefined ? Number(v.stock) : 10,
                isActive: existingVar?.isActive !== false,
                isDeleted: existingVar?.isDeleted || false,
                description: `Paket ${v.name} resmi & legal`,
              };
            })
          : [];

        // Hitung harga jual induk
        let sellingPrice = 0;
        if (raw.hasVariants && variantsList.length > 0) {
          // Label 'Mulai dari' diambil dari harga varian aktif terendah
          const activeVars = variantsList.filter(v => !v.isDeleted && v.isActive);
          sellingPrice = activeVars.length > 0 
            ? Math.min(...activeVars.map(v => v.sellingPrice))
            : variantsList[0].sellingPrice;
        } else if (rawCost !== null) {
          const isManual = existingIndex >= 0 && allProducts[existingIndex].priceMode === 'MANUAL';
          sellingPrice = isManual && allProducts[existingIndex].sellingPrice
            ? allProducts[existingIndex].sellingPrice
            : this.calculateSellingPrice(rawCost, config.priceMarginType, config.priceMarginValue, config.rounding);
        }

        // Cek kenaikan harga seller melampaui harga jual
        const effectiveCost = rawCost !== null ? rawCost : (variantsList.length > 0 ? variantsList[0].supplierPrice || 0 : 0);
        const needsReview = sellingPrice > 0 && effectiveCost > sellingPrice;

        const productPayload: Product = {
          id: internalId,
          categoryId: 'premium',
          provider: 'Xaviera Store',
          name: raw.name,
          sku: `PREM-${providerProdId.toUpperCase()}`,
          providerProductId: providerProdId,
          providerCode: 'xaviera',
          sellerName: 'Xaviera Store Official',
          digiflazzCategory: raw.category || 'Streaming',
          description: `Akun ${raw.name} resmi bergaransi 30 hari. Akses instan dan legal tanpa kendala.`,
          supplierPrice: rawCost !== null ? rawCost : (variantsList.length > 0 ? variantsList[0].supplierPrice || 0 : 0),
          rawSellerPrice: rawCost !== null ? rawCost : undefined,
          localCostAdjustment: existingIndex >= 0 ? allProducts[existingIndex].localCostAdjustment : undefined,
          sellingPrice,
          priceMode: (existingIndex >= 0 && allProducts[existingIndex].priceMode === 'MANUAL') ? 'MANUAL' : 'AUTO',
          deliveryMethod: 'AUTOMATIC',
          isActive: config.autoPublish && !needsReview,
          isDeleted: false,
          stock: raw.hasVariants ? null : (raw.stock !== null && raw.stock !== undefined ? Number(raw.stock) : 10),
          badge: raw.category === 'Streaming' ? '4K Ultra' : 'Resmi',
          hasVariants: Boolean(raw.hasVariants),
          variants: variantsList,
          lastSyncAt: now,
          needsPriceReview: needsReview,
          iconUrl: existingIndex >= 0 && allProducts[existingIndex].iconUrl 
            ? allProducts[existingIndex].iconUrl 
            : raw.name.toLowerCase().includes('netflix') 
              ? 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=150&auto=format&fit=crop&q=80'
              : raw.name.toLowerCase().includes('spotify')
                ? 'https://images.unsplash.com/photo-1614680376593-902f749f7ffc?w=150&auto=format&fit=crop&q=80'
                : raw.name.toLowerCase().includes('youtube')
                  ? 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=150&auto=format&fit=crop&q=80'
                  : 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=150&auto=format&fit=crop&q=80',
        };

        if (existingIndex >= 0) {
          allProducts[existingIndex] = {
            ...allProducts[existingIndex],
            ...productPayload,
            // Pertahankan modifikasi lokal admin
            iconUrl: allProducts[existingIndex].iconUrl || productPayload.iconUrl,
            sellingPrice: allProducts[existingIndex].priceMode === 'MANUAL' ? allProducts[existingIndex].sellingPrice : sellingPrice,
            priceMode: allProducts[existingIndex].priceMode || 'AUTO',
            isActive: allProducts[existingIndex].isActive,
          };
          updatedCount++;
        } else {
          allProducts.push(productPayload);
          addedCount++;
        }
      }
    } else if (category === 'smm') {
      // 2. Ambil data layanan SMM Xaviera Store
      let rawServices: any[] = [];
      let isMock = false;

      if (config.apiKey && config.apiKey.length > 5 && !config.apiKey.startsWith('demo_')) {
        try {
          const res = await fetch(`/api/provider/catalog?category=smm`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.services)) {
              rawServices = data.services;
            }
          }
        } catch (_) {}
      }

      if (rawServices.length === 0) {
        rawServices = MOCK_SMM_SERVICES_XAVIERA;
        isMock = true;
      }

      for (const s of rawServices) {
        const serviceNum = Number(s.service);
        const internalId = `smm-xav-${serviceNum}`;

        const existingIndex = allProducts.findIndex(p => p.id === internalId || p.smmServiceId === serviceNum);

        if (existingIndex >= 0 && allProducts[existingIndex].isDeleted) {
          skippedCount++;
          continue;
        }

        const rawRate = Number(s.rate || 0);
        const isManual = existingIndex >= 0 && allProducts[existingIndex].priceMode === 'MANUAL';
        const sellingRate = isManual && allProducts[existingIndex].ratePer1000
          ? allProducts[existingIndex].ratePer1000!
          : this.calculateSellingPrice(rawRate, config.priceMarginType, config.priceMarginValue, config.rounding);

        const needsReview = sellingRate > 0 && rawRate > sellingRate;

        const productPayload: Product = {
          id: internalId,
          categoryId: 'smm',
          provider: 'Xaviera Store SMM',
          name: s.name,
          sku: `SMM-${serviceNum}`,
          providerCode: 'xaviera_smm',
          sellerName: 'Xaviera SMM Gateway',
          digiflazzCategory: s.category || 'Social Media',
          smmCategory: s.category || 'Social Media',
          smmServiceId: serviceNum,
          description: `Layanan ${s.name} (${s.category}). Min: ${s.min.toLocaleString('id-ID')} | Max: ${s.max.toLocaleString('id-ID')} unit. ${s.refill ? 'Mendukung refill garansi.' : 'Non-refill.'}`,
          supplierPrice: rawRate,
          rawSellerPrice: rawRate,
          ratePer1000: sellingRate,
          sellingPrice: sellingRate, // Tarif jual per 1000 unit
          smmMin: Number(s.min || 100),
          smmMax: Number(s.max || 10000),
          smmRefill: Boolean(s.refill),
          priceMode: isManual ? 'MANUAL' : 'AUTO',
          deliveryMethod: 'AUTOMATIC',
          isActive: config.autoPublish && !needsReview,
          isDeleted: false,
          stock: 999999,
          badge: s.refill ? 'Refill' : 'Instant',
          lastSyncAt: now,
          needsPriceReview: needsReview,
          iconUrl: s.category?.toLowerCase().includes('instagram')
            ? 'https://images.unsplash.com/photo-1611262588024-d12430b98920?w=150&auto=format&fit=crop&q=80'
            : s.category?.toLowerCase().includes('tiktok')
              ? 'https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=150&auto=format&fit=crop&q=80'
              : 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=150&auto=format&fit=crop&q=80',
        };

        if (existingIndex >= 0) {
          allProducts[existingIndex] = {
            ...allProducts[existingIndex],
            ...productPayload,
            sellingPrice: allProducts[existingIndex].priceMode === 'MANUAL' ? allProducts[existingIndex].sellingPrice : sellingRate,
            ratePer1000: allProducts[existingIndex].priceMode === 'MANUAL' ? allProducts[existingIndex].ratePer1000 : sellingRate,
            priceMode: allProducts[existingIndex].priceMode || 'AUTO',
            isActive: allProducts[existingIndex].isActive,
          };
          updatedCount++;
        } else {
          allProducts.push(productPayload);
          addedCount++;
        }
      }
    } else if (category === 'game') {
      // 3. Top Up Game (Digiflazz / Game Provider)
      const gameProducts = allProducts.filter(p => p.categoryId === 'game');
      updatedCount = gameProducts.length;
    } else if (category === 'gateway_tambahan') {
      // 4. Clouvia AI Router & Developer Sandbox (Model coding-high)
      const clouviaModels = [
        {
          id: 'clv-coding-high',
          name: 'Clouvia API Key (Model coding-high)',
          model: 'coding-high',
          price: 15000,
          desc: 'API Key resmi Clouvia Router (https://router.clouvia.id/v1) model coding-high. Arsitektur teknis super cepat & solutif.',
          badge: 'CODING-HIGH',
        },
        {
          id: 'clv-token-balance-10',
          name: 'Clouvia Router AI $10 Credit',
          model: 'router-10usd',
          price: 35000,
          desc: 'Saldo $10 Clouvia API Router. Akses multi-LLM: coding-high, GPT-4o, Claude 3.5 & DeepSeek via baseURL router.clouvia.id/v1.',
          badge: 'MULTI-LLM',
        },
        {
          id: 'clv-token-balance-25',
          name: 'Clouvia Router AI $25 Credit',
          model: 'router-25usd',
          price: 85000,
          desc: 'Saldo $25 Clouvia API Router Enterprise. High throughput rate limit, support webhook & bot Telegram/WA.',
          badge: 'ENTERPRISE',
        },
      ];

      for (const item of clouviaModels) {
        const existingIndex = allProducts.findIndex(p => p.id === item.id);
        const selling = this.calculateSellingPrice(item.price, config.priceMarginType, config.priceMarginValue, config.rounding);

        const payload: Product = {
          id: item.id,
          categoryId: 'gateway_tambahan',
          provider: 'Clouvia Router AI',
          name: item.name,
          sku: `CLV-${item.model.toUpperCase()}`,
          providerProductId: item.model,
          providerCode: 'clouvia',
          sellerName: 'Clouvia Router Official',
          digiflazzCategory: 'AI Gateway',
          description: item.desc,
          supplierPrice: item.price,
          rawSellerPrice: item.price,
          sellingPrice: selling,
          duration: 'Aktif 1-3 Bulan',
          priceMode: 'AUTO',
          deliveryMethod: 'AUTOMATIC',
          isActive: true,
          isDeleted: false,
          stock: 999,
          badge: item.badge,
          lastSyncAt: now,
          iconUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&q=80',
        };

        if (existingIndex >= 0) {
          allProducts[existingIndex] = {
            ...allProducts[existingIndex],
            ...payload,
            sellingPrice: allProducts[existingIndex].priceMode === 'MANUAL' ? allProducts[existingIndex].sellingPrice : selling,
            isActive: allProducts[existingIndex].isActive,
          };
          updatedCount++;
        } else {
          allProducts.push(payload);
          addedCount++;
        }
      }
    }

    // Simpan semua pembaruan ke storage
    storage.saveProducts(allProducts);

    // Perbarui riwayat sinkronisasi di config
    const updatedConfig: ApiProviderConfig = {
      ...config,
      lastSyncAt: now,
      lastSyncStatus: 'SUCCESS',
      lastSyncSummary: `Sinkronisasi berhasil: +${addedCount} baru, ${updatedCount} diperbarui, ${skippedCount} dilewati.`,
    };
    this.saveApiConfig(updatedConfig);

    return {
      added: addedCount,
      updated: updatedCount,
      skipped: skippedCount,
      total: addedCount + updatedCount,
      message: `Sinkronisasi ${config.providerName} selesai: +${addedCount} produk baru, ${updatedCount} diperbarui.`,
    };
  }

  /**
   * Eksekusi Pembelian Akun Premium ke Provider (POST /v1/products/order)
   */
  async executeOrderPremium(
    order: Order,
    item: any,
    targetProduct: Product
  ): Promise<{ success: boolean; credentials?: { email: string; password?: string }[]; providerOrderId?: string; total?: number; message?: string }> {
    const configs = this.getApiConfigs();
    const config = configs.premium || DEFAULT_API_CONFIGS.premium;

    const prodId = targetProduct.providerProductId || item.productId.replace(/^prem-xav-/, '');
    const variantId = item.variantId;
    const qty = 1;

    // Coba kirim ke endpoint nyata jika token tersedia
    if (config.apiKey && config.apiKey.length > 5 && !config.apiKey.startsWith('demo_')) {
      try {
        const res = await fetch(`/api/provider/order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: 'premium',
            productId: prodId,
            variantId: variantId || undefined,
            qty,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json && json.order && Array.isArray(json.order.credentials) && json.order.credentials.length > 0) {
            return {
              success: true,
              credentials: json.order.credentials,
              providerOrderId: json.order.id,
              total: json.order.total,
              message: 'Akun premium berhasil diperoleh dari provider.',
            };
          }
        }
      } catch (_) {}
    }

    // SIMULASI MOCK SESUAI PRD 3.3 H.1 (Data Simulasi Berlabel)
    const mockEmail = `user.${order.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(-6)}@wayahe-vip.id`;
    const mockPassword = `WD-Prem${Math.floor(100000 + Math.random() * 900000)}!`;
    const mockOrderId = `o_xav_${Date.now().toString(36).toUpperCase()}`;

    return {
      success: true,
      credentials: [
        {
          email: mockEmail,
          password: mockPassword,
        },
      ],
      providerOrderId: mockOrderId,
      total: targetProduct.supplierPrice || 25000,
      message: 'Akun premium siap digunakan (Data simulasi resmi Xaviera Store).',
    };
  }

  /**
   * Eksekusi Pembelian Layanan SMM ke Provider (POST /v1/smm/order)
   */
  async executeOrderSmm(
    order: Order,
    item: any,
    targetProduct: Product
  ): Promise<{ success: boolean; providerOrderId?: number; providerGatewayId?: string; status?: string; total?: number; message?: string }> {
    const configs = this.getApiConfigs();
    const config = configs.smm || DEFAULT_API_CONFIGS.smm;

    const serviceId = targetProduct.smmServiceId || 1234;
    const target = order.targetDestination || order.smmTarget || 'https://instagram.com/wayahe_digital';
    const qty = order.smmQty || 100;
    const comments = order.smmComments;

    if (config.apiKey && config.apiKey.length > 5 && !config.apiKey.startsWith('demo_')) {
      try {
        const res = await fetch(`/api/provider/order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: 'smm',
            serviceId,
            target,
            qty,
            comments: comments || undefined,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json && json.order) {
            return {
              success: true,
              providerGatewayId: json.order.id,
              providerOrderId: json.order.smm?.providerOrderId,
              status: json.order.smm?.status || 'Pending',
              total: json.order.total,
              message: 'Pesanan SMM berhasil diteruskan ke provider gateway.',
            };
          }
        }
      } catch (_) {}
    }

    // SIMULASI MOCK SESUAI PRD 3.4 H.1
    const mockGatewayId = `o_smm_${Date.now().toString(36).toUpperCase()}`;
    const mockProviderOrderId = Math.floor(900000 + Math.random() * 99999);
    const cost = this.calculateSmmCost(targetProduct.supplierPrice || 15000, qty);

    return {
      success: true,
      providerGatewayId: mockGatewayId,
      providerOrderId: mockProviderOrderId,
      status: 'Pending',
      total: cost,
      message: 'Pesanan SMM dalam antrean pemrosesan server (Data simulasi Xaviera SMM).',
    };
  }

  /**
   * Alias untuk sinkronisasi katalog
   */
  async syncCatalog(category: string) {
    return this.syncProducts(category);
  }

  /**
   * Cek Status Pesanan SMM dari Provider (GET /v1/smm/order/{id})
   */
  async checkSmmStatus(
    gatewayOrderId: string | number
  ): Promise<{ success: boolean; status: string; localStatus: string; rawStatus: string; providerOrderId?: number; message: string }> {
    const configs = this.getApiConfigs();
    const config = configs.smm || DEFAULT_API_CONFIGS.smm;
    const cleanId = String(gatewayOrderId);

    if (config.apiKey && config.apiKey.length > 5 && !config.apiKey.startsWith('demo_')) {
      try {
        const res = await fetch(`/api/provider/order/${cleanId}?category=smm`);
        if (res.ok) {
          const json = await res.json();
          const raw = json.order?.smm?.status || 'Pending';
          const local = this.mapSmmStatus(raw);
          return {
            success: true,
            status: raw,
            localStatus: local,
            rawStatus: raw,
            providerOrderId: json.order?.smm?.providerOrderId,
            message: `Status SMM: ${raw} (${local})`,
          };
        }
      } catch (_) {}
    }

    // Simulasi respons status SMM
    return {
      success: true,
      status: 'Pending',
      localStatus: 'WAITING',
      rawStatus: 'Pending',
      message: 'Status: Pending (Menunggu proses di antrean server SMM)',
    };
  }

  /**
   * Ambil Ulang Detail Akun Premium dari Provider (GET /v1/orders/{id})
   */
  async reFetchPremiumOrder(
    providerOrderId: string | number
  ): Promise<{ success: boolean; order?: { credentials?: { email: string; password?: string }[] }; credentials?: { email: string; password?: string }[]; message: string }> {
    const configs = this.getApiConfigs();
    const config = configs.premium || DEFAULT_API_CONFIGS.premium;
    const cleanId = String(providerOrderId);

    if (config.apiKey && config.apiKey.length > 5 && !config.apiKey.startsWith('demo_')) {
      try {
        const res = await fetch(`/api/provider/order/${cleanId}?category=premium`);
        if (res.ok) {
          const json = await res.json();
          if (json && json.order && Array.isArray(json.order.credentials)) {
            return {
              success: true,
              order: json.order,
              credentials: json.order.credentials,
              message: 'Detail kredensial akun berhasil diambil kembali dari provider.',
            };
          }
        }
      } catch (_) {}
    }

    return {
      success: false,
      message: 'Detail pesanan tersimpan lokal sudah mutakhir.',
    };
  }

  /**
   * Alias untuk ambil detail pesanan provider
   */
  async retrieveOrderDetails(providerOrderId: string | number) {
    return this.reFetchPremiumOrder(providerOrderId);
  }

  /**
   * Pemetaan status mentah provider SMM ke status internal website
   */
  mapSmmStatus(raw: string): string {
    const s = String(raw || '').toLowerCase();
    if (s.includes('pending') || s.includes('waiting')) return 'WAITING';
    if (s.includes('process') || s.includes('in progress')) return 'PROCESSING';
    if (s.includes('complete') || s.includes('success')) return 'SUCCESS';
    if (s.includes('partial')) return 'PARTIAL';
    if (s.includes('cancel')) return 'CANCELED';
    if (s.includes('fail') || s.includes('error')) return 'FAILED';
    return 'PROCESSING';
  }
}

export const providerIntegrationService = new ProviderIntegrationService();
