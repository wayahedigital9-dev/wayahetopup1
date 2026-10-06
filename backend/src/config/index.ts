/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║          WAYAHEDIGITAL - CENTRALIZED CONFIG                 ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║                                                              ║
 * ║  Config dipisah menjadi 2 file:                              ║
 * ║                                                              ║
 * ║  1. console.ts  → Terminal/Console Settings                  ║
 * ║     (Port, Database, Mode, Frontend URL)                     ║
 * ║     Jarang berubah, setting server lokal                     ║
 * ║                                                              ║
 * ║  2. apikeys.ts  → API Key Settings                           ║
 * ║     (Qiospay, Digiflazz, Ngrok, Internal)                    ║
 * ║     Wajib diisi dari dashboard provider                      ║
 * ║                                                              ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export { CONSOLE_CONFIG } from './console.js';
export {
  QIOSPAY_CONFIG,
  DIGIFLAZZ_CONFIG,
  NGROK_CONFIG,
  BOT_CONFIG,
  INTERNAL_SECRETS,
  validateApiKeys,
} from './apikeys.js';
