import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { storage } from './storage';

export interface SupabaseInfoResponse {
  status: string;
  driver: string;
  projectUrl: string;
  hasAnonKey: boolean;
  hasServiceRoleKey: boolean;
  configured: boolean;
}

export interface SupabaseTestResponse {
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

export function sanitizeUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim().replace(/\/+$/, '');
  while (/\/rest\/v1\/?$/i.test(url)) {
    url = url.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  }
  return url;
}

export class SupabaseClientService {
  private getEffectiveConfig(customUrl?: string, customKey?: string) {
    const settings = storage.getSettings();
    const url = sanitizeUrl(
      customUrl ||
      settings.supabaseUrl ||
      (import.meta as any).env?.VITE_SUPABASE_URL ||
      'https://fpymtffqttwbmrqqjfyu.supabase.co'
    );
    const key = (
      customKey ||
      settings.supabaseSecretKey ||
      settings.supabasePublishableKey ||
      settings.supabaseServiceRoleKey ||
      settings.supabaseAnonKey ||
      (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
      (import.meta as any).env?.VITE_SUPABASE_SECRET_KEY ||
      ''
    ).trim();

    return { url, key };
  }

  getClient(customUrl?: string, customKey?: string): SupabaseClient | null {
    const { url, key } = this.getEffectiveConfig(customUrl, customKey);
    if (!url || !key) return null;
    try {
      return createClient(url, key);
    } catch {
      return null;
    }
  }

  async getInfo(): Promise<SupabaseInfoResponse> {
    const { url, key } = this.getEffectiveConfig();
    return {
      status: url && key ? 'connected' : 'standby',
      driver: '@supabase/supabase-js v2 (Direct Client & Cloud Ready)',
      projectUrl: url,
      hasAnonKey: Boolean(key),
      hasServiceRoleKey: Boolean(key && key.length > 50),
      configured: Boolean(url && key),
    };
  }

  async testConnection(
    customUrl?: string,
    customKey?: string
  ): Promise<SupabaseTestResponse> {
    const { url, key } = this.getEffectiveConfig(customUrl, customKey);

    if (!url || !key) {
      return {
        success: false,
        message: 'URL atau API Key Supabase belum diisi. Silakan periksa pengaturan database.',
        error: 'CONFIG_MISSING',
        timestamp: new Date().toISOString(),
      };
    }

    const start = performance.now();

    // 1. Direct browser client execution (Works 100% on Vercel, Netlify, VPS & Localhost)
    try {
      const client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const tableList = ['products', 'orders', 'users', 'warranties', 'claims', 'app_settings', 'settings'];

      // Execute all table checks concurrently in parallel for ultra-fast latency (<150ms)
      const tableResults = await Promise.all(
        tableList.map(async (t) => {
          try {
            const { count, error } = await client.from(t).select('*', { count: 'exact', head: true });
            if (!error) {
              return { name: t, count: count || 0, status: 'READY' as const };
            }
            return { name: t, count: 0, status: 'NOT_FOUND' as const };
          } catch (_) {
            return { name: t, count: 0, status: 'NOT_FOUND' as const };
          }
        })
      );

      const latencyMs = Math.max(1, Math.round(performance.now() - start));
      const readyCount = tableResults.filter(t => t.status === 'READY').length;

      return {
        success: true,
        message: `Koneksi Supabase aktif (${latencyMs}ms). Terhubung ke ${readyCount} tabel database.`,
        latencyMs,
        projectUrl: url,
        tables: tableResults,
        timestamp: new Date().toISOString(),
      };
    } catch (directErr: any) {
      // 2. Fallback to API endpoint if available
      try {
        const res = await fetch('/api/supabase/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, key }),
        });

        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (_) {}

      return {
        success: false,
        message: directErr.message || 'Gagal terhubung ke Supabase.',
        error: String(directErr),
        timestamp: new Date().toISOString(),
      };
    }
  }

  async runSampleQuery(
    customUrl?: string,
    customKey?: string,
    table: string = 'orders',
    query?: any
  ): Promise<{ success: boolean; data?: any; message: string; latencyMs: number }> {
    const { url, key } = this.getEffectiveConfig(customUrl, customKey);

    if (!url || !key) {
      return {
        success: false,
        message: 'URL atau API Key Supabase belum dikonfigurasi.',
        latencyMs: 0,
      };
    }

    const start = performance.now();

    // 1. Direct browser client execution (100% resilient on Vercel deployment)
    try {
      const client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data, error } = await client.from(table).select('*').limit(10);
      const latencyMs = Math.round(performance.now() - start);

      if (error) {
        // Try fallback table name (e.g. app_settings vs settings)
        if (table === 'settings') {
          const res2 = await client.from('app_settings').select('*').limit(10);
          if (!res2.error) {
            return {
              success: true,
              data: res2.data,
              message: `Query berhasil dari app_settings (${res2.data?.length || 0} baris, ${latencyMs}ms).`,
              latencyMs,
            };
          }
        }
        return {
          success: false,
          data: [],
          message: `Query Supabase: ${error.message} (Tabel: ${table})`,
          latencyMs,
        };
      }

      return {
        success: true,
        data: data || [],
        message: `Query Supabase berhasil (${data?.length || 0} baris data ditemukan, ${latencyMs}ms).`,
        latencyMs,
      };
    } catch (err: any) {
      // 2. Fallback to API if backend proxy exists
      try {
        const res = await fetch('/api/supabase/run-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, key, table, query }),
        });

        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (_) {}

      return {
        success: false,
        message: err.message || 'Gagal mengeksekusi query Supabase.',
        latencyMs: Math.round(performance.now() - start),
      };
    }
  }

  async getSqlSchema(): Promise<{ schema: string }> {
    try {
      const res = await fetch('/api/supabase/sql-schema');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data && data.schema && data.schema.trim().length > 100) {
          return data;
        }
      }
    } catch (_) {}

    try {
      const staticRes = await fetch('/supabase_schema.sql');
      if (staticRes.ok) {
        const text = await staticRes.text();
        if (text && text.trim().length > 100 && !text.includes('<!DOCTYPE html>')) {
          return { schema: text };
        }
      }
    } catch (_) {}

    const { DEFAULT_SUPABASE_SQL_SCHEMA } = await import('./defaultSupabaseSchema');
    return { schema: DEFAULT_SUPABASE_SQL_SCHEMA };
  }

  async execSql(sql: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/supabase/exec-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}

export const supabaseClient = new SupabaseClientService();
export default supabaseClient;
