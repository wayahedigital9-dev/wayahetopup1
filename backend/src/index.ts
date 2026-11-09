import express, { Request, Response } from 'express';
import { toPublicState } from './security/stateDto.js';
import { createMemberAuth, memberDto } from './security/memberAuth.js';
import { resolveManualCheckout } from './services/manualCheckout.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { hydrateDigiflazzRuntime } from './services/digiflazzRuntime.js';
import { hydrateQiospayRuntime } from './services/qiospayRuntime.js';
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
  transformDigiflazzProduct,
  findCachedDigiflazzItem,
  isWithinCutOff
} from './services/digiflazz.js';
import { FulfillmentService } from './services/fulfillment.js';
import { qiospayService } from './services/qiospay.js';
import { ngrokService } from './services/ngrok.js';
import { mongoDbService } from './services/mongodbService.js';
import { supabaseService, sanitizeSupabaseUrl } from './services/supabaseService.js';
import { mergeSettings } from './services/settingsMerge.js';
import { createPaymentSession, detectActiveGateway, logGatewayStatus, listPaymentChannels } from './services/paymentRouter.js';
import { pushNotificationService } from './services/pushNotificationService.js';
import { outboundIpService } from './services/outboundIpService.js';
import { loadXavieraConfig, xavieraProducts, xavieraSmmServices, xavieraGames } from './services/xavieraClient.js';
import { telegramBotService } from './services/telegramBot.js';

// ── Config terpisah: Console (terminal) vs API Keys ──────────
import { CONSOLE_CONFIG } from './config/console.js';
import {
  validateApiKeys,
  DIGIFLAZZ_CONFIG,
  QIOSPAY_CONFIG,
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
app.set('trust proxy', 1);
const fulfillmentService = new FulfillmentService(prisma);
const PORT = CONSOLE_CONFIG.PORT;

// Security & Middlewares
const allowedOrigins = new Set<string>([
  'https://wayahedigital.com',
  'https://www.wayahedigital.com',
  'https://wayahetopup.my.id',
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
const memberAuth = createMemberAuth(async () => {
  const client = await mongoDbService.getClient();
  if (!client) throw new Error('Member database unavailable');
  return client.db(mongoDbService.getPrimaryDbName());
}, CONSOLE_CONFIG.isProduction, mongoDbService.getTransCollectionName() || 'orders');
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 40, skip: req => req.method === 'GET', message: { success: false, message: 'Terlalu banyak percobaan. Coba lagi nanti.' } }), memberAuth.router);


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
      variantId,
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

    const member = await memberAuth.getMember(req);
    if (!member) {
      return res.status(401).json({ success: false, message: 'Silakan login sebagai member sebelum membuat pesanan.' });
    }
    const state = await mongoDbService.getAllState();

    // Catalog and manual stock come from the canonical admin inventory first.
    const canonicalProducts = Array.isArray(state?.products) ? state.products : Object.values(state?.products || {});
    let product: any = canonicalProducts.find((p: any) => p.id === productId);
    if (!product) { try { product = await prisma.product.findUnique({ where: { id: productId } }); } catch (_) {} }

    const dynamicPriceFromReq = Number(req.body.sellingPrice || req.body.totalAmount || req.body.amount || 0);

    const isApiProduct = Boolean(
      product?.isDigiflazzSynced ||
      product?.sellerName ||
      product?.digiflazzCategory ||
      product?.supplierSku ||
      String(productId).startsWith('df-') ||
      req.body.supplierSku ||
      req.body.buyerSkuCode ||
      product?.providerProductId ||
      product?.smmServiceId
    );

    // Jika produk belum tersimpan di state tetapi merupakan SKU Digiflazz resmi, ambil dari cache Digiflazz
    if (!product && (String(productId).startsWith('df-') || req.body.supplierSku || req.body.buyerSkuCode)) {
      const getCachedItem = typeof findCachedDigiflazzItem === 'function' ? findCachedDigiflazzItem : null;
      const cachedDf = getCachedItem ? (getCachedItem(productId) || (req.body.supplierSku ? getCachedItem(req.body.supplierSku) : null)) : null;
      if (cachedDf && typeof transformDigiflazzProduct === 'function') {
        product = transformDigiflazzProduct(cachedDf);
      }
    }

    // ── ATURAN KETAT STOK API KEY: Produk API harus selalu mengikuti status & stok live API ──
    if (isApiProduct) {
      if (!product) {
        return res.status(404).json({ success: false, message: 'Produk API tidak ditemukan di katalog resmi provider.' });
      }
      if (product.isActive === false) {
        const reason = product.statusNote || 'Produk sedang tidak aktif / cut-off dari provider API';
        return res.status(400).json({ success: false, message: `Transaksi ditolak: ${reason}. Silakan pilih nominal lain.` });
      }
      if (product.unlimitedStock === false && product.stock !== undefined && Number(product.stock) <= 0) {
        return res.status(400).json({ success: false, message: 'Stok produk dari supplier API saat ini sedang kosong (Stok: 0). Silakan pilih nominal lain.' });
      }
      if (typeof isWithinCutOff === 'function' && isWithinCutOff(product.startCutOff, product.endCutOff)) {
        return res.status(400).json({ success: false, message: `Produk sedang dalam jam cut-off/pemeliharaan server provider (${product.startCutOff || ''} - ${product.endCutOff || ''} WIB). Silakan coba lagi nanti.` });
      }
    } else {
      if ((!product || product.isActive === false) && ['wifi', 'premium'].includes(String(req.body.category || product?.categoryId || '').toLowerCase())) {
        return res.status(404).json({ success: false, message: 'Produk manual tidak tersedia di katalog admin.' });
      }

      if (!product || product.isActive === false) {
        product = {
          id: productId,
          name: req.body.productName || 'Produk Digital Wayahe',
          sellingPrice: dynamicPriceFromReq > 0 ? dynamicPriceFromReq : 10000,
          categoryId: req.body.category || 'PULSA',
          provider: req.body.provider || 'General',
          deliveryMethod: req.body.deliveryMethod || 'INSTANT_ROUTER_INJECTION',
        };
      }
    }

    let selectedVariantId: string | undefined;
    let selectedVariantName: string | undefined;
    const manualCategory = product && ['wifi', 'premium'].includes(String(product.categoryId).toLowerCase()) && !product.isDigiflazzSynced && !product.sellerName && !product.providerProductId;
    if (manualCategory) {
      try { const selected = resolveManualCheckout(product, variantId); product = selected.product; selectedVariantId = selected.variantId; selectedVariantName = selected.variantName; }
      catch (error: any) { return res.status(error.status || 400).json({ success: false, message: error.message }); }
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
    const activeGateway = (preferredGateway || paymentGatewayProvider || state?.settings?.paymentGatewayProvider || 'QIOSPAY') as any;
    const baseAmount = Math.max(0, subtotal - discount + adminFee);
    let paymentReferenceFee = 0;
    let totalAmount = baseAmount;
    if (String(activeGateway).toUpperCase() === 'QIOSPAY') {
      const usedPendingAmounts = new Set(
        (Array.isArray(state?.orders) ? state.orders : Object.values(state?.orders || {}))
          .filter((order: any) => ['PENDING', 'UNPAID', 'EXPIRED'].includes(order.paymentStatus))
          .map((order: any) => Number(order.totalAmount || 0))
      );
      for (let candidate = 1; candidate <= 999; candidate++) {
        if (!usedPendingAmounts.has(baseAmount + candidate)) {
          paymentReferenceFee = candidate;
          totalAmount = baseAmount + candidate;
          break;
        }
      }
    }
    const invoiceNumber = customInvoice || `INV/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/WD/${Math.floor(1000 + Math.random() * 9000)}`;
    const orderId = customId || `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Identity collisions are always conflicts, including owner/admin retries.
    // No caller may recreate an existing identity through this creation endpoint.
    if (typeof orderId !== 'string' || !orderId.trim() || typeof invoiceNumber !== 'string' || !invoiceNumber.trim()) {
      return res.status(400).json({ success: false, message: 'Identitas pesanan tidak valid.' });
    }
    const existingOrders = Array.isArray(state?.orders) ? state.orders : Object.values(state?.orders || {});
    const collision = existingOrders.some((o: any) => o.id === orderId || o.invoiceNumber === invoiceNumber)
      || await prisma.order.findFirst({ where: { OR: [{ id: orderId }, { invoiceNumber }] } })
      || await supabaseService.getOrder(orderId, false)
      || await supabaseService.getOrder(invoiceNumber, false);
    if (collision) return res.status(409).json({ success: false, message: 'ID atau nomor invoice pesanan sudah digunakan.' });

    const accessToken = typeof guestAccessToken === 'string' && guestAccessToken.length >= 20 ? guestAccessToken : `gst_${crypto.randomBytes(24).toString('hex')}`;
    const reservation = {
      id: orderId, invoiceNumber, userId: member.id, guestAccessToken: accessToken,
      productId: product.id, variantId: selectedVariantId, variantName: selectedVariantName,
      targetDestination: targetDestination.trim(), customerName: customerName || 'Pelanggan Wayahe', customerPhone: customerPhone || targetDestination,
      customerEmail: customerEmail || '', category: product.categoryId || 'PULSA', subtotal, adminFee, discount, totalAmount,
      promoCode: promoCode || '', deliveryMethod: product.deliveryMethod || 'INSTANT_ROUTER_INJECTION',
      paymentStatus: 'FAILED', fulfillmentStatus: 'NOT_STARTED', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    // Durable insert-only reservations close concurrent races before payment/provider work.
    const reserved = await mongoDbService.createOrder(reservation);
    if (!reserved.success) return res.status(reserved.conflict ? 409 : 503).json({ success: false, message: reserved.conflict ? 'ID atau nomor invoice pesanan sudah digunakan.' : 'Database reservasi pesanan tidak tersedia.' });
    await supabaseService.saveOrder(reservation, true);
    const { userId: _owner, productId: _product, variantId: _variant, variantName: _variantName, createdAt: _created, updatedAt: _updated, ...prismaReservation } = reservation as any;
    await prisma.order.create({ data: { ...prismaReservation, idempotencyKey: idempotencyKey || invoiceNumber } });

    // Generate Payment Session (QRIS atau Virtual Account sesuai pilihan pembeli)
    const paymentResult = await createPaymentSession({
      orderId: invoiceNumber,
      grossAmount: totalAmount,
      customerName: customerName || 'Pelanggan Wayahe',
      customerEmail,
      customerPhone: customerPhone || targetDestination,
      preferredGateway: activeGateway,
      // 'qris' (default) atau 'va:<kode bank>' / '<bank>_va' bila pembeli memilih VA.
      paymentMethod: req.body.paymentMethod || req.body.paymentChannel,
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
      userId: member.id,
      invoiceNumber,
      guestAccessToken: accessToken,
      targetDestination: targetDestination.trim(),
      customerName: customerName || 'Pelanggan Wayahe',
      customerPhone: customerPhone || targetDestination,
      customerEmail: customerEmail || '',
      productId: product.id,
      variantId: selectedVariantId, variantName: selectedVariantName,
      productName: product.name,
      buyerSkuCode: (product as any).supplierSku || (product as any).sku || req.body.supplierSku || req.body.sku || req.body.buyerSkuCode || '',
      supplierSku: (product as any).supplierSku || (product as any).sku || '',
      sku: (product as any).sku || (product as any).supplierSku || '',
      category: product.categoryId || 'PULSA',
      items: [
        {
          productId: product.id,
          variantId: selectedVariantId, variantName: selectedVariantName,
          productName: product.name,
          category: product.categoryId || 'PULSA',
          price: product.sellingPrice,
          sellingPrice: product.sellingPrice,
          provider: product.provider,
          deliveryMethod: product.deliveryMethod,
          iconUrl: product.iconUrl,
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
      paymentMethod: paymentResult.vaNumber
        ? `VA ${paymentResult.vaBankName || paymentResult.vaBankCode || ''}`.trim()
        : 'QRIS',
      gatewayRefId: paymentResult.token,
      qrString: paymentResult.qrString,
      paymentLink: paymentResult.redirectUrl,
      vaNumber: paymentResult.vaNumber,
      vaBankCode: paymentResult.vaBankCode,
      vaBankName: paymentResult.vaBankName,
      vaPartnerReff: paymentResult.partnerReff,
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

    // 3. Update only the Prisma identity reserved before payment generation.
    await prisma.order.update({
      where: { id: formattedOrder.id },
      data: {
        paymentStatus: 'PENDING', fulfillmentStatus: 'NOT_STARTED',
        paymentMethod: formattedOrder.paymentMethod,
        gatewayRefId: paymentResult.token,
        qrString: paymentResult.qrString, paymentLink: paymentResult.redirectUrl,
        vaNumber: paymentResult.vaNumber, vaBankCode: paymentResult.vaBankCode,
        vaBankName: paymentResult.vaBankName, vaPartnerReff: paymentResult.partnerReff,
        fee: paymentResult.fee || 0, totalPayment: paymentResult.totalPayment || totalAmount,
      },
    });

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
      gatewayRefId: paymentResult.token,
      paymentGateway: paymentResult.gateway,
      paymentLink: paymentResult.redirectUrl,
      qrString: paymentResult.qrString,
      qrImage: paymentResult.qrImage,
      vaNumber: paymentResult.vaNumber,
      vaBankCode: paymentResult.vaBankCode,
      vaBankName: paymentResult.vaBankName,
      vaPartnerReff: paymentResult.partnerReff,
      fee: paymentResult.fee || 0,
      totalPayment: paymentResult.totalPayment || totalAmount,
      expiredAt: paymentResult.expiredAt,
      isDynamic: paymentResult.isDynamic,
      isSandbox: paymentResult.isSandbox,
    });
  } catch (error: any) {
    if (['P2002', '23505', 11000].includes(error.code)) return res.status(409).json({ success: false, message: 'ID atau nomor invoice pesanan sudah digunakan.' });
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

async function canReadOrder(req: Request, order: any): Promise<boolean> {
  if (verifyAdminSession(req)) return true;
  const client = await mongoDbService.getClient();
  if (!client) return false;
  const canonical = await client.db(mongoDbService.getPrimaryDbName()).collection(mongoDbService.getTransCollectionName() || 'orders').findOne({ id: order.id }, { projection: { userId: 1 } });
  const owner = canonical?.userId || order.userId;
  if (owner) {
    const member = await memberAuth.getMember(req);
    return !!member && member.id === owner;
  }
  const token = String(req.query.token || req.headers['x-guest-token'] || '');
  return token.length >= 12 && typeof order.guestAccessToken === 'string' && sameSecret(token, order.guestAccessToken);
}
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

    if (!await canReadOrder(req, order)) return res.status(403).json({ success: false, message: 'Akses pesanan ditolak.' });
    // canReadOrder is the sole ownership/token decision; phone is not authentication.

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
    const cleanId = String(req.params.identifier || '').trim();
    const state = await mongoDbService.getAllState();
    const orders = Array.isArray(state.orders) ? state.orders : Object.values(state.orders || {});
    const order: any = orders.find((o: any) => o.id === cleanId || o.invoiceNumber === cleanId);
    if (!order) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });
    if (!await canReadOrder(req, order)) return res.status(403).json({ success: false, message: 'Akses pesanan ditolak.' });
    if (order.paymentStatus === 'PAID') {
      return res.json({ success: true, paymentStatus: 'PAID', fulfillmentStatus: order.fulfillmentStatus, order, diagnosticCode: 'VERIFIED' });
    }
    const settings = await mongoDbService.getSettingsFromDatabase();
    const gateway = String(order.paymentGatewayProvider || settings.paymentGatewayProvider || 'QIOSPAY').toUpperCase();
    if (!settings.qiospayMerchantCode || !settings.qiospayApiKey) {
      return res.status(503).json({ success: false, message: 'Konfigurasi gateway di dashboard admin belum lengkap.' });
    }
    const result = await qiospayService.checkAndReconcileOrderStatus(order.id, prisma, fulfillmentService, settings.qiospayMerchantCode, settings.qiospayApiKey);
    return res.json(result);
  } catch (error: any) {
    return res.status(503).json({ success: false, message: 'Status pembayaran belum dapat diverifikasi. Silakan coba lagi.' });
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

    // Read canonical Mongo/local state first so a stale mirror cannot hide SKU or supplier results.
    const state = await mongoDbService.getAllState();
    const ordersList = Array.isArray(state?.orders) ? state.orders : Object.values(state?.orders || {});
    let order: any = ordersList.find((o: any) =>
      o.id === cleanRef || o.invoiceNumber === cleanRef || o.supplierRefId === cleanRef
      || o.invoiceNumber?.toLowerCase() === cleanRef.toLowerCase());
    if (!order) {
      try {
        order = await prisma.order.findFirst({
          where: { OR: [
            { id: cleanRef }, { invoiceNumber: cleanRef }, { supplierRefId: cleanRef },
            { invoiceNumber: cleanRef.replace(/^WD-/, '') },
          ] },
          include: { items: true },
        });
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

    if (!await canReadOrder(req, order)) return res.status(403).json({ success: false, message: 'Akses pesanan ditolak.' });
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
app.get('/api/orders', requireAdmin, async (_req: Request, res: Response) => {
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
app.delete('/api/orders/:id', requireAdmin, async (req: Request, res: Response) => {
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
app.post('/api/orders/bulk-delete', requireAdmin, async (req: Request, res: Response) => {
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
app.all('/api/digiflazz/balance', requireAdmin, async (req: Request, res: Response) => {
  try {
    const username = (DIGIFLAZZ_CONFIG.USERNAME || '').trim();
    const apiKey = (DIGIFLAZZ_CONFIG.API_KEY || '').trim();

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
app.post('/api/digiflazz/transaction', requireAdmin, async (req: Request, res: Response) => {
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
export async function syncDigiflazzCatalog(category?: 'game'): Promise<{ success: boolean; count: number; added?: number; updated?: number; message: string; timestamp: string }> {
  try {
    const upstream = await digiflazzService.fetchPriceList({ allowCache: false });
    const rawList = category === 'game' ? upstream.filter(p => ['game', 'games'].includes(String(p.category).toLowerCase())) : upstream;
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
      (category === 'game' && p.categoryId !== 'game') ||
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
    const existingIds = new Set(currentProducts.map((p: any) => p.id));
    const added = transformedDigiflazz.filter(p => !existingIds.has(p.id)).length;
    const updated = transformedDigiflazz.length - added;

    // Simpan ke MongoDB / Local FileDb
    if (!await mongoDbService.syncEntity('products', mergedProducts)) throw new Error('Database product sync rejected');
    
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
      added,
      updated,
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

app.all(['/api/digiflazz/sync-products', '/api/digiflazz/sync'], requireAdmin, async (req: Request, res: Response) => {
  const result = await syncDigiflazzCatalog(req.query.category === 'game' ? 'game' : undefined);
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
app.get('/api/digiflazz/detect-live-ip', requireAdmin, async (req: Request, res: Response) => {
  try {
    const liveIp = await outboundIpService.detectLiveVpsIp();
    const configuredWhitelistIp = DIGIFLAZZ_CONFIG.WHITELIST_IP.trim();
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

app.get('/api/digiflazz/ip-status', requireAdmin, async (req: Request, res: Response) => {
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

// Read-only fresh upstream catalog verification. No product/order/cache writes.
app.get('/api/digiflazz/game-status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const rows = await digiflazzService.fetchPriceList({ allowCache: false });
    const games = rows.filter(p => ['game', 'games'].includes(String(p.category).toLowerCase()));
    const client = await mongoDbService.getClient();
    if (!client) throw new Error('Database products unavailable');
    const savedGames = await client.db(mongoDbService.getPrimaryDbName()).collection('products')
      .find({ categoryId: 'game' }, { projection: { supplierSku: 1, sku: 1 } }).toArray();
    const upstreamBySku = new Map(games.map(p => [p.buyer_sku_code, p]));
    const matched = savedGames.map((p: any) => upstreamBySku.get(p.supplierSku || p.sku)).filter(Boolean);
    const available = (p: any) => p.buyer_product_status === true && p.seller_product_status === true && (p.unlimited_stock === true || Number(p.stock) > 0);
    return res.json({ success: true, data: {
      source: 'LIVE_DIGIFLAZZ', connectionStatus: 'CONNECTED', checkedAt: new Date().toISOString(),
      upstreamGameCount: games.length, upstreamAvailableCount: games.filter(available).length,
      savedGameCount: savedGames.length, matchedSavedGameCount: matched.length,
      availableSavedGameCount: matched.filter(available).length,
      fulfillmentVerified: false,
    }, message: 'Katalog game terverifikasi langsung. Transaksi topup berbayar belum diuji.' });
  } catch (err: any) {
    return res.status(502).json({ success: false, data: { source: 'LIVE_DIGIFLAZZ', connectionStatus: 'FAILED', fulfillmentVerified: false }, message: err.message });
  }
});

app.post('/api/settings/digiflazz', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { username, mode, productionKey, developmentKey, webhookSecret, webhookUrl, whitelistIp, outboundProxy } = req.body || {};
    
    const currentSettings = await mongoDbService.getSettingsFromDatabase();
    const existingMode = currentSettings.digiflazzMode;
    
    const settingsToSave: Record<string, any> = {};
    
    if (username !== undefined) settingsToSave.digiflazzUsername = String(username || '').trim();
    
    // Mode tidak bisa diubah setelah diset pertama kali (immutable setelah diset)
    if (mode !== undefined) {
      const newMode = String(mode || 'PRODUCTION').toUpperCase() === 'DEVELOPMENT' ? 'DEVELOPMENT' : 'PRODUCTION';
      if (existingMode && existingMode !== newMode) {
        return res.status(400).json({ 
          success: false, 
          message: `Mode Digiflazz sudah diset ke "${existingMode}" dan tidak boleh diubah. Hubungi administrator untuk reset.` 
        });
      }
      settingsToSave.digiflazzMode = newMode;
    }
    
    if (productionKey !== undefined) settingsToSave.digiflazzProductionKey = String(productionKey || '').trim();
    if (developmentKey !== undefined) settingsToSave.digiflazzDevelopmentKey = String(developmentKey || '').trim();
    if (webhookSecret !== undefined) settingsToSave.digiflazzWebhookSecret = String(webhookSecret || '').trim();
    if (webhookUrl !== undefined) settingsToSave.digiflazzWebhookUrl = String(webhookUrl || '').trim();
    if (whitelistIp !== undefined) settingsToSave.digiflazzWhitelistIp = String(whitelistIp || '').trim();
    if (outboundProxy !== undefined) settingsToSave.digiflazzOutboundProxy = String(outboundProxy || '').trim();
    
    if (Object.keys(settingsToSave).length === 0) {
      return res.status(400).json({ success: false, message: 'Minimal satu field Digiflazz harus diisi.' });
    }
    
    const syncOk = await mongoDbService.syncEntity('settings', settingsToSave);
    if (!syncOk) {
      return res.status(503).json({ success: false, message: 'Database tidak tersedia. Konfigurasi Digiflazz belum disimpan.' });
    }
    
    await hydrateDigiflazzRuntime();
    syncDigiflazzCatalog().catch((e: any) => console.log('Settings update Digiflazz sync note:', e.message));
    
    return res.json({ 
      success: true, 
      message: 'Konfigurasi Digiflazz tersimpan ke database dan dimuat ulang. Mode tidak bisa diubah setelah diset.' 
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/settings/digiflazz', requireAdmin, async (req: Request, res: Response) => {
  try {
    const settings = await mongoDbService.getSettingsFromDatabase();
    const hasUsername = Boolean(settings.digiflazzUsername || settings.digiflazzUser);
    const hasApiKey = Boolean(settings.digiflazzProductionKey || settings.digiflazzDevelopmentKey || settings.digiflazzApiKey);
    const hasSecret = Boolean(settings.digiflazzWebhookSecret || settings.digiflazzSecretCode);
    const testing = settings.digiflazzMode === 'DEVELOPMENT';
    
    return res.json({
      success: true,
      data: {
        username: settings.digiflazzUsername || settings.digiflazzUser || '',
        mode: settings.digiflazzMode || 'PRODUCTION',
        hasProductionKey: Boolean(settings.digiflazzProductionKey || settings.digiflazzApiKey),
        hasDevelopmentKey: Boolean(settings.digiflazzDevelopmentKey),
        hasWebhookSecret: Boolean(settings.digiflazzWebhookSecret || settings.digiflazzSecretCode),
        webhookUrl: settings.digiflazzWebhookUrl || '',
        whitelistIp: settings.digiflazzWhitelistIp || '',
        outboundProxy: settings.digiflazzOutboundProxy || '',
        testing: testing,
      },
      configured: hasUsername && hasApiKey && hasSecret,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/digiflazz/update-ip-config', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { whitelistIp, outboundProxy } = req.body || {};
    const settings: Record<string, string> = {};
    if (whitelistIp !== undefined) settings.digiflazzWhitelistIp = String(whitelistIp).trim();
    if (outboundProxy !== undefined) settings.digiflazzOutboundProxy = String(outboundProxy).trim();
    if (!await mongoDbService.syncEntity('settings', settings)) {
      return res.status(503).json({ success: false, message: 'Database tidak tersedia. Konfigurasi jaringan belum disimpan.' });
    }
    await hydrateDigiflazzRuntime();
    syncDigiflazzCatalog().catch((e: any) => console.log('Settings update Digiflazz sync note:', e.message));
    return res.json({ success: true, message: 'Konfigurasi jaringan Digiflazz tersimpan di database. Daftarkan IP whitelist secara terpisah di dashboard Digiflazz.' });
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

// ── QIOSPAY CONFIG (persist ke MongoDB, tidak hilang saat reload) ──────────────
app.get('/api/settings/qiospay', requireAdmin, async (req: Request, res: Response) => {
  try {
    const settings = await mongoDbService.getSettingsFromDatabase();
    const hasMerchantCode = Boolean(settings.qiospayMerchantCode || settings.qiospayMerchantKey);
    const hasApiKey = Boolean(settings.qiospayApiKey);
    const hasSecret = Boolean(settings.qiospaySecretKey || settings.qiospaySecretCode || settings.qiospayCallbackSecret);

    return res.json({
      success: true,
      data: {
        merchantCode: settings.qiospayMerchantCode || settings.qiospayMerchantKey || '',
        apiKey: settings.qiospayApiKey || '',
        hasProductionKey: hasMerchantCode && hasApiKey,
        expectedNmid: settings.qiospayExpectedNmid || settings.qiospayNmid || '',
        hasSecret,
        adminToken: settings.qiospayAdminToken || '',
        merchantName: settings.qiospayMerchantName || 'WAYAHE DIGITAL',
        qrString: settings.qiospayQrisString || settings.qiospayQrString || '',
        localDynamicConfirmed: settings.qiospayLocalDynamicConfirmed === 'false' ? false : true,
        testing: settings.qiospayMode === 'DEVELOPMENT',
        h2hUsername: settings.qiospayH2hUsername || settings.qiospayUsername || '',
        h2hPin: settings.qiospayH2hPin || settings.qiospayUsApikey || '',
        vaEnabled: settings.qiospayVaEnabled === 'false' ? false : true,
        vaCallbackUrl: settings.qiospayVaCallbackUrl || '',
        vaBanks: settings.qiospayVaBanks ? String(settings.qiospayVaBanks).split(',').filter(Boolean) : ['BRI:002','BNI:009','Mandiri:008','BSI:451'],
      },
      configured: hasMerchantCode && hasApiKey,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/settings/qiospay', requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      merchantCode, apiKey, expectedNmid, callbackSecret, adminToken, merchantName,
      qrString, localDynamicConfirmed, mode, h2hUsername, h2hPin,
      vaEnabled, vaCallbackUrl, vaBanks,
    } = req.body || {};

    const settingsToSave: Record<string, any> = {};

    // Mode tidak bisa diubah setelah diset pertama kali (immutable setelah diset)
    if (mode !== undefined) {
      const current = await mongoDbService.getSettingsFromDatabase();
      const existingMode = current.qiospayMode;
      const newMode = String(mode || 'PRODUCTION').toUpperCase() === 'DEVELOPMENT' ? 'DEVELOPMENT' : 'PRODUCTION';
      if (existingMode && existingMode !== newMode) {
        return res.status(400).json({
          success: false,
          message: `Mode Qiospay sudah diset ke "${existingMode}" dan tidak boleh diubah. Hubungi administrator untuk reset.`
        });
      }
      settingsToSave.qiospayMode = newMode;
    }

    if (merchantCode !== undefined) settingsToSave.qiospayMerchantCode = String(merchantCode || '').trim();
    if (apiKey !== undefined) settingsToSave.qiospayApiKey = String(apiKey || '').trim();
    if (expectedNmid !== undefined) settingsToSave.qiospayExpectedNmid = String(expectedNmid || '').trim();
    if (callbackSecret !== undefined) settingsToSave.qiospayCallbackSecret = String(callbackSecret || '').trim();
    if (adminToken !== undefined) settingsToSave.qiospayAdminToken = String(adminToken || '').trim();
    if (merchantName !== undefined) settingsToSave.qiospayMerchantName = String(merchantName || 'WAYAHE DIGITAL').trim();
    if (qrString !== undefined) settingsToSave.qiospayQrisString = String(qrString || '').trim();
    if (localDynamicConfirmed !== undefined) settingsToSave.qiospayLocalDynamicConfirmed = String(!!localDynamicConfirmed);
    if (h2hUsername !== undefined) settingsToSave.qiospayH2hUsername = String(h2hUsername || '').trim();
    if (h2hPin !== undefined) settingsToSave.qiospayH2hPin = String(h2hPin || '').trim();
    if (vaEnabled !== undefined) settingsToSave.qiospayVaEnabled = String(!!vaEnabled);
    if (vaCallbackUrl !== undefined) settingsToSave.qiospayVaCallbackUrl = String(vaCallbackUrl || '').trim();
    if (vaBanks !== undefined) settingsToSave.qiospayVaBanks = Array.isArray(vaBanks) ? vaBanks.join(',') : String(vaBanks || '').trim();

    if (Object.keys(settingsToSave).length === 0) {
      return res.status(400).json({ success: false, message: 'Minimal satu field Qiospay harus diisi.' });
    }

    const syncOk = await mongoDbService.syncEntity('settings', settingsToSave);
    if (!syncOk) {
      return res.status(503).json({ success: false, message: 'Database tidak tersedia. Konfigurasi Qiospay belum disimpan.' });
    }

    await hydrateQiospayRuntime();

    return res.json({
      success: true,
      message: 'Konfigurasi Qiospay tersimpan ke database dan dimuat ulang. Mode tidak bisa diubah setelah diset.'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post(['/api/orders/:id/fulfill', '/api/fulfillment/fulfill'], requireAdmin, async (req: Request, res: Response) => {
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
    virtual_account: {
      enabled: qiospayService.isVaConfigured(),
      banks: qiospayService.listVaBanks(),
      note: qiospayService.isVaConfigured()
        ? 'VA H2H aktif'
        : 'VA H2H belum aktif: isi QIOSPAY_H2H_USERNAME & QIOSPAY_H2H_PIN setelah disetujui di dashboard Qiospay.',
    },
  });
});

// GET /api/payment/methods — daftar channel pembayaran dari SERVER.
// UI tidak boleh menebak daftar channel: channel VA Qiospay hanya muncul tersedia
// setelah kredensial H2H ada, supaya pembeli tidak pernah diarahkan ke VA yang gagal.
app.get('/api/payment/methods', (req: Request, res: Response) => {
  try {
    const channels = listPaymentChannels();
    res.json({
      success: true,
      activeGateway: detectActiveGateway(),
      channels,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message, channels: [] });
  }
});

// ── Callback Virtual Account Qiospay ────────────────────────────────────────
// Qiospay mengirim POST ke url_callback yang dilampirkan saat Create VA dan
// WAJIB dibalas HTTP 200. Pencocokan memakai partner_reff (identitas eksplisit).
const handleQiospayVaCallback = async (req: Request, res: Response) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) {
        try { const qs = await import('node:querystring'); body = qs.parse(body); } catch (__) {}
      }
    }
    const { statusCode, response } = await qiospayService.processVaCallback(body, prisma, fulfillmentService);
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.end(JSON.stringify(response));
  } catch (error: any) {
    console.error('[Qiospay VA Callback Error]:', error.message);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ status: 'reject', message: 'Terjadi kesalahan backend' }));
    }
  }
};
app.get('/api/webhook/qiospay-va', (req, res) => res.json({ status: 'ready', message: 'Qiospay VA webhook endpoint active' }));
app.post('/api/webhook/qiospay-va', handleQiospayVaCallback);
app.post('/api/webhook/callback_secret/qiospay-va', handleQiospayVaCallback);
app.post('/api/webhook/callback_scret/qiospay-va', handleQiospayVaCallback);

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
// ── TELEGRAM BOT STORE & INTEGRATION ENDPOINTS ────────────────
// ══════════════════════════════════════════════════════════════

// 1. Webhook endpoint (POST /api/telegram/webhook & /webhook/telegram)
app.post(['/api/telegram/webhook', '/webhook/telegram', '/api/telegram/bot'], async (req: Request, res: Response) => {
  try {
    await telegramBotService.handleUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('[Telegram Webhook Error]:', err.message);
    res.status(200).json({ ok: false, error: err.message });
  }
});

// GET ping handler for telegram webhook testing
app.get(['/api/telegram/webhook', '/webhook/telegram'], (_req: Request, res: Response) => {
  res.json({ status: 'ready', message: 'Telegram Store Bot Webhook endpoint active' });
});

// 2. Get Telegram Bot Info & Status (requireAdmin)
app.get('/api/telegram/info', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const info = await telegramBotService.getMe();
    const config = telegramBotService.getConfig();
    res.json({
      success: Boolean(info?.ok),
      bot: info?.result || null,
      config: {
        isConfigured: telegramBotService.isConfigured(),
        chatId: config.chatId,
        botUsername: config.botUsername,
        storeEnabled: config.storeEnabled,
        storeMode: config.storeMode,
        webhookUrl: config.webhookUrl,
        webAppUrl: config.webAppUrl,
        csUsername: config.csUsername,
        channelUrl: config.channelUrl,
      },
      description: info?.description || (info?.ok ? 'Bot Telegram terhubung' : 'Token bot tidak valid'),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Set Webhook URL to Telegram API (requireAdmin)
app.post('/api/telegram/set-webhook', requireAdmin, async (req: Request, res: Response) => {
  try {
    const url = req.body?.url || telegramBotService.getConfig().webhookUrl;
    if (!url) return res.status(400).json({ success: false, message: 'URL webhook wajib diisi' });
    const result = await telegramBotService.setWebhook(url);
    res.json({ success: Boolean(result?.ok), result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Send Test Message to Admin (requireAdmin)
app.post('/api/telegram/test-message', requireAdmin, async (req: Request, res: Response) => {
  try {
    const targetChatId = req.body?.chatId || telegramBotService.getConfig().chatId;
    if (!targetChatId) return res.status(400).json({ success: false, message: 'Admin Chat ID belum diisi' });
    const config = telegramBotService.getConfig();
    const testMsg =
      `🚀 <b>TEST KONEKSI TOKO BOT TELEGRAM WAYAHEDIGITAL</b>\n\n` +
      `Halo Admin! Bot Toko Telegram berhasil terhubung ke server website.\n\n` +
      `⚡ <b>Layanan Siap Melayani Pembeli:</b>\n` +
      `• Auto Order Realtime dari Katalog Website\n` +
      `• QRIS Otomatis Terbit di Chat Pembeli\n` +
      `• Broadcast Notifikasi Pembayaran Lunas\n` +
      `• Mini App WebApp Terintegrasi\n\n` +
      `Waktu Uji: <code>${new Date().toLocaleString('id-ID')}</code>`;

    const result = await telegramBotService.sendMessage(targetChatId, testMsg, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Buka Menu Toko', callback_data: 'nav_home' }],
          [{ text: '🌐 Buka WebApp Store', url: config.webAppUrl || 'https://wayahetopup.my.id' }],
        ],
      },
    });
    res.json({ success: Boolean(result?.ok), result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Toggle Polling Mode (requireAdmin)
app.post('/api/telegram/toggle-polling', requireAdmin, async (req: Request, res: Response) => {
  try {
    const active = Boolean(req.body?.active);
    if (active) {
      await telegramBotService.startPolling();
    } else {
      telegramBotService.stopPolling();
    }
    res.json({ success: true, isPolling: active });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
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

// Read-only live mutations use authenticated server-side DB configuration.
async function readQiospayMutasi(_req: Request, res: Response) {
  try {
    const settings = await mongoDbService.getSettingsFromDatabase();
    if (typeof settings.qiospayMerchantCode !== 'string' || !settings.qiospayMerchantCode.trim() || typeof settings.qiospayApiKey !== 'string' || !settings.qiospayApiKey.trim()) {
      return res.status(422).json({ success: false, diagnosticCode: 'QIOSPAY_CONFIG_INCOMPLETE', message: 'Simpan Merchant Code dan API Key Qiospay lengkap di pengaturan database sebelum membaca mutasi.' });
    }
    const result = await qiospayService.getMutasi(settings.qiospayMerchantCode, settings.qiospayApiKey, fetch, true, true);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(result.statusCode).json(result.data);
  } catch (_) { return res.status(503).json({ success: false, message: 'Database konfigurasi Qiospay tidak tersedia.' }); }
}
app.get('/api/qiospay/mutasi', requireAdmin, readQiospayMutasi);
app.get('/api/admin/qiospay/mutasi', requireAdmin, readQiospayMutasi);
// Do not expose credentials in request URLs or permit arbitrary provider feeds.
app.get('/api/qiospay/mutasi/:merchantCode/:apiKey', requireAdmin, (_req: Request, res: Response) => res.status(410).json({ success: false, message: 'Gunakan endpoint mutasi dengan konfigurasi server.' }));
app.post('/api/qiospay/sync', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const settings = await mongoDbService.getSettingsFromDatabase();
    if (typeof settings.qiospayMerchantCode !== 'string' || !settings.qiospayMerchantCode.trim() || typeof settings.qiospayApiKey !== 'string' || !settings.qiospayApiKey.trim()) {
      return res.status(422).json({ success: false, diagnosticCode: 'QIOSPAY_CONFIG_INCOMPLETE', message: 'Simpan Merchant Code dan API Key Qiospay lengkap di pengaturan database sebelum sinkronisasi.' });
    }
    const result = await qiospayService.syncAllPendingOrders(prisma, fulfillmentService, settings.qiospayMerchantCode, settings.qiospayApiKey, true);
    return res.status(result.success ? 200 : result.diagnosticCode === 'UPSTREAM_AUTH_REJECTED' ? 422 : 502).json(result);
  } catch (_) { return res.status(503).json({ success: false, message: 'Sinkronisasi Qiospay tidak tersedia; status pesanan tidak dikonfirmasi.' }); }
});

// 11. NGROK TUNNEL CONTROLLERS (Webhooks Exposer)
app.get('/api/tunnel/status', requireAdmin, (req: Request, res: Response) => {
  res.json(ngrokService.getStatus());
});

app.post('/api/tunnel/start', requireAdmin, async (req: Request, res: Response) => {
  const { authtoken, domain } = req.body || {};
  const status = await ngrokService.start(Number(PORT), authtoken, domain);
  res.json(status);
});

app.post('/api/tunnel/stop', requireAdmin, async (req: Request, res: Response) => {
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

app.post('/api/supabase/test', requireAdmin, async (req: Request, res: Response) => {
  const { url, key } = req.body || {};
  const result = await supabaseService.testConnection(url, key);
  res.json(result);
});

// Permanently remove arbitrary database execution from the application surface.
// A frontend-distributed token cannot authorize database console access.
app.all(['/api/supabase/run-query', '/api/supabase/exec-sql', '/api/mongodb/run-query'], (_req: Request, res: Response) => {
  res.status(410).json({ success: false, message: 'Database console endpoints are disabled' });
});

app.get('/api/supabase/sql-schema', (req: Request, res: Response) => {
  res.json({ schema: supabaseService.getSqlSchema() });
});

const ADMIN_SESSION_COOKIE = 'wd_admin_session';
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function readCookie(req: Request, name: string): string {
  const raw = String(req.headers.cookie || '');
  const part = raw.split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : '';
}
function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a || '');
  const y = Buffer.from(b || '');
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}
function adminSessionSecret(): string {
  return (process.env.ADMIN_SESSION_SECRET || CONSOLE_CONFIG.ADMIN_TOKEN || process.env.ADMIN_TOKEN || '').trim();
}
function createAdminSession(username: string): string {
  const payload = Buffer.from(JSON.stringify({ username, exp: Date.now() + ADMIN_SESSION_TTL_MS })).toString('base64url');
  const signature = crypto.createHmac('sha256', adminSessionSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
function verifyAdminSession(req: Request): boolean {
  const value = readCookie(req, ADMIN_SESSION_COOKIE);
  const [payload, signature] = value.split('.');
  if (!payload || !signature || !adminSessionSecret()) return false;
  const expected = crypto.createHmac('sha256', adminSessionSecret()).update(payload).digest('base64url');
  if (!sameSecret(signature, expected)) return false;
  try { return Number(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).exp) > Date.now(); } catch { return false; }
}
function requireAdmin(req: Request, res: Response, next: any) {
  if (verifyAdminSession(req)) return next();
  return res.status(401).json({ success: false, message: 'Unauthorized' });
}

app.get('/api/provider/catalog', requireAdmin, async (req: Request, res: Response) => {
  const category = String(req.query.category || '').trim().toLowerCase();
  if (!['premium', 'smm', 'games'].includes(category)) {
    return res.status(400).json({ success: false, message: 'Kategori Xaviera tidak valid.' });
  }
  try {
    const config = loadXavieraConfig();
    const result = category === 'premium'
      ? { products: await xavieraProducts(config) }
      : category === 'smm'
        ? { services: await xavieraSmmServices(config) }
        : { games: await xavieraGames(config) };
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, category, ...result });
  } catch (error: any) {
    const status = error?.status === 401 ? 503 : 502;
    console.warn(`[Xaviera catalog] ${category} request failed with status ${Number(error?.status) || 0}`);
    return res.status(status).json({ success: false, code: 'XAVIERA_CATALOG_UNAVAILABLE', message: 'Katalog Xaviera belum dapat dimuat.' });
  }
});

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
});

app.post('/api/admin/login', adminLoginLimiter, async (req: Request, res: Response) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!username || !password) return res.status(400).json({ success: false, message: 'Username dan password wajib diisi.' });
  try {
    const settings = (await mongoDbService.getAllState()).settings || {};
    const configuredUser = String(process.env.ADMIN_USERNAME || settings.adminUsername || '').trim().toLowerCase();
    const configuredPassword = String(process.env.ADMIN_PASSWORD || settings.adminPassword || '');
    if (!configuredUser || !configuredPassword || !adminSessionSecret()) return res.status(503).json({ success: false, message: 'Autentikasi admin belum dikonfigurasi.' });
    if (!sameSecret(username, configuredUser) || !sameSecret(password, configuredPassword)) return res.status(401).json({ success: false, message: 'Kredensial admin tidak valid.' });
    const secure = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
    res.setHeader('Set-Cookie', `${ADMIN_SESSION_COOKIE}=${createAdminSession(configuredUser)}; Path=/; Max-Age=${Math.floor(ADMIN_SESSION_TTL_MS / 1000)}; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`);
    return res.json({ success: true, data: { username: configuredUser, name: settings.adminName || 'Administrator', email: settings.supportEmail || '' } });
  } catch {
    return res.status(500).json({ success: false, message: 'Login admin gagal diproses.' });
  }
});
app.post('/api/admin/logout', (_req: Request, res: Response) => {
  res.setHeader('Set-Cookie', `${ADMIN_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict`);
  res.json({ success: true });
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

app.post('/api/mongodb/test', requireAdmin, async (req: Request, res: Response) => {
  const { uri, dbName, dbNameTrans } = req.body || {};
  const result = await mongoDbService.testConnection(uri, dbName, dbNameTrans);
  res.json(result);
});


// 13. CLOUD DATABASE SYNCHRONIZATION (Cross-Device Realtime Sync)
// Helper: sanitasi settings agar secret tidak bocor ke publik tanpa X-Admin-Token
function isAdminRequest(req: Request): boolean {
  return verifyAdminSession(req);
}
function sanitizeSettingsForPublic(settings: any, isAdmin: boolean): any {
  return isAdmin ? settings : toPublicState({ settings }).settings;
}
app.get('/api/sync/state', async (req: Request, res: Response) => {
  try {
    const rawState = await mongoDbService.getAllState();
    const data = toPublicState(rawState);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Cloudflare-CDN-Cache-Control', 'no-store');
    res.json({ success: true, data, _sanitized: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/sync/state', requireAdmin, async (req: Request, res: Response) => {
  try {
    const fullState = req.body;
    if (fullState?.users) return res.status(400).json({ success: false, message: 'Member accounts must use authenticated member endpoints.' });
    if (fullState?.settings?.mongodbUri) {
      delete fullState.settings.mongodbUri;
    }
    const success = await mongoDbService.syncAllState(fullState);
    res.json({ success, message: success ? 'Data tersinkronisasi ke MongoDB Cloud' : 'Disimpan di lokal' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin-only inventory hydration includes voucher codes and batch details, which
// must never be exposed from the public sync-state DTO.
app.get('/api/admin/inventory/load', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const state = await mongoDbService.getAllState();
    return res.json({ success: true, data: { products: state.products || [], wifiBatches: state.wifiBatches || [], revision: state.manualInventoryRevision || 0 } });
  } catch {
    return res.status(503).json({ success: false, message: 'Stok database belum dapat dimuat.' });
  }
});

// Database-authoritative save for manual product stock and WiFi voucher batches.
// The browser updates its local mirror only after this endpoint confirms MongoDB.
app.post('/api/admin/inventory/save', requireAdmin, async (req: Request, res: Response) => {
  try {
    let products = Array.isArray(req.body?.products) ? req.body.products : null;
    const wifiBatches = Array.isArray(req.body?.wifiBatches) ? req.body.wifiBatches : null;
    if (!products || !wifiBatches) return res.status(400).json({ success: false, message: 'Produk dan batch voucher harus berupa daftar.' });

    // Manual-stock screens must never erase supplier catalog items that were not
    // loaded into a browser session.
    const current = await mongoDbService.getAllState();
    const incomingIds = new Set(products.map((product: any) => product?.id).filter(Boolean));
    const supplierProducts = (current.products || []).filter((product: any) =>
      (product.isDigiflazzSynced || product.sellerName) && !incomingIds.has(product.id)
    );
    products = [...products, ...supplierProducts];

    const revision = req.body?.revision;
    if (!Number.isSafeInteger(revision) || revision < 0) return res.status(400).json({ success: false, message: 'Muat ulang inventori sebelum menyimpan (revisi wajib diisi).' });
    const result = await mongoDbService.saveManualInventory(products, wifiBatches, revision);
    if (result.conflict) return res.status(409).json({ success: false, message: 'Inventori berubah. Muat ulang stok sebelum menyimpan draf.' });
    if (!result.success || !result.data) {
      return res.status(503).json({ success: false, message: 'Stok belum tersimpan di database. Tidak ada perubahan lokal yang dikonfirmasi.' });
    }
    return res.json({ success: true, data: result.data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Gagal menyimpan stok ke database.' });
  }
});

app.post('/api/sync/entity', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { entity, data } = req.body || {};
    if (!entity) return res.status(400).json({ success: false, message: 'Entity name required' });
    if (entity === 'users') return res.status(400).json({ success: false, message: 'Bulk member writes are disabled.' });
    
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

app.get('/api/admin/members', requireAdmin, async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const client = await mongoDbService.getClient();
    if (!client) throw new Error('unavailable');
    const users = await client.db(mongoDbService.getPrimaryDbName()).collection('users').find({}, { projection: { password: 0, passwordHash: 0 } }).toArray();
    return res.json({ success: true, data: users.map(memberDto) });
  } catch { return res.status(503).json({ success: false, message: 'Database member tidak tersedia.' }); }
});
// Admin settings load — mirrors serverless fallback semantics (sanitized when not admin)
app.get('/api/settings/load', async (req: Request, res: Response) => {
  try {
    const isAdmin = isAdminRequest(req);
    const settings = isAdmin ? await mongoDbService.getSettingsFromDatabase() : (await mongoDbService.getAllState()).settings || {};
    if (!isAdmin) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      return res.json({ success: true, _sanitized: true, data: sanitizeSettingsForPublic(settings, false) });
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json({ success: true, _sanitized: false, data: settings });
  } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

// Save Settings and persist to backend/.env + Supabase
app.post('/api/settings/save', requireAdmin, async (req: Request, res: Response) => {
  try {
    const settings = mergeSettings({}, req.body.settings || req.body || {});
    // Reject before changing files or runtime services: MongoDB is the commit boundary.
    const syncOk = await mongoDbService.syncEntity('settings', settings);
    if (!syncOk) return res.status(503).json({ success: false, mongoPersisted: false, message: 'Database tidak tersedia. Pengaturan belum disimpan.' });
    await hydrateDigiflazzRuntime();
    syncDigiflazzCatalog().catch((e: any) => console.log('Settings update Digiflazz sync note:', e.message));
    // SUPABASE DISABLED — tidak lagi simpan SUPABASE_* ke .env (MongoDB aktif)
    try {
      const envPath = resolveEnvPath();
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        // Simpan SUPABASE Config ke .env dan CONSOLE_CONFIG jika dikirim
        if (settings.supabaseUrl !== undefined && typeof settings.supabaseUrl === 'string') {
          const cleanUrl = sanitizeSupabaseUrl(settings.supabaseUrl);
          CONSOLE_CONFIG.SUPABASE_URL = cleanUrl;
          if (envContent.includes('SUPABASE_URL=')) {
            envContent = envContent.replace(/SUPABASE_URL=.*/, `SUPABASE_URL="${cleanUrl}"`);
          } else {
            envContent += `\nSUPABASE_URL="${cleanUrl}"`;
          }
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
        }

        if (settings.supabaseDbUrl !== undefined && typeof settings.supabaseDbUrl === 'string') {
          CONSOLE_CONFIG.SUPABASE_DB_URL = settings.supabaseDbUrl.trim();
          if (envContent.includes('SUPABASE_DB_URL=')) {
            envContent = envContent.replace(/SUPABASE_DB_URL=.*/, `SUPABASE_DB_URL="${settings.supabaseDbUrl.trim()}"`);
          } else {
            envContent += `\nSUPABASE_DB_URL="${settings.supabaseDbUrl.trim()}"`;
          }
        }
      }

      // Refresh memory configuration Digiflazz Service
      digiflazzService.refreshConfig({
        username: DIGIFLAZZ_CONFIG.USERNAME,
        apiKey: DIGIFLAZZ_CONFIG.API_KEY,
        webhookSecret: DIGIFLAZZ_CONFIG.WEBHOOK_SECRET,
        webhookUrl: DIGIFLAZZ_CONFIG.WEBHOOK_URL,
      });

      // Refresh memory configuration Telegram Bot Service
      telegramBotService.refreshConfig({
        botToken: settings.telegramBotToken || BOT_CONFIG.TELEGRAM_TOKEN,
        chatId: settings.telegramChatId || BOT_CONFIG.TELEGRAM_CHAT_ID,
        botUsername: settings.telegramBotUsername,
        storeEnabled: settings.telegramStoreEnabled !== false,
        storeMode: settings.telegramStoreMode || 'webhook',
        webhookUrl: settings.telegramWebhookUrl,
        webAppUrl: settings.telegramWebAppUrl,
        welcomeMessage: settings.telegramWelcomeMessage,
        csUsername: settings.telegramCsUsername,
        channelUrl: settings.telegramChannelUrl,
        alertsEnabled: settings.telegramAlertsEnabled !== false,
      });

      if (settings.telegramStoreMode === 'polling' && settings.telegramStoreEnabled !== false && settings.telegramBotToken) {
        await telegramBotService.registerCommands();
        await telegramBotService.startPolling();
      } else {
        telegramBotService.stopPolling();
      }
    } catch (e: any) {
      console.warn('Could not write .env file:', e.message);
    }

    const bundle = {
      ...settings,
      telegramBotToken: settings.telegramBotToken || BOT_CONFIG.TELEGRAM_TOKEN,
      chatId: settings.telegramChatId || BOT_CONFIG.TELEGRAM_CHAT_ID,
      botUsername: settings.telegramBotUsername,
      storeEnabled: settings.telegramStoreEnabled !== false,
      storeMode: settings.telegramStoreMode || 'webhook',
      webhookUrl: settings.telegramWebhookUrl,
      webAppUrl: settings.telegramWebAppUrl,
      welcomeMessage: settings.telegramWelcomeMessage,
      csUsername: settings.telegramCsUsername,
      channelUrl: settings.telegramChannelUrl,
      alertsEnabled: settings.telegramAlertsEnabled !== false,
    };
    try { telegramBotService.refreshConfig(bundle); } catch (_) {}
    if (bundle.storeMode === 'polling' && bundle.storeEnabled !== false && bundle.telegramBotToken) {
      try { await telegramBotService.registerCommands(); await telegramBotService.startPolling(); } catch (_) {}
    } else {
      try { telegramBotService.stopPolling(); } catch (_) {}
    }

    res.json({
      success: true,
      mongoPersisted: true,
      message: 'Pengaturan berhasil disimpan ke MongoDB (konfigurasi Telegram Bot di-refresh).'
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

try {
  await hydrateDigiflazzRuntime();
} catch {
  console.error('[DIGIFLAZZ CONFIG] Database unavailable; Digiflazz disabled until confirmed settings reload.');
}

try {
  await hydrateQiospayRuntime();
} catch {
  console.error('[QIOSPAY CONFIG] Database unavailable; Qiospay disabled until confirmed settings reload.');
}

try {
  let lastErr = null;
  for (let i = 0; i < 5; i++) {
    try {
      const dbSettings = await mongoDbService.getSettingsFromDatabase();
      if (dbSettings) {
        telegramBotService.refreshConfig({
          botToken: dbSettings.telegramBotToken || BOT_CONFIG.TELEGRAM_TOKEN,
          chatId: dbSettings.telegramChatId || BOT_CONFIG.TELEGRAM_CHAT_ID,
          botUsername: dbSettings.telegramBotUsername,
          storeEnabled: dbSettings.telegramStoreEnabled !== false,
          storeMode: dbSettings.telegramStoreMode || 'webhook',
          webhookUrl: dbSettings.telegramWebhookUrl,
          webAppUrl: dbSettings.telegramWebAppUrl,
          welcomeMessage: dbSettings.telegramWelcomeMessage,
          csUsername: dbSettings.telegramCsUsername,
          channelUrl: dbSettings.telegramChannelUrl,
          alertsEnabled: dbSettings.telegramAlertsEnabled !== false,
        });
        if (dbSettings.telegramStoreMode === 'polling' && dbSettings.telegramStoreEnabled !== false && (dbSettings.telegramBotToken || BOT_CONFIG.TELEGRAM_TOKEN)) {
          try { await telegramBotService.registerCommands(); await telegramBotService.startPolling(); } catch (_) {}
        }
      }
      lastErr = null;
      break;
    } catch (e: any) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  if (lastErr) console.error('[TelegramBot Startup] Gagal memuat konfigurasi dari MongoDB setelah 5x percobaan:', lastErr.message);
} catch (e: any) {
  console.error('[TelegramBot Startup] Error fatal:', e.message);
}

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

  // Restart hydrates config only; catalog writes require explicit sync or the normal 30-minute schedule.
  setInterval(() => {
    console.log('🔄 [CRON] Menjalankan pembaruan otomatis produk Digiflazz...');
    syncDigiflazzCatalog().catch((e: any) => console.error('Cron Digiflazz sync error:', e.message));
  }, 30 * 60 * 1000);
});
