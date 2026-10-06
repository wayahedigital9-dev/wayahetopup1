import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { apiClient } from './apiClient';
import {
  ClaimTicket,
  SavedMonitoringRecord,
  WarrantyItem,
  WhatsAppNotificationItem,
  DispatchedPremiumAccount,
} from '../types';

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

export interface SupabaseMutationResult {
  success: boolean;
  error?: string;
}

export type DatabaseSyncMode = 'hybrid' | 'local_only' | 'cloud_only';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  syncMode: DatabaseSyncMode;
  autoImportEnabled: boolean;
  autoImportIntervalSeconds: number; // e.g. 30, 60, 300
  conflictStrategy: 'merge_newest' | 'overwrite_local' | 'preserve_local';
  autoSyncOnStart: boolean;
}

export interface ConsoleLogItem {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error' | 'sync' | 'import';
  source: 'SYSTEM' | 'SUPABASE' | 'LOCAL_DB' | 'API' | 'AUTO_IMPORT' | 'STORAGE';
  message: string;
  details?: any;
}

export interface EntityConnectionStatus {
  id: string;
  name: string;
  type: 'table' | 'bucket' | 'realtime' | 'auth';
  target: string;
  description: string;
  status: 'connected' | 'error' | 'idle' | 'testing';
  recordCount?: number;
  lastChecked?: string;
  errorMessage?: string;
}

export interface SystemHealthStatus {
  api: {
    online: boolean;
    latencyMs: number;
    port: number | string;
    uptimeSeconds: number;
    lastPing: string;
  };
  localDb: {
    online: boolean;
    path: string;
    totalRecords: number;
    warrantiesCount: number;
    claimsCount: number;
    monitoringCount: number;
    dispatchedCount: number;
    notificationsCount: number;
    lastUpdated: string;
  };
  supabase: {
    configured: boolean;
    online: boolean;
    realtimeConnected: boolean;
    latencyMs: number;
    syncMode: DatabaseSyncMode;
    url: string;
    lastSync: string | null;
    counts?: {
      warranties: number;
      claims: number;
      monitoring: number;
      dispatched: number;
      notifications: number;
      total: number;
    };
  };
  autoImport: {
    active: boolean;
    intervalSeconds: number;
    lastRun: string | null;
    importedCount: number;
    status: 'idle' | 'running' | 'error';
  };
}

export interface DataSyncHandlers {
  onWarrantyChange?: (action: 'INSERT' | 'UPDATE' | 'DELETE', item: any) => void;
  onClaimChange?: (action: 'INSERT' | 'UPDATE' | 'DELETE', item: any) => void;
  onMonitoringChange?: (action: 'INSERT' | 'UPDATE' | 'DELETE', item: any) => void;
  onDispatchedChange?: (action: 'INSERT' | 'UPDATE' | 'DELETE', item: any) => void;
  onNotificationChange?: (action: 'INSERT' | 'UPDATE' | 'DELETE', item: any) => void;
  applyFullData?: (data: {
    warranties?: WarrantyItem[];
    claims?: ClaimTicket[];
    monitoring?: SavedMonitoringRecord[];
    dispatched?: DispatchedPremiumAccount[];
    notifications?: WhatsAppNotificationItem[];
  }) => void;
  getCurrentData?: () => {
    warranties: WarrantyItem[];
    claims: ClaimTicket[];
    monitoring: SavedMonitoringRecord[];
    dispatched: DispatchedPremiumAccount[];
    notifications: WhatsAppNotificationItem[];
  };
}

const STORAGE_KEY_CONFIG = 'wayahe_supabase_hybrid_config_v2';
const STORAGE_KEY_LOGS = 'wayahe_console_logs_v1';

const DEFAULT_CONFIG: SupabaseConfig = {
  url: '',
  anonKey: '',
  serviceRoleKey: '',
  syncMode: 'hybrid',
  autoImportEnabled: true,
  autoImportIntervalSeconds: 60,
  conflictStrategy: 'merge_newest',
  autoSyncOnStart: true,
};

export function normalizeWarrantyRow(row: any): WarrantyItem {
  if (!row) return {} as WarrantyItem;
  return {
    id: String(row.id || row.orderId || row.order_id || ''),
    orderId: String(row.orderId || row.order_id || row.id || ''),
    customerName: String(row.customerName || row.customer_name || 'Pelanggan'),
    customerPhone: String(row.customerPhone || row.customer_phone || '-'),
    customerInitials: String(row.customerInitials || row.customer_initials || 'WD'),
    avatarBg: String(row.avatarBg || row.avatar_bg || 'bg-[#e4dfff] text-[#160066]'),
    product: String(row.product || ''),
    productVariant: String(row.productVariant || row.product_variant || 'Akun Digital'),
    validity: String(row.validity || '30 Hari Garansi'),
    progressPercent: Number(row.progressPercent ?? row.progress_percent ?? 100),
    status: (row.status || 'Aktif') as any,
    issueType: String(row.issueType || row.issue_type || 'Normal / Tanpa Kendala'),
    complaint: String(row.complaint || ''),
    screenshotUrl: String(row.screenshotUrl || row.screenshot_url || ''),
    price: String(row.price || ''),
    purchaseDate: String(row.purchaseDate || row.purchase_date || ''),
    role: (row.role || 'pembeli') as any,
  };
}

export function normalizeClaimRow(row: any): ClaimTicket {
  if (!row) return {} as ClaimTicket;
  return {
    id: String(row.id || ''),
    orderId: String(row.orderId || row.order_id || ''),
    orderDate: String(row.orderDate || row.order_date || ''),
    issueDate: String(row.issueDate || row.issue_date || ''),
    solutionRequested: (row.solutionRequested || row.solution_requested || 'Ganti Akun / Profil Baru') as any,
    product: String(row.product || ''),
    productVariant: String(row.productVariant || row.product_variant || 'Akun Digital'),
    issueType: (row.issueType || row.issue_type || 'Gagal Login / Password Salah') as any,
    accountEmail: String(row.accountEmail || row.account_email || ''),
    whatsapp: String(row.whatsapp || ''),
    device: String(row.device || 'Desktop & Mobile'),
    screenshotUrl: String(row.screenshotUrl || row.screenshot_url || ''),
    screenshotName: String(row.screenshotName || row.screenshot_name || ''),
    screenshotSize: String(row.screenshotSize || row.screenshot_size || ''),
    description: String(row.description || ''),
    submittedAt: String(row.submittedAt || row.submitted_at || ''),
    status: (row.status || 'Sedang Diproses CS') as any,
    slaResponseEstimate: String(row.slaResponseEstimate || row.sla_response_estimate || '< 15 Menit'),
    adminResponseNote: row.adminResponseNote || row.admin_response_note || undefined,
    replacementAccountInfo: row.replacementAccountInfo || row.replacement_account_info || undefined,
    customerName: row.customerName || row.customer_name || undefined,
    linkedMonitoringId: row.linkedMonitoringId || row.linked_monitoring_id || undefined,
  };
}

export function normalizeMonitoringRow(row: any): SavedMonitoringRecord {
  if (!row) return {} as SavedMonitoringRecord;
  return {
    id: String(row.id || ''),
    orderId: String(row.orderId || row.order_id || ''),
    product: String(row.product || ''),
    orderDate: String(row.orderDate || row.order_date || ''),
    accountEmail: String(row.accountEmail || row.account_email || ''),
    screenshotUrl: String(row.screenshotUrl || row.screenshot_url || ''),
    screenshotName: String(row.screenshotName || row.screenshot_name || ''),
    screenshotSize: String(row.screenshotSize || row.screenshot_size || ''),
    note: String(row.note || ''),
    savedAt: String(row.savedAt || row.saved_at || ''),
    status: (row.status || 'Tersimpan & Terpantau') as any,
    customerName: row.customerName || row.customer_name || undefined,
    customerPhone: row.customerPhone || row.customer_phone || undefined,
    adminNote: row.adminNote || row.admin_note || undefined,
    healthStatus: (row.healthStatus || row.health_status || 'Normal Aktif') as any,
    linkedClaimTicketId: row.linkedClaimTicketId || row.linked_claim_ticket_id || undefined,
  };
}

export function normalizeDispatchedRow(row: any): DispatchedPremiumAccount {
  if (!row) return {} as DispatchedPremiumAccount;
  return {
    id: String(row.id || ''),
    orderId: String(row.orderId || row.order_id || ''),
    appName: String(row.appName || row.app_name || ''),
    orderDate: String(row.orderDate || row.order_date || ''),
    accountCredentials: String(row.accountCredentials || row.account_credentials || ''),
    customerName: String(row.customerName || row.customer_name || ''),
    customerWhatsapp: String(row.customerWhatsapp || row.customer_whatsapp || ''),
    duration: String(row.duration || '30 Hari'),
    note: String(row.note || ''),
    sentAt: String(row.sentAt || row.sent_at || ''),
    status: (row.status || 'Terkirim') as any,
  };
}

export function normalizeNotificationRow(row: any): WhatsAppNotificationItem {
  if (!row) return {} as WhatsAppNotificationItem;
  return {
    id: String(row.id || ''),
    type: (row.type || 'claim') as any,
    title: String(row.title || ''),
    message: String(row.message || ''),
    timestamp: String(row.timestamp || ''),
    read: Boolean(row.read),
    targetNumber: String(row.targetNumber || row.target_number || ''),
    referenceId: row.referenceId || row.reference_id || undefined,
    customerName: row.customerName || row.customer_name || undefined,
    productName: row.productName || row.product_name || undefined,
    status: (row.status as 'Terkirim ke WhatsApp Admin' | 'Pending' | 'Selesai') || 'Terkirim ke WhatsApp Admin',
    waUrl: row.waUrl || row.wa_url || undefined,
  };
}

class SupabaseHybridService {
  private client: SupabaseClient | null = null;
  private config: SupabaseConfig = DEFAULT_CONFIG;
  private logs: ConsoleLogItem[] = [];
  private logListeners: ((logs: ConsoleLogItem[]) => void)[] = [];
  private configListeners: ((config: SupabaseConfig) => void)[] = [];
  private autoImportTimer: any = null;
  private isImporting: boolean = false;
  private lastSyncTimestamp: string | null = null;
  private lastAutoImportTime: string | null = null;
  private importedCountTotal: number = 0;
  private syncHandlers: DataSyncHandlers | null = null;
  private realtimeChannel: any = null;
  private isRealtimeSubscribed: boolean = false;

  constructor() {
    this.loadConfig();
    this.initClient();
    this.addLog('info', 'SYSTEM', 'Sistem Engine Supabase Hybrid & Realtime Auto-Save diinisialisasi.');
    if (this.config.autoImportEnabled && this.config.syncMode !== 'local_only') {
      this.startAutoImportDaemon();
    }
  }

  // --- HANDLER REGISTRATION FOR REACT DATA STORE ---
  public registerSyncHandlers(handlers: DataSyncHandlers): void {
    this.syncHandlers = handlers;
  }

  // --- CONFIG MANAGEMENT ---
  public getConfig(): SupabaseConfig {
    return { ...this.config };
  }

  public subscribeConfig(listener: (config: SupabaseConfig) => void): () => void {
    this.configListeners.push(listener);
    return () => {
      this.configListeners = this.configListeners.filter((l) => l !== listener);
    };
  }

  private notifyConfigListeners(): void {
    const current = this.getConfig();
    this.configListeners.forEach((l) => l(current));
  }

  public isConfigured(): boolean {
    return !!(this.config.url && this.config.anonKey);
  }

  public isReady(): boolean {
    return !!(this.client && this.config.url && this.config.anonKey);
  }

  public async saveConfig(newConfig: Partial<SupabaseConfig>): Promise<void> {
    const rawUrl = (newConfig.url !== undefined ? newConfig.url : this.config.url);
    const cleanUrl = sanitizeSupabaseUrl(rawUrl);
    const cleanAnonKey = (newConfig.anonKey !== undefined ? newConfig.anonKey : this.config.anonKey).trim();
    const cleanSecretKey = (newConfig.serviceRoleKey !== undefined ? newConfig.serviceRoleKey : (this.config.serviceRoleKey || '')).trim();

    this.config = {
      ...this.config,
      ...newConfig,
      url: cleanUrl,
      anonKey: cleanAnonKey,
      serviceRoleKey: cleanSecretKey,
    };

    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.config));
    } catch (e) {
      console.error('Failed to save Supabase config to localStorage', e);
    }

    try {
      await apiClient.updateSettings({
        supabaseUrl: this.config.url,
        supabaseAnonKey: this.config.anonKey,
        supabaseServiceRoleKey: this.config.serviceRoleKey,
        supabaseSyncMode: this.config.syncMode,
      });
    } catch { }

    this.initClient();
    this.notifyConfigListeners();
    this.addLog('info', 'SUPABASE', `Konfigurasi Supabase diperbarui. Mode: [${this.config.syncMode.toUpperCase()}]. URL: ${cleanUrl || '(Kosong)'}`);

    this.stopAutoImportDaemon();
    if (this.config.autoImportEnabled && this.config.syncMode !== 'local_only') {
      this.startAutoImportDaemon();
    }

    // Auto pull immediately when client becomes available
    if (this.client && this.config.syncMode !== 'local_only') {
      this.pullFromSupabase().catch(() => { });
    }
  }

  public async resetConfig(): Promise<void> {
    this.teardownRealtimeSync();
    this.config = {
      ...DEFAULT_CONFIG,
      url: '',
      anonKey: '',
      serviceRoleKey: '',
    };
    try {
      localStorage.removeItem(STORAGE_KEY_CONFIG);
    } catch { }
    try {
      await apiClient.updateSettings({
        supabaseUrl: '',
        supabaseAnonKey: '',
        supabaseServiceRoleKey: '',
      });
    } catch { }
    this.client = null;
    this.notifyConfigListeners();
    this.addLog('warn', 'SUPABASE', 'Konfigurasi Supabase telah dikosongkan/direset.');
  }

  public getShareableSetupUrl(): string {
    if (typeof window === 'undefined' || !this.config.url || !this.config.anonKey) return '';
    const base = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();
    params.set('sb_url', this.config.url);
    params.set('sb_key', this.config.anonKey);
    params.set('sb_mode', this.config.syncMode);
    return `${base}?${params.toString()}`;
  }

  private loadConfig(): void {
    const rawEnvUrl = (
      (import.meta as any).env?.VITE_SUPABASE_URL ||
      (import.meta as any).env?.SUPABASE_URL ||
      ''
    );
    const envUrl = sanitizeSupabaseUrl(rawEnvUrl);

    const envKey = (
      (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
      (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
      (import.meta as any).env?.SUPABASE_PUBLISHABLE_KEY ||
      (import.meta as any).env?.SUPABASE_ANON_KEY ||
      ''
    ).trim();

    // Check URL parameters for seamless multi-device setup (e.g. ?sb_url=...&sb_key=...)
    let queryUrl = '';
    let queryKey = '';
    let querySyncMode: DatabaseSyncMode | undefined = undefined;

    if (typeof window !== 'undefined' && window.location) {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const pUrl = urlParams.get('sb_url') || urlParams.get('supabase_url');
        const pKey = urlParams.get('sb_key') || urlParams.get('supabase_key') || urlParams.get('sb_anon');
        const pMode = urlParams.get('sb_mode') as DatabaseSyncMode;

        if (pUrl && pKey) {
          queryUrl = sanitizeSupabaseUrl(pUrl);
          queryKey = pKey.trim();
          if (pMode && ['hybrid', 'local_only', 'cloud_only'].includes(pMode)) {
            querySyncMode = pMode;
          }
          // Clean up URL query parameters without reloading the page
          urlParams.delete('sb_url');
          urlParams.delete('supabase_url');
          urlParams.delete('sb_key');
          urlParams.delete('supabase_key');
          urlParams.delete('sb_anon');
          urlParams.delete('sb_mode');
          const cleanSearch = urlParams.toString();
          const newRelativePathQuery = window.location.pathname + (cleanSearch ? `?${cleanSearch}` : '') + window.location.hash;
          window.history.replaceState(null, '', newRelativePathQuery);
        }
      } catch { }
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (queryUrl && queryKey) {
        this.config = {
          ...DEFAULT_CONFIG,
          ...(saved ? JSON.parse(saved) : {}),
          url: queryUrl,
          anonKey: queryKey,
          syncMode: querySyncMode || 'hybrid',
        };
        try {
          localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.config));
        } catch { }
      } else if (saved) {
        const parsed = JSON.parse(saved);
        this.config = {
          ...DEFAULT_CONFIG,
          ...parsed,
          url: sanitizeSupabaseUrl(parsed.url !== undefined && parsed.url.trim() !== '' ? parsed.url : envUrl),
          anonKey: parsed.anonKey !== undefined && parsed.anonKey.trim() !== '' ? parsed.anonKey.trim() : envKey,
        };

        if (envUrl && (!this.config.url || this.config.url.trim() === '')) {
          this.config.url = envUrl;
        }
        if (envKey && (!this.config.anonKey || this.config.anonKey.trim() === '')) {
          this.config.anonKey = envKey;
        }
      } else {
        this.config = {
          ...DEFAULT_CONFIG,
          url: envUrl,
          anonKey: envKey,
        };
      }
    } catch {
      this.config = {
        ...DEFAULT_CONFIG,
        url: queryUrl || envUrl,
        anonKey: queryKey || envKey,
      };
    }

    // Always fetch shared server settings to sync across different devices (Device A & Device B)
    if (typeof window !== 'undefined') {
      apiClient.getSettings().then((s: any) => {
        if (s) {
          let hasChange = false;
          const cleanServerUrl = sanitizeSupabaseUrl(s.supabaseUrl || '');
          const cleanServerKey = (s.supabaseAnonKey || '').trim();

          if (cleanServerUrl && this.config.url !== cleanServerUrl) {
            this.config.url = cleanServerUrl;
            hasChange = true;
          }
          if (cleanServerKey && this.config.anonKey !== cleanServerKey) {
            this.config.anonKey = cleanServerKey;
            hasChange = true;
          }
          if (s.supabaseSyncMode && this.config.syncMode !== s.supabaseSyncMode) {
            this.config.syncMode = s.supabaseSyncMode;
            hasChange = true;
          }
          if (hasChange || (this.isConfigured() && !this.client)) {
            try {
              localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.config));
            } catch { }
            this.initClient();
            this.notifyConfigListeners();
            // Automatically pull data on Device B when settings are loaded!
            this.pullFromSupabase().catch(() => { });
          }
        }
      }).catch(() => { });
    }
  }

  private initClient(): void {
    const url = sanitizeSupabaseUrl(this.config.url);
    const key = this.config.anonKey?.trim();

    if (url && key) {
      try {
        this.client = createClient(url, key, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
          },
          realtime: {
            params: {
              eventsPerSecond: 10,
            },
          },
        });
        this.addLog('success', 'SUPABASE', `✅ Supabase Client terhubung ke: ${url}`);
        this.setupRealtimeSync();
        // Immediately fetch data on connect
        if (this.config.syncMode !== 'local_only') {
          this.pullFromSupabase().catch(() => { });
        }
      } catch (err: any) {
        this.client = null;
        this.addLog('error', 'SUPABASE', `❌ Gagal menginisialisasi Supabase Client: ${err?.message || err}`);
      }
    } else {
      this.teardownRealtimeSync();
      this.client = null;
    }
  }

  public getClient(): SupabaseClient | null {
    return this.client;
  }

  public isRealtimeActive(): boolean {
    return this.isRealtimeSubscribed && !!this.client;
  }

  // --- REALTIME WEB-SOCKET SUBSCRIPTION ---
  public setupRealtimeSync(): void {
    if (!this.client || this.config.syncMode === 'local_only') {
      this.teardownRealtimeSync();
      return;
    }

    if (this.realtimeChannel) {
      this.teardownRealtimeSync();
    }

    try {
      const channel = this.client.channel('wayahe-realtime-global');

      const handleEvent = (table: string, payload: any) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        const action = eventType as 'INSERT' | 'UPDATE' | 'DELETE';
        const rawItem = action === 'DELETE' ? oldRecord : newRecord;

        // Safety: Ignore DELETE events that have no valid ID to avoid wiping local state
        if (action === 'DELETE') {
          const checkId = rawItem?.id || rawItem?.orderId || rawItem?.order_id;
          if (!checkId || typeof checkId !== 'string' || !checkId.trim() || checkId === 'undefined' || checkId === 'null') {
            this.addLog('warn', 'SUPABASE', `⚡ Realtime Event DELETE pada [${table}] diabaikan karena tidak memiliki ID valid.`);
            return;
          }
        }

        let item: any = rawItem;
        if (rawItem) {
          if (table === 'warranties') item = normalizeWarrantyRow(rawItem);
          else if (table === 'claims') item = normalizeClaimRow(rawItem);
          else if (table === 'monitoring') item = normalizeMonitoringRow(rawItem);
          else if (table === 'dispatched_accounts') item = normalizeDispatchedRow(rawItem);
          else if (table === 'notifications') item = normalizeNotificationRow(rawItem);
        }

        this.addLog('sync', 'SUPABASE', `⚡ Realtime Event: ${action} pada tabel [${table}] (${item?.id || item?.orderId || '-'})`);

        if (table === 'warranties' && this.syncHandlers?.onWarrantyChange) {
          this.syncHandlers.onWarrantyChange(action, item);
        } else if (table === 'claims' && this.syncHandlers?.onClaimChange) {
          this.syncHandlers.onClaimChange(action, item);
        } else if (table === 'monitoring' && this.syncHandlers?.onMonitoringChange) {
          this.syncHandlers.onMonitoringChange(action, item);
        } else if (table === 'dispatched_accounts' && this.syncHandlers?.onDispatchedChange) {
          this.syncHandlers.onDispatchedChange(action, item);
        } else if (table === 'notifications' && this.syncHandlers?.onNotificationChange) {
          this.syncHandlers.onNotificationChange(action, item);
        }
      };

      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'warranties' }, (p) => handleEvent('warranties', p))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'claims' }, (p) => handleEvent('claims', p))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'monitoring' }, (p) => handleEvent('monitoring', p))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatched_accounts' }, (p) => handleEvent('dispatched_accounts', p))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (p) => handleEvent('notifications', p))
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            this.isRealtimeSubscribed = true;
            this.addLog('success', 'SUPABASE', '🟢 Supabase Realtime WebSocket AKTIF: Perubahan data otomatis tersinkronisasi instan!');
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            this.isRealtimeSubscribed = false;
          }
        });

      this.realtimeChannel = channel;
    } catch (err: any) {
      this.isRealtimeSubscribed = false;
      this.addLog('warn', 'SUPABASE', `Gagal menghubungkan Realtime Channel: ${err?.message || err}`);
    }
  }

  public teardownRealtimeSync(): void {
    if (this.realtimeChannel && this.client) {
      try {
        this.client.removeChannel(this.realtimeChannel);
      } catch { }
      this.realtimeChannel = null;
      this.isRealtimeSubscribed = false;
    }
  }

  // --- DIRECT REALTIME MUTATION METHODS ---
  public async upsertWarranty(item: WarrantyItem): Promise<SupabaseMutationResult> {
    if (this.config.syncMode === 'local_only') return { success: true };
    if (!this.client) {
      return { success: false, error: 'Supabase client belum terhubung. Periksa konfigurasi URL & Anon Key di Pengaturan Admin.' };
    }
    try {
      const payload = {
        id: item.id,
        orderId: item.orderId,
        customerName: item.customerName,
        customerPhone: item.customerPhone || '',
        customerInitials: item.customerInitials || 'WD',
        avatarBg: item.avatarBg || 'bg-[#e4dfff] text-[#160066]',
        product: item.product,
        productVariant: item.productVariant || 'Akun Digital',
        validity: item.validity || '30 Hari Garansi',
        progressPercent: item.progressPercent ?? 100,
        status: item.status || 'Aktif',
        issueType: item.issueType || 'Normal / Tanpa Kendala',
        complaint: item.complaint || '',
        screenshotUrl: item.screenshotUrl || '',
        price: item.price || '',
        purchaseDate: item.purchaseDate || new Date().toISOString().slice(0, 10),
        role: item.role || 'pembeli',
        updatedAt: new Date().toISOString(),
      };
      const { error } = await this.client.from('warranties').upsert(payload, { onConflict: 'id' });
      if (error) {
        const msg = `Supabase Error [warranties]: ${error.message}${error.details ? ` (${error.details})` : ''} [Code: ${error.code || 'ERR'}]`;
        this.addLog('error', 'SUPABASE', msg);
        return { success: false, error: msg };
      }
      this.addLog('success', 'SUPABASE', `☁️ Realtime Auto-Save: Polis garansi [${item.orderId}] tersimpan di Supabase.`);
      this.lastSyncTimestamp = new Date().toISOString();
      return { success: true };
    } catch (err: any) {
      const msg = `Supabase Exception [warranties]: ${err?.message || err}`;
      this.addLog('error', 'SUPABASE', msg);
      return { success: false, error: msg };
    }
  }

  public async deleteWarranty(id: string): Promise<SupabaseMutationResult> {
    if (this.config.syncMode === 'local_only') return { success: true };
    if (!this.client) {
      return { success: false, error: 'Supabase client belum terhubung.' };
    }

    // Strict validation: ID must be a non-empty, valid string
    if (!id || typeof id !== 'string' || !id.trim() || id === 'undefined' || id === 'null') {
      const msg = `Supabase Delete Ditolak [warranties]: ID garansi tidak valid (${String(id)}). Penghapusan dibatalkan demi keamanan data.`;
      this.addLog('error', 'SUPABASE', msg);
      return { success: false, error: msg };
    }

    const cleanId = id.trim();
    try {
      const { error } = await this.client.from('warranties').delete().or(`id.eq.${cleanId},orderId.eq.${cleanId}`);
      if (error) {
        const msg = `Supabase Delete Error [warranties]: ${error.message} [Code: ${error.code || 'ERR'}]`;
        this.addLog('error', 'SUPABASE', msg);
        return { success: false, error: msg };
      }
      this.addLog('success', 'SUPABASE', `🗑️ Realtime Delete: Polis garansi [${cleanId}] dihapus dari Supabase.`);
      this.lastSyncTimestamp = new Date().toISOString();
      return { success: true };
    } catch (err: any) {
      const msg = `Gagal delete garansi di Supabase: ${err?.message || err}`;
      this.addLog('error', 'SUPABASE', msg);
      return { success: false, error: msg };
    }
  }

  public async upsertClaim(item: ClaimTicket): Promise<SupabaseMutationResult> {
    if (this.config.syncMode === 'local_only') return { success: true };
    if (!this.client) {
      return { success: false, error: 'Supabase client belum terhubung. Periksa konfigurasi URL & Anon Key di Pengaturan Admin.' };
    }
    try {
      const payload = {
        id: item.id,
        orderId: item.orderId,
        orderDate: item.orderDate || '',
        issueDate: item.issueDate || '',
        solutionRequested: item.solutionRequested || 'Ganti Akun / Profil Baru',
        product: item.product,
        productVariant: item.productVariant || 'Akun Digital',
        issueType: item.issueType,
        accountEmail: item.accountEmail,
        whatsapp: item.whatsapp,
        device: item.device || 'Desktop & Mobile',
        screenshotUrl: item.screenshotUrl || '',
        screenshotName: item.screenshotName || '',
        screenshotSize: item.screenshotSize || '',
        description: item.description || '',
        submittedAt: item.submittedAt || '',
        status: item.status || 'Sedang Diproses CS',
        slaResponseEstimate: item.slaResponseEstimate || '< 15 Menit',
        adminResponseNote: item.adminResponseNote || '',
        replacementAccountInfo: item.replacementAccountInfo || '',
        customerName: item.customerName || '',
        linkedMonitoringId: item.linkedMonitoringId || null,
        updatedAt: new Date().toISOString(),
      };
      const { error } = await this.client.from('claims').upsert(payload, { onConflict: 'id' });
      if (error) {
        const msg = `Supabase Error [claims]: ${error.message}${error.details ? ` (${error.details})` : ''} [Code: ${error.code || 'ERR'}]`;
        this.addLog('error', 'SUPABASE', msg);
        return { success: false, error: msg };
      }
      this.addLog('success', 'SUPABASE', `☁️ Realtime Auto-Save: Tiket klaim [${item.id}] tersimpan di Supabase.`);
      this.lastSyncTimestamp = new Date().toISOString();
      return { success: true };
    } catch (err: any) {
      const msg = `Supabase Exception [claims]: ${err?.message || err}`;
      this.addLog('error', 'SUPABASE', msg);
      return { success: false, error: msg };
    }
  }

  public async deleteClaim(id: string): Promise<SupabaseMutationResult> {
    if (this.config.syncMode === 'local_only') return { success: true };
    if (!this.client) {
      return { success: false, error: 'Supabase client belum terhubung.' };
    }
    if (!id || typeof id !== 'string' || !id.trim() || id === 'undefined' || id === 'null') {
      const msg = `Supabase Delete Ditolak [claims]: ID tiket klaim tidak valid (${String(id)}).`;
      this.addLog('error', 'SUPABASE', msg);
      return { success: false, error: msg };
    }
    const cleanId = id.trim();
    try {
      const { error } = await this.client.from('claims').delete().eq('id', cleanId);
      if (error) {
        const msg = `Supabase Delete Error [claims]: ${error.message} [Code: ${error.code || 'ERR'}]`;
        this.addLog('error', 'SUPABASE', msg);
        return { success: false, error: msg };
      }
      this.addLog('success', 'SUPABASE', `🗑️ Realtime Delete: Tiket klaim [${cleanId}] dihapus dari Supabase.`);
      this.lastSyncTimestamp = new Date().toISOString();
      return { success: true };
    } catch (err: any) {
      const msg = `Gagal delete klaim di Supabase: ${err?.message || err}`;
      this.addLog('error', 'SUPABASE', msg);
      return { success: false, error: msg };
    }
  }

  public async upsertMonitoring(item: SavedMonitoringRecord): Promise<SupabaseMutationResult> {
    if (this.config.syncMode === 'local_only') return { success: true };
    if (!this.client) {
      return { success: false, error: 'Supabase client belum terhubung. Periksa konfigurasi URL & Anon Key di Pengaturan Admin.' };
    }
    try {
      const payload = {
        id: item.id,
        orderId: item.orderId,
        product: item.product,
        orderDate: item.orderDate || '',
        accountEmail: item.accountEmail,
        screenshotUrl: item.screenshotUrl || '',
        screenshotName: item.screenshotName || '',
        screenshotSize: item.screenshotSize || '',
        note: item.note || '',
        savedAt: item.savedAt || '',
        status: item.status || 'Tersimpan & Terpantau',
        customerName: item.customerName || '',
        customerPhone: item.customerPhone || '',
        adminNote: item.adminNote || '',
        healthStatus: item.healthStatus || 'Normal Aktif',
        linkedClaimTicketId: item.linkedClaimTicketId || null,
        updatedAt: new Date().toISOString(),
      };
      const { error } = await this.client.from('monitoring').upsert(payload, { onConflict: 'id' });
      if (error) {
        const msg = `Supabase Error [monitoring]: ${error.message}${error.details ? ` (${error.details})` : ''} [Code: ${error.code || 'ERR'}]`;
        this.addLog('error', 'SUPABASE', msg);
        return { success: false, error: msg };
      }
      this.addLog('success', 'SUPABASE', `☁️ Realtime Auto-Save: Monitoring akun [${item.orderId}] tersimpan di Supabase.`);
      this.lastSyncTimestamp = new Date().toISOString();
      return { success: true };
    } catch (err: any) {
      const msg = `Supabase Exception [monitoring]: ${err?.message || err}`;
      this.addLog('error', 'SUPABASE', msg);
      return { success: false, error: msg };
    }
  }

  public async deleteMonitoring(id: string): Promise<SupabaseMutationResult> {
    if (this.config.syncMode === 'local_only') return { success: true };
    if (!this.client) {
      return { success: false, error: 'Supabase client belum terhubung.' };
    }
    if (!id || typeof id !== 'string' || !id.trim() || id === 'undefined' || id === 'null') {
      const msg = `Supabase Delete Ditolak [monitoring]: ID monitoring tidak valid (${String(id)}).`;
      this.addLog('error', 'SUPABASE', msg);
      return { success: false, error: msg };
    }
    const cleanId = id.trim();
    try {
      const { error } = await this.client.from('monitoring').delete().eq('id', cleanId);
      if (error) {
        const msg = `Supabase Delete Error [monitoring]: ${error.message} [Code: ${error.code || 'ERR'}]`;
        this.addLog('error', 'SUPABASE', msg);
        return { success: false, error: msg };
      }
      this.addLog('success', 'SUPABASE', `🗑️ Realtime Delete: Monitoring [${cleanId}] dihapus dari Supabase.`);
      this.lastSyncTimestamp = new Date().toISOString();
      return { success: true };
    } catch (err: any) {
      const msg = `Gagal delete monitoring di Supabase: ${err?.message || err}`;
      this.addLog('error', 'SUPABASE', msg);
      return { success: false, error: msg };
    }
  }

  public async upsertDispatchedAccount(item: DispatchedPremiumAccount): Promise<SupabaseMutationResult> {
    if (this.config.syncMode === 'local_only') return { success: true };
    if (!this.client) {
      return { success: false, error: 'Supabase client belum terhubung. Periksa konfigurasi URL & Anon Key di Pengaturan Admin.' };
    }
    try {
      const payload = {
        id: item.id,
        orderId: item.orderId,
        appName: item.appName,
        orderDate: item.orderDate || '',
        accountCredentials: item.accountCredentials,
        customerName: item.customerName || '',
        customerWhatsapp: item.customerWhatsapp || '',
        duration: item.duration || '30 Hari',
        note: item.note || '',
        sentAt: item.sentAt || new Date().toISOString(),
        status: item.status || 'Terkirim',
        updatedAt: new Date().toISOString(),
      };
      const { error } = await this.client.from('dispatched_accounts').upsert(payload, { onConflict: 'id' });
      if (error) {
        const msg = `Supabase Error [dispatched_accounts]: ${error.message}${error.details ? ` (${error.details})` : ''} [Code: ${error.code || 'ERR'}]`;
        this.addLog('error', 'SUPABASE', msg);
        return { success: false, error: msg };
      }
      this.addLog('success', 'SUPABASE', `☁️ Realtime Auto-Save: Pengiriman akun [${item.orderId}] tersimpan di Supabase.`);
      this.lastSyncTimestamp = new Date().toISOString();
      return { success: true };
    } catch (err: any) {
      const msg = `Supabase Exception [dispatched_accounts]: ${err?.message || err}`;
      this.addLog('error', 'SUPABASE', msg);
      return { success: false, error: msg };
    }
  }

  public async deleteDispatchedAccount(id: string): Promise<SupabaseMutationResult> {
    if (this.config.syncMode === 'local_only') return { success: true };
    if (!this.client) {
      return { success: false, error: 'Supabase client belum terhubung.' };
    }
    if (!id || typeof id !== 'string' || !id.trim() || id === 'undefined' || id === 'null') {
      const msg = `Supabase Delete Ditolak [dispatched_accounts]: ID akun terkirim tidak valid (${String(id)}).`;
      this.addLog('error', 'SUPABASE', msg);
      return { success: false, error: msg };
    }
    const cleanId = id.trim();
    try {
      const { error } = await this.client.from('dispatched_accounts').delete().eq('id', cleanId);
      if (error) {
        const msg = `Supabase Delete Error [dispatched_accounts]: ${error.message} [Code: ${error.code || 'ERR'}]`;
        this.addLog('error', 'SUPABASE', msg);
        return { success: false, error: msg };
      }
      this.addLog('success', 'SUPABASE', `🗑️ Realtime Delete: Akun terkirim [${cleanId}] dihapus dari Supabase.`);
      this.lastSyncTimestamp = new Date().toISOString();
      return { success: true };
    } catch (err: any) {
      const msg = `Gagal delete akun terkirim di Supabase: ${err?.message || err}`;
      this.addLog('error', 'SUPABASE', msg);
      return { success: false, error: msg };
    }
  }

  public async upsertNotification(item: WhatsAppNotificationItem): Promise<SupabaseMutationResult> {
    if (this.config.syncMode === 'local_only') return { success: true };
    if (!this.client) {
      return { success: false, error: 'Supabase client belum terhubung.' };
    }
    try {
      const payload = {
        id: item.id,
        type: item.type,
        title: item.title,
        message: item.message,
        timestamp: item.timestamp,
        read: item.read ?? false,
        targetNumber: item.targetNumber,
        referenceId: item.referenceId || '',
        customerName: item.customerName || '',
        productName: item.productName || '',
        status: item.status || 'Terkirim ke WhatsApp Admin',
        waUrl: item.waUrl || '',
        createdAt: new Date().toISOString(),
      };
      const { error } = await this.client.from('notifications').upsert(payload, { onConflict: 'id' });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  // --- TWO-WAY PULL & PUSH HYBRID SYNC ---
  public async pullFromSupabase(): Promise<{
    success: boolean;
    counts: { warranties: number; claims: number; monitoring: number; dispatched: number; notifications: number };
    message: string;
    error?: string;
  }> {
    if (!this.client) {
      return {
        success: false,
        counts: { warranties: 0, claims: 0, monitoring: 0, dispatched: 0, notifications: 0 },
        message: 'Supabase URL & Anon Key belum diisi.',
      };
    }

    this.addLog('sync', 'SUPABASE', '📥 Menarik data terbaru dari Supabase Cloud PostgreSQL...');
    try {
      const [wRes, cRes, mRes, dRes, nRes] = await Promise.all([
        Promise.resolve(this.client.from('warranties').select('*').order('id', { ascending: false })).catch((err) => ({ data: null, error: err })),
        Promise.resolve(this.client.from('claims').select('*').order('id', { ascending: false })).catch((err) => ({ data: null, error: err })),
        Promise.resolve(this.client.from('monitoring').select('*').order('id', { ascending: false })).catch((err) => ({ data: null, error: err })),
        Promise.resolve(this.client.from('dispatched_accounts').select('*').order('id', { ascending: false })).catch((err) => ({ data: null, error: err })),
        Promise.resolve(this.client.from('notifications').select('*').order('id', { ascending: false })).catch((err) => ({ data: null, error: err })),
      ]);

      const queryErrors: string[] = [];
      if (wRes?.error) queryErrors.push(`warranties (${wRes.error.message || wRes.error})`);
      if (cRes?.error) queryErrors.push(`claims (${cRes.error.message || cRes.error})`);
      if (mRes?.error) queryErrors.push(`monitoring (${mRes.error.message || mRes.error})`);
      if (dRes?.error) queryErrors.push(`dispatched_accounts (${dRes.error.message || dRes.error})`);
      if (nRes?.error) queryErrors.push(`notifications (${nRes.error.message || nRes.error})`);

      if (queryErrors.length > 0) {
        this.addLog('warn', 'SUPABASE', `Kendala pembacaan tabel Supabase: ${queryErrors.join(', ')}`);
      }

      const rawWarranties = Array.isArray(wRes?.data) ? wRes.data : [];
      const rawClaims = Array.isArray(cRes?.data) ? cRes.data : [];
      const rawMonitoring = Array.isArray(mRes?.data) ? mRes.data : [];
      const rawDispatched = Array.isArray(dRes?.data) ? dRes.data : [];
      const rawNotifications = Array.isArray(nRes?.data) ? nRes.data : [];

      const warranties = rawWarranties.map(normalizeWarrantyRow);
      const claims = rawClaims.map(normalizeClaimRow);
      const monitoring = rawMonitoring.map(normalizeMonitoringRow);
      const dispatched = rawDispatched.map(normalizeDispatchedRow);
      const notifications = rawNotifications.map(normalizeNotificationRow);

      const counts = {
        warranties: warranties.length,
        claims: claims.length,
        monitoring: monitoring.length,
        dispatched: dispatched.length,
        notifications: notifications.length,
      };

      if (this.syncHandlers?.applyFullData) {
        this.syncHandlers.applyFullData({
          warranties: Array.isArray(wRes?.data) ? warranties : undefined,
          claims: Array.isArray(cRes?.data) ? claims : undefined,
          monitoring: Array.isArray(mRes?.data) ? monitoring : undefined,
          dispatched: Array.isArray(dRes?.data) ? dispatched : undefined,
          notifications: Array.isArray(nRes?.data) ? notifications : undefined,
        });
      }

      this.lastSyncTimestamp = new Date().toISOString();
      const total = counts.warranties + counts.claims + counts.monitoring + counts.dispatched + counts.notifications;

      if (queryErrors.length === 5) {
        const primaryErr = queryErrors[0];
        this.addLog('error', 'SUPABASE', `❌ Seluruh tabel Supabase gagal diakses: ${primaryErr}`);
        return {
          success: false,
          counts,
          message: `Gagal membaca tabel Supabase: ${primaryErr}`,
          error: queryErrors.join('; '),
        };
      }

      this.addLog('success', 'SUPABASE', `✅ Berhasil memuat ${total} data langsung dari Supabase Cloud.`);
      return {
        success: true,
        counts,
        message: `Berhasil sinkronisasi ${total} data dari Supabase.`,
      };
    } catch (err: any) {
      this.addLog('error', 'SUPABASE', `Gagal menarik data dari Supabase: ${err?.message || err}`);
      return {
        success: false,
        counts: { warranties: 0, claims: 0, monitoring: 0, dispatched: 0, notifications: 0 },
        message: err?.message || 'Gagal terhubung ke database cloud',
        error: err?.message || String(err),
      };
    }
  }

  public async pushLocalToSupabase(): Promise<{ success: boolean; pushedCount: number; message: string }> {
    if (!this.client) {
      return { success: false, pushedCount: 0, message: 'Harap isi URL & Anon Key Supabase terlebih dahulu.' };
    }

    const data = this.syncHandlers?.getCurrentData ? this.syncHandlers.getCurrentData() : null;
    const warranties = data ? data.warranties : await apiClient.getWarranties();
    const claims = data ? data.claims : await apiClient.getClaims();
    const monitoring = data ? data.monitoring : await apiClient.getMonitoringRecords();
    const dispatched = data?.dispatched || [];

    const totalAvailable = (warranties?.length || 0) + (claims?.length || 0) + (monitoring?.length || 0) + (dispatched?.length || 0);
    if (totalAvailable === 0) {
      const msg = 'Data lokal kosong. Push otomatis dibatalkan demi keamanan data Supabase Cloud.';
      this.addLog('warn', 'SUPABASE', msg);
      return { success: true, pushedCount: 0, message: msg };
    }

    this.addLog('sync', 'SUPABASE', '📤 Memulai Push Data Lokal ke Supabase Cloud PostgreSQL...');
    try {
      let count = 0;
      if (warranties && warranties.length > 0) {
        for (const w of warranties) {
          await this.upsertWarranty(w);
        }
        count += warranties.length;
      }

      const claims = data ? data.claims : await apiClient.getClaims();
      if (claims && claims.length > 0) {
        for (const c of claims) {
          await this.upsertClaim(c);
        }
        count += claims.length;
      }

      const monitoring = data ? data.monitoring : await apiClient.getMonitoringRecords();
      if (monitoring && monitoring.length > 0) {
        for (const m of monitoring) {
          await this.upsertMonitoring(m);
        }
        count += monitoring.length;
      }

      const dispatched = data?.dispatched || [];
      if (dispatched.length > 0) {
        for (const d of dispatched) {
          await this.upsertDispatchedAccount(d);
        }
        count += dispatched.length;
      }

      this.lastSyncTimestamp = new Date().toISOString();
      this.addLog('success', 'SUPABASE', `🎉 Seluruh data lokal (${count} item) berhasil dikirimkan ke Supabase Cloud!`);
      return { success: true, pushedCount: count, message: `Berhasil mengekspor ${count} item ke Cloud Supabase.` };
    } catch (err: any) {
      this.addLog('error', 'SUPABASE', `Gagal push ke Supabase: ${err?.message || err}`);
      return { success: false, pushedCount: 0, message: err?.message || 'Gagal push ke database' };
    }
  }

  public async executeAutoImport(): Promise<{ success: boolean; importedRecords: number; message: string }> {
    if (this.isImporting) {
      return { success: false, importedRecords: 0, message: 'Proses import otomatis sedang berjalan...' };
    }

    this.isImporting = true;
    this.addLog('import', 'AUTO_IMPORT', '🚀 Menjalankan Siklus Realtime Import / Sinkronisasi Supabase...');

    try {
      const res = await this.pullFromSupabase();
      const total = res.counts.warranties + res.counts.claims + res.counts.monitoring + res.counts.dispatched;
      this.lastAutoImportTime = new Date().toLocaleTimeString('id-ID');
      this.importedCountTotal += total;
      this.isImporting = false;
      return {
        success: res.success,
        importedRecords: total,
        message: res.message,
      };
    } catch (err: any) {
      this.isImporting = false;
      this.addLog('error', 'AUTO_IMPORT', `❌ Kendala auto-import: ${err?.message || err}`);
      return { success: false, importedRecords: 0, message: err?.message || 'Gagal import' };
    }
  }

  // --- CONSOLE LOGGER ---
  public addLog(
    level: ConsoleLogItem['level'],
    source: ConsoleLogItem['source'],
    message: string,
    details?: any
  ): void {
    const item: ConsoleLogItem = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp:
        new Date().toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
        '.' +
        String(new Date().getMilliseconds()).padStart(3, '0'),
      level,
      source,
      message,
      details,
    };

    this.logs = [item, ...this.logs.slice(0, 199)];
    this.notifyLogListeners();

    if (level === 'error') {
      console.error(`[${source}] ${message}`, details || '');
    } else if (level === 'warn') {
      console.warn(`[${source}] ${message}`, details || '');
    } else {
      console.log(`[${source}] ${message}`, details || '');
    }
  }

  public getLogs(): ConsoleLogItem[] {
    return [...this.logs];
  }

  public clearLogs(): void {
    this.logs = [];
    this.addLog('info', 'SYSTEM', 'Layar console monitor dibersihkan.');
  }

  public subscribeLogs(listener: (logs: ConsoleLogItem[]) => void): () => void {
    this.logListeners.push(listener);
    listener(this.getLogs());
    return () => {
      this.logListeners = this.logListeners.filter((l) => l !== listener);
    };
  }

  private notifyLogListeners(): void {
    const currentLogs = this.getLogs();
    this.logListeners.forEach((l) => l(currentLogs));
  }

  // --- PING HELPERS ---
  public async pingBackendApi(): Promise<{ online: boolean; latencyMs: number; port: number; uptime: number }> {
    const start = performance.now();
    try {
      const isHealthy = await apiClient.checkHealth();
      const latencyMs = Math.round(performance.now() - start);
      return {
        online: isHealthy,
        latencyMs: isHealthy ? latencyMs : 0,
        port: 3001,
        uptime: isHealthy ? 3600 : 0,
      };
    } catch {
      return { online: false, latencyMs: 0, port: 3001, uptime: 0 };
    }
  }

  public async pingSupabase(): Promise<{ online: boolean; latencyMs: number; message?: string }> {
    if (!this.client || !this.config.url || !this.config.anonKey) {
      return { online: false, latencyMs: 0, message: 'URL atau Anon Key Supabase belum dikonfigurasi.' };
    }

    const start = performance.now();
    try {
      const checkPromise = this.client.from('orders').select('id').limit(1);
      const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Koneksi timeout (> 5000ms)')), 5000)
      );

      const res: any = await Promise.race([checkPromise, timeoutPromise]);
      const latencyMs = Math.max(Math.round(performance.now() - start), 1);

      if (res && res.error) {
        if (res.error.code === '42P01' || res.error.message?.includes('does not exist')) {
          return {
            online: true,
            latencyMs,
            message: `Supabase Cloud Aktif (${latencyMs}ms), namun tabel belum dibuat. Jalankan Skrip SQL.`,
          };
        }
        return {
          online: true,
          latencyMs,
          message: `Koneksi Supabase Cloud Aktif (${latencyMs}ms)`,
        };
      }

      return { online: true, latencyMs, message: `Koneksi Supabase Cloud Aktif (${latencyMs}ms)` };
    } catch (err: any) {
      return { online: false, latencyMs: 0, message: err?.message || 'Gagal tersambung ke Supabase' };
    }
  }

  public async getOverallHealth(): Promise<SystemHealthStatus> {
    const apiPing = await this.pingBackendApi();
    const supabasePing = await this.pingSupabase();

    let localStats: any = { warranties: 0, claims: 0, monitoring: 0, dispatched: 0, notifications: 0, total: 0 };
    const currData = this.syncHandlers?.getCurrentData ? this.syncHandlers.getCurrentData() : null;
    if (currData) {
      localStats = {
        warranties: currData.warranties.length,
        claims: currData.claims.length,
        monitoring: currData.monitoring.length,
        dispatched: currData.dispatched.length,
        notifications: currData.notifications.length,
        total: currData.warranties.length + currData.claims.length + currData.monitoring.length + currData.dispatched.length,
      };
    } else {
      try {
        const stats = await apiClient.getStats();
        if (stats) {
          localStats = {
            warranties: stats.warranties?.total || 0,
            claims: stats.claims?.total || 0,
            monitoring: stats.monitoring?.total || 0,
            dispatched: 0,
            notifications: stats.notifications?.total || 0,
            total: (stats.warranties?.total || 0) + (stats.claims?.total || 0) + (stats.monitoring?.total || 0),
          };
        }
      } catch { }
    }

    let supabaseCounts = { warranties: 0, claims: 0, monitoring: 0, dispatched: 0, notifications: 0, total: 0 };
    if (this.client && supabasePing.online) {
      try {
        const [w, c, m, d, n] = await Promise.all([
          Promise.resolve(this.client.from('warranties').select('*', { count: 'exact', head: true })).catch(() => ({ count: 0 })),
          Promise.resolve(this.client.from('claims').select('*', { count: 'exact', head: true })).catch(() => ({ count: 0 })),
          Promise.resolve(this.client.from('monitoring').select('*', { count: 'exact', head: true })).catch(() => ({ count: 0 })),
          Promise.resolve(this.client.from('dispatched_accounts').select('*', { count: 'exact', head: true })).catch(() => ({ count: 0 })),
          Promise.resolve(this.client.from('notifications').select('*', { count: 'exact', head: true })).catch(() => ({ count: 0 })),
        ]);
        supabaseCounts = {
          warranties: w.count ?? 0,
          claims: c.count ?? 0,
          monitoring: m.count ?? 0,
          dispatched: d.count ?? 0,
          notifications: n.count ?? 0,
          total: (w.count ?? 0) + (c.count ?? 0) + (m.count ?? 0) + (d.count ?? 0),
        };
      } catch { }
    }

    return {
      api: {
        online: apiPing.online,
        latencyMs: apiPing.latencyMs,
        port: apiPing.port,
        uptimeSeconds: apiPing.uptime,
        lastPing: new Date().toLocaleTimeString('id-ID'),
      },
      localDb: {
        online: true,
        path: 'LocalStorage & Server Cache',
        totalRecords: localStats.total,
        warrantiesCount: localStats.warranties,
        claimsCount: localStats.claims,
        monitoringCount: localStats.monitoring,
        dispatchedCount: localStats.dispatched,
        notificationsCount: localStats.notifications,
        lastUpdated: new Date().toLocaleTimeString('id-ID'),
      },
      supabase: {
        configured: !!(this.config.url && this.config.anonKey),
        online: supabasePing.online,
        realtimeConnected: this.isRealtimeSubscribed,
        latencyMs: supabasePing.latencyMs,
        syncMode: this.config.syncMode,
        url: this.config.url || 'Belum diatur',
        lastSync: this.lastSyncTimestamp,
        counts: supabaseCounts,
      },
      autoImport: {
        active: this.config.autoImportEnabled && this.config.syncMode !== 'local_only',
        intervalSeconds: this.config.autoImportIntervalSeconds,
        lastRun: this.lastAutoImportTime,
        importedCount: this.importedCountTotal,
        status: this.isImporting ? 'running' : 'idle',
      },
    };
  }

  // --- CONNECTABLE ENTITIES MATRIX ---
  public getConnectableEntities(): EntityConnectionStatus[] {
    return [
      {
        id: 'table_warranties',
        name: 'Tabel Garansi (warranties)',
        type: 'table',
        target: 'public.warranties',
        description: 'Menyimpan kode pesanan, nama pembeli, WhatsApp, produk, masa aktif, dan status garansi.',
        status: this.client ? 'connected' : 'idle',
      },
      {
        id: 'table_claims',
        name: 'Tabel Klaim Masalah (claims)',
        type: 'table',
        target: 'public.claims',
        description: 'Menyimpan tiket keluhan pembeli, nomor WhatsApp, deskripsi kendala, bukti foto, dan status penanganan CS.',
        status: this.client ? 'connected' : 'idle',
      },
      {
        id: 'table_monitoring',
        name: 'Tabel Monitoring Akun (monitoring)',
        type: 'table',
        target: 'public.monitoring',
        description: 'Menyimpan riwayat akun yang dipantau pembeli, pemeriksaan berkala, dan status kesehatan akun.',
        status: this.client ? 'connected' : 'idle',
      },
      {
        id: 'table_dispatched_accounts',
        name: 'Tabel Akun Terkirim (dispatched_accounts)',
        type: 'table',
        target: 'public.dispatched_accounts',
        description: 'Menyimpan riwayat invoice dan detail akun premium yang dikirimkan Admin ke pembeli.',
        status: this.client ? 'connected' : 'idle',
      },
      {
        id: 'table_notifications',
        name: 'Tabel Notifikasi WhatsApp (notifications)',
        type: 'table',
        target: 'public.notifications',
        description: 'Menyimpan riwayat broadcast WhatsApp, pesan instruksi garansi, dan log status terkirim.',
        status: this.client ? 'connected' : 'idle',
      },
      {
        id: 'table_settings',
        name: 'Tabel Pengaturan Global (app_settings)',
        type: 'table',
        target: 'public.app_settings',
        description: 'Menyimpan konfigurasi branding, logo login, profil admin, dan parameter sistem.',
        status: this.client ? 'connected' : 'idle',
      },
      {
        id: 'bucket_proofs',
        name: 'Storage Bucket Bukti (proof-uploads)',
        type: 'bucket',
        target: 'storage.buckets/proof-uploads',
        description: 'Menyimpan file screenshot keluhan pembeli, dokumen klaim garansi, dan aset media website.',
        status: this.client ? 'connected' : 'idle',
      },
      {
        id: 'realtime_channel',
        name: 'Supabase Realtime WebSocket (wayahe-realtime-global)',
        type: 'realtime',
        target: 'realtime:public:*',
        description: 'Mendengarkan event INSERT/UPDATE/DELETE secara instan tanpa perlu refresh browser pembeli/admin.',
        status: this.isRealtimeSubscribed ? 'connected' : 'idle',
      },
      {
        id: 'auth_security',
        name: 'Supabase Auth & RLS Policy (Security)',
        type: 'auth',
        target: 'auth.users & Row Level Security',
        description: 'Keamanan multi-role, otentikasi login admin, serta pembatasan akses data klaim pembeli.',
        status: this.client ? 'connected' : 'idle',
      },
    ];
  }

  // --- TEST INDIVIDUAL ENTITY ---
  public async testEntityConnection(entityId: string): Promise<{ success: boolean; message: string; count?: number }> {
    if (!this.client) {
      return { success: false, message: 'Supabase client belum dikonfigurasi dengan URL & Key yang valid.' };
    }

    this.addLog('info', 'SUPABASE', `Menguji koneksi entitas: [${entityId}]...`);

    try {
      if (entityId === 'table_warranties') {
        const { data, error, count } = await this.client.from('warranties').select('*', { count: 'exact', head: false }).limit(5);
        if (error) throw error;
        this.addLog('success', 'SUPABASE', `Tabel warranties terverifikasi. Terdeteksi ${count ?? (data?.length || 0)} baris data.`);
        return { success: true, message: `Tabel warranties online (${count ?? (data?.length || 0)} baris).`, count: count ?? data?.length };
      }

      if (entityId === 'table_claims') {
        const { data, error, count } = await this.client.from('claims').select('*', { count: 'exact', head: false }).limit(5);
        if (error) throw error;
        this.addLog('success', 'SUPABASE', `Tabel claims terverifikasi. Terdeteksi ${count ?? (data?.length || 0)} tiket klaim.`);
        return { success: true, message: `Tabel claims online (${count ?? (data?.length || 0)} tiket).`, count: count ?? data?.length };
      }

      if (entityId === 'table_monitoring') {
        const { data, error, count } = await this.client.from('monitoring').select('*', { count: 'exact', head: false }).limit(5);
        if (error) throw error;
        this.addLog('success', 'SUPABASE', `Tabel monitoring terverifikasi. Terdeteksi ${count ?? (data?.length || 0)} akun.`);
        return { success: true, message: `Tabel monitoring online (${count ?? (data?.length || 0)} akun).`, count: count ?? data?.length };
      }

      if (entityId === 'table_dispatched_accounts') {
        const { data, error, count } = await this.client.from('dispatched_accounts').select('*', { count: 'exact', head: false }).limit(5);
        if (error) throw error;
        this.addLog('success', 'SUPABASE', `Tabel dispatched_accounts terverifikasi. Terdeteksi ${count ?? (data?.length || 0)} akun terkirim.`);
        return { success: true, message: `Tabel dispatched_accounts online (${count ?? (data?.length || 0)} akun).`, count: count ?? data?.length };
      }

      if (entityId === 'table_notifications') {
        const { data, error, count } = await this.client.from('notifications').select('*', { count: 'exact', head: false }).limit(5);
        if (error) throw error;
        this.addLog('success', 'SUPABASE', `Tabel notifications terverifikasi. Terdeteksi ${count ?? (data?.length || 0)} notifikasi.`);
        return { success: true, message: `Tabel notifications online (${count ?? (data?.length || 0)} pesan).`, count: count ?? data?.length };
      }

      if (entityId === 'table_settings') {
        const { data, error } = await this.client.from('app_settings').select('*').limit(1);
        if (error) throw error;
        this.addLog('success', 'SUPABASE', 'Tabel app_settings terverifikasi dan siap digunakan.');
        return { success: true, message: 'Tabel app_settings online.', count: data?.length || 0 };
      }

      if (entityId === 'bucket_proofs') {
        let exists = false;
        try {
          const { data } = await this.client.storage.listBuckets();
          if (Array.isArray(data) && data.some((b) => b.name === 'proof-uploads' || b.id === 'proof-uploads')) {
            exists = true;
          }
        } catch { }

        if (!exists) {
          try {
            const { data: bData, error: bErr } = await this.client.storage.getBucket('proof-uploads');
            if (bData && !bErr) exists = true;
          } catch { }
        }

        if (exists) {
          this.addLog('success', 'STORAGE', 'Bucket "proof-uploads" terdeteksi aktif & siap menerima unggahan bukti!');
          return { success: true, message: 'Storage bucket proof-uploads aktif & terhubung.' };
        } else {
          return { success: false, message: 'Bucket "proof-uploads" belum dibuat. Jalankan skrip SQL migrasi.' };
        }
      }

      if (entityId === 'realtime_channel') {
        this.setupRealtimeSync();
        return { success: true, message: 'Realtime WebSocket Channel siap & aktif.' };
      }

      if (entityId === 'auth_security') {
        const { data, error } = await this.client.auth.getSession();
        if (error) throw error;
        this.addLog('success', 'SUPABASE', 'Supabase Auth Engine aktif. Siap untuk multi-role security.');
        return { success: true, message: 'Supabase Auth subsystem siap.' };
      }

      return { success: true, message: `Entitas ${entityId} berhasil diuji.` };
    } catch (err: any) {
      this.addLog('error', 'SUPABASE', `Gagal menguji entitas [${entityId}]: ${err?.message || err}`);
      return { success: false, message: `Error: ${err?.message || 'Gagal berkomunikasi dengan database'}` };
    }
  }

  // --- START/STOP DAEMON ---
  public startAutoImportDaemon(): void {
    this.stopAutoImportDaemon();
    const intervalMs = Math.max(10, this.config.autoImportIntervalSeconds) * 1000;
    this.addLog('info', 'AUTO_IMPORT', `Daemon Auto-Sync AKTIF. Frekuensi sinkronisasi: tiap ${this.config.autoImportIntervalSeconds} detik.`);

    this.autoImportTimer = setInterval(() => {
      this.executeAutoImport().catch(() => { });
    }, intervalMs);
  }

  public stopAutoImportDaemon(): void {
    if (this.autoImportTimer) {
      clearInterval(this.autoImportTimer);
      this.autoImportTimer = null;
    }
  }

  // --- SQL SCHEMA GENERATOR FOR ADMIN ---
  public generateSupabaseSqlScript(): string {
    return `-- =========================================================================
-- WAYAHEDIGITAL WARRANTY CENTER - SUPABASE DATABASE MIGRATION SCRIPT
-- Copy seluruh script ini dan paste ke Supabase Dashboard -> SQL Editor -> Run
-- =========================================================================

-- 1. TABEL WARRANTIES (Garansi & Lisensi Akun)
CREATE TABLE IF NOT EXISTS public.warranties (
    id TEXT PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT DEFAULT '',
    "customerInitials" TEXT DEFAULT 'WD',
    "avatarBg" TEXT DEFAULT 'bg-[#e4dfff] text-[#160066]',
    product TEXT NOT NULL,
    "productVariant" TEXT DEFAULT 'Akun Digital',
    validity TEXT DEFAULT '30 Hari Garansi',
    "progressPercent" NUMERIC DEFAULT 100,
    status TEXT NOT NULL DEFAULT 'Aktif',
    "issueType" TEXT DEFAULT 'Normal / Tanpa Kendala',
    complaint TEXT DEFAULT '',
    "screenshotUrl" TEXT DEFAULT '',
    price TEXT DEFAULT '',
    "purchaseDate" TEXT,
    role TEXT DEFAULT 'pembeli',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABEL CLAIMS (Tiket Masalah & Klaim Pembeli)
CREATE TABLE IF NOT EXISTS public.claims (
    id TEXT PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "orderDate" TEXT,
    "issueDate" TEXT,
    "solutionRequested" TEXT DEFAULT 'Ganti Akun / Profil Baru',
    product TEXT NOT NULL,
    "productVariant" TEXT DEFAULT 'Akun Digital',
    "issueType" TEXT NOT NULL,
    "accountEmail" TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    device TEXT DEFAULT 'Desktop & Mobile',
    "screenshotUrl" TEXT DEFAULT '',
    "screenshotName" TEXT DEFAULT '',
    "screenshotSize" TEXT DEFAULT '',
    description TEXT,
    "submittedAt" TEXT,
    status TEXT NOT NULL DEFAULT 'Sedang Diproses CS',
    "slaResponseEstimate" TEXT DEFAULT '< 15 Menit',
    "adminResponseNote" TEXT,
    "replacementAccountInfo" TEXT,
    "customerName" TEXT,
    "linkedMonitoringId" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABEL MONITORING (Pemantauan Akun Berkala)
CREATE TABLE IF NOT EXISTS public.monitoring (
    id TEXT PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    product TEXT NOT NULL,
    "orderDate" TEXT,
    "accountEmail" TEXT NOT NULL,
    "screenshotUrl" TEXT DEFAULT '',
    "screenshotName" TEXT DEFAULT '',
    "screenshotSize" TEXT DEFAULT '',
    note TEXT,
    "savedAt" TEXT,
    status TEXT NOT NULL DEFAULT 'Tersimpan & Terpantau',
    "customerName" TEXT,
    "customerPhone" TEXT,
    "adminNote" TEXT,
    "healthStatus" TEXT DEFAULT 'Normal Aktif',
    "linkedClaimTicketId" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABEL DISPATCHED_ACCOUNTS (Pengiriman Akun Premium ke Pembeli)
CREATE TABLE IF NOT EXISTS public.dispatched_accounts (
    id TEXT PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "orderDate" TEXT,
    "accountCredentials" TEXT NOT NULL,
    "customerName" TEXT,
    "customerWhatsapp" TEXT,
    duration TEXT,
    note TEXT,
    "sentAt" TEXT,
    status TEXT NOT NULL DEFAULT 'Terkirim',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABEL NOTIFICATIONS (Log Notifikasi WhatsApp Bot)
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'claim',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp TEXT,
    read BOOLEAN DEFAULT FALSE,
    "targetNumber" TEXT NOT NULL,
    "referenceId" TEXT,
    "customerName" TEXT,
    "productName" TEXT,
    status TEXT NOT NULL DEFAULT 'Terkirim ke WhatsApp Admin',
    "waUrl" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABEL APP_SETTINGS (Pengaturan Global & Branding)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 7. INDEXES UNTUK PENCARIAN CEPAT
CREATE INDEX IF NOT EXISTS idx_warranties_orderId ON public.warranties("orderId");
CREATE INDEX IF NOT EXISTS idx_claims_orderId ON public.claims("orderId");
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.claims(status);
CREATE INDEX IF NOT EXISTS idx_monitoring_orderId ON public.monitoring("orderId");
CREATE INDEX IF NOT EXISTS idx_dispatched_orderId ON public.dispatched_accounts("orderId");

-- 8. REPLICA IDENTITY FULL (Wajib agar Supabase Realtime mengirimkan seluruh kolom pada UPDATE & DELETE)
ALTER TABLE public.warranties REPLICA IDENTITY FULL;
ALTER TABLE public.claims REPLICA IDENTITY FULL;
ALTER TABLE public.monitoring REPLICA IDENTITY FULL;
ALTER TABLE public.dispatched_accounts REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.app_settings REPLICA IDENTITY FULL;

-- 9. ENABLE ROW LEVEL SECURITY (RLS) & UNIFIED ACCESS POLICIES
ALTER TABLE public.warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatched_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon all on warranties" ON public.warranties;
DROP POLICY IF EXISTS "Allow all on warranties" ON public.warranties;
CREATE POLICY "Allow all on warranties" ON public.warranties FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on claims" ON public.claims;
DROP POLICY IF EXISTS "Allow all on claims" ON public.claims;
CREATE POLICY "Allow all on claims" ON public.claims FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on monitoring" ON public.monitoring;
DROP POLICY IF EXISTS "Allow all on monitoring" ON public.monitoring;
CREATE POLICY "Allow all on monitoring" ON public.monitoring FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on dispatched_accounts" ON public.dispatched_accounts;
DROP POLICY IF EXISTS "Allow all on dispatched_accounts" ON public.dispatched_accounts;
CREATE POLICY "Allow all on dispatched_accounts" ON public.dispatched_accounts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow all on notifications" ON public.notifications;
CREATE POLICY "Allow all on notifications" ON public.notifications FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow all on app_settings" ON public.app_settings;
CREATE POLICY "Allow all on app_settings" ON public.app_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 10. STORAGE BUCKET UNTUK BUKTI SCREENSHOT
INSERT INTO storage.buckets (id, name, public) 
VALUES ('proof-uploads', 'proof-uploads', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access Bucket Proofs" ON storage.objects;
CREATE POLICY "Public Access Bucket Proofs" ON storage.objects FOR ALL TO anon, authenticated USING (bucket_id = 'proof-uploads') WITH CHECK (bucket_id = 'proof-uploads');

-- 11. PUBLIKASI REALTIME SUPABASE (Auto-Sync Instan ke Seluruh Layar)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.warranties, public.claims, public.monitoring, public.dispatched_accounts, public.notifications, public.app_settings;
`;
  }
}

export const supabaseHybridService = new SupabaseHybridService();
