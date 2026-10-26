import { PrismaClient } from '@prisma/client';
import {
  createDigiflazzTransaction,
  digiflazzService,
  resolveDigiflazzCallbackUrl
} from './digiflazz.js';
import { CONSOLE_CONFIG } from '../config/console.js';
import { DIGIFLAZZ_CONFIG } from '../config/apikeys.js';
import { supabaseService } from './supabaseService.js';
import { mongoDbService } from './mongodbService.js';

/**
 * Generate unique ref_id untuk transaksi Digiflazz
 * Format: WD-YYYYMMDD-XXXXXX (contoh: WD-20260928-X7K92P)
 */
export function generateDigiflazzRefId(invoiceNumber?: string): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  const cleanInv = invoiceNumber ? invoiceNumber.replace(/[^A-Za-z0-9]/g, '').slice(-4).toUpperCase() : '';
  return `WD-${dateStr}-${cleanInv ? cleanInv + '-' : ''}${rand}`;
}

export class FulfillmentService {
  private prisma: PrismaClient;

  constructor(prismaClient: PrismaClient) {
    this.prisma = prismaClient;
  }

  private async persistOrderState(orderId: string, data: Record<string, any>): Promise<void> {
    // Mongo/local canonical state is confirmed before any best-effort mirror write.
    const state = { id: orderId, ...data, updatedAt: new Date().toISOString() };
    const saved = await mongoDbService.saveOrder(state);
    if (!saved.success) {
      const error: any = new Error(saved.error || 'Status pesanan gagal disimpan ke database kanonis.');
      error.canonicalPersistenceFailure = true;
      throw error;
    }
    try { await this.prisma.order.update({ where: { id: orderId }, data }); }
    catch (_) { console.warn(`[Fulfillment] Prisma mirror unavailable for ${orderId}; canonical state preserved.`); }
    try { await supabaseService.saveOrder(state); } catch (_) {}
  }

  /**
   * Eksekusi pemenuhan pesanan yang telah lunas
   */
  async fulfillOrder(orderId: string, customCallbackUrl?: string): Promise<void> {
    const state = await mongoDbService.getAllState();
    const mongoOrder = (state.orders || []).find((item: any) => item.id === orderId);
    let mirror: any = null;
    try {
      mirror = await this.prisma.order.findUnique({
        where: { id: orderId }, include: { items: { include: { product: true } } },
      });
    } catch (_) {}
    // Prefer the complete canonical snapshot, not an incomplete/status-only mirror.
    const order: any = mongoOrder || mirror;
    if (!order) throw new Error(`Order ${orderId} tidak ditemukan.`);

    if (order.paymentStatus !== 'PAID') {
      throw new Error(`Order ${order.invoiceNumber} belum lunas (Status: ${order.paymentStatus}).`);
    }

    if (order.fulfillmentStatus === 'SUCCESS') {
      // IDEMPOTEN: Jangan proses ulang order yang sudah sukses
      console.log(`[Fulfillment] Order ${order.invoiceNumber} sudah berstatus SUCCESS. Melewati transaksi ganda.`);
      return;
    }

    // Historical failed/manual-review orders need an explicit admin decision.
    if (['FAILED', 'CANCELED', 'MANUAL_REVIEW', 'NEEDS_REVIEW'].includes(order.fulfillmentStatus)) return;

    // Set status ke PROCESSING
    await this.persistOrderState(order.id, { fulfillmentStatus: 'PROCESSING' });

    const primaryItem = (Array.isArray(order.items) && order.items.length > 0) ? (order.items[0] as any) : null;
    const orderAny = order as any;
    let product: any = (state.products || []).find((entry: any) => entry.id === (order.productId || primaryItem?.productId)) || primaryItem?.product;

    if (!product) {
      const prodId = orderAny.productId || primaryItem?.productId;
      if (prodId) {
        try {
          product = await this.prisma.product.findUnique({ where: { id: prodId } });
        } catch (_) { }
      }
      if (!product && (orderAny.sku || primaryItem?.sku)) {
        const skuToFind = orderAny.sku || primaryItem?.sku;
        try {
          product = await (this.prisma.product as any).findFirst({ where: { sku: skuToFind } });
        } catch (_) { }
      }
    }

    const rawCat = String(orderAny.category || orderAny.categoryId || product?.categoryId || primaryItem?.category || '').toUpperCase();
    const isDigiflazz = rawCat !== 'WIFI' && rawCat !== 'PREMIUM' && (
      rawCat === 'PULSA' ||
      rawCat === 'KUOTA' ||
      rawCat === 'DATA' ||
      rawCat === 'GAME' ||
      rawCat === 'GAMES' ||
      rawCat === 'PLN' ||
      rawCat === 'VOUCHER' ||
      rawCat === 'STREAMING' ||
      rawCat === 'TV' ||
      rawCat === 'EMERGENCY' ||
      rawCat.includes('MASA AKTIF') ||
      rawCat.includes('PAKET') ||
      Boolean(product?.digiflazzCategory) ||
      Boolean(product?.sellerName) ||
      Boolean(orderAny.buyerSkuCode) ||
      Boolean(product?.sku && String(product.sku).startsWith('DF-'))
    );

    try {
      if (isDigiflazz) {
        await this.fulfillDigiflazz(order, product, customCallbackUrl);
      } else if (rawCat === 'WIFI') {
        await this.fulfillWifiVoucher(order, product);
      } else if (rawCat === 'PREMIUM') {
        await this.fulfillPremium(order, product);
      } else {
        // Fallback: If not explicitly wifi or premium, route to Digiflazz
        await this.fulfillDigiflazz(order, product, customCallbackUrl);
      }
    } catch (error: any) {
      // Never downgrade a committed allocation or publish success on failed canonical persistence.
      if (error.canonicalPersistenceFailure) throw error;
      console.error(`Fulfillment error on order ${order.invoiceNumber}:`, error.message);

      await this.persistOrderState(order.id, {
        fulfillmentStatus: 'MANUAL_REVIEW',
        errorReason: error.message || 'Kendala koneksi supplier.',
      });

      try { await this.prisma.auditLog.create({
        data: {
          action: 'FULFILLMENT_FAILED_MANUAL_REVIEW',
          performedBy: 'Fulfillment Engine',
          details: `Order ${order.invoiceNumber} gagal otomatis: ${error.message}. Dialihkan ke antrean manual review admin.`,
        },
      }); } catch (_) { /* Audit mirrors do not decide canonical fulfillment. */ }
    }
  }

  /**
   * Pemenuhan Produk Pulsa, Kuota, Game, PLN via Digiflazz Buyer API
   * Mendukung parameter cb_url untuk Multi-Webhook
   */
  private async fulfillDigiflazz(order: any, product: any, customCallbackUrl?: string): Promise<void> {
    const primaryItem = (Array.isArray(order.items) && order.items.length > 0) ? order.items[0] : null;
    const buyerSku =
      product?.supplierSku ||
      product?.sku ||
      order.buyerSkuCode ||
      order.supplierSku ||
      order.sku ||
      primaryItem?.supplierSku ||
      primaryItem?.sku;

    if (!buyerSku) {
      throw new Error(`Produk ${product?.name || order.productName || order.id} tidak memiliki supplierSku atau sku yang valid.`);
    }

    const customerNo =
      order.targetDestination ||
      order.customerPhone ||
      order.customer_no ||
      primaryItem?.targetNumberOrAccount;

    if (!customerNo) {
      throw new Error(`Nomor tujuan / ID Akun pelanggan kosong pada pesanan ${order.invoiceNumber}.`);
    }

    // Pastikan ref_id UNIQUE
    const refId = order.supplierRefId || generateDigiflazzRefId(order.invoiceNumber);
    const cbUrl = resolveDigiflazzCallbackUrl(customCallbackUrl);

    // 1. Simpan order ke database sebelum dikirim ke Digiflazz
    // Status internal awal: PROCESSING (mapping: PENDING)
    await this.persistOrderState(order.id, {
      supplierRefId: refId, fulfillmentStatus: 'PROCESSING', errorReason: null,
    });

    try {
      await this.prisma.digiflazzLog.upsert({
        where: { refId },
        create: {
          orderId: order.id,
          buyerSkuCode: buyerSku,
          customerNo,
          refId,
          status: 'Pending',
          message: 'Transaksi dibuat, menunggu konfirmasi Digiflazz',
          requestBody: {
            refId,
            buyerSkuCode: buyerSku,
            customerNo,
            cb_url: cbUrl || null,
          },
        },
        update: {
          status: 'Pending',
          message: 'Transaksi diulang, menunggu konfirmasi Digiflazz',
        },
      });
    } catch (_) { }

    // 2. Kirim transaksi ke Digiflazz Buyer API
    const isTesting = (order as any).isTesting !== undefined
      ? Boolean((order as any).isTesting)
      : Boolean(DIGIFLAZZ_CONFIG.TESTING);

    const digiRes = await createDigiflazzTransaction({
      buyerSkuCode: buyerSku,
      customerNo,
      refId,
      callbackUrl: cbUrl,
      testing: isTesting,
    });

    const data = digiRes.data;
    const status = data.status; // 'Pending' | 'Sukses' | 'Gagal'
    const sn = data.sn;
    const message = data.message;
    const rc = data.rc;

    // 3. Catat log respon Digiflazz
    try {
      await this.prisma.digiflazzLog.update({
        where: { refId },
        data: {
          status,
          rc,
          sn: sn || null,
          message: message || null,
          responseBody: data as any,
        },
      });
    } catch (_) { }

    // 4. PROTEKSI RACE CONDITION:
    // Callback webhook mungkin telah masuk dan mengubah status menjadi SUCCESS/FAILED saat request ini berlangsung.
    // DILARANG menurunkan status terminal (SUCCESS atau FAILED) kembali ke PENDING/PROCESSING.
    const latestState = await mongoDbService.getAllState();
    const currentOrder = (latestState.orders || []).find((entry: any) => entry.id === order.id);

    if (currentOrder && (currentOrder.fulfillmentStatus === 'SUCCESS' || currentOrder.fulfillmentStatus === 'FAILED')) {
      console.log(
        `[DIGIFLAZZ DB UPDATE] Race condition protected: order ${order.invoiceNumber} sudah berada di status terminal '${currentOrder.fulfillmentStatus}'. Respon awal '${status}' dilewati.`
      );
      return;
    }

    const oldStatus = currentOrder?.fulfillmentStatus || 'PROCESSING';

    if (status === 'Sukses') {
      await this.persistOrderState(order.id, {
        fulfillmentStatus: 'SUCCESS', supplierRefId: refId,
        serialNumber: sn || null, fulfilledAt: new Date().toISOString(), errorReason: null,
      });

      console.log(`[DIGIFLAZZ DB UPDATE]`, {
        ref_id: refId, old_status: oldStatus, new_status: 'SUCCESS',
      });
    } else if (status === 'Pending') {
      await this.persistOrderState(order.id, {
        fulfillmentStatus: 'PROCESSING', supplierRefId: refId,
      });

      console.log(`[DIGIFLAZZ DB UPDATE]`, {
        ref_id: refId,
        old_status: oldStatus,
        new_status: 'PROCESSING',
      });
    } else {
      // A supplier rejection is not proof that customer funds were refunded.
      await this.persistOrderState(order.id, {
        fulfillmentStatus: 'FAILED', supplierRefId: refId,
        errorReason: message || 'Transaksi ditolak oleh supplier. Hubungi admin untuk tindak lanjut.',
      });
      console.log(`[DIGIFLAZZ DB UPDATE]`, {
        ref_id: refId, old_status: oldStatus, new_status: 'FAILED',
      });
    }
  }

  private async fulfillManualWifiOrder(order: any, products: any[]): Promise<void> {
    const item = Array.isArray(order.items) ? order.items[0] : null;
    await this.fulfillWifiVoucher(order, products.find((entry: any) => entry.id === (order.productId || item?.productId)));
  }

  private async fulfillWifiVoucher(order: any, product: any): Promise<void> {
    const item = Array.isArray(order.items) ? order.items[0] : null;
    const voucher = await mongoDbService.reserveManualWifiVoucher({
      productId: order.productId || item?.productId || product?.id,
      variantId: order.variantId || item?.variantId,
      orderId: order.id,
    });
    if (!voucher) {
      await this.persistOrderState(order.id, {
        fulfillmentStatus: 'MANUAL_REVIEW', errorReason: 'Stok voucher WiFi kosong atau tidak sesuai produk/varian.',
      });
      return;
    }
    await this.persistOrderState(order.id, {
      fulfillmentStatus: 'SUCCESS', voucherCode: voucher.code, voucherPassword: voucher.password || null,
      wifiSsid: voucher.wifiSsid || null, wifiLoginUrl: voucher.wifiLoginUrl || null,
      serialNumber: voucher.code, fulfilledAt: new Date().toISOString(), errorReason: null,
      fulfillmentResult: { ...(order.fulfillmentResult || {}), voucherCode: voucher.code, voucherPassword: voucher.password || null,
        wifiSsid: voucher.wifiSsid || null, wifiLoginUrl: voucher.wifiLoginUrl || null, serialNumber: voucher.code },
    });
  }

  private async fulfillPremium(order: any, product: any): Promise<void> {
    const item = Array.isArray(order.items) ? order.items[0] : null;
    const allocation = await mongoDbService.reserveManualPremiumCredential({
      productId: order.productId || item?.productId || product?.id,
      variantId: order.variantId || item?.variantId,
      orderId: order.id,
    });
    if (!allocation) {
      await this.persistOrderState(order.id, {
        fulfillmentStatus: 'MANUAL_REVIEW', errorReason: 'Stok akun/kode premium kosong atau tidak sesuai produk/varian.',
      });
      return;
    }
    await this.persistOrderState(order.id, {
      fulfillmentStatus: 'SUCCESS', ...allocation, premiumNotes: allocation.premiumInstructions,
      fulfillmentResult: { ...(order.fulfillmentResult || {}), ...allocation },
      fulfilledAt: new Date().toISOString(), errorReason: null,
    });
  }
}
