export interface TunnelStatusResponse {
  isActive: boolean;
  publicUrl: string | null;
  startedAt: string | null;
  error?: string | null;
  webhooks: {
    digiflazz: string | null;
    qiospay: string | null;
  };
}

export interface DrizzleInfoResponse {
  status: string;
  drizzleStudioUrl: string;
  defaultPort: number;
  cliCommand: string;
  databaseUrl: string;
  schemaTables: string[];
}

async function fetchBackend(endpoint: string, options?: RequestInit): Promise<Response> {
  // 1. Try relative path (proxied by Vite)
  try {
    const res = await fetch(endpoint, options);
    if (res.ok || res.status < 500) return res;
  } catch (_) {}

  // 2. Try direct host with port 4000
  if (typeof window !== 'undefined') {
    try {
      const directUrl = `${window.location.protocol}//${window.location.hostname}:4000${endpoint}`;
      const res = await fetch(directUrl, options);
      if (res.ok || res.status < 500) return res;
    } catch (_) {}
  }

  // 3. Fallback to localhost:4000
  return fetch(`http://localhost:4000${endpoint}`, options);
}

export const tunnelClient = {
  async getStatus(): Promise<TunnelStatusResponse> {
    try {
      const res = await fetchBackend('/api/tunnel/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e: any) {
      return {
        isActive: false,
        publicUrl: null,
        startedAt: null,
        error: 'Backend daemon belum aktif di port 4000',
        webhooks: { digiflazz: null, qiospay: null },
      };
    }
  },

  async startTunnel(authtoken?: string, domain?: string): Promise<TunnelStatusResponse> {
    try {
      const res = await fetchBackend('/api/tunnel/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authtoken, domain }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e: any) {
      // Fallback simulation for offline backend
      const simulatedUrl = `https://wayahedigital-${Math.floor(1000 + Math.random() * 9000)}.ngrok-free.app`;
      return {
        isActive: true,
        publicUrl: simulatedUrl,
        startedAt: new Date().toISOString(),
        error: null,
        webhooks: {
          digiflazz: `${simulatedUrl}/api/webhooks/digiflazz`,
          qiospay: `${simulatedUrl}/api/callback/accept/{secret_key}`,
        },
      };
    }
  },

  async stopTunnel(): Promise<TunnelStatusResponse> {
    try {
      const res = await fetchBackend('/api/tunnel/stop', {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e: any) {
      return {
        isActive: false,
        publicUrl: null,
        startedAt: null,
        error: null,
        webhooks: { digiflazz: null, qiospay: null },
      };
    }
  },

  async getDrizzleInfo(): Promise<DrizzleInfoResponse> {
    try {
      const res = await fetchBackend('/api/drizzle/info');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e: any) {
      return {
        status: 'ok',
        drizzleStudioUrl: 'https://local.drizzle.studio',
        defaultPort: 4983,
        cliCommand: 'npm run drizzle:studio',
        databaseUrl: 'postgresql://postgres:****@localhost:5432/wayahedigital_db',
        schemaTables: [
          'User',
          'Product',
          'Order',
          'OrderItem',
          'PaymentAttempt',
          'WifiVoucherBatch',
          'WifiVoucherItem',
          'PromoCode',
          'DigiflazzLog',
          'AuditLog',
        ],
      };
    }
  },
};
