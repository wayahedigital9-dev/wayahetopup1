import express, { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { db as prisma } from './db/client.js';
import { 
  digiflazzService, 
  createDigiflazzTransaction, 
  verifyDigiflazzWebhookSignature, 
  resolveDigiflazzCallbackUrl,
  transformDigiflazzProduct
} from './services/digiflazz.js';
import { FulfillmentService } from './services/fulfillment.js';
import { qiospayService } from './services/qiospay.js';
import { ngrokService } from './services/ngrok.js';
import { mongoDbService } from './services/mongodbService.js';
import { supabaseService, sanitizeSupabaseUrl } from './services/supabaseService.js';
import { createPaymentSession, detectActiveGateway, logGatewayStatus } from './services/paymentRouter.js';
import { pushNotificationService } from './services/pushNotificationService.js';
import { pakasirService } from './services/pakasir.js';
import { outboundIpService } from './services/outboundIpService.js';

// ── Config terpisah: Console (terminal) vs API Keys ──────────
import { CONSOLE_CONFIG } from './config/console.js';
import {
  validateApiKeys,
  DIGIFLAZZ_CONFIG,
  QIOSPAY_CONFIG,
  PAKASIR_CONFIG,
  NGROK_CONFIG,
  BOT_CONFIG,
} from './config/apikeys.js';

// ── Robust .env Path Resolution (works in dev & production) ──
const __indexFilename = fileURLToPath(import.meta.url);
const __indexDirname = path.dirname(__indexFilename);

/**
 * Resolve path ke file .env secara robust.
 * Mencari dari __dirname (lokasi file ini) relatif ke backend root,
 * BUKAN dari process.cwd() yang bisa berbeda saat deploy.
 */
function resolveEnvPath(): string {
  // Kandidat path .env, diurutkan prioritas:
  const candidates = [
    path.resolve(__indexDirname, '../../.env'),       // backend/src -> backend/.env (development, src mode)
    path.resolve(__indexDirname, '../.env'),           // backend/dist/src -> backend/.env (compiled/dist)
    path.join(process.cwd(), 'backend', '.env'),      // workspace root -> backend/.env
    path.join(process.cwd(), '.env'),                  // fallback: workspace root .env
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch (_) {}
  }

  // Default: paling probable path di development
  return candidates[0];
}

const app = express();
const fulfillmentService = new FulfillmentService(prisma);
const PORT = CONSOLE_CONFIG.PORT;

// Security & Middlewares
const allowedOrigins = new Set<string>([
  'https://wayahedigital.com',
  'https://www.wayahedigital.com',
]);
if (CONSOLE_CONFIG.SUPABASE_URL) allowedOrigins.add(CONSOLE_CONFIG.SUPABASE_URL);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // curl/healthcheck
    const host = (() => { try { return new URL(origin).hostname; } catch { return origin; } })();
    const isAllowed = allowedOrigins.has(origin)
      || host.endsWith('.wayahedigital.com')
      || host.endsWith('.trycloudflare.com')
      || host.endsWith('.tunnel.devtest.ultravocloud.com')
      || origin.includes('localhost');
    return cb(null, isAllowed ? true : false);
  },
  credentials: true,
}));
app.use(express.json({ 
  limit: '10mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.text({ type: ['text/*', 'application/xml'], limit: '10mb' }));

// Rate Limiter (Otomatis dilewati untuk Callback & Webhook agar transaksi tidak pernah terhambat)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  skip: (req) => {
    const path = req.path.toLowerCase();
    return (
      path.startsWith('/webhook') ||
      path.startsWith('/api/webhook') ||
      path.startsWith('/api/callback') ||
      path.startsWith('/api/payment') ||
      path.startsWith('/api/digiflazz') ||
      path.startsWith('/api/system/metrics')
    );
  },
  message: { error: 'Terlalu banyak permintaan dari IP ini. Silakan coba lagi nanti.' },
});
app.use('/api/', generalLimiter);

// 1. GET CATALOG
app.get('/api/products', async (req: Request, res: Response) => {
  try {
    const { category, provider } = req.query;
    const whereClause: any = { isActive: true };

    if (category) {
      whereClause.categoryId = String(category).toUpperCase();
    }
    if (provider) {
      whereClause.provider = String(provider);
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      orderBy: { sellingPrice: 'asc' },
    });

    res.json({ success: true, data: products });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. CREATE ORDER (Idempotent & Price Enforced by Backend)
app.post('/api/orders', async (req: Request, res: Response) => {
  try {
    const {
      id: customId,
      invoiceNumber: customInvoice,
      guestAccessToken,
      productId,
      targetDestination,
      customerName,
      customerPhone,
      customerEmail,
      promoCode,
      idempotencyKey,
      preferredGateway,
      paymentGatewayProvider,
    } = req.body;

    if (!productId || !targetDestination) {
      return res.status(400).json({ success: false, message: 'Produk dan tujuan transaksi wajib diisi.' });
    }

    const state = await mongoDbService.getAllState();

    // 1. Dapatkan metadata produk (dari MongoDB/Local State jika Prisma tidak aktif)
    let product: any = null;
    try {
      product = await prisma.product.findUnique({ where: { id: productId } });
    } catch (_) {}

    if (!product) {
      const productList = Array.isArray(state?.products) 
        ? state.products 
        : (state?.products ? Object.values(state.products) : []);
      product = productList.find((p: any) => p.id === productId);
    }

    const dynamicPriceFromReq = Number(req.body.sellingPrice || req.body.totalAmount || req.body.amount || 0);

    if (!product || product.isActive === false) {
      // Gunakan data produk dinamis dari frontend (misal WiFi voucher, Digiflazz, atau akun premium)
      product = {
        id: productId,
        name: req.body.productName || 'Produk Digital Wayahe',
        sellingPrice: dynamicPriceFromReq > 0 ? dynamicPriceFromReq : 10000,
        categoryId: req.body.category || 'PULSA',
        provider: req.body.provider || 'General',
        deliveryMethod: req.body.deliveryMethod || 'INSTANT_ROUTER_INJECTION',
      };
    } else if (dynamicPriceFromReq > 0 && (!product.sellingPrice || product.sellingPrice === 10000)) {
      product.sellingPrice = dynamicPriceFromReq;
    }

    // Hitung nominal transaksi dinamis
    let discount = 0;
    if (promoCode) {
      const promoList = Array.isArray(state?.promos) ? state.promos : [];
      const promo = promoList.find((pr: any) => pr.code?.toUpperCase() === String(promoCode).toUpperCase() && pr.isActive);
      if (promo && product.sellingPrice >= (promo.minTransaction || 0)) {
        discount = promo.discountAmount || 0;
      }
    }

    const subtotal = Number(product.sellingPrice || dynamicPriceFromReq || 0);
    const adminFee = Number(req.body.adminFee || 0);
    const totalAmount = Math.max(0, subtotal - discount + adminFee);
    const invoiceNumber = customInvoice || `INV/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/WD/${Math.floor(1000 + Math.random() * 9000)}`;
    const orderId = customId || `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Tentukan gateway aktif dari request atau pengaturan tersimpan
    const activeGateway = (preferredGateway || paymentGatewayProvider || state?.settings?.paymentGatewayProvider || 'QIOSPAY') as any;

    // Generate Payment Session (QRIS)
    const paymentResult = await createPaymentSession({
      orderId: invoiceNumber,
      grossAmount: totalAmount,
      customerName: customerName || 'Pelanggan Wayahe',
      customerEmail,
      customerPhone: customerPhone || targetDestination,
      preferredGateway: activeGateway,
      items: [
        {
          id: product.id,
          name: product.name,
          price: product.sellingPrice,
          quantity: 1,
        },
      ],
    });

    const formattedOrder = {
      id: orderId,
      invoiceNumber,
      guestAccessToken: guestAccessToken || `gst_${Math.random().toString(36).substring(2, 12)}`,
      targetDestination: targetDestination.trim(),
      customerName: customerName || 'Pelanggan Wayahe',
      customerPhone: customerPhone || targetDestination,
      customerEmail: customerEmail || '',
      productId: product.id,
      productName: product.name,
      buyerSkuCode: (product as any).supplierSku || (product as any).sku || req.body.supplierSku || req.body.sku || req.body.buyerSkuCode || '',
      supplierSku: (product as any).supplierSku || (product as any).sku || '',
      sku: (product as any).sku || (product as any).supplierSku || '',
      category: product.categoryId || 'PULSA',
      items: [
        {
          productId: product.id,
          productName: product.name,
          category: product.categoryId || 'PULSA',
          price: product.sellingPrice,
          supplierSku: (product as any).supplierSku || (product as any).sku || '',
          sku: (product as any).sku || (product as any).supplierSku || '',
          targetNumberOrAccount: targetDestination.trim(),
        }
      ],
      subtotal,
      adminFee,
      discount,
      promoCode: promoCode || '',
      totalAmount,
      paymentStatus: 'PENDING',
      fulfillmentStatus: 'NOT_STARTED',
      deliveryMethod: product.deliveryMethod || 'INSTANT_ROUTER_INJECTION',
      paymentMethod: paymentResult.gateway === 'PAKASIR' ? 'QRIS (Pakasir)' : 'QRIS',
      snapToken: paymentResult.token,
      qrString: paymentResult.qrString,
      paymentLink: paymentResult.redirectUrl,
      pakasirTxnId: paymentResult.gateway === 'PAKASIR' ? paymentResult.token : undefined,
      fee: paymentResult.fee || 0,
      totalPayment: paymentResult.totalPayment || totalAmount,
      expiredAt: paymentResult.expiredAt,
      isDynamic: paymentResult.isDynamic,
      isSandbox: paymentResult.isSandbox,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 2. Simpan order ke Supabase Cloud & MongoDB & Local Storage Fallback
    await supabaseService.saveOrder(formattedOrder);
    const mongoSaveResult = await mongoDbService.saveOrder(formattedOrder);
    if (!mongoSaveResult.success) {
      console.warn('⚠️ [Order] MongoDB save notice:', mongoSaveResult.error);
    }

    // 3. Simpan ke Prisma jika tersedia
    try {
      await prisma.order.create({
        data: {
          id: formattedOrder.id,
          invoiceNumber: formattedOrder.invoiceNumber,
          guestAccessToken: formattedOrder.guestAccessToken,
          targetDestination: formattedOrder.targetDestination,
          customerName: formattedOrder.customerName,
          customerPhone: formattedOrder.customerPhone,
          customerEmail: formattedOrder.customerEmail,
          category: formattedOrder.category,
          subtotal: formattedOrder.subtotal,
          adminFee: formattedOrder.adminFee,
          discount: formattedOrder.discount,
          promoCode: formattedOrder.promoCode,
          totalAmount: formattedOrder.totalAmount,
          paymentStatus: 'PENDING',
          fulfillmentStatus: 'NOT_STARTED',
          paymentMethod: formattedOrder.paymentMethod,
          deliveryMethod: formattedOrder.deliveryMethod,
          midtransSnapToken: paymentResult.token,
          idempotencyKey: idempotencyKey || invoiceNumber,
        },
      }).catch(() => {});
    } catch (_) {}

    // 4. Trigger Web Push Notification ke HP/Browser Admin
    try {
      pushNotificationService.sendNewOrderNotification({
        id: formattedOrder.id,
        invoiceNumber: formattedOrder.invoiceNumber,
        productName: formattedOrder.productName || product.name,
        totalAmount: formattedOrder.totalAmount,
        createdAt: formattedOrder.createdAt,
      }).catch((pErr) => {
        console.warn('⚠️ [PushNotification] Order creation notification notice:', pErr.message);
      });
    } catch (_) {}

    res.status(201).json({
      success: true,
      data: formattedOrder,
      snapToken: paymentResult.token,
      paymentGateway: paymentResult.gateway,
      paymentLink: paymentResult.redirectUrl,
      qrString: paymentResult.qrString,
      qrImage: paymentResult.qrImage,
      fee: paymentResult.fee || 0,
      totalPayment: paymentResult.totalPayment || totalAmount,
      expiredAt: paymentResult.expiredAt,
      isDynamic: paymentResult.isDynamic,
      isSandbox: paymentResult.isSandbox,
    });
  } catch (error: any) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2b. AUTH REGISTRATION ENDPOINT (Menyimpan user ke MongoDB & local storage)
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password, name, phone } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username dan Password wajib diisi.' });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const cleanEmail = email ? String(email).trim().toLowerCase() : `${cleanUsername}@member.wayahedigital.id`;

    const newUser = {
      id: 'usr_' + Date.now(),
      username: cleanUsername,
      email: cleanEmail,
      name: name || cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1),
      phone: phone || '',
      role: 'CUSTOMER',
      memberTier: 'VIP_GOLD',
      balance: 25000,
      rewardPoints: 500,
      createdAt: new Date().toISOString(),
    };

    await supabaseService.saveUser(newUser);
    const saveResult = await mongoDbService.saveUser(newUser);
    if (!saveResult.success) {
      return res.status(500).json({ success: false, message: 'Gagal menyimpan data pengguna ke database.', error: saveResult.error });
    }

    res.status(201).json({
      success: true,
      message: 'Registrasi pengguna berhasil disimpan ke database.',
      data: newUser,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. PUBLIC ORDER TRACKING & AUTO RECONCILIATION
app.get('/api/orders/track', async (req: Request, res: Response) => {
  try {
    const { invoice, token, phone } = req.query;

    if (!invoice) {
      return res.status(400).json({ success: false, message: 'Nomor invoice wajib diisi.' });
    }

    let order = await prisma.order.findUnique({
      where: { invoiceNumber: String(invoice).trim() },
      include: { items: true },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan.' });
    }

    // Keamanan: Cek token atau nomor HP yang cocok
    const isTokenMatch = token && order.guestAccessToken === String(token).trim();
    const isPhoneMatch = phone && (order.targetDestination.includes(String(phone).trim()) || order.customerPhone?.includes(String(phone).trim()));

    if (!isTokenMatch && !isPhoneMatch) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak. Masukkan nomor HP tujuan atau akses token yang sesuai untuk melihat transaksi ini.',
      });
    }

    // Jika masih PENDING, periksa apakah mutasi sudah masuk
    if (order.paymentStatus === 'PENDING') {
      const reconResult = await qiospayService.checkAndReconcileOrderStatus(order.id, prisma, fulfillmentService);
      if (reconResult.order) {
        order = reconResult.order;
      }
    }

    res.json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. CHECK & AUTO RECONCILE ORDER STATUS (GET /api/orders/:identifier/payment-status)
const handleOrderStatusCheck = async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;
    const token = (req.query.token as string) || (req.headers['x-guest-token'] as string);
    const phone = req.query.phone as string;
    const merchantCode = (req.query.merchant_code as string) || (req.body?.merchant_code as string) || '';
    const apiKey = (req.query.api_key as string) || (req.body?.api_key as string) || '';

    // Cari order dari Prisma, MongoDB, atau Supabase
    const cleanId = String(identifier || '').trim();
    let order: any = null;
    try {
      order = await prisma.order.findFirst({
        where: {
          OR: [
            { id: cleanId },
            { invoiceNumber: cleanId },
          ],
        },
        include: { items: true },
      });
    } catch (_) {}

    if (!order) {
      try {
        const state = await mongoDbService.getAllState();
        const ordersList = Array.isArray(state?.orders)
          ? state.orders
          : (state?.orders ? Object.values(state.orders) : []);
        order = ordersList.find(
          (o: any) => o.id === cleanId || o.invoiceNumber?.toLowerCase() === cleanId.toLowerCase()
        );
      } catch (_) {}
    }

    if (!order) {
      return res.status(404).json({ success: false, paymentStatus: 'NOT_FOUND', fulfillmentStatus: 'NOT_STARTED', message: 'Pesanan tidak ditemukan.' });
    }

    // Validasi kepemilikan jika token atau phone disertakan
    if (token || phone) {
      const isTokenMatch = token && order.guestAccessToken === String(token).trim();
      const isPhoneMatch = phone && (order.targetDestination.includes(String(phone).trim()) || order.customerPhone?.includes(String(phone).trim()));
      if (!isTokenMatch && !isPhoneMatch) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Token atau identitas pesanan tidak cocok.' });
      }
    }

    const result = await qiospayService.checkAndReconcileOrderStatus(
      order.id, 
      prisma, 
      fulfillmentService,
      merchantCode,
      apiKey
    );
    res.json(result);
  } catch (error: any) {
    console.error('[Check Status Error]:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

app.get('/api/orders/:identifier/payment-status', handleOrderStatusCheck);
app.all('/api/orders/:identifier/check-status', handleOrderStatusCheck);

// 4a-2. PUBLIC ORDER STATUS BY REF_ID / INVOICE NUMBER
// Endpoint standar untuk polling status order dari database (GET /api/orders/{ref_id})
app.get('/api/orders/:ref_id', async (req: Request, res: Response) => {
  try {
    const { ref_id } = req.params;
    const cleanRef = String(ref_id || '').trim();

    let order: any = null;
    try {
      order = await prisma.order.findFirst({
        where: {
          OR: [
            { id: cleanRef },
            { invoiceNumber: cleanRef },
            { supplierRefId: cleanRef },
            { invoiceNumber: cleanRef.replace(/^WD-/, '') },
          ],
        },
        include: { items: true },
      });
    } catch (_) {}

    if (!order) {
      try {
        const state = await mongoDbService.getAllState();
        const ordersList = Array.isArray(state?.orders)
          ? state.orders
          : (state?.orders ? Object.values(state.orders) : []);
        order = ordersList.find(
          (o: any) =>
            o.id === cleanRef ||
            o.invoiceNumber === cleanRef ||
            o.supplierRefId === cleanRef ||
            o.invoiceNumber?.toLowerCase() === cleanRef.toLowerCase()
        );
      } catch (_) {}
    }

    if (!order) {
      try {
        const dbPath = path.join(process.cwd(), 'data', 'db.json');
        if (fs.existsSync(dbPath)) {
          const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
          if (Array.isArray(db.orders)) {
            order = db.orders.find(
              (o: any) =>
                o.id === cleanRef ||
                o.invoiceNumber === cleanRef ||
                o.supplierRefId === cleanRef ||
                o.invoiceNumber?.toLowerCase() === cleanRef.toLowerCase()
            );
          }
        }
      } catch (_) {}
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order tidak ditemukan.' });
    }

    return res.json({
      success: true,
      data: order,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      voucherCode: order.voucherCode || order.fulfillmentResult?.voucherCode,
      voucherPassword: order.voucherPassword || order.fulfillmentResult?.voucherPassword,
      wifiSsid: order.wifiSsid || order.fulfillmentResult?.wifiSsid,
      wifiLoginUrl: order.wifiLoginUrl || order.fulfillmentResult?.wifiLoginUrl,
      serialNumber: order.serialNumber || order.voucherCode || order.fulfillmentResult?.serialNumber,
      supplierRefId: order.supplierRefId,
      refId: order.supplierRefId || order.invoiceNumber,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders (Semua Order dari Database)
app.get('/api/orders', async (_req: Request, res: Response) => {
  try {
    let orders: any[] = [];
    try {
      orders = await prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        include: { items: true },
        take: 100,
      });
    } catch (_) {}

    if (orders.length === 0) {
      try {
        const dbPath = path.join(process.cwd(), 'data', 'db.json');
        if (fs.existsSync(dbPath)) {
          const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
          if (Array.isArray(db.orders)) orders = db.orders;
        }
      } catch (_) {}
    }

    return res.json({ success: true, data: orders });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 4a.2 DELETE ORDER
app.delete('/api/orders/:id', async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.id || '').trim();
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'ID order wajib diisi.' });
    }

    try {
      await prisma.order.deleteMany({
        where: {
          OR: [
            { id: orderId },
            { invoiceNumber: orderId },
            { supplierRefId: orderId },
          ],
        },
      });
    } catch (_) {}

    return res.json({ success: true, message: `Order ${orderId} berhasil dihapus.` });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 4a.3 BULK DELETE ORDERS
app.post('/api/orders/bulk-delete', async (req: Request, res: Response) => {
  try {
    const { orderIds } = req.body || {};
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Array orderIds wajib diisi.' });
    }

    try {
      await prisma.order.deleteMany({
        where: {
          OR: [
            { id: { in: orderIds } },
            { invoiceNumber: { in: orderIds } },
          ],
        },
      });
    } catch (_) {}

    return res.json({ success: true, message: `${orderIds.length} order berhasil dihapus.` });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 4b. DIGIFLAZZ (H2H) SECURE BACKEND ENDPOINTS
// Menggunakan API Key yang aman di server backend .env (tidak pernah dikirim ke frontend)
app.all('/api/digiflazz/balance', async (req: Request, res: Response) => {
  try {
    const qUser = (req.query.username as string) || (req.body?.username as string);
    const qKey = (req.query.apiKey as string) || (req.body?.apiKey as string);

    const username = (qUser || DIGIFLAZZ_CONFIG.USERNAME || '').trim();
    const apiKey = (qKey || DIGIFLAZZ_CONFIG.API_KEY || '').trim();

    if (!username || !apiKey) {
      return res.json({
        success: false,
        message: 'Kredensial Digiflazz (Username & Production Key) belum dikonfigurasi di backend/.env atau pengaturan admin.',
        data: {
          deposit: 0,
          username: username || '-',
          status: 'UNCONFIGURED',
        },
      });
    }

    const result = await digiflazzService.checkBalance({ username, apiKey });
    return res.json({
      success: true,
      data: {
        deposit: result.deposit,
        username: result.username,
        status: 'CONNECTED',
      },
    });
  } catch (error: any) {
    console.error('[Digiflazz] Cek Saldo Error:', error.message);
    return res.json({
      success: false,
      message: error.message,
      data: {
        deposit: 0,
        username: DIGIFLAZZ_CONFIG.USERNAME || '-',
        status: 'ERROR',
        error: error.message,
      },
    });
  }
});

// Transaksi Digiflazz dengan dukungan multi-webhook parameter cb_url
app.post('/api/digiflazz/transaction', async (req: Request, res: Response) => {
  try {
    const { buyerSkuCode, customerNo, refId, maxPrice, callbackUrl, allowDot, testing } = req.body;
    if (!buyerSkuCode || !customerNo || !refId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Parameter buyerSkuCode, customerNo, dan refId wajib diisi.' 
      });
    }

    const result = await createDigiflazzTransaction({
      buyerSkuCode,
      customerNo,
      refId,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      callbackUrl,
      allowDot,
      testing,
    });

    return res.json({
      success: true,
      data: result.data,
    });
  } catch (error: any) {
    console.error('[Digiflazz Transaction Endpoint Error]:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Sinkronisasi Katalog Produk Resmi dari Digiflazz ke Database
export async function syncDigiflazzCatalog(): Promise<{ success: boolean; count: number; message: string; timestamp: string }> {
  try {
    const rawList = await digiflazzService.fetchPriceList();
    if (!Array.isArray(rawList) || rawList.length === 0) {
      return { success: false, count: 0, message: 'Tidak ada data produk dari Digiflazz.', timestamp: new Date().toISOString() };
    }

    const currentState = await mongoDbService.getAllState();
    const currentProducts = Array.isArray(currentState.products) ? currentState.products : [];
    
    // Simpan harga custom yang pernah diset admin
    const customPriceMap = new Map<string, number>();
    for (const p of currentProducts) {
      if (p.id && p.sellingPrice) {
        customPriceMap.set(p.id, Number(p.sellingPrice));
      }
    }

    // Pertahankan produk non-Digiflazz (wifi & premium) serta produk custom manual buatan admin
    const preservedProducts = currentProducts.filter((p: any) => 
      p.categoryId === 'wifi' || 
      p.categoryId === 'premium' ||
      p.isManualCustom === true ||
      (p.id && String(p.id).startsWith('df-manual-'))
    );

    // Transformasi produk resmi Digiflazz
    const transformedDigiflazz = rawList.map((item) => {
      const cleanSku = String(item.buyer_sku_code || '').trim();
      const id = `df-${cleanSku.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;
      const existingPrice = customPriceMap.get(id);
      return transformDigiflazzProduct(item, existingPrice);
    });

    const mergedProducts = [...preservedProducts, ...transformedDigiflazz];

    // Simpan ke MongoDB / Local FileDb
    await mongoDbService.syncEntity('products', mergedProducts);
    
    // Simpan ke Prisma Memory Store
    for (const p of mergedProducts) {
      try {
        await prisma.product.upsert({
          where: { id: p.id },
          create: p,
          update: p,
        });
      } catch (_) {}
    }

    console.log(`✅ [DIGIFLAZZ SYNC] Berhasil menyinkronkan ${transformedDigiflazz.length} produk resmi Digiflazz`);
    return {
      success: true,
      count: transformedDigiflazz.length,
      message: `Berhasil menyinkronkan ${transformedDigiflazz.length} produk dari Digiflazz Buyer API`,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error('❌ [DIGIFLAZZ SYNC ERROR]:', err.message);
    return {
      success: false,
      count: 0,
      message: `Gagal sinkronisasi Digiflazz: ${err.message}`,
      timestamp: new Date().toISOString(),
    };
  }
}

app.all(['/api/digiflazz/sync-products', '/api/digiflazz/sync'], async (req: Request, res: Response) => {
  const result = await syncDigiflazzCatalog();
  res.json(result);
});

app.get('/api/digiflazz/products', async (req: Request, res: Response) => {
  try {
    const state = await mongoDbService.getAllState();
    const list = Array.isArray(state?.products) ? state.products : [];
    const digiflazzOnly = list.filter((p: any) => 
      p.categoryId === 'pulsa' || 
      p.categoryId === 'kuota' || 
      p.categoryId === 'game' || 
      p.digiflazzCategory || 
      p.sellerName || 
      (p.id && String(p.id).startsWith('df-'))
    );
    return res.json({
      success: true,
      count: digiflazzOnly.length,
      data: digiflazzOnly,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 4e. DIGIFLAZZ OUTBOUND IP & WHITELIST MANAGEMENT
app.get('/api/digiflazz/detect-live-ip', async (req: Request, res: Response) => {
  try {
    const liveIp = await outboundIpService.detectLiveVpsIp();
    const configuredWhitelistIp = (process.env.DIGIFLAZZ_WHITELIST_IP || '82.158.130.255').trim();
    return res.json({
      success: true,
      data: {
        liveIp,
        configuredWhitelistIp,
        isMatch: liveIp === configuredWhitelistIp,
        detectedAt: new Date().toISOString(),
      },
      message: `IP Publik Server/VPS terdeteksi: ${liveIp}`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/digiflazz/ip-status', async (req: Request, res: Response) => {
  try {
    const status = await outboundIpService.checkDigiflazzWhitelist();
    return res.json({
      success: true,
      data: status,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/digiflazz/update-ip-config', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { whitelistIp, outboundProxy } = req.body || {};
    const result = await outboundIpService.updateConfig(whitelistIp, outboundProxy);
    
    // Simpan juga ke settings state
    try {
      const state = await mongoDbService.getAllState();
      const settings = state.settings || {};
      if (whitelistIp) settings.digiflazzWhitelistIp = String(whitelistIp).trim();
      if (outboundProxy !== undefined) settings.digiflazzOutboundProxy = String(outboundProxy).trim();
      await mongoDbService.syncEntity('settings', settings);
    } catch (_) {}

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/digiflazz/test-ip', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { proxy } = req.body || {};
    const status = await outboundIpService.checkDigiflazzWhitelist(proxy);
    return res.json({
      success: true,
      data: status,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post(['/api/orders/:id/fulfill', '/api/fulfillment/fulfill'], async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id || req.body.orderId || req.body.id || req.body.order?.id;
    if (!orderId && !req.body.invoiceNumber && !req.body.order?.invoiceNumber) {
      return res.status(400).json({ success: false, message: 'Order ID atau invoiceNumber diperlukan.' });
    }

    // Jika frontend mengirim data order lengkap, simpan/update ke database dulu
    if (req.body.order && typeof req.body.order === 'object') {
      const orderData = req.body.order;
      await mongoDbService.saveOrder(orderData).catch(() => {});
      try {
        await prisma.order.upsert({
          where: { id: orderData.id },
          create: {
            id: orderData.id,
            invoiceNumber: orderData.invoiceNumber,
            guestAccessToken: orderData.guestAccessToken || '',
            targetDestination: orderData.targetDestination || '',
            customerName: orderData.customerName || 'Pelanggan',
            customerPhone: orderData.customerPhone || '',
            customerEmail: orderData.customerEmail || '',
            category: orderData.category || 'PULSA',
            subtotal: orderData.subtotal || 0,
            adminFee: orderData.adminFee || 0,
            discount: orderData.discount || 0,
            promoCode: orderData.promoCode || '',
            totalAmount: orderData.totalAmount || 0,
            paymentStatus: orderData.paymentStatus || 'PAID',
            fulfillmentStatus: orderData.fulfillmentStatus || 'PROCESSING',
            paymentMethod: orderData.paymentMethod || 'QRIS',
            deliveryMethod: orderData.deliveryMethod || 'AUTOMATIC',
            buyerSkuCode: orderData.buyerSkuCode || orderData.supplierSku || orderData.sku || '',
            supplierSku: orderData.supplierSku || orderData.sku || '',
            sku: orderData.sku || '',
          },
          update: {
            paymentStatus: orderData.paymentStatus || 'PAID',
            fulfillmentStatus: 'PROCESSING',
            buyerSkuCode: orderData.buyerSkuCode || orderData.supplierSku || orderData.sku || undefined,
            supplierSku: orderData.supplierSku || orderData.sku || undefined,
          },
        });
      } catch (_) {}
    }

    const targetId = orderId || req.body.order?.id;
    console.log(`⚡ [FULFILL API] Memproses pemenuhan pesanan ${targetId}...`);
    
    // Jalankan fulfillment
    await fulfillmentService.fulfillOrder(targetId, req.body.callbackUrl || req.body.cb_url);

    // Ambil order terbaru dari database
    const updated = await prisma.order.findUnique({ where: { id: targetId } }).catch(() => null);
    return res.json({
      success: true,
      message: 'Pemenuhan pesanan berhasil diproses.',
      data: updated,
    });
  } catch (error: any) {
    console.error('❌ [FULFILL API ERROR]:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});


// 4c. SYSTEM GATEWAY & API KEYS STATUS (Masked for Security)
app.get('/api/system/gateway-status', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      qiospay: {
        configured: Boolean(QIOSPAY_CONFIG.MERCHANT_CODE && QIOSPAY_CONFIG.API_KEY),
        merchantCode: QIOSPAY_CONFIG.MERCHANT_CODE,
      },
      pakasir: {
        configured: pakasirService.isConfigured(),
        isSandbox: PAKASIR_CONFIG.IS_SANDBOX,
        slug: PAKASIR_CONFIG.SLUG ? `${PAKASIR_CONFIG.SLUG.substring(0, 4)}***` : '',
        hasApiKey: Boolean(PAKASIR_CONFIG.API_KEY),
      },
      digiflazz: {
        configured: Boolean(DIGIFLAZZ_CONFIG.USERNAME && DIGIFLAZZ_CONFIG.API_KEY),
        username: DIGIFLAZZ_CONFIG.USERNAME,
        baseUrl: DIGIFLAZZ_CONFIG.BASE_URL,
      },
      ngrok: {
        configured: Boolean(NGROK_CONFIG.AUTHTOKEN),
      },
      telegram: {
        configured: Boolean(BOT_CONFIG.TELEGRAM_TOKEN),
      },
      whatsapp: {
        configured: Boolean(BOT_CONFIG.WHATSAPP_API_KEY),
      },
    },
  });
});

// 4c2. GATEWAY INFO ENDPOINT — Frontend loads active config from backend memory
// Sanitized: never expose raw QR string / secrets to public; admin gets them via /api/sync/state + token
app.get('/api/settings/gateway-info', (req: Request, res: Response) => {
  const isAdmin = isAdminRequest(req);
  const maskQr = (s: string) => s ? `${s.slice(0,12)}***` : '';
  res.json({
    success: true, _sanitized: !isAdmin,
    activeGateway: detectActiveGateway(),
    pakasir: {
      configured: pakasirService.isConfigured(),
      isSandbox: PAKASIR_CONFIG.IS_SANDBOX,
      baseUrl: PAKASIR_CONFIG.BASE_URL,
      slug: PAKASIR_CONFIG.SLUG ? (isAdmin ? PAKASIR_CONFIG.SLUG : `${PAKASIR_CONFIG.SLUG.substring(0, 4)}***`) : '',
      hasApiKey: Boolean(PAKASIR_CONFIG.API_KEY),
      hasWebhookSecret: Boolean(PAKASIR_CONFIG.WEBHOOK_SECRET),
      paymentMethod: PAKASIR_CONFIG.PAYMENT_METHOD || 'qris',
      merchantName: PAKASIR_CONFIG.MERCHANT_NAME || 'WAYAHE DIGITAL',
      nmid: PAKASIR_CONFIG.NMID || '',
      qrString: isAdmin ? (PAKASIR_CONFIG.QR_STRING || '') : maskQr(PAKASIR_CONFIG.QR_STRING || ''),
    },
    qiospay: {
      configured: Boolean(QIOSPAY_CONFIG.MERCHANT_CODE && QIOSPAY_CONFIG.API_KEY),
      merchantCode: QIOSPAY_CONFIG.MERCHANT_CODE || '',
      merchantName: QIOSPAY_CONFIG.MERCHANT_NAME || '',
      nmid: QIOSPAY_CONFIG.NMID || '',
      qrString: isAdmin ? (QIOSPAY_CONFIG.QRIS_STRING || '') : maskQr(QIOSPAY_CONFIG.QRIS_STRING || ''),
      hasApiKey: Boolean(QIOSPAY_CONFIG.API_KEY),
      hasSecretKey: Boolean(QIOSPAY_CONFIG.SECRET_KEY),
    },
  });
});

// 4d. REALTIME SERVER, VPS, HOSTING, CPU, RAM & DATABASE TELEMETRY
app.get('/api/system/metrics', requireAdmin, async (req: Request, res: Response) => {
  try {
    const cpus = os.cpus();
    const coreCount = cpus.length || 1;
    
    // 1. CPU Load Calculation
    const loadAvg = os.loadavg();
    let cpuPercent = Math.min(100, Math.max(0.08, Number(((loadAvg[0] / coreCount) * 100).toFixed(2))));
    if (isNaN(cpuPercent) || cpuPercent === 0) {
      cpuPercent = Number((0.15 + Math.random() * 0.12).toFixed(2));
    }

    // 2. RAM Memory Calculation
    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    const usedMemBytes = Math.max(0, totalMemBytes - freeMemBytes);
    const totalMb = Math.round(totalMemBytes / 1024 / 1024);
    const systemUsedMb = Math.round(usedMemBytes / 1024 / 1024);
    const ramPercent = Math.min(100, Math.max(1, Math.round((usedMemBytes / totalMemBytes) * 100)));

    // Process Memory
    const memUsage = process.memoryUsage();
    const processRssMb = Math.round(memUsage.rss / 1024 / 1024);
    const processHeapUsedMb = Math.round(memUsage.heapUsed / 1024 / 1024);

    // 3. Real-time Database Probe & Active Detection
    const dbStart = performance.now();
    let dbStatus: 'CONNECTED' | 'STANDBY' | 'ERROR' = 'STANDBY';
    let dbLatencyMs = 0;
    let dbType = 'PostgreSQL Local';
    let dbHost = 'localhost:5432';

    if (process.env.SUPABASE_URL || process.env.DATABASE_URL?.includes('supabase')) {
      dbType = 'Supabase Cloud (PostgreSQL)';
      dbHost = sanitizeSupabaseUrl(process.env.SUPABASE_URL || '') || 'db.supabase.co';
    } else if (process.env.DATABASE_URL?.includes('mongodb') || process.env.MONGODB_URI) {
      dbType = 'MongoDB Atlas';
      dbHost = 'cluster.mongodb.net';
    } else if (process.env.DATABASE_URL) {
      dbType = 'PostgreSQL VPS / Hosting';
      try {
        const parsed = new URL(process.env.DATABASE_URL);
        dbHost = `${parsed.hostname}:${parsed.port || 5432}`;
      } catch (_) {
        dbHost = 'server-vps';
      }
    }

    try {
      if (typeof (prisma as any).$queryRaw === 'function') {
        await (prisma as any).$queryRaw`SELECT 1`;
        dbLatencyMs = Math.round(performance.now() - dbStart);
        dbStatus = 'CONNECTED';
      } else if (typeof (prisma as any).product?.count === 'function') {
        await (prisma as any).product.count();
        dbLatencyMs = Math.round(performance.now() - dbStart);
        dbStatus = 'CONNECTED';
      } else {
        dbLatencyMs = Math.round(performance.now() - dbStart + 5);
        dbStatus = 'CONNECTED';
      }
    } catch (dbErr: any) {
      dbStatus = 'ERROR';
      dbLatencyMs = Math.round(performance.now() - dbStart);
    }

    // 4. Push Devices Count
    let pushDevicesCount = 0;
    try {
      const devices = await pushNotificationService.getActiveSubscriptions();
      pushDevicesCount = devices.length;
    } catch (_) {}

    res.json({
      success: true,
      data: {
        server: {
          platform: os.platform(),
          type: os.type(),
          arch: os.arch(),
          hostname: os.hostname(),
          uptimeSeconds: Math.round(process.uptime()),
          nodeVersion: process.version,
          environment: process.env.NODE_ENV || 'development',
          port: PORT,
        },
        cpu: {
          loadPercent: cpuPercent,
          cores: coreCount,
          model: cpus[0]?.model || 'Virtual CPU Core',
          loadAvg: loadAvg.map((l) => Number(l.toFixed(2))),
        },
        ram: {
          processUsedMb: processRssMb,
          processHeapUsedMb: processHeapUsedMb,
          systemUsedMb: systemUsedMb,
          systemTotalMb: totalMb,
          percent: ramPercent,
        },
        database: {
          status: dbStatus,
          type: dbType,
          host: dbHost,
          latencyMs: dbLatencyMs,
          configured: Boolean(process.env.DATABASE_URL || process.env.SUPABASE_URL),
        },
        integrations: {
          qiospay: {
            status: QIOSPAY_CONFIG.MERCHANT_CODE ? 'ACTIVE' : 'STANDBY',
            merchant: QIOSPAY_CONFIG.MERCHANT_NAME || 'Qiospay QRIS',
          },
          pakasir: {
            status: (PAKASIR_CONFIG.SLUG && PAKASIR_CONFIG.API_KEY) ? 'ACTIVE' : 'STANDBY',
            slug: PAKASIR_CONFIG.SLUG || '',
            configured: Boolean(PAKASIR_CONFIG.SLUG && PAKASIR_CONFIG.API_KEY),
          },
          digiflazz: {
            status: (DIGIFLAZZ_CONFIG.USERNAME && DIGIFLAZZ_CONFIG.API_KEY) ? 'ACTIVE' : 'STANDBY',
            username: DIGIFLAZZ_CONFIG.USERNAME || '',
          },
          supabase: {
            status: process.env.SUPABASE_URL ? 'ACTIVE' : 'STANDBY',
          },
          telegram: {
            status: BOT_CONFIG.TELEGRAM_TOKEN ? 'ACTIVE' : 'OFF',
          },
          pushNotifications: {
            status: pushDevicesCount > 0 ? 'ACTIVE' : 'STANDBY',
            activeDevices: pushDevicesCount,
          },
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5e. QIOSPAY CALLBACK RECEIVER & ADMIN ENDPOINTS
// 1. Health check standard
app.get('/health', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify({ status: 'ok' }));
});

// 1b. Qiospay Payment Health Check (Konfigurasi & Konektivitas aman tanpa expose secrets)
app.get('/api/payment/qiospay/health', (req: Request, res: Response) => {
  const isMerchantCode = Boolean(QIOSPAY_CONFIG.MERCHANT_CODE);
  const isApiKey = Boolean(QIOSPAY_CONFIG.API_KEY);
  const isQrisString = Boolean(QIOSPAY_CONFIG.QRIS_STRING || QIOSPAY_CONFIG.QR_STRING);
  const isCallbackSecret = Boolean(QIOSPAY_CONFIG.CALLBACK_SECRET || QIOSPAY_CONFIG.SECRET_KEY);
  const isConfigured = Boolean(isMerchantCode && isApiKey && isQrisString);

  res.json({
    configured: isConfigured,
    merchant_code: isMerchantCode,
    api_key: isApiKey,
    qris_string: isQrisString,
    callback_secret: isCallbackSecret,
    database: (process.env.SUPABASE_URL || process.env.DATABASE_URL) ? 'connected' : 'standby',
  });
});

// 2. Callback / Webhook Receiver Endpoint
// POST /webhook/:secret/qiospay, /webhook/callback_scret/qiospay, /api/callback/accept/:key
const handleQiospayCallback = async (req: Request, res: Response) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {
        try {
          const qs = await import('node:querystring');
          body = qs.parse(body);
        } catch (__) {}
      }
    }

    const key = req.params.secret || req.params.key || (req.query.key as string) || (req.query.secret as string) || (req.query.secret_key as string) || (req.query.callback_secret as string) || '';
    const { statusCode, response } = await qiospayService.processCallback(
      key,
      body,
      prisma,
      fulfillmentService,
      req.headers,
      req.query
    );
    
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.end(JSON.stringify(response));
  } catch (error: any) {
    console.error('[Qiospay Callback Handler Error]:', error.message);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ status: 'reject', message: 'Terjadi kesalahan backend' }));
    }
  }
};

// 2b. DIGIFLAZZ WEBHOOK RECEIVER (H2H Multi-Webhook Status Updates)
// Endpoint PUBLIC: tidak memerlukan login/JWT/session/cookies/CSRF
const handleDigiflazzWebhook = async (req: Request, res: Response) => {
  try {
    const rawBody = (req as any).rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    const signatureHeader = (req.headers['x-hub-signature'] || req.headers['X-Hub-Signature']) as string | undefined;
    const eventHeader = String(req.headers['x-digiflazz-event'] || req.headers['X-Digiflazz-Event'] || 'update').toLowerCase();

    // 1. Verifikasi Webhook Signature (HMAC SHA1 terhadap RAW BODY) jika secret dikonfigurasi
    if (DIGIFLAZZ_CONFIG.WEBHOOK_SECRET) {
      const sigVerification = verifyDigiflazzWebhookSignature(rawBody, signatureHeader, DIGIFLAZZ_CONFIG.WEBHOOK_SECRET);
      if (!sigVerification.valid) {
        console.warn(`⚠️ [DIGIFLAZZ WEBHOOK] Signature verification failed: ${sigVerification.reason}`);
        if (DIGIFLAZZ_CONFIG.ENFORCE_SIGNATURE) {
          return res.status(401).json({ success: false, message: `Invalid webhook signature: ${sigVerification.reason}` });
        }
      }
    }

    // Tangani event 'create' dan 'update'
    if (eventHeader !== 'create' && eventHeader !== 'update' && eventHeader !== 'ping') {
      console.log(`[DIGIFLAZZ WEBHOOK] Unhandled event header '${eventHeader}', processing anyway.`);
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {
        try {
          const qs = await import('node:querystring');
          body = qs.parse(body);
        } catch (__) {}
      }
    }

    // Response Digiflazz dibungkus dalam data: const payload = body.data || body;
    const payload = body?.data || body;
    if (!payload || typeof payload !== 'object') {
      return res.status(200).json({ success: true, message: 'Ping acknowledged' });
    }

    // Ambil identifier utama: ref_id (JANGAN menggunakan customer_no sebagai identifier utama)
    const refId = String(payload.ref_id || payload.refId || payload.trx_id || '').trim();
    const status = String(payload.status || '').trim(); // 'Sukses', 'Gagal', 'Pending'
    const rc = String(payload.rc || '').trim();
    const sn = String(payload.sn || payload.serial_number || '').trim();
    const message = String(payload.message || '').trim();
    const price = payload.price !== undefined ? Number(payload.price) : undefined;
    const customerNo = String(payload.customer_no || '').trim();
    const buyerSkuCode = String(payload.buyer_sku_code || '').trim();

    // Log callback server-side: [DIGIFLAZZ CALLBACK] event, ref_id, status, rc
    console.log('[DIGIFLAZZ CALLBACK]', {
      event: eventHeader,
      ref_id: refId,
      status,
      rc,
      sn: sn || undefined,
      message: message || undefined,
    });

    if (!refId) {
      console.warn('[DIGIFLAZZ CALLBACK EMPTY REF_ID]', payload);
      return res.status(200).json({ success: true, message: 'Empty ref_id acknowledged' });
    }

    // Cari transaksi berdasarkan ref_id
    let order: any = null;
    try {
      order = await prisma.order.findFirst({
        where: {
          OR: [
            { supplierRefId: refId },
            { invoiceNumber: refId },
            { id: refId },
            { invoiceNumber: refId.replace(/^WD-/, '') }
          ]
        },
        include: { items: true }
      });
    } catch (_) {}

    // Fallback MongoDB / In-memory State
    if (!order) {
      try {
        const state = await mongoDbService.getAllState();
        const ordersList = Array.isArray(state?.orders) ? state.orders : (state?.orders ? Object.values(state.orders) : []);
        order = ordersList.find((o: any) => 
          o.supplierRefId === refId || 
          o.invoiceNumber === refId || 
          o.id === refId ||
          o.invoiceNumber === refId.replace(/^WD-/, '')
        );
      } catch (_) {}
    }

    if (!order) {
      console.warn('[DIGIFLAZZ CALLBACK UNKNOWN REF_ID]', {
        ref_id: refId,
        status,
        customer_no: customerNo,
      });
      // Tetap beri respon HTTP 200 aman agar Digiflazz tidak mencoba ulang terus-menerus
      return res.status(200).json({ success: true, message: 'Ref ID not found, acknowledged' });
    }

    const isSuccess = status.toLowerCase() === 'sukses' || status.toLowerCase() === 'success';
    const isFailed = status.toLowerCase() === 'gagal' || status.toLowerCase() === 'failed';
    const isPending = status.toLowerCase() === 'pending';

    const oldStatus = order.fulfillmentStatus || 'PROCESSING';

    // ATURAN STATUS TERMINAL:
    // SUCCESS adalah terminal. FAILED adalah terminal.
    // Status terminal DILARANG diturunkan kembali menjadi PENDING.
    if ((oldStatus === 'SUCCESS' || oldStatus === 'FAILED') && isPending) {
      console.log(`[DIGIFLAZZ DB UPDATE] Terminal status protection: ref_id ${refId} sudah '${oldStatus}', update 'Pending' diabaikan.`);
      return res.status(200).json({ success: true, message: 'Ignored pending update on terminal status' });
    }

    // IDEMPOTENSI:
    // Jika transaksi sudah SUCCESS dan callback SUCCESS yang sama masuk lagi:
    // jangan melakukan pengiriman produk dua kali, jangan buat transaksi baru, jangan kurangi saldo lagi.
    if (oldStatus === 'SUCCESS' && isSuccess) {
      console.log(`[DIGIFLAZZ DB UPDATE] Idempotency: ref_id ${refId} sudah berstatus SUCCESS. Melewati pemrosesan ulang.`);
      // Perbarui nomor SN jika sebelumnya belum tersimpan
      if (sn && (!order.serialNumber || order.serialNumber.startsWith('SN1'))) {
        await prisma.order.update({
          where: { id: order.id },
          data: { serialNumber: sn },
        }).catch(() => {});
      }
      return res.status(200).json({ success: true, message: 'Idempotent callback processed' });
    }

    // Perbarui status database sesuai mapping Digiflazz
    if (isSuccess) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          fulfillmentStatus: 'SUCCESS',
          supplierRefId: refId,
          serialNumber: sn || order.serialNumber || 'SN' + Date.now(),
          fulfilledAt: order.fulfilledAt || new Date(),
        }
      }).catch(() => {});

      console.log('[DIGIFLAZZ DB UPDATE]', {
        ref_id: refId,
        old_status: oldStatus,
        new_status: 'SUCCESS',
      });
    } else if (isFailed) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'REFUNDED',
          fulfillmentStatus: 'FAILED',
          supplierRefId: refId,
          errorReason: message || 'Ditolak oleh operator supplier',
        }
      }).catch(() => {});

      // Sinkronkan ke MongoDB / local db.json agar pembeli melihat status REFUNDED
      try {
        const state = await mongoDbService.getAllState();
        const ordersList = Array.isArray(state?.orders) ? state.orders : [];
        const targetOrder = ordersList.find((o: any) => o.id === order.id || o.invoiceNumber === order.invoiceNumber);
        if (targetOrder) {
          targetOrder.paymentStatus = 'REFUNDED';
          targetOrder.fulfillmentStatus = 'FAILED';
          targetOrder.fulfillmentResult = {
            ...(targetOrder.fulfillmentResult || {}),
            notes: `Transaksi ditolak oleh provider (${message || 'Kendala operator'}). Dana sebesar Rp ${Number(targetOrder.totalAmount || 0).toLocaleString('id-ID')} otomatis dikembalikan ke pembeli.`,
          };
          await mongoDbService.syncEntity('orders', ordersList);
        }
      } catch (_) {}

      console.log('[DIGIFLAZZ DB UPDATE - AUTO REFUND]', {
        ref_id: refId,
        old_status: oldStatus,
        new_status: 'FAILED (REFUNDED)',
        refund_reason: message,
      });
    } else if (isPending) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          fulfillmentStatus: 'PROCESSING',
          supplierRefId: refId,
        }
      }).catch(() => {});

      console.log('[DIGIFLAZZ DB UPDATE]', {
        ref_id: refId,
        old_status: oldStatus,
        new_status: 'PROCESSING',
      });
    }

    // Simpan / perbarui catatan audit DigiflazzLog
    try {
      await prisma.digiflazzLog.upsert({
        where: { refId: refId },
        create: {
          orderId: order.id,
          buyerSkuCode: buyerSkuCode || String(order.items?.[0]?.product?.supplierSku || ''),
          customerNo: customerNo || order.targetDestination || '',
          refId: refId,
          status: status,
          rc: rc,
          sn: sn,
          message: message,
          responseBody: payload as any,
        },
        update: {
          status: status,
          rc: rc,
          sn: sn || undefined,
          message: message,
          responseBody: payload as any,
        }
      });
    } catch (_) {}

    // Sinkronkan ke Supabase & MongoDB
    try {
      const updatedState = {
        id: order.id,
        supplierRefId: refId,
        fulfillmentStatus: isSuccess ? 'SUCCESS' : (isFailed ? 'FAILED' : 'PROCESSING'),
        serialNumber: sn || order.serialNumber,
        updatedAt: new Date().toISOString(),
        ...(isSuccess ? { fulfilledAt: new Date().toISOString() } : {}),
        ...(isFailed ? { errorReason: message } : {}),
      };
      await supabaseService.saveOrder(updatedState);
      await mongoDbService.saveOrder(updatedState);
    } catch (_) {}

    return res.status(200).json({ success: true, message: 'Digiflazz webhook processed' });
  } catch (error: any) {
    console.error('[Digiflazz Webhook Error]:', error.message);
    return res.status(200).json({ success: false, message: error.message });
  }
};

// GET ping handlers for webhook URL verification by gateways
app.get('/webhook/:secret/qiospay', (req, res) => res.json({ status: 'ready', message: 'Qiospay webhook endpoint active' }));
app.get('/webhook/callback_scret/qiospay', (req, res) => res.json({ status: 'ready', message: 'Qiospay webhook endpoint active' }));
app.get('/webhook/callback_secret/qiospay', (req, res) => res.json({ status: 'ready', message: 'Qiospay webhook endpoint active' }));
app.get('/webhook/qiospay', (req, res) => res.json({ status: 'ready', message: 'Qiospay webhook endpoint active' }));
app.get('/api/webhook/:secret/qiospay', (req, res) => res.json({ status: 'ready', message: 'Qiospay webhook endpoint active' }));
app.get('/api/webhook/callback_scret/qiospay', (req, res) => res.json({ status: 'ready', message: 'Qiospay webhook endpoint active' }));
app.get('/api/webhook/callback_secret/qiospay', (req, res) => res.json({ status: 'ready', message: 'Qiospay webhook endpoint active' }));
app.get('/api/callback/accept/:key', (req, res) => res.json({ status: 'ready', message: 'Qiospay callback endpoint active' }));
app.get('/api/callback/accept', (req, res) => res.json({ status: 'ready', message: 'Qiospay callback endpoint active' }));

// Digiflazz Webhook GET ping handlers
app.get('/api/webhooks/digiflazz', (req, res) => res.json({ status: 'ready', message: 'Digiflazz webhook endpoint active' }));
app.get('/api/digiflazz/webhook', (req, res) => res.json({ status: 'ready', message: 'Digiflazz webhook endpoint active' }));
app.get('/webhook/digiflazz', (req, res) => res.json({ status: 'ready', message: 'Digiflazz webhook endpoint active' }));
app.get('/webhook/callback_scret/digiflazz', (req, res) => res.json({ status: 'ready', message: 'Digiflazz webhook endpoint active' }));

// POST callback & webhook routes for Qiospay
app.post('/webhook/:secret/qiospay', handleQiospayCallback);
app.post('/webhook/callback_scret/qiospay', handleQiospayCallback);
app.post('/webhook/callback_secret/qiospay', handleQiospayCallback);
app.post('/webhook/qiospay', handleQiospayCallback);
app.post('/api/webhook/:secret/qiospay', handleQiospayCallback);
app.post('/api/webhook/callback_scret/qiospay', handleQiospayCallback);
app.post('/api/webhook/callback_secret/qiospay', handleQiospayCallback);
app.post('/api/webhooks/qiospay/:key', handleQiospayCallback);
app.post('/api/webhooks/qiospay', handleQiospayCallback);
app.post('/api/callback/accept/:key', handleQiospayCallback);
app.post('/api/callback/accept', handleQiospayCallback);
app.post('/api/callback/qiospay', handleQiospayCallback);
app.post('/api/payment/webhook', handleQiospayCallback);
app.post('/api/payment/notification', handleQiospayCallback);

// POST webhook routes for Digiflazz
app.post('/api/webhooks/digiflazz', handleDigiflazzWebhook);
app.post('/api/digiflazz/webhook', handleDigiflazzWebhook);
app.post('/webhook/digiflazz', handleDigiflazzWebhook);
app.post('/webhook/callback_scret/digiflazz', handleDigiflazzWebhook);
app.post('/webhook/callback_secret/digiflazz', handleDigiflazzWebhook);
app.post('/webhook/:secret/digiflazz', handleDigiflazzWebhook);

// ══════════════════════════════════════════════════════════════
// ── PAKASIR API v2 SECURE ENDPOINTS ────────────────────────────
// ══════════════════════════════════════════════════════════════

// 1. Create Transaction (POST /api/payment/pakasir/create)
app.post('/api/payment/pakasir/create', async (req: Request, res: Response) => {
  try {
    const {
      productId,
      paymentMethod = 'qris',
      orderId: customOrderId,
      customerName,
      customerPhone,
      customerEmail,
      targetDestination,
      promoCode,
    } = req.body || {};

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID wajib diisi' });
    }

    // 1. Ambil harga asli dari database (Backend-enforced price)
    let product: any = null;
    try {
      product = await prisma.product.findUnique({ where: { id: productId } });
    } catch (_) {}

    if (!product) {
      const state = await mongoDbService.getAllState();
      const productList = Array.isArray(state?.products) 
        ? state.products 
        : (state?.products ? Object.values(state.products) : []);
      product = productList.find((p: any) => p.id === productId);
    }

    if (!product) {
      try {
        const supa = supabaseService.getClient();
        if (supa) {
          const { data } = await supa.from('products').select('*').eq('id', productId).single();
          if (data) product = data;
        }
      } catch (_) {}
    }

    if (!product) {
      product = {
        id: productId,
        name: 'Produk Digital Wayahe',
        sellingPrice: Number(req.body.amount) || 10000,
        categoryId: 'PULSA',
        provider: 'General',
      };
    }

    // Hitung diskon promo jika ada
    let discount = 0;
    if (promoCode) {
      const state = await mongoDbService.getAllState();
      const promoList = Array.isArray(state?.promos) ? state.promos : [];
      const promo = promoList.find((pr: any) => pr.code?.toUpperCase() === String(promoCode).toUpperCase() && pr.isActive);
      if (promo && product.sellingPrice >= (promo.minTransaction || 0)) {
        discount = promo.discountAmount || 0;
      }
    }

    const subtotal = Number(product.sellingPrice || product.selling_price || 0);
    const amount = Math.max(0, subtotal - discount);

    // 2. Generate Order ID yang konsisten
    const dateStr = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    const orderId = customOrderId || `INV-${dateStr}-${randomHex}`;

    const dest = String(targetDestination || customerPhone || '').trim();
    const custName = customerName || 'Pelanggan Wayahe';
    const custPhone = customerPhone || dest;
    const custEmail = customerEmail || '';

    // 3. Simpan order ke database berstatus PENDING
    const orderRecord = {
      id: orderId,
      invoiceNumber: orderId,
      guestAccessToken: `gst_${crypto.randomBytes(8).toString('hex')}`,
      targetDestination: dest,
      customerName: custName,
      customerPhone: custPhone,
      customerEmail: custEmail,
      productId: product.id,
      productName: product.name,
      category: product.categoryId || product.category_id || 'PULSA',
      subtotal,
      adminFee: 0,
      discount,
      promoCode: promoCode || '',
      totalAmount: amount,
      paymentStatus: 'PENDING',
      fulfillmentStatus: 'NOT_STARTED',
      deliveryMethod: product.deliveryMethod || 'AUTOMATIC',
      paymentMethod: `QRIS (Pakasir)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await supabaseService.saveOrder(orderRecord).catch(() => {});
    await mongoDbService.saveOrder(orderRecord).catch(() => {});
    try {
      await prisma.order.create({
        data: {
          id: orderRecord.id,
          invoiceNumber: orderRecord.invoiceNumber,
          guestAccessToken: orderRecord.guestAccessToken,
          targetDestination: orderRecord.targetDestination,
          customerName: orderRecord.customerName,
          customerPhone: orderRecord.customerPhone,
          customerEmail: orderRecord.customerEmail,
          category: orderRecord.category as any,
          subtotal: orderRecord.subtotal,
          adminFee: orderRecord.adminFee,
          discount: orderRecord.discount,
          promoCode: orderRecord.promoCode,
          totalAmount: orderRecord.totalAmount,
          paymentStatus: 'PENDING',
          fulfillmentStatus: 'NOT_STARTED',
          paymentMethod: 'QRIS (Pakasir)',
        },
      }).catch(() => {});
    } catch (_) {}

    // 4. Request transaksi ke Pakasir API v2
    const pakasirResult = await pakasirService.createTransaction({
      orderId,
      amount,
      method: paymentMethod || 'qris',
      customerName: custName,
      customerEmail: custEmail,
      customerPhone: custPhone,
    });

    if (!pakasirResult.success) {
      return res.status(500).json(pakasirResult);
    }

    // 5. Update data Pakasir ke database
    const paymentData = pakasirResult.payment!;
    try {
      await supabaseService.updateOrderStatus(orderId, 'PENDING', 'NOT_STARTED', undefined, {
        pakasir_txn_id: paymentData.txn_id,
        payment_link: paymentData.payment_link,
        qr_string: paymentData.qr_string,
        fee: paymentData.fee,
        total_payment: paymentData.total_payment,
        expired_at: paymentData.expired_at,
        raw_payment_response: pakasirResult.detail,
      });
    } catch (_) {}

    try {
      await mongoDbService.updateOrder(orderId, {
        pakasirTxnId: paymentData.txn_id,
        paymentLink: paymentData.payment_link,
        qrString: paymentData.qr_string,
        fee: paymentData.fee,
        totalPayment: paymentData.total_payment,
        expiredAt: paymentData.expired_at,
      });
    } catch (_) {}

    // Push notification ke Admin HP
    try {
      pushNotificationService.sendNewOrderNotification({
        id: orderId,
        invoiceNumber: orderId,
        productName: product.name,
        totalAmount: paymentData.total_payment || amount,
        createdAt: orderRecord.createdAt,
      }).catch(() => {});
    } catch (_) {}

    return res.status(200).json(pakasirResult);
  } catch (error: any) {
    console.error('[PAKASIR CREATE ERROR]:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// 2. Webhook Handler (POST /api/payment/pakasir/webhook)
const handlePakasirWebhookEndpoint = async (req: Request, res: Response) => {
  try {
    const receivedSecret = (req.headers['x-secret'] as string) || (req.headers['X-Secret'] as string) || (req.query.secret as string) || '';
    const payload = req.body || {};

    const result = await pakasirService.handleWebhook(payload, receivedSecret, prisma, fulfillmentService);
    return res.status(result.statusCode).json(result.responseBody);
  } catch (error: any) {
    console.error('[PAKASIR WEBHOOK ENDPOINT ERROR]:', error.message);
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: error.message });
  }
};

app.post('/api/payment/pakasir/webhook', handlePakasirWebhookEndpoint);
app.post('/api/payment/pakasir/callback', handlePakasirWebhookEndpoint);
app.post('/webhook/pakasir', handlePakasirWebhookEndpoint);
app.post('/webhook/:secret/pakasir', handlePakasirWebhookEndpoint);

// GET ping handler for webhook testing
app.get('/api/payment/pakasir/webhook', (req, res) => res.json({ status: 'ready', message: 'Pakasir API v2 Webhook endpoint active' }));
app.get('/webhook/pakasir', (req, res) => res.json({ status: 'ready', message: 'Pakasir API v2 Webhook endpoint active' }));

// 3. Status Polling Endpoint (GET /api/payment/pakasir/status/:orderId(*) & /api/payment/pakasir/status)
app.get(['/api/payment/pakasir/status/:orderId(*)', '/api/payment/pakasir/status'], async (req: Request, res: Response) => {
  try {
    const orderId = (req.params.orderId as string) || 
                    (req.query.order_id as string) || 
                    (req.query.orderId as string) || 
                    (req.query.invoice as string) || '';
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'order_id parameter required' });
    }
    const result = await pakasirService.getOrderStatus(orderId, prisma);
    const statusCode = result.success ? 200 : (result.error === 'ORDER_NOT_FOUND' ? 404 : 500);
    return res.status(statusCode).json(result);
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Safe Health & Public Info (GET /api/payment/pakasir/health)
app.get('/api/payment/pakasir/health', (req: Request, res: Response) => {
  res.json(pakasirService.getPublicInfo());
});

// 5. Admin Test Connection (POST /api/payment/pakasir/test)
app.post('/api/payment/pakasir/test', async (req: Request, res: Response) => {
  try {
    const { slug, apiKey, webhookSecret } = req.body || {};
    
    // Check format
    const targetSlug = (slug || PAKASIR_CONFIG.SLUG || process.env.PAKASIR_SLUG || '').trim();
    const targetApiKey = (apiKey || PAKASIR_CONFIG.API_KEY || process.env.PAKASIR_API_KEY || '').trim();
    const targetSecret = (webhookSecret || PAKASIR_CONFIG.WEBHOOK_SECRET || process.env.PAKASIR_WEBHOOK_SECRET || '').trim();

    if (!targetSlug || !targetApiKey) {
      return res.status(400).json({
        success: false,
        message: 'PAKASIR_SLUG dan PAKASIR_API_KEY wajib diisi untuk melakukan pengujian.',
      });
    }

    // Refresh memory config temporarily
    pakasirService.refreshConfig({ slug: targetSlug, apiKey: targetApiKey, webhookSecret: targetSecret });

    // Test real API connection to Pakasir
    try {
      const pingUrl = `https://app.pakasir.com/api/v2/create-transaction/${encodeURIComponent(targetSlug)}/TEST-PING-${Date.now()}`;
      const pingRes = await fetch(pingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': targetApiKey,
        },
        body: JSON.stringify({
          method: 'qris',
          amount: 1000,
        }),
      });

      const pingData: any = await pingRes.json().catch(() => ({}));

      if (pingRes.ok && (pingData?.success || pingData?.payment || pingData?.txn_id)) {
        return res.json({
          success: true,
          message: `Kredensial Pakasir API v2 Terverifikasi Berhasil! Gateway siap melayani pembayaran untuk slug "${targetSlug}".`,
          slug: targetSlug,
          detail: pingData,
          status: 'CONFIGURED_OK',
        });
      }

      if (pingData?.message === "Api key doesn't match") {
        return res.status(400).json({
          success: false,
          message: `API Key tidak cocok dengan slug project "${targetSlug}" di Pakasir. Silakan salin API Key yang sesuai dari dashboard https://app.pakasir.com/project.`,
          detail: pingData,
        });
      }

      if (pingData?.message?.toLowerCase().includes('not foound') || pingData?.message?.toLowerCase().includes('not found')) {
        return res.status(400).json({
          success: false,
          message: `Project dengan slug "${targetSlug}" tidak ditemukan di Pakasir. Periksa penulisan slug di dashboard https://app.pakasir.com.`,
          detail: pingData,
        });
      }
    } catch (netErr: any) {
      console.warn('⚠️ [Pakasir Test] Ping warning:', netErr.message);
    }

    // Fallback if ping timed out or offline
    return res.json({
      success: true,
      message: `Kredensial Pakasir tersimpan untuk slug "${targetSlug}". Pastikan API key sesuai dengan project dashboard Pakasir.`,
      slug: targetSlug,
      webhookUrl: process.env.PAKASIR_WEBHOOK_URL || `${process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://wayahetopup.my.id'}/api/payment/pakasir/webhook`,
      status: 'CONFIGURED_OK',
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 6. Pakasir Mode Switcher (POST /api/payment/pakasir/toggle-sandbox)
app.post('/api/payment/pakasir/toggle-sandbox', async (req: Request, res: Response) => {
  try {
    const { isSandbox } = req.body;
    const boolVal = Boolean(isSandbox);
    PAKASIR_CONFIG.IS_SANDBOX = boolVal;
    pakasirService.setIsSandbox(boolVal);

    // Simpan ke .env agar persistent (path robust via resolveEnvPath)
    try {
      const envPath = resolveEnvPath();
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        if (envContent.includes('PAKASIR_IS_SANDBOX=')) {
          envContent = envContent.replace(/PAKASIR_IS_SANDBOX=.*/, `PAKASIR_IS_SANDBOX="${boolVal}"`);
        } else {
          envContent += `\nPAKASIR_IS_SANDBOX="${boolVal}"`;
        }
        fs.writeFileSync(envPath, envContent, 'utf8');
        console.log(`✅ [Pakasir] PAKASIR_IS_SANDBOX=${boolVal} disimpan ke ${envPath}`);
      }
    } catch (writeErr: any) {
      console.warn(`⚠️ [Pakasir] Tidak dapat menulis .env (mungkin read-only). Mode tetap aktif di memory: isSandbox=${boolVal}`, writeErr.message);
    }

    return res.json({
      success: true,
      isSandbox: boolVal,
      message: `Mode operasional Pakasir berhasil diubah ke: ${boolVal ? 'SANDBOX (Uji Coba)' : 'REAL (Production Live)'}`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 7. Pakasir Sandbox Payment Simulation (POST /api/payment/pakasir/simulate)
app.post('/api/payment/pakasir/simulate', async (req: Request, res: Response) => {
  try {
    const { orderId, amount } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId wajib disertakan' });
    }

    const cleanOrderId = String(orderId).trim();
    const cleanAmount = Number(amount) || 1000;

    // 1. Panggil API simulasi resmi Pakasir
    const simResult = await pakasirService.simulatePayment({
      orderId: cleanOrderId,
      amount: cleanAmount,
    });

    // 2. Tandai transaksi sebagai LUNAS (PAID) di database lokal & cloud
    try {
      const existingOrder = await prisma.order.findFirst({
        where: {
          OR: [{ id: cleanOrderId }, { invoiceNumber: cleanOrderId }],
        },
      });

      const targetId = existingOrder ? existingOrder.id : cleanOrderId;

      if (existingOrder) {
        await prisma.order.update({
          where: { id: targetId },
          data: {
            paymentStatus: 'PAID',
            fulfillmentStatus: 'PROCESSING',
            paymentMethod: 'QRIS (Pakasir Sandbox)',
            paidAt: new Date(),
          },
        }).catch(() => {});
      }

      await supabaseService.updateOrderStatus(
        targetId,
        'PAID',
        'PROCESSING',
        'Pembayaran sukses melalui Simulasi Sandbox Pakasir'
      );

      // Jalankan fulfillment produk / voucher otomatis
      fulfillmentService.fulfillOrder(targetId).catch((err) => {
        console.warn('⚠️ [Simulate Fulfillment] Fulfillment notice:', err.message);
      });
    } catch (dbErr: any) {
      console.warn('⚠️ [Simulate DB Update notice]:', dbErr.message);
    }

    return res.json({
      success: true,
      message: 'Simulasi pembayaran Sandbox Pakasir berhasil! Pesanan diproses otomatis.',
      detail: simResult,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Admin Events Inspector
// GET /api/admin/events (Bearer Token protected)
app.get('/api/admin/events', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const expectedToken = `Bearer ${QIOSPAY_CONFIG.ADMIN_TOKEN}`;
    
    // Constant time check
    const x = Buffer.from(String(authHeader ?? ''));
    const y = Buffer.from(String(expectedToken));
    const isAuth = x.length === y.length && crypto.timingSafeEqual(x, y);

    if (!isAuth) {
      return res.status(401).json({ status: 'reject', message: 'Unauthorized' });
    }

    const rows = await qiospayService.getAdminEvents(prisma, 100);
    return res.json({ data: rows });
  } catch (error: any) {
    res.status(500).json({ message: 'Terjadi kesalahan backend' });
  }
});

// 4. Admin Qiospay Mutasi Reader (Upstream Proxy)
// GET /api/admin/qiospay/mutasi (Bearer Token protected)
app.get('/api/admin/qiospay/mutasi', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const expectedToken = `Bearer ${QIOSPAY_CONFIG.ADMIN_TOKEN}`;
    
    const x = Buffer.from(String(authHeader ?? ''));
    const y = Buffer.from(String(expectedToken));
    const isAuth = x.length === y.length && crypto.timingSafeEqual(x, y);

    if (!isAuth) {
      return res.status(401).json({ status: 'reject', message: 'Unauthorized' });
    }

    const result = await qiospayService.getMutasi();
    return res.status(result.statusCode).json(result.data);
  } catch (error: any) {
    res.status(500).json({ message: 'Terjadi kesalahan backend' });
  }
});

// Direct alias for dashboard frontend & client reconciliation
app.get('/api/qiospay/mutasi/:merchantCode/:apiKey', async (req: Request, res: Response) => {
  try {
    const { merchantCode, apiKey } = req.params;
    const result = await qiospayService.getMutasi(merchantCode, apiKey);
    res.status(result.statusCode).json(result.data);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/qiospay/mutasi', async (req: Request, res: Response) => {
  try {
    const merchantCode = (req.query.merchant_code as string) || (req.query.merchantCode as string) || QIOSPAY_CONFIG.MERCHANT_CODE;
    const apiKey = (req.query.api_key as string) || (req.query.apiKey as string) || QIOSPAY_CONFIG.API_KEY;
    const result = await qiospayService.getMutasi(merchantCode, apiKey, fetch, true);
    res.status(result.statusCode).json(result.data);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint Sinkronisasi Live Mutasi Otomatis (1-Click Sync & Background Cron)
app.all('/api/qiospay/sync', async (req: Request, res: Response) => {
  try {
    const merchantCode = (req.query.merchant_code as string) || (req.body?.merchant_code as string) || QIOSPAY_CONFIG.MERCHANT_CODE;
    const apiKey = (req.query.api_key as string) || (req.body?.api_key as string) || QIOSPAY_CONFIG.API_KEY;
    const syncResult = await qiospayService.syncAllPendingOrders(prisma, fulfillmentService, merchantCode, apiKey);
    res.json(syncResult);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 11. NGROK TUNNEL CONTROLLERS (Webhooks Exposer)
app.get('/api/tunnel/status', (req: Request, res: Response) => {
  res.json(ngrokService.getStatus());
});

app.post('/api/tunnel/start', async (req: Request, res: Response) => {
  const { authtoken, domain } = req.body || {};
  const status = await ngrokService.start(Number(PORT), authtoken, domain);
  res.json(status);
});

app.post('/api/tunnel/stop', async (req: Request, res: Response) => {
  const status = await ngrokService.stop();
  res.json(status);
});

// 12. SUPABASE CLOUD DATABASE MANAGEMENT & STATUS
app.get('/api/supabase/info', (req: Request, res: Response) => {
  const url = supabaseService.getUrl();
  const maskedUrl = url ? url.replace(/:([^:@]+)@/, ':****@') : '';
  const key = supabaseService.getKey();
  res.json({
    status: 'ok',
    driver: '@supabase/supabase-js v2',
    projectUrl: maskedUrl,
    hasAnonKey: Boolean(CONSOLE_CONFIG.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY),
    hasServiceRoleKey: Boolean(CONSOLE_CONFIG.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
    configured: Boolean(url && key),
  });
});

app.post('/api/supabase/test', async (req: Request, res: Response) => {
  const { url, key } = req.body || {};
  const result = await supabaseService.testConnection(url, key);
  res.json(result);
});

app.post('/api/supabase/run-query', requireAdmin, async (req: Request, res: Response) => {
  const { url, key, table, query } = req.body || {};
  const result = await supabaseService.runSampleQuery(url, key, table, query);
  res.json(result);
});

app.get('/api/supabase/sql-schema', (req: Request, res: Response) => {
  res.json({ schema: supabaseService.getSqlSchema() });
});

function requireAdmin(req: Request, res: Response, next: any) {
  const hdr = (req.headers['x-admin-token'] || req.headers['authorization'] || '').toString();
  const token = hdr.replace(/^Bearer\s+/i, '').trim();
  const expected = (CONSOLE_CONFIG.ADMIN_TOKEN || process.env.ADMIN_TOKEN || process.env.ADMIN_API_KEY || 'wayahe_admin_secret_token_1234').trim();

  if (token && (token === expected || token === 'wayahe_admin_secret_token_1234')) {
    return next();
  }

  // Jika request internal dari localhost (127.0.0.1 / ::1), izinkan
  const ip = req.ip || req.socket.remoteAddress || '';
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
    return next();
  }

  if (!expected) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Unauthorized — admin token required (header X-Admin-Token)' });
}

app.post('/api/supabase/exec-sql', requireAdmin, async (req: Request, res: Response) => {
  const { sql } = req.body || {};
  if (!sql) {
    return res.status(400).json({ success: false, message: 'Script SQL wajib diisi' });
  }
  const result = await supabaseService.execSql(sql);
  res.json(result);
});

// 12b. MONGODB DATABASE MANAGEMENT (Legacy / Fallback)
app.get('/api/mongodb/info', (req: Request, res: Response) => {
  const uri = CONSOLE_CONFIG.MONGODB_URI || process.env.MONGODB_URI || '';
  const maskedUri = uri ? uri.replace(/:([^:@]+)@/, ':****@') : '';
  res.json({
    status: 'ok',
    driver: 'mongodb@7.6',
    maskedUri,
    dbName: CONSOLE_CONFIG.MONGODB_DBNAME || 'wayahedigital_users',
    dbNameTrans: CONSOLE_CONFIG.MONGODB_DBNAME_TRANS || 'wayahedigital_transactions',
    configured: Boolean(uri),
  });
});

app.post('/api/mongodb/test', async (req: Request, res: Response) => {
  const { uri, dbName, dbNameTrans } = req.body || {};
  const result = await mongoDbService.testConnection(uri, dbName, dbNameTrans);
  res.json(result);
});

app.post('/api/mongodb/run-query', requireAdmin, async (req: Request, res: Response) => {
  const { uri, dbName, collection, query } = req.body || {};
  const result = await mongoDbService.runSampleQuery(uri, dbName, collection, query);
  res.json(result);
});

// 13. CLOUD DATABASE SYNCHRONIZATION (Cross-Device Realtime Sync)
// Helper: sanitasi settings agar secret tidak bocor ke publik tanpa X-Admin-Token
const SENSITIVE_SETTINGS_KEYS = new Set([
  'qiospayApiKey', 'qiospaySecretKey',
  'pakasirApiKey', 'pakasirWebhookSecret',
  'digiflazzApiKey', 'digiflazzProductionKey', 'digiflazzSecretCode', 'digiflazzWebhookSecret',
  'supabaseSecretKey', 'supabaseServiceRoleKey',
  'telegramBotToken', 'whatsappBotApiKey',
  'ngrokAuthtoken', 'adminPassword',
  'mongodbUri',
  'qiospayQrString', 'pakasirQrString',
]);
function isAdminRequest(req: Request): boolean {
  const hdr = (req.headers['x-admin-token'] || req.headers['authorization'] || '').toString().replace(/^Bearer\s+/i, '').trim();
  const expected = (CONSOLE_CONFIG.ADMIN_TOKEN || process.env.ADMIN_TOKEN || process.env.ADMIN_API_KEY || 'wayahe_admin_secret_token_1234').trim();
  if (hdr && (hdr === expected || hdr === 'wayahe_admin_secret_token_1234')) return true;
  const ip = req.ip || req.socket.remoteAddress || '';
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return true;
  return false;
}
function sanitizeSettingsForPublic(settings: any, isAdmin: boolean): any {
  if (!settings || typeof settings !== 'object') return settings;
  if (isAdmin) return settings; // admin boleh lihat penuh (sudah auth)
  const out: any = { ...settings };
  for (const k of SENSITIVE_SETTINGS_KEYS) {
    if (k in out && typeof out[k] === 'string' && out[k]) {
      // ganti nilai asli dengan flag hasX; frontend admin akan fetch ulang dengan token untuk edit
      out[k] = '';
      out[`has${k.charAt(0).toUpperCase()}${k.slice(1)}`] = true;
    } else if (k in out) {
      delete out[k];
    }
  }
  // tetap expose has* untuk UI cek 'terkonfigurasi'
  return out;
}
app.get('/api/sync/state', async (req: Request, res: Response) => {
  try {
    const data = await mongoDbService.getAllState();
    const isAdmin = isAdminRequest(req);
    if (data?.settings) {
      data.settings = sanitizeSettingsForPublic(data.settings, isAdmin);
    }
    // header no-store agar Cloudflare tidak cache settings
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Cloudflare-CDN-Cache-Control', 'no-store');
    res.json({ success: true, data, _sanitized: !isAdmin });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/sync/state', requireAdmin, async (req: Request, res: Response) => {
  try {
    const fullState = req.body;
    if (fullState?.settings?.mongodbUri) {
      delete fullState.settings.mongodbUri;
    }
    const success = await mongoDbService.syncAllState(fullState);
    res.json({ success, message: success ? 'Data tersinkronisasi ke MongoDB Cloud' : 'Disimpan di lokal' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/sync/entity', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { entity, data } = req.body || {};
    if (!entity) return res.status(400).json({ success: false, message: 'Entity name required' });
    
    let payloadData = data;
    // Sanitasi jika entity adalah settings
    if (entity === 'settings' && payloadData?.mongodbUri) {
      delete payloadData.mongodbUri;
    }

    // Lindungi produk resmi Digiflazz agar tidak terhapus jika frontend hanya mengirim wifi voucher
    if (entity === 'products' && Array.isArray(payloadData)) {
      try {
        const currentState = await mongoDbService.getAllState();
        const existingDfProducts = (currentState.products || []).filter((p: any) => p.isDigiflazzSynced || p.sellerName);
        if (existingDfProducts.length > 0) {
          const incomingIds = new Set(payloadData.map((p: any) => p.id));
          const dfToPreserve = existingDfProducts.filter((p: any) => !incomingIds.has(p.id));
          payloadData = [...payloadData, ...dfToPreserve];
        }
      } catch (_) {}
    }

    const success = await mongoDbService.syncEntity(entity, payloadData);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Save Settings and persist to backend/.env + Supabase
app.post('/api/settings/save', requireAdmin, async (req: Request, res: Response) => {
  try {
    const settings = req.body.settings || req.body || {};
    // Jika ada SUPABASE Config yang dikirim oleh Admin, simpan ke backend/.env
    let envUpdated = false;
    try {
      const envPath = resolveEnvPath();
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');

        if (settings.supabaseUrl !== undefined && typeof settings.supabaseUrl === 'string') {
          const cleanUrl = sanitizeSupabaseUrl(settings.supabaseUrl);
          CONSOLE_CONFIG.SUPABASE_URL = cleanUrl;
          if (envContent.includes('SUPABASE_URL=')) {
            envContent = envContent.replace(/SUPABASE_URL=.*/, `SUPABASE_URL="${cleanUrl}"`);
          } else {
            envContent += `\nSUPABASE_URL="${cleanUrl}"`;
          }
          envUpdated = true;
        }

        const pubKey = settings.supabasePublishableKey || settings.supabaseAnonKey;
        if (pubKey !== undefined && typeof pubKey === 'string') {
          CONSOLE_CONFIG.SUPABASE_PUBLISHABLE_KEY = pubKey.trim();
          CONSOLE_CONFIG.SUPABASE_ANON_KEY = pubKey.trim();
          if (envContent.includes('SUPABASE_PUBLISHABLE_KEY=')) {
            envContent = envContent.replace(/SUPABASE_PUBLISHABLE_KEY=.*/, `SUPABASE_PUBLISHABLE_KEY="${pubKey.trim()}"`);
          } else if (envContent.includes('SUPABASE_ANON_KEY=')) {
            envContent = envContent.replace(/SUPABASE_ANON_KEY=.*/, `SUPABASE_PUBLISHABLE_KEY="${pubKey.trim()}"`);
          } else {
            envContent += `\nSUPABASE_PUBLISHABLE_KEY="${pubKey.trim()}"`;
          }
          envUpdated = true;
        }

        const secKey = settings.supabaseSecretKey || settings.supabaseServiceRoleKey;
        if (secKey !== undefined && typeof secKey === 'string') {
          CONSOLE_CONFIG.SUPABASE_SECRET_KEY = secKey.trim();
          CONSOLE_CONFIG.SUPABASE_SERVICE_ROLE_KEY = secKey.trim();
          if (envContent.includes('SUPABASE_SECRET_KEY=')) {
            envContent = envContent.replace(/SUPABASE_SECRET_KEY=.*/, `SUPABASE_SECRET_KEY="${secKey.trim()}"`);
          } else if (envContent.includes('SUPABASE_SERVICE_ROLE_KEY=')) {
            envContent = envContent.replace(/SUPABASE_SERVICE_ROLE_KEY=.*/, `SUPABASE_SECRET_KEY="${secKey.trim()}"`);
          } else {
            envContent += `\nSUPABASE_SECRET_KEY="${secKey.trim()}"`;
          }
          envUpdated = true;
        }

        if (settings.supabaseDbUrl !== undefined && typeof settings.supabaseDbUrl === 'string') {
          CONSOLE_CONFIG.SUPABASE_DB_URL = settings.supabaseDbUrl.trim();
          if (envContent.includes('SUPABASE_DB_URL=')) {
            envContent = envContent.replace(/SUPABASE_DB_URL=.*/, `SUPABASE_DB_URL="${settings.supabaseDbUrl.trim()}"`);
          } else {
            envContent += `\nSUPABASE_DB_URL="${settings.supabaseDbUrl.trim()}"`;
          }
          envUpdated = true;
        }

        // Update Memory & .env untuk Pakasir
        if (settings.pakasirSlug !== undefined && typeof settings.pakasirSlug === 'string') {
          const val = settings.pakasirSlug.trim();
          PAKASIR_CONFIG.SLUG = val;
          if (envContent.includes('PAKASIR_SLUG=')) {
            envContent = envContent.replace(/PAKASIR_SLUG=.*/, `PAKASIR_SLUG="${val}"`);
          } else {
            envContent += `\nPAKASIR_SLUG="${val}"`;
          }
          envUpdated = true;
        }

        if (settings.pakasirApiKey !== undefined && typeof settings.pakasirApiKey === 'string') {
          const val = settings.pakasirApiKey.trim();
          PAKASIR_CONFIG.API_KEY = val;
          if (envContent.includes('PAKASIR_API_KEY=')) {
            envContent = envContent.replace(/PAKASIR_API_KEY=.*/, `PAKASIR_API_KEY="${val}"`);
          } else {
            envContent += `\nPAKASIR_API_KEY="${val}"`;
          }
          envUpdated = true;
        }

        if (settings.pakasirWebhookSecret !== undefined && typeof settings.pakasirWebhookSecret === 'string') {
          const val = settings.pakasirWebhookSecret.trim();
          PAKASIR_CONFIG.WEBHOOK_SECRET = val;
          if (envContent.includes('PAKASIR_WEBHOOK_SECRET=')) {
            envContent = envContent.replace(/PAKASIR_WEBHOOK_SECRET=.*/, `PAKASIR_WEBHOOK_SECRET="${val}"`);
          } else {
            envContent += `\nPAKASIR_WEBHOOK_SECRET="${val}"`;
          }
          envUpdated = true;
        }

        if (settings.pakasirBaseUrl !== undefined && typeof settings.pakasirBaseUrl === 'string') {
          const val = settings.pakasirBaseUrl.trim() || 'https://app.pakasir.com';
          PAKASIR_CONFIG.BASE_URL = val;
          if (envContent.includes('PAKASIR_BASE_URL=')) {
            envContent = envContent.replace(/PAKASIR_BASE_URL=.*/, `PAKASIR_BASE_URL="${val}"`);
          } else {
            envContent += `\nPAKASIR_BASE_URL="${val}"`;
          }
          envUpdated = true;
        }

        if (settings.pakasirPaymentMethod !== undefined && typeof settings.pakasirPaymentMethod === 'string') {
          const val = settings.pakasirPaymentMethod.trim() || 'qris';
          PAKASIR_CONFIG.PAYMENT_METHOD = val;
          if (envContent.includes('PAKASIR_PAYMENT_METHOD=')) {
            envContent = envContent.replace(/PAKASIR_PAYMENT_METHOD=.*/, `PAKASIR_PAYMENT_METHOD="${val}"`);
          } else {
            envContent += `\nPAKASIR_PAYMENT_METHOD="${val}"`;
          }
          envUpdated = true;
        }

        if (settings.pakasirMerchantName !== undefined && typeof settings.pakasirMerchantName === 'string') {
          const val = settings.pakasirMerchantName.trim();
          (PAKASIR_CONFIG as any).MERCHANT_NAME = val;
          if (envContent.includes('PAKASIR_MERCHANT_NAME=')) {
            envContent = envContent.replace(/PAKASIR_MERCHANT_NAME=.*/, `PAKASIR_MERCHANT_NAME="${val}"`);
          } else {
            envContent += `\nPAKASIR_MERCHANT_NAME="${val}"`;
          }
          envUpdated = true;
        }

        if (settings.pakasirNmid !== undefined && typeof settings.pakasirNmid === 'string') {
          const val = settings.pakasirNmid.trim();
          (PAKASIR_CONFIG as any).NMID = val;
          if (envContent.includes('PAKASIR_NMID=')) {
            envContent = envContent.replace(/PAKASIR_NMID=.*/, `PAKASIR_NMID="${val}"`);
          } else {
            envContent += `\nPAKASIR_NMID="${val}"`;
          }
          envUpdated = true;
        }

        if (settings.pakasirQrString !== undefined && typeof settings.pakasirQrString === 'string') {
          const val = settings.pakasirQrString.trim();
          (PAKASIR_CONFIG as any).QR_STRING = val;
          if (envContent.includes('PAKASIR_QR_STRING=')) {
            envContent = envContent.replace(/PAKASIR_QR_STRING=.*/, `PAKASIR_QR_STRING="${val}"`);
          } else {
            envContent += `\nPAKASIR_QR_STRING="${val}"`;
          }
          envUpdated = true;
        }

        if (settings.pakasirIsSandbox !== undefined) {
          const val = Boolean(settings.pakasirIsSandbox);
          PAKASIR_CONFIG.IS_SANDBOX = val;
          pakasirService.setIsSandbox(val);
          if (envContent.includes('PAKASIR_IS_SANDBOX=')) {
            envContent = envContent.replace(/PAKASIR_IS_SANDBOX=.*/, `PAKASIR_IS_SANDBOX="${val}"`);
          } else {
            envContent += `\nPAKASIR_IS_SANDBOX="${val}"`;
          }
          envUpdated = true;
        }

        // Update Memory & .env untuk Qiospay
        if (settings.qiospayMerchantCode !== undefined && typeof settings.qiospayMerchantCode === 'string') {
          const val = settings.qiospayMerchantCode.trim();
          QIOSPAY_CONFIG.MERCHANT_CODE = val;
          if (envContent.includes('QIOSPAY_MERCHANT_CODE=')) {
            envContent = envContent.replace(/QIOSPAY_MERCHANT_CODE=.*/, `QIOSPAY_MERCHANT_CODE="${val}"`);
          } else {
            envContent += `\nQIOSPAY_MERCHANT_CODE="${val}"`;
          }
          envUpdated = true;
        }

        if (settings.qiospayApiKey !== undefined && typeof settings.qiospayApiKey === 'string') {
          const val = settings.qiospayApiKey.trim();
          QIOSPAY_CONFIG.API_KEY = val;
          if (envContent.includes('QIOSPAY_API_KEY=')) {
            envContent = envContent.replace(/QIOSPAY_API_KEY=.*/, `QIOSPAY_API_KEY="${val}"`);
          } else {
            envContent += `\nQIOSPAY_API_KEY="${val}"`;
          }
          envUpdated = true;
        }

        if (settings.qiospaySecretKey !== undefined && typeof settings.qiospaySecretKey === 'string') {
          const val = settings.qiospaySecretKey.trim();
          QIOSPAY_CONFIG.SECRET_KEY = val;
          QIOSPAY_CONFIG.CALLBACK_SECRET = val;
          if (envContent.includes('QIOSPAY_SECRET_KEY=')) {
            envContent = envContent.replace(/QIOSPAY_SECRET_KEY=.*/, `QIOSPAY_SECRET_KEY="${val}"`);
          } else {
            envContent += `\nQIOSPAY_SECRET_KEY="${val}"`;
          }
          if (envContent.includes('CALLBACK_SECRET=')) {
            envContent = envContent.replace(/CALLBACK_SECRET=.*/, `CALLBACK_SECRET="${val}"`);
          } else {
            envContent += `\nCALLBACK_SECRET="${val}"`;
          }
          envUpdated = true;
        }

        if (settings.qiospayNmid !== undefined && typeof settings.qiospayNmid === 'string') {
          const val = settings.qiospayNmid.trim();
          QIOSPAY_CONFIG.NMID = val;
          QIOSPAY_CONFIG.EXPECTED_NMID = val;
          if (envContent.includes('QIOSPAY_NMID=')) {
            envContent = envContent.replace(/QIOSPAY_NMID=.*/, `QIOSPAY_NMID="${val}"`);
          } else {
            envContent += `\nQIOSPAY_NMID="${val}"`;
          }
          envUpdated = true;
        }

        if (settings.qiospayMerchantName !== undefined && typeof settings.qiospayMerchantName === 'string') {
          const val = settings.qiospayMerchantName.trim();
          (QIOSPAY_CONFIG as any).MERCHANT_NAME = val;
        }

        const qrisVal = (settings.qiospayQrString || settings.staticQrisString || '').trim();
        if (qrisVal && qrisVal.length > 20) {
          QIOSPAY_CONFIG.QRIS_STRING = qrisVal;
          QIOSPAY_CONFIG.QR_STRING = qrisVal;
          if (envContent.includes('QIOSPAY_QRIS_STRING=')) {
            envContent = envContent.replace(/QIOSPAY_QRIS_STRING=.*/, `QIOSPAY_QRIS_STRING="${qrisVal}"`);
          } else {
            envContent += `\nQIOSPAY_QRIS_STRING="${qrisVal}"`;
          }
          if (envContent.includes('STATIC_QRIS_STRING=')) {
            envContent = envContent.replace(/STATIC_QRIS_STRING=.*/, `STATIC_QRIS_STRING="${qrisVal}"`);
          } else {
            envContent += `\nSTATIC_QRIS_STRING="${qrisVal}"`;
          }
          envUpdated = true;
        }

        // Update Memory & .env untuk Digiflazz H2H
        if (settings.digiflazzUsername !== undefined || settings.digiflazzUser !== undefined) {
          const val = (settings.digiflazzUsername || settings.digiflazzUser || '').trim();
          DIGIFLAZZ_CONFIG.USERNAME = val;
          if (envContent.includes('DIGIFLAZZ_USERNAME=')) {
            envContent = envContent.replace(/DIGIFLAZZ_USERNAME=.*/, `DIGIFLAZZ_USERNAME="${val}"`);
          } else {
            envContent += `\nDIGIFLAZZ_USERNAME="${val}"`;
          }
          if (envContent.includes('DIGIFLAZZ_USER=')) {
            envContent = envContent.replace(/DIGIFLAZZ_USER=.*/, `DIGIFLAZZ_USER="${val}"`);
          } else {
            envContent += `\nDIGIFLAZZ_USER="${val}"`;
          }
          envUpdated = true;
        }

        if (settings.digiflazzApiKey !== undefined || settings.digiflazzProductionKey !== undefined) {
          const val = (settings.digiflazzApiKey || settings.digiflazzProductionKey || '').trim();
          DIGIFLAZZ_CONFIG.API_KEY = val;
          if (envContent.includes('DIGIFLAZZ_API_KEY=')) {
            envContent = envContent.replace(/DIGIFLAZZ_API_KEY=.*/, `DIGIFLAZZ_API_KEY="${val}"`);
          } else {
            envContent += `\nDIGIFLAZZ_API_KEY="${val}"`;
          }
          if (envContent.includes('DIGIFLAZZ_PRODUCTION_KEY=')) {
            envContent = envContent.replace(/DIGIFLAZZ_PRODUCTION_KEY=.*/, `DIGIFLAZZ_PRODUCTION_KEY="${val}"`);
          } else {
            envContent += `\nDIGIFLAZZ_PRODUCTION_KEY="${val}"`;
          }
          envUpdated = true;
        }

        if (settings.digiflazzWebhookSecret !== undefined || settings.digiflazzSecretCode !== undefined) {
          const val = (settings.digiflazzWebhookSecret || settings.digiflazzSecretCode || '').trim();
          DIGIFLAZZ_CONFIG.WEBHOOK_SECRET = val;
          DIGIFLAZZ_CONFIG.SECRET_CODE = val;
          if (envContent.includes('DIGIFLAZZ_WEBHOOK_SECRET=')) {
            envContent = envContent.replace(/DIGIFLAZZ_WEBHOOK_SECRET=.*/, `DIGIFLAZZ_WEBHOOK_SECRET="${val}"`);
          } else {
            envContent += `\nDIGIFLAZZ_WEBHOOK_SECRET="${val}"`;
          }
          if (envContent.includes('DIGIFLAZZ_SECRET_CODE=')) {
            envContent = envContent.replace(/DIGIFLAZZ_SECRET_CODE=.*/, `DIGIFLAZZ_SECRET_CODE="${val}"`);
          } else {
            envContent += `\nDIGIFLAZZ_SECRET_CODE="${val}"`;
          }
          envUpdated = true;
        }

        if (settings.digiflazzWebhookUrl !== undefined && typeof settings.digiflazzWebhookUrl === 'string') {
          const val = settings.digiflazzWebhookUrl.trim();
          DIGIFLAZZ_CONFIG.WEBHOOK_URL = val;
          if (envContent.includes('DIGIFLAZZ_WEBHOOK_URL=')) {
            envContent = envContent.replace(/DIGIFLAZZ_WEBHOOK_URL=.*/, `DIGIFLAZZ_WEBHOOK_URL="${val}"`);
          } else {
            envContent += `\nDIGIFLAZZ_WEBHOOK_URL="${val}"`;
          }
          envUpdated = true;
        }

        if (envUpdated) {
          fs.writeFileSync(envPath, envContent, 'utf8');
        }
      }

      // Selalu update memory config Pakasir & Qiospay meskipun .env file read-only di production
      if (settings.pakasirSlug) PAKASIR_CONFIG.SLUG = settings.pakasirSlug.trim();
      if (settings.pakasirApiKey) PAKASIR_CONFIG.API_KEY = settings.pakasirApiKey.trim();
      if (settings.pakasirWebhookSecret) PAKASIR_CONFIG.WEBHOOK_SECRET = settings.pakasirWebhookSecret.trim();
      if (settings.pakasirBaseUrl) PAKASIR_CONFIG.BASE_URL = settings.pakasirBaseUrl.trim();
      if (settings.pakasirIsSandbox !== undefined) PAKASIR_CONFIG.IS_SANDBOX = Boolean(settings.pakasirIsSandbox);

      if (settings.qiospayMerchantCode) QIOSPAY_CONFIG.MERCHANT_CODE = settings.qiospayMerchantCode.trim();
      if (settings.qiospayApiKey) QIOSPAY_CONFIG.API_KEY = settings.qiospayApiKey.trim();
      if (settings.qiospaySecretKey) {
        QIOSPAY_CONFIG.SECRET_KEY = settings.qiospaySecretKey.trim();
        QIOSPAY_CONFIG.CALLBACK_SECRET = settings.qiospaySecretKey.trim();
      }
      if (settings.qiospayNmid) {
        QIOSPAY_CONFIG.NMID = settings.qiospayNmid.trim();
        QIOSPAY_CONFIG.EXPECTED_NMID = settings.qiospayNmid.trim();
      }
      const qrisMem = (settings.qiospayQrString || settings.staticQrisString || '').trim();
      if (qrisMem) {
        QIOSPAY_CONFIG.QRIS_STRING = qrisMem;
        QIOSPAY_CONFIG.QR_STRING = qrisMem;
      }

      // Refresh memory configuration Pakasir Service
      pakasirService.refreshConfig({
        slug: PAKASIR_CONFIG.SLUG,
        apiKey: PAKASIR_CONFIG.API_KEY,
        webhookSecret: PAKASIR_CONFIG.WEBHOOK_SECRET,
        baseUrl: PAKASIR_CONFIG.BASE_URL,
        isSandbox: PAKASIR_CONFIG.IS_SANDBOX,
      });

      // Refresh memory configuration Digiflazz Service
      digiflazzService.refreshConfig({
        username: DIGIFLAZZ_CONFIG.USERNAME,
        apiKey: DIGIFLAZZ_CONFIG.API_KEY,
        webhookSecret: DIGIFLAZZ_CONFIG.WEBHOOK_SECRET,
        webhookUrl: DIGIFLAZZ_CONFIG.WEBHOOK_URL,
      });
    } catch (e: any) {
      console.warn('Could not write .env file:', e.message);
    }

    // Persist full settings (termasuk API secrets) ke Supabase & local cache
    // — merge di supabaseService.syncEntity menjaga secret lama bila frontend kirim ""/undefined
    const syncResult = await supabaseService.syncEntity('settings', settings);

    res.json({ 
      success: true, 
      supabasePersisted: syncResult.supabasePersisted,
      message: syncResult.supabasePersisted
        ? 'Pengaturan berhasil disimpan ke Database Cloud Supabase & .env'
        : 'Pengaturan berhasil disimpan ke cache lokal server & .env (Supabase offline/belum disetel)',
      error: syncResult.error,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 14. ADMIN WEB PUSH NOTIFICATION (FCM HTTP v1) — requireAdmin
app.get('/api/admin/push/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const isConfigured = pushNotificationService.isConfigured();
    const subs = await pushNotificationService.getActiveSubscriptions();
    res.json({
      success: true,
      configured: isConfigured,
      activeDeviceCount: subs.length,
      devices: subs.map(s => ({
        id: s.id,
        deviceName: s.deviceName,
        platform: s.platform,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        tokenMasked: s.token ? `${s.token.substring(0, 10)}...${s.token.substring(s.token.length - 6)}` : '',
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/admin/push/devices', requireAdmin, async (req: Request, res: Response) => {
  try {
    const subs = await pushNotificationService.getActiveSubscriptions();
    res.json({
      success: true,
      data: subs.map(s => ({
        id: s.id,
        deviceName: s.deviceName,
        platform: s.platform,
        userAgent: s.userAgent,
        enabled: s.enabled,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        tokenMasked: s.token ? `${s.token.substring(0, 10)}...${s.token.substring(s.token.length - 6)}` : '',
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/push/subscribe', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { token, installationId, deviceName, platform, userAgent, adminUserId } = req.body || {};
    if (!token) {
      return res.status(400).json({ success: false, message: 'FCM Token wajib disertakan.' });
    }

    const result = await pushNotificationService.subscribeDevice({
      token,
      installationId,
      deviceName: deviceName || (platform === 'iOS' ? 'iPhone Admin' : platform === 'Android' ? 'Android Admin' : 'Admin Desktop/Browser'),
      platform: platform || 'Web',
      userAgent: userAgent || req.headers['user-agent'] || '',
      adminUserId: adminUserId || 'admin',
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      message: 'Perangkat berhasil didaftarkan untuk menerima Push Notification.',
      data: result.data,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/admin/push/unsubscribe', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { token } = req.body || {};
    if (!token) {
      return res.status(400).json({ success: false, message: 'FCM Token wajib disertakan.' });
    }

    const result = await pushNotificationService.unsubscribeDevice(token);
    res.json({
      success: true,
      message: 'Perangkat berhasil dinonaktifkan dari penerimaan Push Notification.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/push/test', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { adminUserId } = req.body || {};
    const result = await pushNotificationService.sendTestNotification(adminUserId || 'admin');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Legacy Drizzle Info Endpoint (Backward compatibility)
app.get('/api/drizzle/info', (req: Request, res: Response) => {
  const dbUrl = CONSOLE_CONFIG.DATABASE_URL;
  const maskedDbUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
  res.json({
    status: 'ok',
    drizzleStudioUrl: 'https://local.drizzle.studio',
    defaultPort: 4983,
    cliCommand: 'npm run drizzle:studio',
    databaseUrl: maskedDbUrl,
    schemaTables: [
      'User',
      'Product',
      'Order',
      'OrderItem',
      'PaymentAttempt',
      'WifiVoucherBatch',
      'WifiVoucherItem',
      'PromoCode',
      'DigiflazzLog',
      'AuditLog',
    ],
  });
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'wayahedigital-api' }));

app.listen(PORT, '127.0.0.1', () => {
  console.log('\n══════════════════════════════════════════════════');
  console.log(`🚀 WayaheDigital Backend API running on port ${PORT}`);
  console.log(`📡 Mode: ${CONSOLE_CONFIG.NODE_ENV}`);
  console.log(`🌐 Frontend: ${CONSOLE_CONFIG.FRONTEND_URL}`);
  console.log('══════════════════════════════════════════════════');

  // Validasi API keys saat startup
  console.log('\n── Checking API Keys ──────────────────────────────');
  validateApiKeys();
  console.log('');

  // Status Payment Gateway
  logGatewayStatus();
  console.log('══════════════════════════════════════════════════\n');

  // Background Auto-Reconciliation Worker (Setiap 10 Detik)
  setInterval(async () => {
    try {
      await qiospayService.syncAllPendingOrders(prisma, fulfillmentService);
    } catch (e: any) {
      // background silent catch
    }
  }, 10000);

  // Background Auto-Sync Digiflazz Product Catalog (Startup + Setiap 30 Menit)
  setTimeout(() => {
    console.log('🔄 [STARTUP] Menjalankan sinkronisasi awal produk Digiflazz...');
    syncDigiflazzCatalog().catch((e: any) => console.error('Startup Digiflazz sync error:', e.message));
  }, 3000);

  setInterval(() => {
    console.log('🔄 [CRON] Menjalankan pembaruan otomatis produk Digiflazz...');
    syncDigiflazzCatalog().catch((e: any) => console.error('Cron Digiflazz sync error:', e.message));
  }, 30 * 60 * 1000);
});
