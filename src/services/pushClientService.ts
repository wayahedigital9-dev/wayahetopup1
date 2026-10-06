import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

export interface PushStatus {
  supported: boolean;
  isIos: boolean;
  isStandalone: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
  serverConfigured: boolean;
  activeDeviceCount: number;
  currentTokenMasked?: string;
  error?: string;
}

export interface DeviceInfo {
  id: string;
  deviceName: string;
  platform: string;
  userAgent?: string;
  enabled: boolean;
  createdAt: string;
  lastUsedAt: string;
  tokenMasked: string;
}

// Client Firebase Configuration from Vite Environment Variables or Fallback
export const getFirebaseClientConfig = () => {
  const metaEnv = (import.meta as any).env || {};
  return {
    apiKey: metaEnv.VITE_FIREBASE_API_KEY || '',
    authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: metaEnv.VITE_FIREBASE_APP_ID || '',
    vapidKey: metaEnv.VITE_FIREBASE_VAPID_KEY || '',
  };
};

class PushClientService {
  private messaging: any = null;
  private currentToken: string | null = null;
  private isInit = false;

  /**
   * Deteksi Platform dan Kesesuaian Lingkungan Web Push
   */
  public getEnvironmentInfo() {
    const isBrowser = typeof window !== 'undefined';
    if (!isBrowser) {
      return { supported: false, isIos: false, isStandalone: false, permission: 'unsupported' as const };
    }

    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    
    // Check standalone mode (PWA installed on Home Screen)
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    const permission = ('Notification' in window) ? Notification.permission : ('unsupported' as const);

    return {
      supported,
      isIos,
      isStandalone,
      permission,
    };
  }

  /**
   * Inisialisasi Firebase Messaging di Frontend
   */
  private async initMessaging() {
    if (this.isInit && this.messaging) return this.messaging;

    const env = this.getEnvironmentInfo();
    if (!env.supported) return null;

    try {
      const isMessagingSupported = await isSupported().catch(() => false);
      if (!isMessagingSupported) return null;

      const config = getFirebaseClientConfig();
      if (!config.apiKey || !config.projectId) {
        console.warn('⚠️ [PushClient] VITE_FIREBASE_API_KEY atau VITE_FIREBASE_PROJECT_ID belum disetel di .env.');
      }

      let app;
      if (getApps().length === 0) {
        app = initializeApp({
          apiKey: config.apiKey,
          authDomain: config.authDomain || `${config.projectId}.firebaseapp.com`,
          projectId: config.projectId,
          storageBucket: config.storageBucket || `${config.projectId}.appspot.com`,
          messagingSenderId: config.messagingSenderId,
          appId: config.appId,
        });
      } else {
        app = getApp();
      }

      this.messaging = getMessaging(app);
      this.isInit = true;

      // Handle in-app foreground messages
      onMessage(this.messaging, (payload) => {
        console.log('🔔 [PushClient] Foreground message received:', payload);
        const title = payload.notification?.title || payload.data?.title || 'Pesanan Baru Wayahe';
        const body = payload.notification?.body || payload.data?.body || 'Ada update status transaksi.';
        
        // Show native notification if permission granted and document not focused
        if (Notification.permission === 'granted' && document.visibilityState !== 'visible') {
          try {
            new Notification(title, {
              body,
              icon: payload.notification?.icon || '/icons/icon-192x192.png',
              tag: payload.data?.tag || `wayahe-${Date.now()}`,
            });
          } catch (_) {}
        }
      });

      return this.messaging;
    } catch (err: any) {
      console.warn('⚠️ [PushClient] Firebase init error:', err.message);
      return null;
    }
  }

  /**
   * Minta Izin Notifikasi dan Daftarkan Perangkat ke Server Backend
   */
  public async requestAndSubscribe(adminUserId = 'admin'): Promise<{
    success: boolean;
    message: string;
    token?: string;
  }> {
    const env = this.getEnvironmentInfo();

    if (!env.supported) {
      return {
        success: false,
        message: 'Browser ini tidak mendukung Web Push Notification. Gunakan Chrome, Edge, atau Safari (iOS 16.4+).',
      };
    }

    if (env.isIos && !env.isStandalone) {
      return {
        success: false,
        message: 'Di iPhone/iPad (iOS), Web Push mengharuskan website ditambahkan ke Home Screen terlebih dahulu. Tekan tombol Share di Safari -> "Add to Home Screen" (Tambahkan ke Layar Utama), lalu buka aplikasi dari ikon layar utama.',
      };
    }

    try {
      // 1. Request Browser Permission (Strict user gesture)
      const permResult = await Notification.requestPermission();
      if (permResult !== 'granted') {
        return {
          success: false,
          message: 'Izin notifikasi ditolak oleh browser. Silakan aktifkan izin notifikasi di Pengaturan Situs browser Anda.',
        };
      }

      // 2. Register Service Worker
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/',
      });
      await navigator.serviceWorker.ready;

      // 3. Inisialisasi Firebase Messaging
      const messaging = await this.initMessaging();
      const config = getFirebaseClientConfig();

      let fcmToken = '';

      if (messaging && config.vapidKey) {
        try {
          fcmToken = await getToken(messaging, {
            vapidKey: config.vapidKey,
            serviceWorkerRegistration: registration,
          });
        } catch (fcmErr: any) {
          console.warn('⚠️ [PushClient] getToken via VAPID error:', fcmErr.message);
        }
      }

      // Fallback: Jika VAPID key belum disetel, coba ambil native subscription endpoint
      if (!fcmToken) {
        try {
          const nativeSub = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: config.vapidKey ? config.vapidKey : undefined,
          });
          if (nativeSub) {
            fcmToken = JSON.stringify(nativeSub);
          }
        } catch (_) {}
      }

      if (!fcmToken) {
        return {
          success: false,
          message: 'Gagal mendapatkan FCM Token perangkat. Pastikan VITE_FIREBASE_VAPID_KEY sudah disetel di .env.',
        };
      }

      this.currentToken = fcmToken;

      // 4. Deteksi Info Perangkat
      const ua = navigator.userAgent;
      let platform = 'Web Desktop';
      let deviceName = 'Admin PC/Browser';

      if (/android/i.test(ua)) {
        platform = 'Android';
        deviceName = 'HP Android Admin';
      } else if (/iphone|ipad|ipod/i.test(ua)) {
        platform = 'iOS';
        deviceName = 'iPhone Admin (PWA)';
      } else if (/mac/i.test(ua)) {
        platform = 'macOS';
        deviceName = 'MacBook Admin';
      } else if (/win/i.test(ua)) {
        platform = 'Windows';
        deviceName = 'Windows PC Admin';
      }

      // 5. Simpan ke Backend Database
      const res = await fetch('/api/admin/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: fcmToken,
          deviceName,
          platform,
          userAgent: ua,
          adminUserId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.message || 'Gagal mendaftarkan perangkat ke server backend.',
        };
      }

      return {
        success: true,
        message: `Perangkat ${deviceName} berhasil diaktifkan untuk menerima Notifikasi Pesanan & Pembayaran!`,
        token: fcmToken,
      };
    } catch (err: any) {
      console.error('❌ [PushClient] Subscription error:', err);
      return {
        success: false,
        message: `Terjadi kendala saat mengaktifkan notifikasi: ${err.message}`,
      };
    }
  }

  /**
   * Nonaktifkan Notifikasi Perangkat Ini
   */
  public async unsubscribe(): Promise<{ success: boolean; message: string }> {
    try {
      if (this.currentToken) {
        await fetch('/api/admin/push/unsubscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: this.currentToken }),
        }).catch(() => {});
      }

      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await sub.unsubscribe();
          }
        }
      }

      this.currentToken = null;
      return {
        success: true,
        message: 'Notifikasi push berhasil dinonaktifkan dari perangkat ini.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Gagal menonaktifkan notifikasi: ${err.message}`,
      };
    }
  }

  /**
   * Kirim Uji Coba Notifikasi Langsung ke HP/Browser Admin
   */
  public async sendTestNotification(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/admin/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminUserId: 'admin' }),
      });

      const data = await res.json();
      return {
        success: Boolean(data.success && data.sentCount > 0),
        message: data.message || (data.success ? 'Notifikasi percobaan berhasil dikirim!' : 'Gagal mengirim notifikasi.'),
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Gagal mengirim request test: ${err.message}`,
      };
    }
  }

  /**
   * Ambil Status Push Notification Lengkap dari Server & Perangkat
   */
  public async getPushStatus(): Promise<PushStatus> {
    const env = this.getEnvironmentInfo();
    let serverConfigured = false;
    let activeDeviceCount = 0;

    try {
      const res = await fetch('/api/admin/push/status');
      if (res.ok) {
        const data = await res.json();
        serverConfigured = Boolean(data.configured);
        activeDeviceCount = data.activeDeviceCount || 0;
      }
    } catch (_) {}

    return {
      supported: env.supported,
      isIos: env.isIos,
      isStandalone: env.isStandalone,
      permission: env.permission,
      isSubscribed: env.permission === 'granted' && activeDeviceCount > 0,
      serverConfigured,
      activeDeviceCount,
      currentTokenMasked: this.currentToken ? `${this.currentToken.substring(0, 10)}...` : undefined,
    };
  }

  /**
   * Ambil Daftar Perangkat yang Terdaftar
   */
  public async getRegisteredDevices(): Promise<DeviceInfo[]> {
    try {
      const res = await fetch('/api/admin/push/devices');
      if (res.ok) {
        const data = await res.json();
        return data.data || [];
      }
    } catch (_) {}
    return [];
  }
}

export const pushClientService = new PushClientService();
export default pushClientService;
