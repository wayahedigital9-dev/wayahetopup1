import ngrok from '@ngrok/ngrok';
import { NGROK_CONFIG, QIOSPAY_CONFIG } from '../config/apikeys.js';

export interface NgrokTunnelState {
  isActive: boolean;
  publicUrl: string | null;
  startedAt: string | null;
  error?: string | null;
  webhooks: {
    digiflazz: string | null;
    qiospay: string | null;
  };
}

let activeListener: any = null;
let currentPublicUrl: string | null = null;
let tunnelStartedAt: string | null = null;
let lastError: string | null = null;

export const ngrokService = {
  /**
   * Start an ngrok tunnel forwarding to local port
   */
  async start(port: number = 4000, authtoken?: string, domain?: string): Promise<NgrokTunnelState> {
    try {
      if (activeListener && currentPublicUrl) {
        return this.getStatus();
      }

      // ⚠️ API Key dikelola di: src/config/apikeys.ts (BAGIAN 2: API KEY SETTINGS)
      const token = authtoken || NGROK_CONFIG.AUTHTOKEN;
      const customDomain = domain || NGROK_CONFIG.DOMAIN;

      const forwardOptions: any = {
        addr: port,
      };

      if (token) {
        forwardOptions.authtoken = token;
      }

      if (customDomain) {
        forwardOptions.domain = customDomain;
      }

      const listener = await ngrok.forward(forwardOptions);
      activeListener = listener;
      currentPublicUrl = listener.url() || null;
      tunnelStartedAt = new Date().toISOString();
      lastError = null;

      console.log(`[NGROK] Tunnel active at: ${currentPublicUrl} -> localhost:${port}`);

      return this.getStatus();
    } catch (err: any) {
      console.error('[NGROK] Failed to start tunnel:', err.message);
      lastError = err.message;
      return {
        isActive: false,
        publicUrl: null,
        startedAt: null,
        error: err.message,
        webhooks: { digiflazz: null, qiospay: null },
      };
    }
  },

  /**
   * Stop active ngrok tunnel
   */
  async stop(): Promise<NgrokTunnelState> {
    try {
      if (activeListener) {
        await activeListener.close();
      }
      await ngrok.disconnect();
    } catch (e: any) {
      console.warn('[NGROK] Disconnect error (ignored):', e.message);
    } finally {
      activeListener = null;
      currentPublicUrl = null;
      tunnelStartedAt = null;
      lastError = null;
    }

    return this.getStatus();
  },

  /**
   * Get current tunnel status
   */
  getStatus(): NgrokTunnelState {
    const isLive = Boolean(activeListener && currentPublicUrl);
    return {
      isActive: isLive,
      publicUrl: currentPublicUrl,
      startedAt: tunnelStartedAt,
      error: lastError,
      webhooks: {
        digiflazz: isLive ? `${currentPublicUrl}/api/webhooks/digiflazz` : null,
        qiospay: isLive ? `${currentPublicUrl}/api/callback/accept/${QIOSPAY_CONFIG.CALLBACK_SECRET || QIOSPAY_CONFIG.SECRET_KEY || 'callback_scret'}` : null,
      },
    };
  },
};
