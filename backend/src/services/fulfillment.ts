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

  /**
   * Eksekusi pemenuhan pesanan yang telah lunas
   */
  async fulfillOrder(orderId: string, customCallbackUrl?: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      throw new Error(`Order ${orderId} tidak ditemukan.`);
    }

    if (order.paymentStatus !== 'PAID') {
      throw new Error(`Order ${order.invoiceNumber} belum lunas (Status: ${order.paymentStatus}).`);
    }

    if (order.fulfillmentStatus === 'SUCCESS') {
      // IDEMPOTEN: Jangan proses ulang order yang sudah sukses
      console.log(`[Fulfillment] Order ${order.invoiceNumber} sudah berstatus SUCCESS. Melewati transaksi ganda.`);
      return;
    }

    // Set status ke PROCESSING
    await this.prisma.order.update({
      where: { id: order.id },
      data: { fulfillmentStatus: 'PROCESSING' },
    });

    const primaryItem = (Array.isArray(order.items) && order.items.length > 0) ? (order.items[0] as any) : null;
    const orderAny = order as any;
    let product: any = primaryItem?.product;

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
    const isDigiflazz =
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
      (product?.sku && String(product.sku).startsWith('DF-'));

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
      console.error(`Fulfillment error on order ${order.invoiceNumber}:`, error);

      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          fulfillmentStatus: 'MANUAL_REVIEW',
          errorReason: error.message || 'Kendala koneksi supplier.',
        },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'FULFILLMENT_FAILED_MANUAL_REVIEW',
          performedBy: 'Fulfillment Engine',
          details: `Order ${order.invoiceNumber} gagal otomatis: ${error.message}. Dialihkan ke antrean manual review admin.`,
        },
      });
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
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        supplierRefId: refId,
        fulfillmentStatus: 'PROCESSING',
      },
    }).catch(() => { });

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

    // Sinkronkan ke Supabase & MongoDB
    try {
      const pendingState = {
        id: order.id,
        supplierRefId: refId,
        fulfillmentStatus: 'PROCESSING',
        updatedAt: new Date().toISOString(),
      };
      await supabaseService.saveOrder(pendingState);
      await mongoDbService.saveOrder(pendingState);
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
    const currentOrder = await this.prisma.order.findUnique({
      where: { id: order.id },
    });

    if (currentOrder && (currentOrder.fulfillmentStatus === 'SUCCESS' || currentOrder.fulfillmentStatus === 'FAILED')) {
      console.log(
        `[DIGIFLAZZ DB UPDATE] Race condition protected: order ${order.invoiceNumber} sudah berada di status terminal '${currentOrder.fulfillmentStatus}'. Respon awal '${status}' dilewati.`
      );
      return;
    }

    const oldStatus = currentOrder?.fulfillmentStatus || 'PROCESSING';

    if (status === 'Sukses') {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          fulfillmentStatus: 'SUCCESS',
          supplierRefId: refId,
          serialNumber: sn || 'SN' + Date.now(),
          fulfilledAt: new Date(),
        },
      });

      console.log(`[DIGIFLAZZ DB UPDATE]`, {
        ref_id: refId,
        old_status: oldStatus,
        new_status: 'SUCCESS',
      });

      try {
        const successState = {
          id: order.id,
          fulfillmentStatus: 'SUCCESS',
          serialNumber: sn || 'SN' + Date.now(),
          supplierRefId: refId,
          fulfilledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await supabaseService.saveOrder(successState);
        await mongoDbService.saveOrder(successState);
      } catch (_) { }
    } else if (status === 'Pending') {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          fulfillmentStatus: 'PROCESSING',
          supplierRefId: refId,
        },
      });

      console.log(`[DIGIFLAZZ DB UPDATE]`, {
        ref_id: refId,
        old_status: oldStatus,
        new_status: 'PROCESSING',
      });
    } else {
      // Status Gagal - Otomatis REFUND agar uang tidak masuk ke penjual jika produk gagal terkirim
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'REFUNDED',
          fulfillmentStatus: 'FAILED',
          errorReason: message || 'Transaksi ditolak oleh sistem operator supplier.',
        },
      });

      console.log(`[DIGIFLAZZ DB UPDATE - AUTO REFUND]`, {
        ref_id: refId,
        old_status: oldStatus,
        new_status: 'FAILED',
        payment_status: 'REFUNDED',
      });

      try {
        const failedState = {
          id: order.id,
          paymentStatus: 'REFUNDED',
          fulfillmentStatus: 'FAILED',
          errorReason: message || 'Transaksi ditolak oleh operator. Dana otomatis dikembalikan ke pembeli.',
          supplierRefId: refId,
          updatedAt: new Date().toISOString(),
        };
        await supabaseService.saveOrder(failedState);
        await mongoDbService.saveOrder(failedState);
      } catch (_) { }
    }
  }

  private async fulfillWifiVoucher(order: any, product: any): Promise<void> {
    // 1. Alokasikan voucher yang AVAILABLE dari tabel
    let selectedVoucher = await this.prisma.wifiVoucherItem.findFirst({
      where: {
        status: 'AVAILABLE',
        packageDuration: product?.duration || '24 Jam',
      },
    });

    if (!selectedVoucher) {
      selectedVoucher = await this.prisma.wifiVoucherItem.findFirst({
        where: { status: 'AVAILABLE' },
      });
    }

    let code = '';
    let pass = '1234';

    const ssid = product?.networkLocation || 'MelatiNet_Warga_Hotspot';
    const loginUrl = 'http://hotspot.wayahedigital.id';

    if (selectedVoucher) {
      // Tandai voucher SOLD
      await this.prisma.wifiVoucherItem.update({
        where: { id: selectedVoucher.id },
        data: {
          status: 'SOLD',
          orderId: order.id,
        },
      });
      code = selectedVoucher.code;
      pass = selectedVoucher.password || '1234';
    } else {
      // 2. Auto-generate kode voucher WiFi instan agar pembeli langsung mendapat kode
      code = 'WF-' + Math.floor(100000 + Math.random() * 900000);
      pass = String(Math.floor(1000 + Math.random() * 9000));
      try {
        await this.prisma.wifiVoucherItem.create({
          data: {
            code,
            password: pass,
            status: 'SOLD',
            location: ssid,
            packageDuration: product?.duration || '24 Jam',
            orderId: order.id,
          },
        });
      } catch (_) { }
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        fulfillmentStatus: 'SUCCESS',
        voucherCode: code,
        voucherPassword: pass,
        wifiSsid: ssid,
        wifiLoginUrl: loginUrl,
        fulfilledAt: new Date(),
      },
    });

    try {
      const successState = {
        id: order.id,
        fulfillmentStatus: 'SUCCESS',
        voucherCode: code,
        voucherPassword: pass,
        wifiSsid: ssid,
        wifiLoginUrl: loginUrl,
        serialNumber: code,
        fulfilledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await supabaseService.saveOrder(successState);
      await mongoDbService.saveOrder(successState);
    } catch (_) { }
  }

  private async fulfillPremium(order: any, product: any): Promise<void> {
    if (product.deliveryMethod === 'AUTOMATIC') {
      const generatedCode = 'WD-PREM-' + Math.random().toString(36).substring(2, 10).toUpperCase();

      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          fulfillmentStatus: 'SUCCESS',
          voucherCode: generatedCode,
          premiumNotes: 'Gunakan kode di atas pada portal aktivasi resmi.',
          fulfilledAt: new Date(),
        },
      });
    } else {
      // Manual Review / Admin Dispatch
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          fulfillmentStatus: 'MANUAL_REVIEW',
          premiumNotes: 'Tim Admin kami sedang memproses undangan resmi ke akun Anda (estimasi 10-30 menit).',
        },
      });
    }
  }
}
