import fs from 'node:fs';
import { mergeSettings } from './settingsMerge.js';
import path from 'node:path';
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
  private client: MongoClient | null = null;
  private isConnecting: boolean = false;

  private omitId(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    const { _id, ...rest } = obj;
    return rest;
  }

  private readEnvFile(): { uri: string; dbName: string; dbNameTrans: string } {
    try {
      const envPath = path.join(process.cwd(), '.env');
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

      const hasMongoData = products.length > 0 || orders.length > 0 || users.length > 0 || settingsDoc || pushSubscriptions.length > 0;

      if (!hasMongoData) {
        // Seed initial local data into MongoDB if MongoDB is empty
        if (local && (local.products?.length || local.orders?.length || local.users?.length || local.pushSubscriptions?.length)) {
          this.syncAllState(local).catch(() => {});
        }
        return local;
      }

      const combined = {
        products: (products.length > 0 ? products : local.products || []).filter((p: any) => !isMockDigiflazz(p)),
        orders: orders.length > 0 ? orders : local.orders || [],
        users: users.length > 0 ? users : local.users || [],
        wifiBatches: wifiBatches.length > 0 ? wifiBatches : local.wifiBatches || [],
        promos: promos.length > 0 ? promos : local.promos || [],
        auditLogs: auditLogs.length > 0 ? auditLogs : local.auditLogs || [],
        // Settings saves use the server file as the durable authority; Mongo may be an older mirror.
        settings: mergeSettings(settingsDoc?.data, this.loadLocalFile().settings),
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
    this.saveLocalFile(state);

    const client = await this.getClient();
    if (!client) return false;

    try {
      const dbName = this.getPrimaryDbName();
      const transColl = this.getTransCollectionName();
      const db = client.db(dbName);

      // 1. Save settings
      if (state.settings) {
        await db.collection('settings').updateOne(
          { _id: 'app_settings' as any },
          { $set: { data: state.settings, updatedAt: new Date().toISOString() } },
          { upsert: true }
        );
      }

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

      // 4. Save users
      if (Array.isArray(state.users) && state.users.length > 0) {
        for (const u of state.users) {
          const uId = u.id || u.username || u.email;
          if (uId) {
            await db.collection('users').updateOne(
              { $or: [{ id: u.id || '' }, { username: u.username || '' }, { email: u.email || '' }] },
              { $set: u },
              { upsert: true }
            );
          }
        }
      }

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
    const local = this.loadLocalFile();
    if (entity === 'settings') data = mergeSettings(local.settings, data);
    local[entity] = data;
    this.saveLocalFile(local);

    const client = await this.getClient();
    if (!client) return false;

    try {
      const dbName = this.getPrimaryDbName();
      const transColl = this.getTransCollectionName();
      const db = client.db(dbName);

      if (entity === 'settings') {
        await db.collection('settings').updateOne(
          { _id: 'app_settings' as any },
          { $set: { data, updatedAt: new Date().toISOString() } },
          { upsert: true }
        );
      } else if (entity === 'products' && Array.isArray(data)) {
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

  /**
   * Direct Order Persistence (Order Creation / Webhook Update)
   */
  async saveOrder(order: any): Promise<{ success: boolean; error?: string }> {
    const local = this.loadLocalFile();
    if (!Array.isArray(local.orders)) local.orders = [];
    const idx = local.orders.findIndex((o: any) => o.id === order.id || o.invoiceNumber === order.invoiceNumber);
    if (idx >= 0) local.orders[idx] = { ...local.orders[idx], ...order };
    else local.orders.unshift(order);
    this.saveLocalFile(local);

    const client = await this.getClient();
    if (!client) {
      return { success: true }; // Tersimpan di local fallback
    }

    try {
      const db = client.db(this.getPrimaryDbName());
      const transColl = this.getTransCollectionName();
      const filter = { $or: [{ id: order.id || '' }, { invoiceNumber: order.invoiceNumber || '' }] };

      await db.collection(transColl).updateOne(filter, { $set: order }, { upsert: true });
      if (transColl !== 'orders') {
        await db.collection('orders').updateOne(filter, { $set: order }, { upsert: true }).catch(() => {});
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
