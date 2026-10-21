/**
 * XavieraStore API client (server-only).
 * Docs: https://xavierastore.com/api-docs.html
 * Auth: Bearer token. Base: https://xavierastore.com/api/v1
 * Rate limit (per key): list 60/min, order 20/min — client must throttle accordingly.
 */
import fs from 'node:fs';
import path from 'node:path';

export interface XavieraConfig { apiKey: string; baseUrl: string }

const DEFAULT_BASE = 'https://xavierastore.com/api/v1';

/** Read key from Mongo settings first, then env/XAVIERA_API_KEY in backend/.env. Never log the value. */
export function loadXavieraConfig(settings: Record<string, any> = {}): XavieraConfig {
  let apiKey = String(settings.xavieraApiKey ?? process.env.XAVIERA_API_KEY ?? '').trim();
  const baseUrl = String(settings.xavieraBaseUrl ?? process.env.XAVIERA_BASE_URL ?? DEFAULT_BASE).trim() || DEFAULT_BASE;
  if (!apiKey) {
    try {
      for (const p of [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), 'backend/.env'), path.resolve(__dirname, '../../.env')]) {
        if (fs.existsSync(p)) {
          const m = fs.readFileSync(p, 'utf8').match(/^XAVIERA_API_KEY=(.+)$/m);
          if (m && m[1]) { apiKey = m[1].trim(); break; }
        }
      }
    } catch { /* fail closed: empty key -> auth error, no fallback secret */ }
  }
  return { apiKey, baseUrl };
}

export class XavieraError extends Error {
  constructor(message: string, public status: number, public retryAfter?: number) { super(message); }
}

async function call(cfg: XavieraConfig, urlPath: string, init?: RequestInit & { retries?: number }): Promise<any> {
  if (!cfg.apiKey) throw new XavieraError('API key Xaviera belum dikonfigurasi.', 401);
  const url = cfg.baseUrl.replace(/\/$/, '') + urlPath;
  const maxAttempts = init?.retries ?? 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
    if (res.status === 429 && attempt < maxAttempts) {
      const wait = Number(res.headers.get('retry-after') || 2);
      await new Promise(r => setTimeout(r, wait * 1000));
      continue;
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new XavieraError(String((body as any).error || `Xaviera HTTP ${res.status}`), res.status,
        Number(res.headers.get('retry-after') || 0) || undefined);
    }
    return body;
  }
}

// ── Akun Premium ─────────────────────────────────────────────
export const xavieraMe = (cfg: XavieraConfig) => call(cfg, '/me');
export const xavieraProducts = (cfg: XavieraConfig) => call(cfg, '/products').then((r: any) => r.products || []);
export const xavieraOrderProduct = (cfg: XavieraConfig, productId: string, opts: { variantId?: string; qty?: number } = {}) =>
  call(cfg, '/products/order', { method: 'POST', body: JSON.stringify({ productId, ...opts }) });
export const xavieraGetOrder = (cfg: XavieraConfig, id: string) => call(cfg, `/orders/${encodeURIComponent(id)}`);

// ── SMM ──────────────────────────────────────────────────────
export const xavieraSmmServices = (cfg: XavieraConfig) => call(cfg, '/smm/services').then((r: any) => r.services || []);
export const xavieraSmmOrder = (cfg: XavieraConfig, serviceId: number, target: string, qty: number, comments?: string) =>
  call(cfg, '/smm/order', { method: 'POST', body: JSON.stringify({ serviceId, target, qty, ...(comments ? { comments } : {}) }) });
export const xavieraSmmStatus = (cfg: XavieraConfig, id: string) => call(cfg, `/smm/order/${encodeURIComponent(id)}`);

// ── Top Up Game ──────────────────────────────────────────────
export const xavieraGames = (cfg: XavieraConfig) => call(cfg, '/games').then((r: any) => r.games || []);
export const xavieraGameItems = (cfg: XavieraConfig, brand: string) =>
  call(cfg, `/games/${encodeURIComponent(brand)}/items`).then((r: any) => r.items || []);
export const xavieraGameOrder = (cfg: XavieraConfig, brand: string, sku: string, customerNo: string, serverId?: string) =>
  call(cfg, '/games/order', { method: 'POST', body: JSON.stringify({ brand, sku, customerNo, ...(serverId ? { serverId } : {}) }) });
export const xavieraGameStatus = (cfg: XavieraConfig, id: string) => call(cfg, `/games/order/${encodeURIComponent(id)}`);
