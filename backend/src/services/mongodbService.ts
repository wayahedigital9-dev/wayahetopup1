import fs from 'node:fs';
import { mergeSettings } from './settingsMerge.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient, ServerApiVersion, Db } from 'mongodb';
import { CONSOLE_CONFIG } from '../config/console.js';

export interface MongoTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  database?: string;
  collections?: {
    name: string;
    count: number;
  }[];
  sampleQueryData?: any;
  error?: string;
  diagnosticHelp?: string;
  timestamp: string;
}

const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

export const isMockDigiflazz = (p: any): boolean => {
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

// Pastikan direktori data ada
try {
  if (!fs.existsSync(path.dirname(DB_FILE))) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  }
} catch (_) {}

export class MongoDbService {
  private settingsWrite: Promise<void> = Promise.resolve();

  async getSettingsFromDatabase(): Promise<Record<string, any>> {
    const client = await this.getClient();
    if (!client) throw new Error('Database settings unavailable');
    const doc = await client.db(this.getPrimaryDbName()).collection('settings').findOne({ _id: 'app_settings' as any });
    return doc?.data || {};
  }
  private client: MongoClient | null = null;
  private isConnecting: boolean = false;

  private omitId(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    const { _id, ...rest } = obj;
    return rest;
  }

  private readEnvFile(): { uri: string; dbName: string; dbNameTrans: string } {
    try {
      const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const matchUri = content.match(/MONGODB_URI=["']?(.*?)["']?(\r?\n|$)/);
        const matchDb = content.match(/MONGODB_DBNAME=["']?(.*?)["']?(\r?\n|$)/);
        const matchTrans = content.match(/MONGODB_DBNAME_TRANS=["']?(.*?)["']?(\r?\n|$)/);

        return {
          uri: matchUri && matchUri[1] ? matchUri[1].trim() : '',
          dbName: matchDb && matchDb[1] ? matchDb[1].trim() : '',
          dbNameTrans: matchTrans && matchTrans[1] ? matchTrans[1].trim() : '',
        };
      }
    } catch (_) {}
    return { uri: '', dbName: '', dbNameTrans: '' };
  }

  public getUri(): string {
    const fromEnv = this.readEnvFile().uri;
    return fromEnv || CONSOLE_CONFIG.MONGODB_URI || process.env.MONGODB_URI || '';
  }

  public getPrimaryDbName(): string {
    const fromEnv = this.readEnvFile().dbName;
    return fromEnv || CONSOLE_CONFIG.MONGODB_DBNAME || process.env.MONGODB_DBNAME || '';
  }

  public getTransCollectionName(): string {
    const fromEnv = this.readEnvFile().dbNameTrans;
    return fromEnv || CONSOLE_CONFIG.MONGODB_DBNAME_TRANS || process.env.MONGODB_DBNAME_TRANS || '';
  }

  /**
   * Mengembalikan koneksi MongoClient aktif (Singleton Connection Pool)
   */
  async getClient(): Promise<MongoClient | null> {
    const uri = this.getUri();
    if (!uri) return null;

    if (this.client) {
      return this.client;
    }

    if (this.isConnecting) {
      await new Promise(r => setTimeout(r, 400));
      return this.client;
    }

    try {
      this.isConnecting = true;
      const client = new MongoClient(uri, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        },
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        maxPoolSize: 20,
      });
      await client.connect();
      this.client = client;
      console.log(`✅ [MongoDB] Connected successfully to cluster (Database: ${this.getPrimaryDbName()})`);
      return this.client;
    } catch (err: any) {
      console.warn('⚠️ [MongoDB] Connection warning:', err.message);
      this.client = null;
      return null;
    } finally {
      this.isConnecting = false;
    }
  }

  async resetClient() {
    if (this.client) {
      try {
        await this.client.close();
      } catch (_) {}
      this.client = null;
    }
  }

  /**
   * Helper to load from local file fallback
   */
  private loadLocalFile(): any {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        return {
          products: (Array.isArray(raw.products) ? raw.products : (raw.products ? Object.values(raw.products) : [])).filter((p: any) => !isMockDigiflazz(p)),
          orders: Array.isArray(raw.orders) ? raw.orders : (raw.orders ? Object.values(raw.orders) : []),
          users: Array.isArray(raw.users) ? raw.users : (raw.users ? Object.values(raw.users) : []),
          wifiBatches: Array.isArray(raw.wifiBatches) ? raw.wifiBatches : (raw.wifiBatches ? Object.values(raw.wifiBatches) : []),
          promos: Array.isArray(raw.promos) ? raw.promos : (raw.promos ? Object.values(raw.promos) : []),
          auditLogs: Array.isArray(raw.auditLogs) ? raw.auditLogs : (raw.auditLogs ? Object.values(raw.auditLogs) : []),
          settings: raw.settings || {},
          banners: Array.isArray(raw.banners) ? raw.banners : (raw.banners ? Object.values(raw.banners) : []),
          catalogs: Array.isArray(raw.catalogs) ? raw.catalogs : (raw.catalogs ? Object.values(raw.catalogs) : []),
          pushSubscriptions: Array.isArray(raw.pushSubscriptions) ? raw.pushSubscriptions : (raw.pushSubscriptions ? Object.values(raw.pushSubscriptions) : []),
        };
      }
    } catch (_) {}
    return {
      products: [],
      orders: [],
      users: [],
      wifiBatches: [],
      promos: [],
      auditLogs: [],
      settings: {},
      banners: [],
      catalogs: [],
      pushSubscriptions: [],
    };
  }

  private saveLocalFile(data: any) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (_) {}
  }

  /**
   * Get all application state from MongoDB or fallback to local disk
   */
  async getAllState(): Promise<any> {
    const client = await this.getClient();
    const local = this.loadLocalFile();

    if (!client) {
      return local;
    }

    try {
      const dbName = this.getPrimaryDbName();
      const transColl = this.getTransCollectionName();
      const db = client.db(dbName);

      // Fetch from MongoDB collections in the primary database
      const [
        products,
        manualInventory,
        orders,
        users,
        wifiBatches,
        promos,
        auditLogs,
        settingsDoc,
        banners,
        catalogs,
        pushSubscriptions,
      ] = await Promise.all([
        db.collection('products').find({}).toArray().catch(() => []),
        db.collection('manual_inventory').findOne({ _id: 'current' as any }).catch(() => null),
        db.collection(transColl).find({}).sort({ createdAt: -1 }).toArray()
          .catch(async () => db.collection('orders').find({}).sort({ createdAt: -1 }).toArray().catch(() => [])),
        db.collection('users').find({}).toArray().catch(() => []),
        db.collection('wifi_batches').find({}).toArray().catch(() => []),
        db.collection('promos').find({}).toArray().catch(() => []),
        db.collection('audit_logs').find({}).sort({ timestamp: -1 }).limit(100).toArray().catch(() => []),
        db.collection('settings').findOne({ _id: 'app_settings' as any }).catch(() => null),
        db.collection('banners').find({}).toArray().catch(() => []),
        db.collection('catalogs').find({}).toArray().catch(() => []),
        db.collection('push_subscriptions').find({}).toArray().catch(() => []),
      ]);

      const hasMongoData = products.length > 0 || Boolean(manualInventory) || orders.length > 0 || users.length > 0 || settingsDoc || pushSubscriptions.length > 0;
      const savedManualProducts = Array.isArray((manualInventory as any)?.products) ? (manualInventory as any).products : null;
      const savedManualBatches = Array.isArray((manualInventory as any)?.wifiBatches) ? (manualInventory as any).wifiBatches : null;
      const supplierProducts = products.filter((product: any) => product.isDigiflazzSynced || product.sellerName);
      const manualProducts = savedManualProducts
        ? [
            ...savedManualProducts.filter((product: any) => !(product.isDigiflazzSynced || product.sellerName)),
            ...supplierProducts,
          ]
        : products;

      if (!hasMongoData) {
        // Seed initial local data into MongoDB if MongoDB is empty
        if (local && (local.products?.length || local.orders?.length || local.users?.length || local.pushSubscriptions?.length)) {
          this.syncAllState(local).catch(() => {});
        }
        return local;
      }

      const combined = {
        products: (manualProducts.length > 0 ? manualProducts : local.products || []).filter((p: any) => !isMockDigiflazz(p)),
        orders: orders.length > 0 ? orders : local.orders || [],
        users: users.map(({ password, passwordHash, ...user }: any) => user),
        wifiBatches: savedManualBatches || (wifiBatches.length > 0 ? wifiBatches : local.wifiBatches || []),
        promos: promos.length > 0 ? promos : local.promos || [],
        auditLogs: auditLogs.length > 0 ? auditLogs : local.auditLogs || [],
        // MongoDB is authoritative; disk is only a mirror/fallback for public reads.
        settings: settingsDoc?.data || local.settings || {},
        banners: banners.length > 0 ? banners : local.banners || [],
        catalogs: catalogs.length > 0 ? catalogs : local.catalogs || [],
        pushSubscriptions: pushSubscriptions.length > 0 ? pushSubscriptions : local.pushSubscriptions || [],
      };

      this.saveLocalFile(combined);
      return combined;
    } catch (err: any) {
      console.warn('⚠️ Error fetching from MongoDB, using local fallback:', err.message);
      return local;
    }
  }

  /**
   * Sync all state to MongoDB & local file
   */
  async syncAllState(state: any): Promise<boolean> {
    if (state.settings) {
      if (!await this.syncEntity('settings', state.settings)) return false;
      state = { ...state, settings: await this.getSettingsFromDatabase() };
    }
    this.saveLocalFile(state);

    const client = await this.getClient();
    if (!client) return false;

    try {
      const dbName = this.getPrimaryDbName();
      const transColl = this.getTransCollectionName();
      const db = client.db(dbName);

      // Settings use the serialized database-first merge above.

      // 2. Save products
      if (Array.isArray(state.products) && state.products.length > 0) {
        for (const p of state.products) {
          const pId = p.id || p._id;
          if (pId) {
            await db.collection('products').updateOne({ id: pId }, { $set: p }, { upsert: true });
          }
        }
      }

      // 3. Save orders (simpan ke wayahedigital_transactions dan orders)
      if (Array.isArray(state.orders) && state.orders.length > 0) {
        for (const o of state.orders) {
          const oId = o.id || o.invoiceNumber || o._id;
          if (oId) {
            const filter = { $or: [{ id: o.id || '' }, { invoiceNumber: o.invoiceNumber || '' }] };
            await db.collection(transColl).updateOne(filter, { $set: o }, { upsert: true });
            if (transColl !== 'orders') {
              await db.collection('orders').updateOne(filter, { $set: o }, { upsert: true }).catch(() => {});
            }
          }
        }
      }

      // Member accounts are only written by the authenticated database-first service.

      // 5. Save WiFi batches
      if (Array.isArray(state.wifiBatches) && state.wifiBatches.length > 0) {
        for (const b of state.wifiBatches) {
          if (b.id) {
            await db.collection('wifi_batches').updateOne({ id: b.id }, { $set: b }, { upsert: true });
          }
        }
      }

      // 6. Save Promos
      if (Array.isArray(state.promos) && state.promos.length > 0) {
        for (const pr of state.promos) {
          if (pr.id || pr.code) {
            await db.collection('promos').updateOne(
              { $or: [{ id: pr.id || '' }, { code: pr.code || '' }] },
              { $set: pr },
              { upsert: true }
            );
          }
        }
      }

      // 7. Save Banners & Catalogs
      if (Array.isArray(state.banners) && state.banners.length > 0) {
        for (const bn of state.banners) {
          if (bn.id) {
            await db.collection('banners').updateOne({ id: bn.id }, { $set: bn }, { upsert: true });
          }
        }
      }

      if (Array.isArray(state.catalogs) && state.catalogs.length > 0) {
        for (const cat of state.catalogs) {
          if (cat.id) {
            await db.collection('catalogs').updateOne({ id: cat.id }, { $set: cat }, { upsert: true });
          }
        }
      }

      return true;
    } catch (err: any) {
      console.warn('⚠️ Error syncing state to MongoDB:', err.message);
      return false;
    }
  }

  /**
   * Sync single entity to MongoDB & local file
   */
  async syncEntity(entity: string, data: any): Promise<boolean> {
    if (entity === 'users') return false;
    if (entity === 'settings') {
      const write = this.settingsWrite.then(async () => {
        const client = await this.getClient();
        if (!client) return false;
        try {
          const collection = client.db(this.getPrimaryDbName()).collection('settings');
          const current = await collection.findOne({ _id: 'app_settings' as any });
          const merged = mergeSettings(current?.data || {}, data);
          const result = await collection.updateOne(
            { _id: 'app_settings' as any },
            { $set: { data: merged, updatedAt: new Date().toISOString() } }, { upsert: true }
          );
          if (!result.acknowledged) return false;
          const local = this.loadLocalFile();
          local.settings = merged;
          this.saveLocalFile(local);
          return true;
        } catch (_) { return false; }
      });
      this.settingsWrite = write.then(() => undefined, () => undefined);
      return write;
    }
    const local = this.loadLocalFile();
    local[entity] = data;
    this.saveLocalFile(local);

    const client = await this.getClient();
    if (!client) return false;

    try {
      const dbName = this.getPrimaryDbName();
      const transColl = this.getTransCollectionName();
      const db = client.db(dbName);

      if (entity === 'products' && Array.isArray(data)) {
        await db.collection('products').deleteMany({});
        if (data.length > 0) await db.collection('products').insertMany(data);
      } else if (entity === 'orders' && Array.isArray(data)) {
        for (const o of data) {
          if (o.id || o.invoiceNumber) {
            const filter = { $or: [{ id: o.id || '' }, { invoiceNumber: o.invoiceNumber || '' }] };
            await db.collection(transColl).updateOne(filter, { $set: o }, { upsert: true });
            if (transColl !== 'orders') {
              await db.collection('orders').updateOne(filter, { $set: o }, { upsert: true }).catch(() => {});
            }
          }
        }
      } else if (entity === 'users' && Array.isArray(data)) {
        for (const u of data) {
          if (u.id || u.username) {
            await db.collection('users').updateOne(
              { $or: [{ id: u.id || '' }, { username: u.username || '' }] },
              { $set: u },
              { upsert: true }
            );
          }
        }
      } else if (entity === 'wifiBatches' && Array.isArray(data)) {
        await db.collection('wifi_batches').deleteMany({});
        if (data.length > 0) await db.collection('wifi_batches').insertMany(data);
      } else if (entity === 'promos' && Array.isArray(data)) {
        await db.collection('promos').deleteMany({});
        if (data.length > 0) await db.collection('promos').insertMany(data);
      } else if (entity === 'banners' && Array.isArray(data)) {
        await db.collection('banners').deleteMany({});
        if (data.length > 0) await db.collection('banners').insertMany(data);
      } else if (entity === 'catalogs' && Array.isArray(data)) {
        await db.collection('catalogs').deleteMany({});
        if (data.length > 0) await db.collection('catalogs').insertMany(data);
      }
      return true;
    } catch (err: any) {
      console.warn(`⚠️ Error syncing ${entity} to MongoDB:`, err.message);
      return false;
    }
  }

  /**
   * Database-first save for manual catalog stock. A standalone MongoDB cannot
   * transact across collections, so the complete manual snapshot lives in one
   * document and is published atomically with journaled acknowledgement.
   */
  async saveManualInventory(products: any[], wifiBatches: any[]): Promise<{ success: boolean; data?: { products: any[]; wifiBatches: any[] } }> {
    if (!Array.isArray(products) || !Array.isArray(wifiBatches)) return { success: false };
    if (products.some((product) => !product || typeof product.id !== 'string' || !product.id.trim())) return { success: false };
    if (wifiBatches.some((batch) => !batch || typeof batch.id !== 'string' || !batch.id.trim())) return { success: false };

    const client = await this.getClient();
    if (!client) return { success: false };
    const clean = (rows: any[]) => rows.map(({ _id, ...row }) => row);
    const safeProducts = clean(products);
    const safeBatches = clean(wifiBatches);
    const db = client.db(this.getPrimaryDbName());
    try {
      const updatedAt = new Date().toISOString();
      const result = await db.collection('manual_inventory').findOneAndUpdate(
        { _id: 'current' as any },
        { $set: { products: safeProducts, wifiBatches: safeBatches, updatedAt }, $inc: { revision: 1 } },
        { upsert: true, returnDocument: 'after', writeConcern: { w: 'majority', j: true } }
      );
      const confirmed = result?.value || await db.collection('manual_inventory').findOne({ _id: 'current' as any });
      if (!confirmed || !Array.isArray((confirmed as any).products) || !Array.isArray((confirmed as any).wifiBatches)) return { success: false };

      // Disk is only a recovery mirror. A mirror failure must not negate an
      // already confirmed database commit.
      try {
        const local = this.loadLocalFile();
        local.products = (confirmed as any).products;
        local.wifiBatches = (confirmed as any).wifiBatches;
        this.saveLocalFile(local);
      } catch (_) {}
      return { success: true, data: { products: (confirmed as any).products, wifiBatches: (confirmed as any).wifiBatches } };
    } catch (error: any) {
      console.warn('⚠️ Manual inventory database commit rejected:', error.message);
      return { success: false };
    }
  }

  async reserveManualWifiVoucher(input: { productId?: string; variantId?: string; orderId: string }): Promise<{ code: string; password?: string } | null> {
    const client = await this.getClient();
    if (!client) return null;
    const db = client.db(this.getPrimaryDbName());
    for (let attempt = 0; attempt < 5; attempt++) {
      const snapshot: any = await db.collection('manual_inventory').findOne({ _id: 'current' as any });
      if (!snapshot || !Array.isArray(snapshot.products)) return null;
      const products = structuredClone(snapshot.products);
      const wifiBatches = Array.isArray(snapshot.wifiBatches) ? structuredClone(snapshot.wifiBatches) : [];
      const product = products.find((item: any) => item.id === input.productId);
      if (!product) return null;
      const variant = input.variantId ? (product.variants || []).find((item: any) => item.id === input.variantId) : null;
      const holder = variant || product;
      const codes = Array.isArray(holder.voucherCodes) ? [...holder.voucherCodes] : [];
      const raw = codes.shift();
      if (!raw) return null;
      holder.voucherCodes = codes;
      holder.stock = codes.length;
      if (variant) product.stock = (product.variants || []).reduce((sum: number, item: any) => sum + Number(item.stock || 0), 0);
      const [code, password] = String(raw).split('|');
      const batch = wifiBatches.find((item: any) => item.productId === product.id && (!variant || item.variantId === variant.id));
      const batchVoucher = batch?.vouchers?.find((item: any) => item.status === 'AVAILABLE' && item.code === String(code).trim());
      if (batchVoucher) { batchVoucher.status = 'USED'; batchVoucher.usedAt = new Date().toISOString(); batchVoucher.orderId = input.orderId; }
      const write = await db.collection('manual_inventory').updateOne(
        { _id: 'current' as any, revision: Number(snapshot.revision || 0) },
        { $set: { products, wifiBatches, updatedAt: new Date().toISOString() }, $inc: { revision: 1 } },
        { writeConcern: { w: 'majority', j: true } }
      );
      if (write.modifiedCount === 1) {
        try { const local = this.loadLocalFile(); local.products = products; local.wifiBatches = wifiBatches; this.saveLocalFile(local); } catch (_) {}
        return { code: String(code).trim(), password: password?.trim() || undefined };
      }
    }
    throw new Error('Stok voucher berubah bersamaan. Silakan coba ulang.');
  }

  /**
   * Direct User Persistence (Registration / Update)
   */
  async saveUser(user: any): Promise<{ success: boolean; error?: string }> {
    const local = this.loadLocalFile();
    if (!Array.isArray(local.users)) local.users = [];
    const idx = local.users.findIndex((u: any) => u.id === user.id || u.username === user.username);
    if (idx >= 0) local.users[idx] = { ...local.users[idx], ...user };
    else local.users.push(user);
    this.saveLocalFile(local);

    const client = await this.getClient();
    if (!client) {
      return { success: true }; // Tersimpan di local fallback
    }

    try {
      const db = client.db(this.getPrimaryDbName());
      const filter = { $or: [{ id: user.id || '' }, { username: user.username || '' }, { email: user.email || '' }] };
      await db.collection('users').updateOne(filter, { $set: user }, { upsert: true });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /** Reserve identity before any payment/provider call. No unsafe file-only creation. */
  async createOrder(order: any): Promise<{ success: boolean; conflict?: boolean; error?: string }> {
    const filter = { $or: [{ id: order.id }, { invoiceNumber: order.invoiceNumber }] };
    const local = this.loadLocalFile();
    const localOrders = Array.isArray(local.orders) ? local.orders : Object.values(local.orders || {});
    if (localOrders.some((o: any) => o.id === order.id || o.invoiceNumber === order.invoiceNumber)) return { success: false, conflict: true };
    const client = await this.getClient();
    if (!client) return { success: false, error: 'Database reservasi pesanan tidak tersedia.' };
    try {
      const db = client.db(this.getPrimaryDbName());
      const names = [...new Set([this.getTransCollectionName() || 'orders', 'orders'])];
      for (const name of names) {
        if (await db.collection(name).findOne(filter)) return { success: false, conflict: true };
      }
      // Unique indexes are required for cross-process duplicate protection. If legacy
      // duplicates prevent index creation, fail closed; never repair customer data here.
      for (const name of names) for (const key of ['id', 'invoiceNumber']) {
        await db.collection(name).createIndex({ [key]: 1 }, { unique: true, partialFilterExpression: { [key]: { $type: 'string' } } });
      }
      for (const name of names) await db.collection(name).insertOne({ ...order });
      local.orders = [order, ...localOrders];
      this.saveLocalFile(local);
      return { success: true };
    } catch (error: any) {
      // A failed mirror/payment leaves an identity reservation, not a reusable ID.
      return { success: false, conflict: error.code === 11000, error: 'Reservasi identitas pesanan gagal.' };
    }
  }

  /**
   * Direct Order Persistence (Webhook/Payment Update); ownership is insert-only.
   */
  async saveOrder(order: any): Promise<{ success: boolean; error?: string }> {
    const local = this.loadLocalFile();
    if (!Array.isArray(local.orders)) local.orders = [];
    const { _id, id, invoiceNumber, userId, guestAccessToken, ...mutable } = order;
    const identity = { id, invoiceNumber, ...(userId ? { userId } : {}), ...(guestAccessToken ? { guestAccessToken } : {}) };
    const idx = local.orders.findIndex((o: any) => o.id === id || o.invoiceNumber === invoiceNumber);
    if (idx >= 0) {
      if (local.orders[idx].id !== id || local.orders[idx].invoiceNumber !== invoiceNumber) return { success: false, error: 'Order identity conflict' };
      local.orders[idx] = { ...local.orders[idx], ...mutable };
    } else local.orders.unshift({ ...identity, ...mutable });
    this.saveLocalFile(local);

    const client = await this.getClient();
    if (!client) {
      return { success: true }; // Tersimpan di local fallback
    }

    try {
      const db = client.db(this.getPrimaryDbName());
      const transColl = this.getTransCollectionName();
      const filter = { id, invoiceNumber };
      const update = { $set: mutable, $setOnInsert: identity };
      await db.collection(transColl || 'orders').updateOne(filter, update, { upsert: true });
      if (transColl && transColl !== 'orders') {
        await db.collection('orders').updateOne(filter, update, { upsert: true });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Update Order Fields in MongoDB & Local State
   */
  async updateOrder(orderId: string, updates: any): Promise<{ success: boolean; error?: string }> {
    const cleanId = String(orderId || '').trim();
    const local = this.loadLocalFile();
    if (Array.isArray(local.orders)) {
      const idx = local.orders.findIndex((o: any) => o.id === cleanId || o.invoiceNumber === cleanId);
      if (idx >= 0) {
        local.orders[idx] = { ...local.orders[idx], ...updates, updatedAt: new Date().toISOString() };
        this.saveLocalFile(local);
      }
    }

    const client = await this.getClient();
    if (!client) {
      return { success: true };
    }

    try {
      const db = client.db(this.getPrimaryDbName());
      const transColl = this.getTransCollectionName();
      const filter = { $or: [{ id: cleanId }, { invoiceNumber: cleanId }] };
      const setPayload = { ...updates, updatedAt: new Date().toISOString() };

      await db.collection(transColl).updateOne(filter, { $set: setPayload });
      if (transColl !== 'orders') {
        await db.collection('orders').updateOne(filter, { $set: setPayload }).catch(() => {});
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Push Subscription Persistence
   */
  async savePushSubscription(sub: any): Promise<{ success: boolean; error?: string }> {
    const local = this.loadLocalFile();
    if (!Array.isArray(local.pushSubscriptions)) local.pushSubscriptions = [];
    const idx = local.pushSubscriptions.findIndex((s: any) => s.token === sub.token);
    if (idx >= 0) local.pushSubscriptions[idx] = { ...local.pushSubscriptions[idx], ...sub };
    else local.pushSubscriptions.push(sub);
    this.saveLocalFile(local);

    const client = await this.getClient();
    if (!client) return { success: true };

    try {
      const db = client.db(this.getPrimaryDbName());
      await db.collection('push_subscriptions').updateOne({ token: sub.token }, { $set: sub }, { upsert: true });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async removePushSubscription(token: string): Promise<{ success: boolean }> {
    const local = this.loadLocalFile();
    if (Array.isArray(local.pushSubscriptions)) {
      local.pushSubscriptions = local.pushSubscriptions.filter((s: any) => s.token !== token);
      this.saveLocalFile(local);
    }

    const client = await this.getClient();
    if (client) {
      try {
        const db = client.db(this.getPrimaryDbName());
        await db.collection('push_subscriptions').deleteOne({ token });
      } catch (_) {}
    }
    return { success: true };
  }

  /**
   * Test Connection with safe diagnostic messages without credential leakage
   */
  async testConnection(
    customUri?: string,
    userDbName?: string,
    transDbName?: string
  ): Promise<MongoTestResult> {
    const startTime = Date.now();
    const uri = customUri || this.getUri();
    const dbName = userDbName || this.getPrimaryDbName();
    const transName = transDbName || this.getTransCollectionName();

    if (!uri) {
      return {
        success: false,
        message: 'MongoDB URI belum diisi di backend (.env atau Server Config).',
        diagnosticHelp: 'Silakan isi MONGODB_URI dengan connection string dari MongoDB Atlas Anda.',
        timestamp: new Date().toISOString(),
      };
    }

    const testClient = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      serverSelectionTimeoutMS: 6000,
      connectTimeoutMS: 6000,
    });

    try {
      await testClient.connect();
      
      // Send a ping to confirm a successful connection
      await testClient.db("admin").command({ ping: 1 });
      console.log("Pinged your deployment. You successfully connected to MongoDB!");

      const primaryDb = testClient.db(dbName || 'admin');
      if (dbName && dbName !== 'admin') {
        await primaryDb.command({ ping: 1 });
      }

      const latencyMs = Date.now() - startTime;

      // Update runtime singleton
      await this.resetClient();
      CONSOLE_CONFIG.MONGODB_URI = uri;
      CONSOLE_CONFIG.MONGODB_DBNAME = dbName;
      CONSOLE_CONFIG.MONGODB_DBNAME_TRANS = transName;

      // Seed/sync all local data directly to MongoDB Atlas collections
      if (dbName) {
        const localData = this.loadLocalFile();
        await this.syncAllState(localData);
      }

      // Re-query collections to get updated live document counts
      let collectionsWithCount: { name: string; count: number }[] = [];
      try {
        const uCols = await primaryDb.listCollections().toArray();
        for (const col of uCols) {
          try {
            const count = await primaryDb.collection(col.name).countDocuments();
            collectionsWithCount.push({ name: col.name, count });
          } catch (_) {
            collectionsWithCount.push({ name: col.name, count: 0 });
          }
        }
      } catch (_) {}

      return {
        success: true,
        message: `Koneksi ke MongoDB Cluster Berhasil! Pinged your deployment. (${latencyMs}ms)`,
        latencyMs,
        database: dbName,
        collections: collectionsWithCount,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      const errMsg = err.message || err.toString();
      let diagnosticHelp = 'Pastikan kredensial dan konfigurasi MongoDB Atlas sudah benar.';

      if (errMsg.includes('bad auth') || errMsg.includes('AuthenticationFailed') || errMsg.includes('auth failed')) {
        diagnosticHelp = 'Autentikasi Gagal: Username atau Password database user salah. Buka MongoDB Atlas -> Database Access -> edit user dan pastikan password benar (tanpa karakter spesial yang belum di-URL encode).';
      } else if (errMsg.includes('timed out') || errMsg.includes('ETIMEDOUT') || errMsg.includes('ENOTFOUND') || errMsg.includes('Could not connect')) {
        diagnosticHelp = 'IP Access Blocked / Timeout: IP server/komputer Anda belum diizinkan. Buka MongoDB Atlas -> Network Access -> Add IP Address -> masukkan 0.0.0.0/0 (Allow Access from Anywhere).';
      } else if (errMsg.includes('querySrv')) {
        diagnosticHelp = 'DNS SRV Error: Host cluster tidak ditemukan. Periksa connection string MONGODB_URI Anda.';
      }

      return {
        success: false,
        message: 'Gagal terhubung ke MongoDB Atlas Cluster.',
        error: errMsg.replace(/:([^:@]+)@/, ':****@'), // Sanitasi rahasia
        diagnosticHelp,
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    } finally {
      try {
        await testClient.close();
      } catch (_) {}
    }
  }

  async runSampleQuery(
    customUri?: string,
    targetDb?: string,
    targetCollection?: string,
    queryObject?: any
  ): Promise<{ success: boolean; data?: any; message: string; latencyMs: number }> {
    const startTime = Date.now();
    const uri = customUri || this.getUri();
    const dbName = targetDb || this.getPrimaryDbName();
    const collName = targetCollection || this.getTransCollectionName();
    const query = queryObject || {};

    if (!uri) {
      return {
        success: false,
        message: 'MongoDB URI belum diisi.',
        latencyMs: 0,
      };
    }

    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      serverSelectionTimeoutMS: 6000,
      connectTimeoutMS: 6000,
    });

    try {
      await client.connect();
      const database = client.db(dbName);
      const collection = database.collection(collName);

      const result = await collection.findOne(query);
      const latencyMs = Date.now() - startTime;

      return {
        success: true,
        data: result || { info: `Collection '${collName}' dicek, dokumen belum ada (0 documents).` },
        message: result
          ? `Dokumen ditemukan di database '${dbName}', collection '${collName}' (${latencyMs}ms)`
          : `Kueri sukses, collection '${collName}' telah dicek (${latencyMs}ms)`,
        latencyMs,
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Gagal menjalankan kueri MongoDB.',
        latencyMs: Date.now() - startTime,
      };
    } finally {
      try {
        await client.close();
      } catch (_) {}
    }
  }
}

export const mongoDbService = new MongoDbService();
