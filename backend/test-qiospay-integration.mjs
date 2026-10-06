import { strict as assert } from 'node:assert';
import { qiospayService } from './dist/services/qiospay.js';
import { createPaymentSession } from './dist/services/paymentRouter.js';
import { inspect, crc16 } from './dist/utils/qris.js';
import { QIOSPAY_CONFIG } from './dist/config/apikeys.js';

console.log('====================================================');
console.log('🧪 RUNNING COMPREHENSIVE QIOSPAY INTEGRATION TESTS');
console.log('====================================================\n');

async function runTests() {
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
    }
  }

  // 1. Test QRIS Generator & CRC16 Validation
  test('1. QRIS Generation & CRC16 Validity', () => {
    const rawQr = QIOSPAY_CONFIG.QRIS_STRING || '00020101021126670016COM.NOBUBANK.WWW01189360050300000907180214260525000007320303UMI51440014ID.CO.QRIS.WWW0215ID10265244964310303UMI5204581753033605802ID5923Waroeng Digital QP487976008SIDOARJO61056121162070703A01630472AF';
    const inspected = inspect(rawQr);
    assert.equal(inspected.values['58'], 'ID', 'Country must be ID');
    assert.equal(inspected.values['53'], '360', 'Currency must be IDR (360)');

    const paymentRes = qiospayService.createPaymentQris({ amount: 15000, orderId: 'INV-TEST-001' });
    assert.ok(paymentRes.qrString.length > 20, 'QR string generated');
    assert.equal(paymentRes.amount, 15000, 'Amount must match exactly');
  });

  // 2. Test Callback Secret Validation (Invalid Secret)
  await testAsync('2. Callback Rejection on Invalid Secret (HTTP 403)', async () => {
    const mockPrisma = {};
    const res = await qiospayService.processCallback(
      'wrong_secret_12345',
      { data: { nmid: 'ID1026524496431', refid: 'REF_TEST_001', amount: 15000, type: 'CR' } },
      mockPrisma
    );
    assert.equal(res.statusCode, 403, 'Should return 403 Forbidden on invalid secret');
    assert.equal(res.response.status, 'reject', 'Should return status reject');
  });

  // 3. Test Callback Debit Transaction Rejection (type: DB)
  await testAsync('3. Callback Ignores Debit Transactions (type: DB)', async () => {
    const validSecret = QIOSPAY_CONFIG.CALLBACK_SECRET || '312d3971811869d9f3a6c740b944f9bf841369d17479bdcaaa9080d1658ba4cb';
    const mockPrisma = {};
    const res = await qiospayService.processCallback(
      validSecret,
      { data: { nmid: 'ID1026524496431', refid: 'REF_TEST_DB_001', amount: 15000, type: 'DB' } },
      mockPrisma
    );
    assert.equal(res.statusCode, 200, 'Should return 200 without charging');
    assert.equal(res.response.message, 'Debit transaction ignored', 'Debit should be ignored');
  });

  // 4. Test Valid Callback Processing & Idempotency
  await testAsync('4. Valid Callback Processing & Idempotency Duplicate Rejection', async () => {
    const validSecret = QIOSPAY_CONFIG.CALLBACK_SECRET || '312d3971811869d9f3a6c740b944f9bf841369d17479bdcaaa9080d1658ba4cb';
    const uniqueRef = 'REF_' + Date.now();
    
    // In-memory mock prisma for testing idempotent storage
    const store = new Map();
    const mockPrisma = {
      qiospayEvent: {
        findUnique: async ({ where }) => {
          const key = `${where.nmid_refid.nmid}:${where.nmid_refid.refid}`;
          return store.get(key) || null;
        },
        create: async ({ data }) => {
          const key = `${data.nmid}:${data.refid}`;
          store.set(key, data);
          return data;
        },
        update: async () => {},
      },
      order: {
        findFirst: async () => null,
        findMany: async () => [],
      },
    };

    // First attempt -> accept 200
    const res1 = await qiospayService.processCallback(
      validSecret,
      {
        status: 'success',
        data: {
          name: 'CUSTOMER_TEST',
          nmid: 'ID1026524496431',
          amount: 25000,
          type: 'CR',
          fee: 0,
          refid: uniqueRef,
          issuer: '93600002',
          balance: '50000',
          time: '19/09/2026 19:00',
        },
      },
      mockPrisma
    );
    assert.equal(res1.statusCode, 200, 'First callback should be accepted');
    assert.equal(res1.response.status, 'accept', 'Status should be accept');

    // Second attempt (duplicate refid) -> accept 200 with Duplicate callback ignored
    const res2 = await qiospayService.processCallback(
      validSecret,
      {
        status: 'success',
        data: {
          name: 'CUSTOMER_TEST',
          nmid: 'ID1026524496431',
          amount: 25000,
          type: 'CR',
          fee: 0,
          refid: uniqueRef,
          issuer: '93600002',
        },
      },
      mockPrisma
    );
    assert.equal(res2.statusCode, 200, 'Duplicate callback should return 200');
    assert.equal(res2.response.message, 'Duplicate callback ignored', 'Should indicate duplicate ignored');
  });

  // 5. Test Partial Order Reconciliation & Preserving Old Data
  await testAsync('5. Partial Order Update (Preserving Customer & Product Data)', async () => {
    const existingOrder = {
      id: 'ord_test_preserve_123',
      invoiceNumber: 'INV/20260919/WD/7788',
      customerName: 'Budi Santoso',
      customerPhone: '081234567890',
      targetDestination: '081234567890',
      productName: 'Pulsa Telkomsel 25.000',
      totalAmount: 25000,
      paymentStatus: 'PENDING',
      fulfillmentStatus: 'NOT_STARTED',
    };

    let updatedSavedOrder = null;
    const mockPrisma = {
      order: {
        findFirst: async ({ where }) => {
          if (where.invoiceNumber === existingOrder.invoiceNumber || where.id === existingOrder.id) {
            return existingOrder;
          }
          return null;
        },
        findMany: async ({ where }) => {
          if (where.totalAmount === existingOrder.totalAmount) {
            return [existingOrder];
          }
          return [];
        },
        findUnique: async () => existingOrder,
        update: async ({ data }) => {
          return { ...existingOrder, ...data };
        },
      },
      $transaction: async (cb) => {
        return cb(mockPrisma);
      },
      qiospayEvent: {
        update: async () => {},
      },
      auditLog: {
        create: async () => {},
      },
    };

    const reconciled = await qiospayService.reconcileOrderForEvent(mockPrisma, {
      nmid: 'ID1026524496431',
      refid: existingOrder.invoiceNumber,
      amount: 25000,
      type: 'CR',
      issuer: 'QRIS_BCA',
      receivedAt: new Date(),
    });

    assert.ok(reconciled, 'Order must be reconciled');
    assert.equal(reconciled.id, existingOrder.id, 'Order ID must remain identical');
    assert.equal(reconciled.invoiceNumber, existingOrder.invoiceNumber, 'Invoice number must remain identical');
    assert.equal(reconciled.customerName, 'Budi Santoso', 'Customer name must NOT be overwritten with null');
    assert.equal(reconciled.customerPhone, '081234567890', 'Customer phone must NOT be overwritten with null');
    assert.equal(reconciled.productName, 'Pulsa Telkomsel 25.000', 'Product name must NOT be overwritten with null');
    assert.equal(reconciled.paymentStatus, 'PAID', 'Payment status must be updated to PAID');
    assert.equal(reconciled.qiospayRefid, existingOrder.invoiceNumber, 'Qiospay Refid must be saved');
  });

  console.log('\n====================================================');
  console.log(`📊 TEST RESULTS: ${passed}/${total} PASSED`);
  console.log('====================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
