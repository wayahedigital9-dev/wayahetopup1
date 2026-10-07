import fs from 'node:fs';
import { mergeSettings } from './settingsMerge.js';
import path from 'node:path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CONSOLE_CONFIG } from '../config/console.js';

export interface SupabaseTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  projectUrl?: string;
  tables?: {
    name: string;
    count: number;
    status: 'READY' | 'NOT_FOUND';
  }[];
  sampleData?: any;
  error?: string;
  diagnosticHelp?: string;
  timestamp: string;
}

export function sanitizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let str = String(rawUrl).trim();
  if (!str) return '';
  if (!str.startsWith('http://') && !str.startsWith('https://')) {
    str = 'https://' + str;
  }
  try {
    const parsed = new URL(str);
    if (parsed.hostname.endsWith('.supabase.co')) {
      return parsed.origin;
    }
    let cleanPath = parsed.pathname
      .replace(/\/rest(\/v1)?\/?$/i, '')
      .replace(/\/+$/, '');
    return parsed.origin + (cleanPath && cleanPath !== '/' ? cleanPath : '');
  } catch {
    return str
      .replace(/\/rest(\/v1)?\/?$/i, '')
      .replace(/\/+$/, '');
  }
}

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

export class SupabaseService {
  private client: SupabaseClient | null = null;
  private currentUrl: string = '';
  private currentKey: string = '';

  private readEnvFile(): { url: string; publishableKey: string; secretKey: string; dbUrl: string } {
    try {
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const matchUrl = content.match(/SUPABASE_URL=["']?(.*?)["']?(\r?\n|$)/);
        const matchPublishable = content.match(/SUPABASE_PUBLISHABLE_KEY=["']?(.*?)["']?(\r?\n|$)/) || content.match(/SUPABASE_ANON_KEY=["']?(.*?)["']?(\r?\n|$)/);
        const matchSecret = content.match(/SUPABASE_SECRET_KEY=["']?(.*?)["']?(\r?\n|$)/) || content.match(/SUPABASE_SERVICE_ROLE_KEY=["']?(.*?)["']?(\r?\n|$)/);
        const matchDbUrl = content.match(/SUPABASE_DB_URL=["']?(.*?)["']?(\r?\n|$)/);

        return {
          url: matchUrl && matchUrl[1] ? sanitizeSupabaseUrl(matchUrl[1]) : '',
          publishableKey: matchPublishable && matchPublishable[1] ? matchPublishable[1].trim() : '',
          secretKey: matchSecret && matchSecret[1] ? matchSecret[1].trim() : '',
          dbUrl: matchDbUrl && matchDbUrl[1] ? matchDbUrl[1].trim() : '',
        };
      }
    } catch (_) { }
    return { url: '', publishableKey: '', secretKey: '', dbUrl: '' };
  }

  public getUrl(): string {
    const fromEnv = this.readEnvFile().url;
    return sanitizeSupabaseUrl(fromEnv || CONSOLE_CONFIG.SUPABASE_URL || process.env.SUPABASE_URL || '');
  }

  public getKey(): string {
    const envData = this.readEnvFile();
    return (
      envData.secretKey ||
      envData.publishableKey ||
      CONSOLE_CONFIG.SUPABASE_SECRET_KEY ||
      CONSOLE_CONFIG.SUPABASE_PUBLISHABLE_KEY ||
      CONSOLE_CONFIG.SUPABASE_SERVICE_ROLE_KEY ||
      CONSOLE_CONFIG.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      ''
    );
  }

  public getDbUrl(): string {
    const fromEnv = this.readEnvFile().dbUrl;
    return fromEnv || CONSOLE_CONFIG.SUPABASE_DB_URL || process.env.SUPABASE_DB_URL || '';
  }

  /**
   * Mengembalikan SupabaseClient aktif (Singleton)
   */
  public getClient(): SupabaseClient | null {
    const url = this.getUrl();
    const key = this.getKey();

    if (!url || !key) {
      return null;
    }

    if (this.client && this.currentUrl === url && this.currentKey === key) {
      return this.client;
    }

    try {
      this.client = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      this.currentUrl = url;
      this.currentKey = key;
      return this.client;
    } catch (err: any) {
      console.warn('⚠️ [Supabase] Client creation warning:', err.message);
      this.client = null;
      return null;
    }
  }

  /**
   * Helper load dari file JSON lokal
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
        };
      }
    } catch (_) { }
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
    };
  }

  /**
   * Simpan local file
   */
  private saveLocalFile(data: any, required = false) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (_) {
      if (required) throw new Error('Settings could not be persisted to server storage');
    }
  }

  /**
   * Menguji koneksi Supabase & Mengecek ketersediaan tabel
   */
  async testConnection(customUrl?: string, customKey?: string): Promise<SupabaseTestResult> {
    const url = sanitizeSupabaseUrl(customUrl || this.getUrl());
    const key = (customKey || this.getKey()).trim();

    if (!url || !key) {
      return {
        success: false,
        message: 'Supabase URL atau API Key belum diisi di backend (.env atau Dashboard).',
        diagnosticHelp: 'Buka Dashboard Supabase (supabase.com) -> Project Settings -> API -> salin Project URL dan anon/service_role API Key.',
        timestamp: new Date().toISOString(),
      };
    }

    try {
      // Re-use warm singleton client or instantiate
      let testClient = this.client;
      if (!testClient || this.currentUrl !== url || this.currentKey !== key) {
        testClient = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        this.client = testClient;
        this.currentUrl = url;
        this.currentKey = key;
        CONSOLE_CONFIG.SUPABASE_URL = url;
        CONSOLE_CONFIG.SUPABASE_ANON_KEY = key;
      }

      // Fast single probe to accurately measure database RTT ping latency
      const pingStart = Date.now();
      const probeRes = await testClient.from('orders').select('id').limit(1);
      const latencyMs = Math.max(Date.now() - pingStart, 1);

      // Tes status tabel secara paralel tanpa membebani latency ping
      const checkTables = [
        'orders', 'products', 'users', 'order_items', 'payment_attempts',
        'wifi_batches', 'wifi_voucher_items', 'promo_codes',
        'warranties', 'claims', 'monitoring', 'dispatched_accounts',
        'notifications', 'app_settings', 'settings', 'digiflazz_logs',
        'audit_logs', 'qiospay_events', 'admin_push_subscriptions'
      ];
      const tablePromises = checkTables.map(async (t) => {
        try {
          if (t === 'orders' && !probeRes.error) {
            return { name: t, count: probeRes.data ? probeRes.data.length : 0, status: 'READY' as const };
          }
          // Pilih kolom primary key minimal (id, key, nmid) dengan limit 1
          let col = 'id';
          if (t === 'app_settings' || t === 'settings') col = 'key';
          if (t === 'qiospay_events') col = 'nmid';

          const { data, error } = await testClient.from(t).select(col).limit(1);

          if (!error) {
            return { name: t, count: data ? data.length : 0, status: 'READY' as const };
          }

          // Khusus app_settings, coba fallback tabel 'settings'
          if (t === 'app_settings') {
            const fallback = await testClient.from('settings').select('key').limit(1);
            if (!fallback.error) {
              return { name: t, count: fallback.data ? fallback.data.length : 0, status: 'READY' as const };
            }
          }

          return { name: t, count: 0, status: 'NOT_FOUND' as const };
        } catch (_) {
          return { name: t, count: 0, status: 'NOT_FOUND' as const };
        }
      });

      const tableResults = await Promise.all(tablePromises);

      const readyCount = tableResults.filter(t => t.status === 'READY').length;
      const projectId = url.replace('https://', '').split('.')[0] || '';

      if (readyCount === 0) {
        return {
          success: false,
          message: `Koneksi ke Supabase Terhubung (${latencyMs}ms), TETAPI tabel database belum dibuat (0/${checkTables.length} tabel).`,
          diagnosticHelp: `Buka Supabase SQL Editor (https://supabase.com/dashboard/project/${projectId}/sql), klik "New Query", paste skrip SQL migrasi, dan klik Run.`,
          latencyMs,
          projectUrl: url.replace(/:([^:@]+)@/, ':****@'),
          tables: tableResults,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        message: `Koneksi ke Supabase Cloud Berhasil! (${readyCount}/${checkTables.length} tabel siap, ${latencyMs}ms)`,
        latencyMs,
        projectUrl: url.replace(/:([^:@]+)@/, ':****@'),
        tables: tableResults,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      const errMsg = err.message || err.toString();
      return {
        success: false,
        message: 'Gagal terhubung ke Supabase.',
        error: errMsg,
        diagnosticHelp: 'Pastikan Project URL berformat https://<project-id>.supabase.co dan API key (anon atau service_role) masih aktif.',
        latencyMs: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Menjalankan contoh query Supabase
   */
  async runSampleQuery(
    customUrl?: string,
    customKey?: string,
    table: string = 'orders',
    queryObj?: any
  ): Promise<{ success: boolean; data?: any; message: string; latencyMs: number }> {
    const url = sanitizeSupabaseUrl(customUrl || this.getUrl());
    const key = (customKey || this.getKey()).trim();

    if (!url || !key) {
      return {
        success: false,
        message: 'Supabase URL atau Key belum disetel.',
        latencyMs: 0,
      };
    }

    try {
      let client = this.client;
      if (!client || this.currentUrl !== url || this.currentKey !== key) {
        client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
        this.client = client;
        this.currentUrl = url;
        this.currentKey = key;
      }
      const targetTable = table || 'orders';

      const startTime = Date.now();
      const { data, error } = await client
        .from(targetTable)
        .select('*')
        .limit(10);

      const latencyMs = Math.max(Date.now() - startTime, 1);

      if (error) {
        return {
          success: false,
          message: `Query gagal pada tabel '${targetTable}': ${error.message}`,
          data: { error: error.message, hint: error.hint, details: error.details },
          latencyMs,
        };
      }

      return {
        success: true,
        message: `Query select dari '${targetTable}' berhasil (${data?.length || 0} baris ditemukan).`,
        data: data || [],
        latencyMs,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Error saat eksekusi query Supabase',
        latencyMs: 0,
      };
    }
  }

  /**
   * Menjalankan SQL langsung ke database Supabase via stored procedure exec_sql
   */
  async execSql(sql: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const client = this.getClient();
    if (!client) {
      return { success: false, error: 'Supabase client belum terhubung' };
    }
    try {
      const { data, error } = await client.rpc('exec_sql', { sql_query: sql });
      if (error) {
        return { success: false, error: error.message };
      }
      return {
        success: data?.success ?? true,
        message: data?.message || 'SQL berhasil dijalankan',
        error: data?.error,
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Menyimpan Order ke Supabase (dengan fallback ke file lokal)
   */
  async saveOrder(order: any): Promise<boolean> {
    const local = this.loadLocalFile();
    const idx = local.orders.findIndex((o: any) => o.id === order.id || o.invoiceNumber === order.invoiceNumber);
    if (idx >= 0) {
      local.orders[idx] = { ...local.orders[idx], ...order };
    } else {
      local.orders.unshift(order);
    }
    this.saveLocalFile(local);

    const client = this.getClient();
    if (client) {
      try {
        const invoiceNum = order.invoiceNumber || order.invoice_number || `INV-${order.id}`;
        const custName = order.customerName || order.customer_name || 'Pelanggan Wayahe';
        const custPhone = order.customerPhone || order.customer_phone || order.targetDestination || order.target_destination || '';
        const targetDest = order.targetDestination || order.target_destination || custPhone;
        const totAmount = Number(order.totalAmount || order.total_amount || 0);
        const payStatus = order.paymentStatus || order.payment_status || 'PENDING';
        const fulStatus = order.fulfillmentStatus || order.fulfillment_status || 'NOT_STARTED';

        const rawData = {
          ...(order.raw_data && typeof order.raw_data === 'object' ? order.raw_data : {}),
          paidAt: order.paidAt || order.paid_at || null,
          qiospayRefid: order.qiospayRefid || order.qiospay_refid || null,
          qiospayNmid: order.qiospayNmid || order.qiospay_nmid || null,
          qiospayIssuer: order.qiospayIssuer || order.qiospay_issuer || null,
          qiospayPaidAt: order.qiospayPaidAt || order.qiospay_paid_at || null,
          wifiVoucherCode: order.wifiVoucherCode || null,
          wifiPassword: order.wifiPassword || null,
          errorReason: order.errorReason || null,
        };

        const validPayload: any = {
          id: order.id,
          invoiceNumber: invoiceNum,
          customerName: custName,
          customerPhone: custPhone,
          customerEmail: order.customerEmail || order.customer_email || null,
          targetDestination: targetDest,
          category: order.category || 'pulsa',
          subtotal: Number(order.subtotal || 0),
          adminFee: Number(order.adminFee || order.admin_fee || 0),
          discount: Number(order.discount || 0),
          promoCode: order.promoCode || order.promo_code || null,
          totalAmount: totAmount,
          paymentStatus: payStatus,
          fulfillmentStatus: fulStatus,
          paymentMethod: order.paymentMethod || order.payment_method || 'QRIS',
          deliveryMethod: order.deliveryMethod || order.delivery_method || 'AUTOMATIC',
          guestAccessToken: order.guestAccessToken || order.guest_access_token || null,
          items: Array.isArray(order.items) ? order.items : [],
          raw_data: rawData,
          updatedAt: new Date().toISOString(),
        };

        const res1 = await client.from('orders').upsert(validPayload, { onConflict: 'id' });
        if (!res1.error) {
          console.log(`✅ [Supabase] Order ${invoiceNum} tersimpan ke tabel 'orders'`);
          return true;
        }

        console.warn(`⚠️ [Supabase] Upsert order warning:`, res1.error?.message);
      } catch (err: any) {
        console.warn(`⚠️ [Supabase] Gagal menyimpan order:`, err.message);
      }
    }
    return false;
  }

  /**
   * Mengambil satu data Order dari Supabase
   */
  async getOrder(orderIdOrInvoice: string): Promise<any | null> {
    const cleanId = String(orderIdOrInvoice || '').trim();
    const local = this.loadLocalFile();
    const localOrder = (local.orders || []).find((o: any) => o.id === cleanId || o.invoiceNumber?.toLowerCase() === cleanId.toLowerCase() || o.invoice_number?.toLowerCase() === cleanId.toLowerCase());
    if (localOrder) return localOrder;

    const client = this.getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('orders')
          .select('*')
          .or(`id.eq.${cleanId},invoiceNumber.eq.${cleanId}`)
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          return data;
        }
      } catch (_) {}
    }
    return null;
  }

  /**
   * Memperbarui status Order di Supabase
   */
  async updateOrderStatus(
    orderId: string,
    paymentStatus: string,
    fulfillmentStatus: string,
    errorReason?: string,
    additionalFields?: Record<string, any>
  ): Promise<boolean> {
    const cleanId = String(orderId || '').trim();
    const local = this.loadLocalFile();
    const idx = (local.orders || []).findIndex((o: any) => o.id === cleanId || o.invoiceNumber === cleanId || o.invoice_number === cleanId);
    if (idx >= 0) {
      local.orders[idx] = {
        ...local.orders[idx],
        paymentStatus,
        payment_status: paymentStatus,
        fulfillmentStatus,
        fulfillment_status: fulfillmentStatus,
        errorReason: errorReason || local.orders[idx].errorReason,
        ...(additionalFields || {}),
        updatedAt: new Date().toISOString(),
      };
      this.saveLocalFile(local);
    }

    const client = this.getClient();
    if (client) {
      try {
        const updates: any = {
          paymentStatus,
          fulfillmentStatus,
          updatedAt: new Date().toISOString(),
        };

        if (errorReason || additionalFields) {
          try {
            const { data: existing } = await client
              .from('orders')
              .select('raw_data')
              .or(`id.eq.${cleanId},invoiceNumber.eq.${cleanId}`)
              .limit(1)
              .maybeSingle();

            const existingRaw = existing?.raw_data && typeof existing.raw_data === 'object' ? existing.raw_data : {};
            updates.raw_data = {
              ...existingRaw,
              ...(additionalFields || {}),
              ...(errorReason ? { errorReason } : {}),
            };
          } catch (_) {}
        }

        const res = await client
          .from('orders')
          .update(updates)
          .or(`id.eq.${cleanId},invoiceNumber.eq.${cleanId}`);

        if (!res.error) {
          return true;
        }
        console.warn(`⚠️ [Supabase] updateOrderStatus warning:`, res.error?.message);
      } catch (err: any) {
        console.warn(`⚠️ [Supabase] Gagal update status order:`, err.message);
      }
    }
    return false;
  }

  /**
   * Menyimpan User ke Supabase
   */
  async saveUser(user: any): Promise<boolean> {
    const local = this.loadLocalFile();
    const idx = local.users.findIndex((u: any) => u.id === user.id || (u.email && u.email === user.email));
    if (idx >= 0) {
      local.users[idx] = { ...local.users[idx], ...user };
    } else {
      local.users.push(user);
    }
    this.saveLocalFile(local);

    const client = this.getClient();
    if (client) {
      try {
        const payload = {
          id: user.id && user.id.includes('-') && user.id.length >= 32 ? user.id : undefined,
          email: user.email,
          phone: user.phone,
          name: user.name,
          role: user.role || 'CUSTOMER',
          updatedAt: new Date().toISOString(),
        };

        const { error } = await client
          .from('users')
          .upsert(payload);

        if (!error) {
          console.log(`✅ [Supabase] User ${user.email || user.name} tersimpan ke tabel 'users'`);
          return true;
        }
      } catch (err: any) {
        console.warn(`⚠️ [Supabase] Gagal menyimpan user:`, err.message);
      }
    }
    return false;
  }

  /**
   * Menyimpan Admin Push Subscription ke Supabase
   */
  async savePushSubscription(sub: any): Promise<boolean> {
    const local = this.loadLocalFile();
    if (!Array.isArray(local.pushSubscriptions)) local.pushSubscriptions = [];
    const idx = local.pushSubscriptions.findIndex((s: any) => s.token === sub.token);
    if (idx >= 0) local.pushSubscriptions[idx] = { ...local.pushSubscriptions[idx], ...sub };
    else local.pushSubscriptions.push(sub);
    this.saveLocalFile(local);

    const client = this.getClient();
    if (client) {
      try {
        const payload = {
          id: sub.id,
          admin_user_id: sub.adminUserId || 'admin',
          token: sub.token,
          installation_id: sub.installationId || null,
          device_name: sub.deviceName || 'Perangkat Admin',
          platform: sub.platform || 'Web',
          user_agent: sub.userAgent || null,
          enabled: sub.enabled !== false,
          created_at: sub.createdAt || new Date().toISOString(),
          updated_at: sub.updatedAt || new Date().toISOString(),
          last_used_at: sub.lastUsedAt || new Date().toISOString(),
        };

        const { error } = await client.from('admin_push_subscriptions').upsert(payload, { onConflict: 'token' });
        if (!error) {
          console.log(`✅ [Supabase] Push Subscription tersimpan ke Supabase`);
          return true;
        }
      } catch (err: any) {
        console.warn(`⚠️ [Supabase] Gagal menyimpan push subscription:`, err.message);
      }
    }
    return false;
  }

  /**
   * Menghapus Admin Push Subscription dari Supabase
   */
  async removePushSubscription(token: string): Promise<boolean> {
    const local = this.loadLocalFile();
    if (Array.isArray(local.pushSubscriptions)) {
      local.pushSubscriptions = local.pushSubscriptions.filter((s: any) => s.token !== token);
      this.saveLocalFile(local);
    }

    const client = this.getClient();
    if (client) {
      try {
        await client.from('admin_push_subscriptions').delete().eq('token', token);
        return true;
      } catch (_) {}
    }
    return false;
  }

  /**
   * Sinkronisasi seluruh data lokal ke Supabase
   */
  async syncAllState(data: any): Promise<{ success: boolean; syncedTables: string[]; errors: string[] }> {
    const client = this.getClient();
    if (!client) {
      return { success: false, syncedTables: [], errors: ['Supabase Client belum terhubung'] };
    }

    const syncedTables: string[] = [];
    const errors: string[] = [];

    // 1. Sync Products
    if (Array.isArray(data.products) && data.products.length > 0) {
      try {
        const rows = data.products.map((p: any) => ({
          id: p.id,
          categoryId: p.categoryId || p.category_id || 'PULSA',
          provider: p.provider || '',
          name: p.name || '',
          sku: p.sku || '',
          supplierPrice: Number(p.supplierPrice || p.supplier_price || 0),
          sellingPrice: Number(p.sellingPrice || p.selling_price || 0),
          isActive: p.isActive !== false,
          stock: p.stock ?? 0,
          raw_data: p,
          updatedAt: new Date().toISOString(),
        }));
        const { error } = await client.from('products').upsert(rows, { onConflict: 'id' });
        if (!error) syncedTables.push('products');
        else errors.push(`products: ${error.message}`);
      } catch (e: any) {
        errors.push(`products: ${e.message}`);
      }
    }

    // 2. Sync Orders
    if (Array.isArray(data.orders) && data.orders.length > 0) {
      try {
        const rows = data.orders.map((o: any) => ({
          id: o.id,
          invoiceNumber: o.invoiceNumber || o.invoice_number || `INV-${o.id}`,
          customerName: o.customerName || o.customer_name || 'Pelanggan',
          customerPhone: o.customerPhone || o.customer_phone || '',
          totalAmount: Number(o.totalAmount || o.total_amount || 0),
          paymentStatus: o.paymentStatus || o.payment_status || 'PENDING',
          fulfillmentStatus: o.fulfillmentStatus || o.fulfillment_status || 'NOT_STARTED',
          items: Array.isArray(o.items) ? o.items : [],
          raw_data: o,
          updatedAt: new Date().toISOString(),
        }));
        const { error } = await client.from('orders').upsert(rows, { onConflict: 'id' });
        if (!error) syncedTables.push('orders');
        else errors.push(`orders: ${error.message}`);
      } catch (e: any) {
        errors.push(`orders: ${e.message}`);
      }
    }

    return {
      success: errors.length === 0,
      syncedTables,
      errors,
    };
  }

  /**
   * Menyimpan entity umum (seperti 'settings', 'products', dll) ke Supabase dan lokal
   */
  async syncEntity(collectionName: string, data: any): Promise<{ success: boolean; supabasePersisted: boolean; error?: string }> {
    const local = this.loadLocalFile();
    if (collectionName === 'settings' || collectionName === 'app_settings') {
      // MERGE: preserve existing secrets when incoming data has empty/undefined
      const mergedLocal = mergeSettings(local.settings, data);
      local.settings = mergedLocal;
      this.saveLocalFile(local, true);
      // data for supabase is mergedLocal (full, including secrets) — will be re-merged with existing supabase row below
      data = mergedLocal;
    } else if (Array.isArray(data)) {
      local[collectionName] = data;
      this.saveLocalFile(local);
    }

    const client = this.getClient();
    let supabasePersisted = false;
    let supabaseError: string | undefined;

    if (client) {
      try {
        if (collectionName === 'settings' || collectionName === 'app_settings') {
          // MERGE with existing Supabase row (avoid wipe when frontend sends partial)
          let existingVal: any = {};
          try {
            const existing = await client.from('app_settings').select('value').eq('key', 'main_settings').maybeSingle();
            if (existing?.data?.value && !existing.error) existingVal = existing.data.value as any;
            if (typeof existingVal === 'string') existingVal = JSON.parse(existingVal);
          } catch (_) {}
          const mergedSupabase = mergeSettings(existingVal, data);
          const payload = { key: 'main_settings', value: mergedSupabase, updatedAt: new Date().toISOString() };

          // Try app_settings first
          const res1 = await client.from('app_settings').upsert(payload, { onConflict: 'key' });
          if (!res1.error) {
            supabasePersisted = true;
          } else {
            // Try fallback settings table
            const res2 = await client.from('settings').upsert({ key: 'main_settings', value: mergedSupabase, updated_at: new Date().toISOString() }, { onConflict: 'key' });
            if (!res2.error) {
              supabasePersisted = true;
            } else {
              supabaseError = res1.error.message || res2.error.message;
              console.warn(`⚠️ [Supabase] Gagal upsert settings:`, supabaseError);
            }
          }
        } else if (['orders', 'users', 'products', 'wifi_batches', 'warranties', 'claims'].includes(collectionName)) {
          const { error } = await client.from(collectionName).upsert(data);
          if (!error) {
            supabasePersisted = true;
          } else {
            supabaseError = error.message;
            console.warn(`⚠️ [Supabase] Upsert ${collectionName} warning:`, error.message);
          }
        }
      } catch (err: any) {
        supabaseError = err.message || String(err);
        console.warn(`⚠️ [Supabase] Exception saat sync entity ${collectionName}:`, supabaseError);
      }
    }

    return {
      success: true,
      supabasePersisted,
      error: supabaseError,
    };
  }

  /**
   * Mengambil SQL Migration script untuk dibuat di Supabase SQL Editor
   */
  getSqlSchema(): string {
    try {
      const candidates = [
        path.join(process.cwd(), 'supabase_schema.sql'),
        path.join(process.cwd(), '..', 'supabase_schema.sql'),
        path.join(process.cwd(), 'backend', 'supabase_schema.sql'),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          const content = fs.readFileSync(p, 'utf8');
          if (content && content.length > 500) {
            return content;
          }
        }
      }
    } catch (_) {}

    return `-- =========================================================================
-- WAYAHEDIGITAL SUPABASE DATABASE SCHEMA MIGRATION
-- Copy & Paste script ini ke Supabase Dashboard -> SQL Editor -> Run
-- =========================================================================

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABEL PENGGUNA & MEMBER (users)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  name TEXT NOT NULL,
  username TEXT,
  password TEXT,
  role TEXT DEFAULT 'CUSTOMER',
  member_tier TEXT DEFAULT 'MEMBER',
  balance NUMERIC DEFAULT 0,
  reward_points INTEGER DEFAULT 0,
  raw_data JSONB DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABEL KATALOG PRODUK (products)
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "categoryId" TEXT,
  provider TEXT,
  name TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  "supplierSku" TEXT,
  nominal NUMERIC,
  "supplierPrice" NUMERIC DEFAULT 0,
  "sellingPrice" NUMERIC NOT NULL,
  "discountPrice" NUMERIC,
  "quotaDetails" TEXT,
  duration TEXT,
  speed TEXT,
  "networkLocation" TEXT,
  "deliveryMethod" TEXT DEFAULT 'AUTOMATIC',
  "isActive" BOOLEAN DEFAULT true,
  stock INTEGER DEFAULT 10,
  badge TEXT,
  "iconUrl" TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABEL TRANSAKSI & PESANAN (orders)
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "invoiceNumber" TEXT UNIQUE NOT NULL,
  "customerName" TEXT,
  "customerPhone" TEXT,
  "customerEmail" TEXT,
  "targetDestination" TEXT,
  category TEXT,
  subtotal NUMERIC DEFAULT 0,
  "adminFee" NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  "promoCode" TEXT,
  "totalAmount" NUMERIC NOT NULL,
  "paymentStatus" TEXT DEFAULT 'PENDING',
  "fulfillmentStatus" TEXT DEFAULT 'NOT_STARTED',
  "paymentMethod" TEXT DEFAULT 'QRIS',
  "deliveryMethod" TEXT DEFAULT 'AUTOMATIC',
  "guestAccessToken" TEXT DEFAULT gen_random_uuid()::text,
  items JSONB DEFAULT '[]'::jsonb,
  raw_data JSONB DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABEL BATCH VOUCHER WIFI (wifi_batches & wifi_voucher_batches)
CREATE TABLE IF NOT EXISTS public.wifi_batches (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  package_duration TEXT,
  price NUMERIC DEFAULT 0,
  vouchers JSONB DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wifi_voucher_batches (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  "speedProfile" TEXT,
  duration TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABEL PENGATURAN SISTEM (app_settings & settings)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABEL GARANSI & CS (warranties, claims, monitoring, dispatched_accounts, notifications)
CREATE TABLE IF NOT EXISTS public.warranties (
  id TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT DEFAULT '',
  product TEXT NOT NULL,
  validity TEXT DEFAULT '30 Hari Garansi',
  status TEXT NOT NULL DEFAULT 'Aktif',
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.claims (
  id TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  product TEXT NOT NULL,
  "issueType" TEXT NOT NULL,
  "accountEmail" TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Sedang Diproses CS',
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.monitoring (
  id TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  product TEXT NOT NULL,
  "accountEmail" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Tersimpan & Terpantau',
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dispatched_accounts (
  id TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "appName" TEXT NOT NULL,
  "accountCredentials" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Terkirim',
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'claim',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  "targetNumber" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Terkirim ke WhatsApp Admin',
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABEL WEB PUSH SUBSCRIPTIONS ADMIN (admin_push_subscriptions)
CREATE TABLE IF NOT EXISTS public.admin_push_subscriptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admin_user_id TEXT DEFAULT 'admin',
  token TEXT UNIQUE NOT NULL,
  installation_id TEXT,
  device_name TEXT DEFAULT 'Perangkat Admin',
  platform TEXT DEFAULT 'Web',
  user_agent TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW()
);

-- AKTIFKAN RLS (Row Level Security) & BUAT PERMISSION AMAN
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wifi_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wifi_voucher_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatched_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Harden RLS: hanya service_role yang boleh tulis app_settings/settings (berisi QRIS secrets).
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow all on %I" ON public.%I', tbl, tbl);
    IF tbl IN ('app_settings', 'settings', 'admin_push_subscriptions') THEN
      EXECUTE format('CREATE POLICY "Allow all on %I" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', tbl, tbl);
      EXECUTE format('CREATE POLICY "Allow read %I for anon" ON public.%I FOR SELECT TO anon, authenticated USING (true)', tbl, tbl);
    ELSE
      EXECUTE format('CREATE POLICY "Allow all on %I" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', tbl, tbl);
    END IF;
  END LOOP;
END $$;

-- STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public) 
VALUES ('proof-uploads', 'proof-uploads', true), ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access Proofs" ON storage.objects;
CREATE POLICY "Public Access Proofs" ON storage.objects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
`;
  }
}

export const supabaseService = new SupabaseService();
export default supabaseService;
