import { storage } from './storage';

export const apiClient = {
  async getSettings() {
    const settings = await storage.hydrateSettingsFromBackend();
    if (!settings) throw new Error('Konfigurasi admin tidak dapat dimuat dari server.');
    return settings;
  },

  async updateSettings(newSettings: any) {
    await storage.saveSettings(newSettings);
    return { success: true };
  },

  async getWarranties(): Promise<any[]> {
    try {
      const res = await fetch('/api/warranties');
      if (res.ok) return await res.json();
    } catch (_) {}
    return [];
  },

  async getClaims(): Promise<any[]> {
    try {
      const res = await fetch('/api/claims');
      if (res.ok) return await res.json();
    } catch (_) {}
    return [];
  },

  async getMonitoringRecords(): Promise<any[]> {
    try {
      const res = await fetch('/api/monitoring');
      if (res.ok) return await res.json();
    } catch (_) {}
    return [];
  },

  async getStats(): Promise<any> {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) return await res.json();
    } catch (_) {}
    return {
      warranties: { total: 0 },
      claims: { total: 0 },
      monitoring: { total: 0 },
      notifications: { total: 0 },
    };
  },

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch('/api/health');
      return res.ok;
    } catch (_) {
      return false;
    }
  },
};
