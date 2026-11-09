import { QIOSPAY_CONFIG } from '../config/apikeys.js';
import { mongoDbService } from './mongodbService.js';
import { resolveQiospaySettings } from './qiospaySettings.js';

// Shared by HTTP startup/settings saves and the separately runnable worker.
export async function hydrateQiospayRuntime() {
  try {
    const settings = await mongoDbService.getSettingsFromDatabase();
    Object.assign(QIOSPAY_CONFIG, resolveQiospaySettings(settings, QIOSPAY_CONFIG));
  } catch (error) {
    // Never retain stale credentials after failed authoritative reads.
    QIOSPAY_CONFIG.MERCHANT_CODE = '';
    QIOSPAY_CONFIG.API_KEY = '';
    QIOSPAY_CONFIG.EXPECTED_NMID = '';
    QIOSPAY_CONFIG.CALLBACK_SECRET = '';
    QIOSPAY_CONFIG.SECRET_KEY = '';
    throw error;
  }
}
