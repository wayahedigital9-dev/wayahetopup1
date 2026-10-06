import { db as prisma } from './db/client.js';
import { FulfillmentService } from './services/fulfillment.js';
import { digiflazzService } from './services/digiflazz.js';
import { qiospayService } from './services/qiospay.js';

const fulfillmentService = new FulfillmentService(prisma);

/**
 * Worker 1: Memproses antrean order yang sudah PAID tapi belum terpenuhi (QUEUED / NOT_STARTED)
 */
async function processPaidOrdersQueue() {
  try {
    const pendingFulfillments = await prisma.order.findMany({
      where: {
        paymentStatus: 'PAID',
        fulfillmentStatus: {
          in: ['NOT_STARTED', 'QUEUED'],
        },
      },
      take: 10,
      orderBy: { createdAt: 'asc' },
    });

    for (const order of pendingFulfillments) {
      console.log(`[Worker] Fulfilling order ${order.invoiceNumber}...`);
      await fulfillmentService.fulfillOrder(order.id);
    }
  } catch (error) {
    console.error('[Worker Error] Gagal memproses antrean pemenuhan:', error);
  }
}

/**
 * Worker 2: Rekonsiliasi transaksi menggantung ke Digiflazz (Status: PROCESSING)
 */
async function reconcilePendingDigiflazzOrders() {
  try {
    const processingOrders = await prisma.order.findMany({
      where: {
        paymentStatus: 'PAID',
        fulfillmentStatus: 'PROCESSING',
        category: {
          in: ['PULSA', 'KUOTA'],
        },
        supplierRefId: {
          not: null,
        },
      },
      include: {
        items: {
          include: { product: true },
        },
      },
      take: 10,
    });

    for (const order of processingOrders) {
      const primaryItem = order.items[0];
      const buyerSku = primaryItem.product.supplierSku || primaryItem.product.sku;

      try {
        const checkRes = await digiflazzService.checkTransactionStatus({
          buyerSkuCode: buyerSku,
          customerNo: order.targetDestination,
          refId: order.supplierRefId!,
        });

        const status = checkRes.data.status;
        const sn = checkRes.data.sn;

        if (status === 'Sukses') {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              fulfillmentStatus: 'SUCCESS',
              serialNumber: sn || order.serialNumber,
              fulfilledAt: new Date(),
            },
          });
          console.log(`[Reconcile] Order ${order.invoiceNumber} berhasil diselesaikan (SN: ${sn})`);
        } else if (status === 'Gagal') {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              fulfillmentStatus: 'FAILED',
              errorReason: checkRes.data.message || 'Status akhir supplier menyatakan gagal.',
            },
          });
          console.log(`[Reconcile] Order ${order.invoiceNumber} gagal di supplier`);
        }
      } catch (err) {
        console.error(`[Reconcile Error] Cek status gagal untuk ${order.invoiceNumber}:`, err);
      }
    }
  } catch (error) {
    console.error('[Worker Error] Rekonsiliasi Digiflazz gagal:', error);
  }
}

/**
 * Worker 3: Kedaluwarsa pesanan UNPAID yang melewati 24 jam
 */
async function expireStaleOrders() {
  try {
    const expiredCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const expiredOrders = await prisma.order.findMany({
      where: {
        paymentStatus: 'UNPAID',
        createdAt: {
          lt: expiredCutoff,
        },
      },
      take: 50,
    });

    for (const order of expiredOrders) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'EXPIRED',
        },
      });

      // Lepaskan reservasi voucher WiFi jika ada
      await prisma.wifiVoucherItem.updateMany({
        where: {
          orderId: order.id,
          status: 'RESERVED',
        },
        data: {
          status: 'AVAILABLE',
          orderId: null,
          reservedUntil: null,
        },
      });

      console.log(`[Worker] Expired stale order ${order.invoiceNumber}`);
    }
  } catch (error) {
    console.error('[Worker Error] Expire stale orders gagal:', error);
  }
}

/**
 * Worker 4: Sinkronisasi Mutasi Pembayaran Qiospay QRIS Otomatis
 * Memeriksa mutasi live dari Qiospay dan mencocokkan dengan pesanan pending
 */
async function autoSyncQiospayMutasi() {
  try {
    const result = await qiospayService.syncAllPendingOrders(prisma, fulfillmentService);
    if (result.syncedCount > 0) {
      console.log(`⚡ [Worker Qiospay] Berhasil melunasi ${result.syncedCount} order via Mutasi: ${result.reconciledInvoices.join(', ')}`);
    }
  } catch (error: any) {
    // Silent notice
  }
}

// Main execution loop
async function runWorkerLoop() {
  console.log('🚀 WayaheDigital Worker started. Listening for background jobs...');

  setInterval(async () => {
    await autoSyncQiospayMutasi();
  }, 15000); // setiap 15 detik cek mutasi Qiospay

  setInterval(async () => {
    await processPaidOrdersQueue();
  }, 10000); // setiap 10 detik

  setInterval(async () => {
    await reconcilePendingDigiflazzOrders();
  }, 30000); // setiap 30 detik

  setInterval(async () => {
    await expireStaleOrders();
  }, 60000); // setiap 1 menit
}

runWorkerLoop();

