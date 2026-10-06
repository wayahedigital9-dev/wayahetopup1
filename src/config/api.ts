/**
 * Helper to dynamically determine the Backend API Base URL.
 * Supports:
 * - Localhost development (via Vite proxy or direct)
 * - Cross-device LAN access (e.g. mobile phone on 192.168.x.x)
 * - Production / Ngrok tunnel / Custom Domain
 */
export function getBackendBaseUrl(): string {
  // If running in browser, relative paths (e.g. '/api/...') are proxied by Vite
  // or served by backend directly in single-server/production setups.
  return '';
}

export function getDirectBackendUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:4000';
  }
  const { protocol, hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:4000';
  }
  // If accessing from another device via LAN IP (e.g., 192.168.1.15:3000)
  return `${protocol}//${hostname}:4000`;
}
