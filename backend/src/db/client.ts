import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const rawPrisma = new PrismaClient();
const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

const isMockDigiflazz = (p: any): boolean => {
  if (!p) return false;
  // Produk resmi hasil sinkronisasi Digiflazz API jangan pernah difilter!
  if (p.isDigiflazzSynced || p.sellerName) return false;
  const cat = String(p.categoryId || '').toLowerCase();
  if (cat === 'wifi' || cat === 'premium') return false;
  const id = String(p.id || '');
  const mockPrefixes = ['tsel-', 'isat-', 'xl-', 'axis-', 'tri-', 'smart-', 'data-', 'game-', 'pulsa-', 'prod-pulsa-'];
  if (mockPrefixes.some(pref => id.startsWith(pref))) return true;
  return false;
};

const DUMMY_WIFI_PREFIXES = ['WF2H-MLT', 'WF6H-MLT', 'WF24-MLT', 'WF3D-MLT', 'WF7D-MLT', 'WIFI2-', 'WIFI6-', 'WIFI24-', 'MELATI'];
const DEFAULT_MOCK_WIFI_IDS = ['wifi-melati-2h', 'wifi-melati-6h', 'wifi-melati-24h', 'wifi-melati-7d', 'wifi-warganet-24h', 'wifi-griyanet-30d', 'prod-wifi-1jam', 'prod-wifi-6jam', 'prod-wifi-24jam', 'prod-wifi-7hari', 'prod-wifi-30hari'];

const cleanMockWifiStock = (p: any): any => {
  if (!p) return p;
  const cat = String(p.categoryId || p.category || '').toLowerCase();
  if (cat !== 'wifi') return p;

  let voucherCodes = Array.isArray(p.voucherCodes) ? p.voucherCodes : [];
  voucherCodes = voucherCodes.filter((c: string) => !DUMMY_WIFI_PREFIXES.some(pre => (c || '').startsWith(pre)));

  let variants = p.variants;
  if (Array.isArray(variants)) {
    variants = variants.map((v: any) => {
      let vCodes = Array.isArray(v.voucherCodes) ? v.voucherCodes : [];
      vCodes = vCodes.filter((c: string) => !DUMMY_WIFI_PREFIXES.some(pre => (c || '').startsWith(pre)));
      return {
        ...v,
        voucherCodes: vCodes,
        stock: DEFAULT_MOCK_WIFI_IDS.includes(p.id) && vCodes.length === 0 ? 0 : (v.stock ?? vCodes.length)
      };
    });
  }

  const isDefault = DEFAULT_MOCK_WIFI_IDS.includes(p.id);
  const newStock = isDefault && voucherCodes.length === 0 ? 0 : (voucherCodes.length > 0 ? voucherCodes.length : (isDefault ? 0 : (p.stock || 0)));

  return {
    ...p,
    voucherCodes,
    variants,
    stock: newStock
  };
};

const cleanWifiVoucherItems = (items: Record<string, any>): Record<string, any> => {
  if (!items || typeof items !== 'object') return {};
  const cleaned: Record<string, any> = {};
  for (const [id, item] of Object.entries(items)) {
    if (id.startsWith('v-') || id.startsWith('vch-')) continue;
    const code = String(item?.code || '');
    if (DUMMY_WIFI_PREFIXES.some(pre => code.startsWith(pre))) continue;
    cleaned[id] = item;
  }
  return cleaned;
};

const cleanWifiBatches = (batches: any[]): any[] => {
  if (!Array.isArray(batches)) return [];
  const dummyBatchIds = ['batch-1', 'batch-2', 'batch-melati-01'];
  return batches.filter(b => b && !dummyBatchIds.includes(b.id) && !String(b.id || '').startsWith('batch-melati'));
};

// Pastikan direktori data ada
try {
  if (!fs.existsSync(path.dirname(DB_FILE))) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  }
} catch (_) {}

interface DbState {
  orders: Record<string, any>;
  qiospayEvents: Record<string, any>;
  auditLogs: any[];
  products: Record<string, any>;
  wifiVoucherItems: Record<string, any>;
  digiflazzLogs: any[];
  users: any;
  promoCodes: Record<string, any>;
  settings?: any;
  wifiBatches?: any[];
  promos?: any[];
  banners?: any[];
  catalogs?: any[];
  pushSubscriptions?: Record<string, any>;
}

function loadFileDb(): DbState {
  try {
    if (fs.existsSync(DB_FILE)) {
      const text = fs.readFileSync(DB_FILE, 'utf8');
      const raw = JSON.parse(text);
      
      const ordersMap: Record<string, any> = {};
      if (Array.isArray(raw.orders)) {
        for (const o of raw.orders) {
          if (o && (o.id || o.invoiceNumber)) {
            ordersMap[o.id || o.invoiceNumber] = o;
          }
        }
      } else if (raw.orders && typeof raw.orders === 'object') {
        Object.assign(ordersMap, raw.orders);
      }

      const productsMap: Record<string, any> = {};
      if (Array.isArray(raw.products)) {
        for (const p of raw.products) {
          if (p && p.id && !isMockDigiflazz(p)) productsMap[p.id] = cleanMockWifiStock(p);
        }
      } else if (raw.products && typeof raw.products === 'object') {
        for (const [k, p] of Object.entries(raw.products as Record<string, any>)) {
          if (p && !isMockDigiflazz(p)) productsMap[k] = cleanMockWifiStock(p);
        }
      }

      const pushSubsMap: Record<string, any> = {};
      if (Array.isArray(raw.pushSubscriptions)) {
        for (const s of raw.pushSubscriptions) {
          if (s && s.token) pushSubsMap[s.token] = s;
        }
      } else if (raw.pushSubscriptions && typeof raw.pushSubscriptions === 'object') {
        Object.assign(pushSubsMap, raw.pushSubscriptions);
      }

      return {
        orders: ordersMap,
        qiospayEvents: raw.qiospayEvents || {},
        auditLogs: Array.isArray(raw.auditLogs) ? raw.auditLogs : [],
        products: productsMap,
        wifiVoucherItems: cleanWifiVoucherItems(raw.wifiVoucherItems || {}),
        digiflazzLogs: Array.isArray(raw.digiflazzLogs) ? raw.digiflazzLogs : [],
        users: raw.users || {},
        promoCodes: raw.promoCodes || {},
        settings: raw.settings || {},
        wifiBatches: cleanWifiBatches(Array.isArray(raw.wifiBatches) ? raw.wifiBatches : []),
        promos: Array.isArray(raw.promos) ? raw.promos : [],
        banners: Array.isArray(raw.banners) ? raw.banners : [],
        catalogs: Array.isArray(raw.catalogs) ? raw.catalogs : [],
        pushSubscriptions: pushSubsMap,
      };
    }
  } catch (_) {}

  return {
    orders: {},
    qiospayEvents: {},
    auditLogs: [],
    products: {},
    wifiVoucherItems: {},
    digiflazzLogs: [],
    users: {},
    promoCodes: {},
    pushSubscriptions: {},
  };
}

let inMemoryState = loadFileDb();

function saveFileDb() {
  try {
    let existingOnDisk: any = {};
    if (fs.existsSync(DB_FILE)) {
      try {
        existingOnDisk = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      } catch (_) {}
    }

    // Merge on-disk products into inMemoryState.products
    if (Array.isArray(existingOnDisk.products)) {
      for (const p of existingOnDisk.products) {
        if (p && p.id && !inMemoryState.products[p.id]) {
          inMemoryState.products[p.id] = cleanMockWifiStock(p);
        }
      }
    }

    const ordersList = Object.values(inMemoryState.orders);
    const productsList = Object.values(inMemoryState.products).map(cleanMockWifiStock);
    const pushSubsList = inMemoryState.pushSubscriptions ? Object.values(inMemoryState.pushSubscriptions) : [];

    const merged = {
      ...existingOnDisk,
      ...inMemoryState,
      users: (existingOnDisk.users && (Array.isArray(existingOnDisk.users) ? existingOnDisk.users.length > 0 : Object.keys(existingOnDisk.users).length > 0))
        ? existingOnDisk.users
        : inMemoryState.users,
      settings: existingOnDisk.settings || inMemoryState.settings,
      products: productsList.filter((p: any) => !isMockDigiflazz(p)),
      orders: ordersList,
      wifiVoucherItems: cleanWifiVoucherItems(inMemoryState.wifiVoucherItems || existingOnDisk.wifiVoucherItems || {}),
      wifiBatches: cleanWifiBatches(existingOnDisk.wifiBatches || inMemoryState.wifiBatches || []),
      promos: existingOnDisk.promos || inMemoryState.promos || [],
      banners: existingOnDisk.banners || inMemoryState.banners || [],
      catalogs: existingOnDisk.catalogs || inMemoryState.catalogs || [],
      pushSubscriptions: pushSubsList.length > 0 ? pushSubsList : (existingOnDisk.pushSubscriptions || []),
    };

    fs.writeFileSync(DB_FILE, JSON.stringify(merged, null, 2), 'utf8');
  } catch (_) {}
}

let isPgAvailable: boolean | null = null;

async function checkPgConnection(): Promise<boolean> {
  if (isPgAvailable !== null) return isPgAvailable;
  try {
    await rawPrisma.$queryRawUnsafe('SELECT 1');
    isPgAvailable = true;
  } catch (_) {
    isPgAvailable = false;
  }
  return isPgAvailable;
}

// Check on startup
checkPgConnection();

/**
 * Fallback In-Memory & File-backed Store
 */
const fallbackStore = {
  $transaction: async (cb: (tx: any) => Promise<any>) => {
    return cb(fallbackStore);
  },
  order: {
    findFirst: async ({ where }: any = {}) => {
      const orders = Object.values(inMemoryState.orders);
      if (where?.OR && Array.isArray(where.OR)) {
        for (const cond of where.OR) {
          const match = orders.find(o => 
            (cond.id && o.id === cond.id) || 
            (cond.invoiceNumber && (o.invoiceNumber === cond.invoiceNumber || String(o.invoiceNumber).toLowerCase() === String(cond.invoiceNumber).toLowerCase()))
          );
          if (match) return match;
        }
        return null;
      }
      if (where?.invoiceNumber) {
        return orders.find(o => o.invoiceNumber === where.invoiceNumber || String(o.invoiceNumber).toLowerCase() === String(where.invoiceNumber).toLowerCase()) || null;
      }
      if (where?.id) {
        return inMemoryState.orders[where.id] || orders.find(o => o.id === where.id) || null;
      }
      return orders[0] || null;
    },
    findUnique: async ({ where }: any = {}) => {
      if (where?.id) return inMemoryState.orders[where.id] || Object.values(inMemoryState.orders).find(o => o.id === where.id) || null;
      if (where?.invoiceNumber) {
        return Object.values(inMemoryState.orders).find(o => o.invoiceNumber === where.invoiceNumber || String(o.invoiceNumber).toLowerCase() === String(where.invoiceNumber).toLowerCase()) || null;
      }
      if (where?.idempotencyKey) {
        return Object.values(inMemoryState.orders).find(o => o.idempotencyKey === where.idempotencyKey) || null;
      }
      return null;
    },
    findMany: async ({ where, orderBy, take }: any = {}) => {
      let list = Object.values(inMemoryState.orders);
      if (where?.paymentStatus) {
        if (typeof where.paymentStatus === 'object' && where.paymentStatus.in) {
          list = list.filter(o => where.paymentStatus.in.includes(o.paymentStatus));
        } else {
          list = list.filter(o => o.paymentStatus === where.paymentStatus);
        }
      }
      if (where?.totalAmount) {
        list = list.filter(o => o.totalAmount === where.totalAmount);
      }
      if (orderBy?.createdAt === 'desc') {
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
      if (take) {
        list = list.slice(0, take);
      }
      return list;
    },
    create: async ({ data }: any) => {
      const id = data.id || 'ord-' + Date.now();
      // File fallback must preserve the same insert-only identity contract as SQL.
      if (Object.values(inMemoryState.orders).some(o => o.id === id || o.invoiceNumber === data.invoiceNumber || (data.idempotencyKey && o.idempotencyKey === data.idempotencyKey))) {
        throw Object.assign(new Error('Order identity conflict'), { code: 'P2002' });
      }
      const order = {
        ...data,
        id,
        items: data.items?.create ? (Array.isArray(data.items.create) ? data.items.create : [data.items.create]) : (data.items || []),
        paymentAttempts: data.paymentAttempts?.create ? [data.paymentAttempts.create] : [],
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
      inMemoryState.orders[id] = order;
      saveFileDb();
      return order;
    },
    upsert: async ({ where, create, update }: any) => {
      let targetId = where?.id;
      if (!targetId && where?.invoiceNumber) {
        const found = Object.values(inMemoryState.orders).find(o => o.invoiceNumber === where.invoiceNumber || String(o.invoiceNumber).toLowerCase() === String(where.invoiceNumber).toLowerCase());
        if (found) targetId = found.id;
      }
      const existing = targetId ? (inMemoryState.orders[targetId] || Object.values(inMemoryState.orders).find(o => o.id === targetId || o.invoiceNumber === targetId)) : null;
      if (existing) {
        const updated = {
          ...existing,
          ...update,
          updatedAt: new Date().toISOString(),
        };
        inMemoryState.orders[existing.id] = updated;
        saveFileDb();
        return updated;
      } else {
        const id = create?.id || targetId || 'ord-' + Date.now();
        const order = {
          ...create,
          id,
          items: create?.items?.create ? (Array.isArray(create.items.create) ? create.items.create : [create.items.create]) : (create?.items || []),
          createdAt: create?.createdAt || new Date().toISOString(),
          updatedAt: create?.updatedAt || new Date().toISOString(),
        };
        inMemoryState.orders[id] = order;
        saveFileDb();
        return order;
      }
    },
    update: async ({ where, data }: any) => {
      let targetId = where.id;
      if (!targetId && where.invoiceNumber) {
        const found = Object.values(inMemoryState.orders).find(o => o.invoiceNumber === where.invoiceNumber || String(o.invoiceNumber).toLowerCase() === String(where.invoiceNumber).toLowerCase());
        if (found) targetId = found.id;
      }
      if (!targetId || !inMemoryState.orders[targetId]) {
        const found = Object.values(inMemoryState.orders).find(o => o.id === targetId || o.invoiceNumber === targetId);
        if (found) targetId = found.id;
        else return null;
      }

      const existing = inMemoryState.orders[targetId];
      const updated = {
        ...existing,
        ...data,
        updatedAt: new Date().toISOString(),
      };
      inMemoryState.orders[targetId] = updated;
      saveFileDb();
      return updated;
    },
    count: async ({ where }: any = {}) => {
      const list = await fallbackStore.order.findMany({ where });
      return list.length;
    },
  },
  qiospayEvent: {
    findUnique: async ({ where }: any = {}) => {
      const nmid = where?.nmid_refid?.nmid;
      const refid = where?.nmid_refid?.refid;
      const key = `${nmid}_${refid}`;
      return inMemoryState.qiospayEvents[key] || null;
    },
    findMany: async ({ where, orderBy, take }: any = {}) => {
      let list = Object.values(inMemoryState.qiospayEvents);
      if (where?.amount) {
        list = list.filter(e => e.amount === where.amount);
      }
      if (where?.verificationStatus) {
        if (typeof where.verificationStatus === 'object' && where.verificationStatus.in) {
          list = list.filter(e => where.verificationStatus.in.includes(e.verificationStatus));
        } else {
          list = list.filter(e => e.verificationStatus === where.verificationStatus);
        }
      }
      if (orderBy?.receivedAt === 'desc') {
        list.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
      }
      if (take) {
        list = list.slice(0, take);
      }
      return list;
    },
    create: async ({ data }: any) => {
      const key = `${data.nmid}_${data.refid}`;
      const event = { id: 'ev-' + Date.now(), ...data };
      inMemoryState.qiospayEvents[key] = event;
      saveFileDb();
      return event;
    },
    update: async ({ where, data }: any) => {
      const nmid = where?.nmid_refid?.nmid;
      const refid = where?.nmid_refid?.refid;
      const key = `${nmid}_${refid}`;
      if (inMemoryState.qiospayEvents[key]) {
        inMemoryState.qiospayEvents[key] = {
          ...inMemoryState.qiospayEvents[key],
          ...data,
        };
        saveFileDb();
        return inMemoryState.qiospayEvents[key];
      }
      return null;
    },
  },
  auditLog: {
    create: async ({ data }: any) => {
      const log = { id: 'log-' + Date.now(), ...data, timestamp: new Date().toISOString() };
      inMemoryState.auditLogs.unshift(log);
      saveFileDb();
      return log;
    },
    findMany: async ({ orderBy, take }: any = {}) => {
      let list = [...inMemoryState.auditLogs];
      if (take) list = list.slice(0, take);
      return list;
    },
  },
  product: {
    findMany: async ({ where }: any = {}) => {
      let list = Object.values(inMemoryState.products);
      if (where?.isActive !== undefined) {
        list = list.filter(p => p.isActive === where.isActive);
      }
      return list;
    },
    findFirst: async ({ where }: any = {}) => {
      let list = Object.values(inMemoryState.products);
      if (where?.sku) return list.find(p => p.sku === where.sku || p.supplierSku === where.sku) || null;
      if (where?.id) return inMemoryState.products[where.id] || null;
      return list[0] || null;
    },
    findUnique: async ({ where }: any = {}) => {
      if (where?.id) return inMemoryState.products[where.id] || null;
      if (where?.sku) return Object.values(inMemoryState.products).find(p => p.sku === where.sku || p.supplierSku === where.sku) || null;
      return null;
    },
    upsert: async ({ where, create, update }: any) => {
      const id = where?.id || create?.id;
      const existing = id ? inMemoryState.products[id] : null;
      if (existing) {
        const updated = { ...existing, ...update };
        inMemoryState.products[id] = updated;
        saveFileDb();
        return updated;
      } else {
        const item = { ...create, id };
        inMemoryState.products[id] = item;
        saveFileDb();
        return item;
      }
    },
    create: async ({ data }: any) => {
      inMemoryState.products[data.id] = data;
      saveFileDb();
      return data;
    },
    update: async ({ where, data }: any) => {
      if (where?.id && inMemoryState.products[where.id]) {
        inMemoryState.products[where.id] = { ...inMemoryState.products[where.id], ...data };
        saveFileDb();
        return inMemoryState.products[where.id];
      }
      return null;
    },
    delete: async ({ where }: any) => {
      if (where?.id && inMemoryState.products[where.id]) {
        const deleted = inMemoryState.products[where.id];
        delete inMemoryState.products[where.id];
        saveFileDb();
        return deleted;
      }
      return null;
    },
    count: async () => Object.keys(inMemoryState.products).length,
  },
  wifiVoucherItem: {
    findFirst: async ({ where }: any = {}) => {
      const list = Object.values(inMemoryState.wifiVoucherItems);
      return list.find(v => v.status === where?.status) || null;
    },
    update: async ({ where, data }: any) => {
      if (inMemoryState.wifiVoucherItems[where?.id]) {
        inMemoryState.wifiVoucherItems[where.id] = {
          ...inMemoryState.wifiVoucherItems[where.id],
          ...data,
        };
        saveFileDb();
        return inMemoryState.wifiVoucherItems[where.id];
      }
      return null;
    },
  },
  digiflazzLog: {
    create: async ({ data }: any) => {
      const log = { id: 'df-' + Date.now(), ...data, createdAt: new Date().toISOString() };
      inMemoryState.digiflazzLogs.unshift(log);
      saveFileDb();
      return log;
    },
  },
  user: {
    findUnique: async () => null,
  },
  promoCode: {
    findUnique: async ({ where }: any = {}) => inMemoryState.promoCodes[where.code] || null,
  },
  adminPushSubscription: {
    findMany: async ({ where, orderBy }: any = {}) => {
      let list = Object.values(inMemoryState.pushSubscriptions || {});
      if (where?.enabled !== undefined) {
        list = list.filter((s: any) => s.enabled === where.enabled);
      }
      if (where?.adminUserId) {
        list = list.filter((s: any) => s.adminUserId === where.adminUserId);
      }
      if (orderBy?.updatedAt === 'desc') {
        list.sort((a: any, b: any) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
      }
      return list;
    },
    findUnique: async ({ where }: any = {}) => {
      if (!inMemoryState.pushSubscriptions) inMemoryState.pushSubscriptions = {};
      if (where?.token) return inMemoryState.pushSubscriptions[where.token] || null;
      if (where?.id) return Object.values(inMemoryState.pushSubscriptions).find((s: any) => s.id === where.id) || null;
      return null;
    },
    upsert: async ({ where, create, update }: any) => {
      if (!inMemoryState.pushSubscriptions) inMemoryState.pushSubscriptions = {};
      const token = where?.token;
      const existing = token ? inMemoryState.pushSubscriptions[token] : null;
      if (existing) {
        const updated = {
          ...existing,
          ...update,
          updatedAt: update?.updatedAt || new Date().toISOString(),
        };
        inMemoryState.pushSubscriptions[token] = updated;
        saveFileDb();
        return updated;
      } else {
        const item = {
          id: create?.id || `sub_${Date.now()}`,
          ...create,
          token,
          createdAt: create?.createdAt || new Date().toISOString(),
          updatedAt: create?.updatedAt || new Date().toISOString(),
        };
        inMemoryState.pushSubscriptions[token] = item;
        saveFileDb();
        return item;
      }
    },
    create: async ({ data }: any) => {
      if (!inMemoryState.pushSubscriptions) inMemoryState.pushSubscriptions = {};
      const item = {
        id: data.id || `sub_${Date.now()}`,
        ...data,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
      if (item.token) {
        inMemoryState.pushSubscriptions[item.token] = item;
      }
      saveFileDb();
      return item;
    },
    updateMany: async ({ where, data }: any) => {
      if (!inMemoryState.pushSubscriptions) inMemoryState.pushSubscriptions = {};
      let count = 0;
      for (const token of Object.keys(inMemoryState.pushSubscriptions)) {
        const item = inMemoryState.pushSubscriptions[token];
        let matches = true;
        if (where?.token && item.token !== where.token) matches = false;
        if (where?.adminUserId && item.adminUserId !== where.adminUserId) matches = false;
        if (matches) {
          inMemoryState.pushSubscriptions[token] = { ...item, ...data, updatedAt: data?.updatedAt || new Date().toISOString() };
          count++;
        }
      }
      saveFileDb();
      return { count };
    },
    deleteMany: async ({ where }: any) => {
      if (!inMemoryState.pushSubscriptions) inMemoryState.pushSubscriptions = {};
      let count = 0;
      for (const token of Object.keys(inMemoryState.pushSubscriptions)) {
        const item = inMemoryState.pushSubscriptions[token];
        let matches = true;
        if (where?.token && item.token !== where.token) matches = false;
        if (matches) {
          delete inMemoryState.pushSubscriptions[token];
          count++;
        }
      }
      saveFileDb();
      return { count };
    },
  },
};

/**
 * Resilient Prisma Proxy
 * Tries Prisma Postgres first; if unavailable or table error occurs, falls back to disk-backed memory store.
 */
export const db: any = new Proxy(rawPrisma, {
  get(target, prop, receiver) {
    if (prop === '$transaction') {
      return async (cb: any) => {
        try {
          if (isPgAvailable === false) return fallbackStore.$transaction(cb);
          return await target.$transaction(cb);
        } catch (e: any) {
          isPgAvailable = false;
          return fallbackStore.$transaction(cb);
        }
      };
    }

    const prismaProp = Reflect.get(target, prop, receiver);
    const fallbackProp = Reflect.get(fallbackStore, prop);

    if (typeof prismaProp === 'object' && prismaProp !== null && fallbackProp) {
      return new Proxy(prismaProp, {
        get(tableTarget, tableMethod) {
          const originalFn = Reflect.get(tableTarget, tableMethod);
          const fallbackFn = Reflect.get(fallbackProp, tableMethod);

          if (typeof originalFn === 'function') {
            return async (...args: any[]) => {
              try {
                if (isPgAvailable === false && fallbackFn) {
                  return await fallbackFn(...args);
                }
                return await originalFn.apply(tableTarget, args);
              } catch (err: any) {
                // A uniqueness failure is a conflict, not a database outage.
                if (err.code === 'P2002') throw err;
                // If any Prisma DB error occurs (connection refused, relation not found, auth failed), gracefully fallback
                isPgAvailable = false;
                if (fallbackFn) {
                  return await fallbackFn(...args);
                }
                throw err;
              }
            };
          }
          return originalFn;
        },
      });
    }

    return fallbackProp || prismaProp;
  },
});

export default db;
