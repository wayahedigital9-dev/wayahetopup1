import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getMessaging, Message } from 'firebase-admin/messaging';
import { db as prisma } from '../db/client.js';
import { mongoDbService } from './mongodbService.js';
import { supabaseService } from './supabaseService.js';

export interface AdminPushSubscription {
  id: string;
  adminUserId: string;
  token: string;
  installationId?: string;
  deviceName?: string;
  platform?: string;
  userAgent?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  data?: Record<string, string>;
}

class PushNotificationService {
  private initialized = false;
  private firebaseApp: App | null = null;

  constructor() {
    this.initFirebase();
  }

  /**
   * Inisialisasi Firebase Admin SDK secara aman dari Environment Variables
   */
  private initFirebase() {
    if (this.initialized && this.firebaseApp) return;

    try {
      const projectId =
        process.env.FIREBASE_PROJECT_ID ||
        process.env.FIREBASE_ADMIN_PROJECT_ID ||
        process.env.VITE_FIREBASE_PROJECT_ID;

      const clientEmail =
        process.env.FIREBASE_CLIENT_EMAIL ||
        process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

      let privateKey =
        process.env.FIREBASE_PRIVATE_KEY ||
        process.env.FIREBASE_ADMIN_PRIVATE_KEY;

      const serviceAccountJson =
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

      const existingApps = getApps();

      if (serviceAccountJson) {
        try {
          const parsed = JSON.parse(serviceAccountJson);
          if (existingApps.length === 0) {
            this.firebaseApp = initializeApp({
              credential: cert(parsed),
            });
          } else {
            this.firebaseApp = getApp();
          }
          this.initialized = true;
          console.log('✅ [PushNotificationService] Firebase Admin initialized via Service Account JSON.');
          return;
        } catch (e: any) {
          console.warn('⚠️ [PushNotificationService] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON:', e.message);
        }
      }

      if (projectId && clientEmail && privateKey) {
        // Tangani formatting newline pada private key untuk deployment (Vercel, Render, VPS)
        privateKey = privateKey.replace(/\\n/g, '\n');
        if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
          privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
        }

        if (existingApps.length === 0) {
          this.firebaseApp = initializeApp({
            credential: cert({
              projectId,
              clientEmail,
              privateKey,
            }),
          });
        } else {
          this.firebaseApp = getApp();
        }
        this.initialized = true;
        console.log(`✅ [PushNotificationService] Firebase Admin initialized for project: ${projectId}`);
      } else {
        console.log('ℹ️ [PushNotificationService] Firebase Admin credentials not fully configured. Push notifications will be queued or logged.');
      }
    } catch (err: any) {
      console.warn('⚠️ [PushNotificationService] Firebase Admin initialization notice:', err.message);
    }
  }

  /**
   * Cek status konfigurasi Firebase
   */
  public isConfigured(): boolean {
    return this.initialized && Boolean(this.firebaseApp);
  }

  /**
   * Simpan atau perbarui pendaftaran token perangkat admin di Database
   */
  public async subscribeDevice(subData: {
    adminUserId?: string;
    token: string;
    installationId?: string;
    deviceName?: string;
    platform?: string;
    userAgent?: string;
  }): Promise<{ success: boolean; data?: AdminPushSubscription; error?: string }> {
    try {
      const { adminUserId = 'admin', token, installationId, deviceName, platform, userAgent } = subData;

      if (!token || typeof token !== 'string' || !token.trim()) {
        return { success: false, error: 'FCM Token wajib diisi.' };
      }

      const cleanToken = token.trim();
      const now = new Date().toISOString();

      const subscription: AdminPushSubscription = {
        id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        adminUserId: adminUserId || 'admin',
        token: cleanToken,
        installationId: installationId || '',
        deviceName: deviceName || 'Perangkat Admin',
        platform: platform || 'Web',
        userAgent: userAgent || '',
        enabled: true,
        createdAt: now,
        updatedAt: now,
        lastUsedAt: now,
      };

      // 1. Simpan ke Prisma/Local DB
      try {
        if (prisma.adminPushSubscription) {
          await prisma.adminPushSubscription.upsert({
            where: { token: cleanToken },
            create: {
              ...subscription,
              createdAt: new Date(now),
              updatedAt: new Date(now),
              lastUsedAt: new Date(now),
            },
            update: {
              adminUserId: subscription.adminUserId,
              deviceName: subscription.deviceName,
              platform: subscription.platform,
              userAgent: subscription.userAgent,
              enabled: true,
              updatedAt: new Date(now),
              lastUsedAt: new Date(now),
            },
          });
        }
      } catch (_) {}

      // 2. Simpan ke Supabase Cloud & MongoDB & in-memory state
      try {
        await supabaseService.savePushSubscription(subscription);
      } catch (_) {}

      try {
        await mongoDbService.savePushSubscription(subscription);
      } catch (_) {}

      console.log(`📱 [PushNotificationService] Device subscribed: ${subscription.deviceName} (${subscription.platform})`);
      return { success: true, data: subscription };
    } catch (err: any) {
      console.error('❌ [PushNotificationService] Subscribe error:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Nonaktifkan token perangkat admin
   */
  public async unsubscribeDevice(token: string): Promise<{ success: boolean }> {
    try {
      const cleanToken = String(token || '').trim();
      if (!cleanToken) return { success: false };

      try {
        if (prisma.adminPushSubscription) {
          await prisma.adminPushSubscription.updateMany({
            where: { token: cleanToken },
            data: { enabled: false, updatedAt: new Date() },
          });
        }
      } catch (_) {}

      try {
        await supabaseService.removePushSubscription(cleanToken);
        await mongoDbService.removePushSubscription(cleanToken);
      } catch (_) {}

      console.log(`📱 [PushNotificationService] Device unsubscribed: token ${cleanToken.substring(0, 10)}...`);
      return { success: true };
    } catch (err: any) {
      console.error('❌ [PushNotificationService] Unsubscribe error:', err.message);
      return { success: false };
    }
  }

  /**
   * Ambil seluruh token perangkat admin yang aktif
   */
  public async getActiveSubscriptions(): Promise<AdminPushSubscription[]> {
    try {
      // Coba ambil dari Prisma
      let list: any[] = [];
      try {
        if (prisma.adminPushSubscription) {
          list = await prisma.adminPushSubscription.findMany({
            where: { enabled: true },
            orderBy: { updatedAt: 'desc' },
          });
        }
      } catch (_) {}

      // Jika kosong, ambil dari MongoDB State
      if (!list || list.length === 0) {
        try {
          const state = await mongoDbService.getAllState();
          const rawSubs = Array.isArray(state?.pushSubscriptions)
            ? state.pushSubscriptions
            : (state?.pushSubscriptions ? Object.values(state.pushSubscriptions) : []);
          list = rawSubs.filter((s: any) => s && s.enabled !== false);
        } catch (_) {}
      }

      return list.map((s) => ({
        id: s.id,
        adminUserId: s.adminUserId || 'admin',
        token: s.token,
        installationId: s.installationId || '',
        deviceName: s.deviceName || 'Perangkat Admin',
        platform: s.platform || 'Web',
        userAgent: s.userAgent || '',
        enabled: s.enabled !== false,
        createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : new Date().toISOString(),
        lastUsedAt: s.lastUsedAt ? new Date(s.lastUsedAt).toISOString() : new Date().toISOString(),
      }));
    } catch (err: any) {
      console.warn('⚠️ [PushNotificationService] Failed to get subscriptions:', err.message);
      return [];
    }
  }

  /**
   * Kirim pesan Web Push Notification ke seluruh perangkat admin yang terdaftar
   */
  public async broadcastToAdmins(
    payload: PushNotificationPayload
  ): Promise<{ success: boolean; sentCount: number; failureCount: number }> {
    const subscriptions = await this.getActiveSubscriptions();

    if (subscriptions.length === 0) {
      console.log('ℹ️ [PushNotificationService] No active admin push subscriptions registered. Notification skipped.');
      return { success: true, sentCount: 0, failureCount: 0 };
    }

    if (!this.initialized || !this.firebaseApp) {
      this.initFirebase();
    }

    if (!this.firebaseApp) {
      console.warn('⚠️ [PushNotificationService] Firebase Admin is not initialized. Notification logged only:', payload.title, payload.body);
      return { success: false, sentCount: 0, failureCount: subscriptions.length };
    }

    const messaging = getMessaging(this.firebaseApp);
    let sentCount = 0;
    let failureCount = 0;

    const invalidTokens: string[] = [];

    const sendPromises = subscriptions.map(async (sub) => {
      try {
        const message: Message = {
          token: sub.token,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: {
            title: payload.title,
            body: payload.body,
            url: payload.url || '/owner',
            tag: payload.tag || 'wayahe-order',
            icon: payload.icon || '/icons/icon-192x192.png',
            badge: payload.badge || '/icons/icon-192x192.png',
            ...(payload.data || {}),
          },
          webpush: {
            headers: {
              Urgency: 'high',
              TTL: '86400',
            },
            notification: {
              title: payload.title,
              body: payload.body,
              icon: payload.icon || '/icons/icon-192x192.png',
              badge: payload.badge || '/icons/icon-192x192.png',
              tag: payload.tag || 'wayahe-order',
              requireInteraction: true,
              data: {
                url: payload.url || '/owner',
                ...(payload.data || {}),
              },
            },
            fcmOptions: {
              link: payload.url || '/owner',
            },
          },
        };

        await messaging.send(message);
        sentCount++;
      } catch (err: any) {
        failureCount++;
        const errorCode = err.code || err.errorInfo?.code || '';
        console.warn(`⚠️ [PushNotificationService] Failed to send to ${sub.deviceName} (${sub.token.substring(0, 8)}...):`, err.message);

        // Jika token sudah kadaluarsa atau tidak valid di Firebase, kumpulkan untuk dihapus
        if (
          errorCode === 'messaging/registration-token-not-registered' ||
          errorCode === 'messaging/invalid-registration-token' ||
          errorCode === 'messaging/invalid-argument'
        ) {
          invalidTokens.push(sub.token);
        }
      }
    });

    await Promise.allSettled(sendPromises);

    // Bersihkan token invalid dari database
    if (invalidTokens.length > 0) {
      for (const invToken of invalidTokens) {
        await this.unsubscribeDevice(invToken);
      }
      console.log(`🧹 [PushNotificationService] Cleaned up ${invalidTokens.length} expired FCM tokens from database.`);
    }

    console.log(`🔔 [PushNotificationService] Broadcast complete: ${sentCount} sent, ${failureCount} failed.`);
    return { success: sentCount > 0 || failureCount === 0, sentCount, failureCount };
  }

  /**
   * Notifikasi: Pesanan Baru Dibuat
   */
  public async sendNewOrderNotification(order: {
    id: string;
    invoiceNumber: string;
    productName: string;
    totalAmount: number;
    createdAt?: string;
  }): Promise<{ success: boolean; sentCount: number; failureCount: number }> {
    try {
      const formattedNominal = new Intl.NumberFormat('id-ID').format(order.totalAmount || 0);
      const title = 'Pesanan Baru';
      const body = `Pesanan #${order.invoiceNumber} — ${order.productName || 'Produk Digital'} — Rp${formattedNominal}`;
      const url = `/owner?orderId=${encodeURIComponent(order.id)}&invoice=${encodeURIComponent(order.invoiceNumber)}`;

      console.log(`📣 [PushNotificationService] Triggering New Order Push Notification for #${order.invoiceNumber}`);

      return await this.broadcastToAdmins({
        title,
        body,
        tag: `order-new-${order.id}`,
        url,
        data: {
          type: 'NEW_ORDER',
          orderId: order.id,
          invoiceNumber: order.invoiceNumber,
          totalAmount: String(order.totalAmount),
        },
      });
    } catch (err: any) {
      console.error('❌ [PushNotificationService] sendNewOrderNotification error:', err.message);
      return { success: false, sentCount: 0, failureCount: 0 };
    }
  }

  /**
   * Notifikasi: Pembayaran Berhasil Terverifikasi
   */
  public async sendPaymentSuccessNotification(order: {
    id: string;
    invoiceNumber: string;
    productName?: string;
    totalAmount: number;
    paidAt?: string;
    paymentMethod?: string;
  }): Promise<{ success: boolean; sentCount: number; failureCount: number }> {
    try {
      const formattedNominal = new Intl.NumberFormat('id-ID').format(order.totalAmount || 0);
      const title = 'Pembayaran Berhasil';
      const body = `Pesanan #${order.invoiceNumber} telah dibayar sebesar Rp${formattedNominal}`;
      const url = `/owner?orderId=${encodeURIComponent(order.id)}&invoice=${encodeURIComponent(order.invoiceNumber)}`;

      console.log(`💰 [PushNotificationService] Triggering Payment Success Push Notification for #${order.invoiceNumber}`);

      return await this.broadcastToAdmins({
        title,
        body,
        tag: `order-paid-${order.id}`,
        url,
        data: {
          type: 'PAYMENT_SUCCESS',
          orderId: order.id,
          invoiceNumber: order.invoiceNumber,
          totalAmount: String(order.totalAmount),
        },
      });
    } catch (err: any) {
      console.error('❌ [PushNotificationService] sendPaymentSuccessNotification error:', err.message);
      return { success: false, sentCount: 0, failureCount: 0 };
    }
  }

  /**
   * Notifikasi Percobaan Diagnostik
   */
  public async sendTestNotification(adminUserId = 'admin'): Promise<{
    success: boolean;
    sentCount: number;
    failureCount: number;
    message: string;
  }> {
    const subscriptions = await this.getActiveSubscriptions();
    if (subscriptions.length === 0) {
      return {
        success: false,
        sentCount: 0,
        failureCount: 0,
        message: 'Belum ada perangkat HP/Browser admin yang terdaftar. Klik "Aktifkan Notifikasi" terlebih dahulu.',
      };
    }

    const title = '🔔 Uji Coba Notifikasi Wayahe';
    const body = `Koneksi Web Push FCM aktif! Waktu: ${new Date().toLocaleTimeString('id-ID')} WIB. Perangkat Anda siap menerima alert pesanan & pembayaran.`;
    const url = '/owner';

    const result = await this.broadcastToAdmins({
      title,
      body,
      tag: `test-push-${Date.now()}`,
      url,
      data: {
        type: 'TEST_NOTIFICATION',
        timestamp: new Date().toISOString(),
      },
    });

    return {
      ...result,
      message: result.sentCount > 0
        ? `Berhasil mengirim notifikasi percobaan ke ${result.sentCount} perangkat admin.`
        : `Gagal mengirim notifikasi (${result.failureCount} gagal). Pastikan kredensial Firebase Admin telah diisi di backend/.env.`,
    };
  }
}

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
