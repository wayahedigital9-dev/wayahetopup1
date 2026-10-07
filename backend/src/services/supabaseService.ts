
import fs from 'node:fs';
import path from 'node:path';

const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

function loadLocalFile(): any {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      return {
        products: Array.isArray(raw.products) ? raw.products : (raw.products ? Object.values(raw.products) : []),
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
  return { products: [], orders: [], users: [], wifiBatches: [], promos: [], auditLogs: [], settings: {}, banners: [], catalogs: [], pushSubscriptions: [] };
}

export function sanitizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let str = String(rawUrl).trim();
  if (!str) return '';
  if (!str.startsWith('http://') && !str.startsWith('https://')) str = 'https://' + str;
  try {
    const parsed = new URL(str);
    if (parsed.hostname.endsWith('.supabase.co')) return parsed.origin;
    return parsed.origin;
  } catch { return str; }
}

export interface SupabaseTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  projectUrl?: string;
  tables?: any[];
  sampleData?: any;
  error?: string;
  diagnosticHelp?: string;
  timestamp: string;
}

// SUPABASE DISABLED — semua data sekarang di MongoDB + local db.json
// File ini dipertahankan agar import tidak pecah; untuk enable lagi restore dari git.
class DisabledSupabaseService {
  getUrl(): string { return ''; }
  getKey(): string { return ''; }
  getDbUrl(): string { return ''; }
  getClient(): null { return null; }
  async testConnection(): Promise<SupabaseTestResult> {
    return { success: false, message: 'Supabase dimatikan sementara — MongoDB aktif sebagai database utama.', diagnosticHelp: 'Semua data ada di MongoDB (wayahetopup1). Untuk aktifkan Supabase lagi, restore backend/src/services/supabaseService.ts dari git.', timestamp: new Date().toISOString() };
  }
  getSqlSchema(): string { return '-- Supabase disabled (MongoDB active)'; }
  async getAllState(): Promise<any> { return loadLocalFile(); }
  async getOrder(_id: string): Promise<any> { return null; }
  async saveOrder(_o: any): Promise<boolean> { return true; }
  async updateOrderStatus(): Promise<boolean> { return false; }
  async saveUser(_u: any): Promise<boolean> { return true; }
  async savePushSubscription(): Promise<boolean> { return true; }
  async removePushSubscription(): Promise<boolean> { return true; }
  async syncAllState(): Promise<{ success: boolean; syncedTables: string[]; errors: string[] }> {
    return { success: true, syncedTables: [], errors: [] };
  }
  async syncEntity(): Promise<{ success: boolean; supabasePersisted: boolean; error?: string }> {
    return { success: true, supabasePersisted: false };
  }
}

export const supabaseService = new DisabledSupabaseService() as any;
export default supabaseService;
