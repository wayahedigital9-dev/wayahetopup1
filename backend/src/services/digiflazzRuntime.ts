import { DIGIFLAZZ_CONFIG } from '../config/apikeys.js';
import { mongoDbService } from './mongodbService.js';
import { digiflazzService } from './digiflazz.js';
import { resolveDigiflazzSettings } from './digiflazzSettings.js';

// Shared by HTTP startup/settings saves and the separately runnable worker.
export async function hydrateDigiflazzRuntime() {
  try {
    const settings = await mongoDbService.getSettingsFromDatabase();
    Object.assign(DIGIFLAZZ_CONFIG, resolveDigiflazzSettings(settings, DIGIFLAZZ_CONFIG));
    digiflazzService.refreshConfig();
  } catch (error) {
    // Never retain stale credentials after failed authoritative reads.
    DIGIFLAZZ_CONFIG.USERNAME = '';
    DIGIFLAZZ_CONFIG.API_KEY = '';
    digiflazzService.refreshConfig();
    throw error;
  }
}
