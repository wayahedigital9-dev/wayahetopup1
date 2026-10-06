import { storage } from './storage';

export const apiClient = {
  async getSettings() {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) return await res.json();
    } catch (_) {}
    return storage.getSettings();
  },

  async updateSettings(newSettings: any) {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (res.ok) {
        const data = await res.json();
        storage.saveSettings(newSettings);
        return data;
      }
    } catch (_) {}
    storage.saveSettings(newSettings);
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
