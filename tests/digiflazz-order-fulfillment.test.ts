import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import test from 'node:test';

async function run(mirror: boolean, options: { status?: string; rejectSave?: boolean } = {}) {
  const stored: any = { id: 'fixture-paid', invoiceNumber: 'fixture-invoice', paymentStatus: 'PAID', fulfillmentStatus: 'NOT_STARTED', category: 'kuota', productId: 'df-data', supplierSku: 'data', buyerSkuCode: 'data', targetDestination: 'fixture-target', supplierRefId: 'fixture-existing-ref', items: [] };
  const projected: any = { id: stored.id, invoiceNumber: stored.invoiceNumber, paymentStatus: 'PAID', fulfillmentStatus: 'NOT_STARTED', category: 'kuota', targetDestination: stored.targetDestination, items: [] };
  const requests: any[] = [];
  const source = ts.createSourceFile('fulfillment.ts', fs.readFileSync('backend/src/services/fulfillment.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const code = source.statements.filter(n => !ts.isImportDeclaration(n)).map(n => n.getText(source).replace(/^export /, '')).join('\n');
  const prisma: any = {
    order: { findUnique: async () => mirror ? projected : null, update: async ({ data }: any) => { if (!mirror) throw new Error('no mirror'); Object.assign(projected, data); return projected; } },
    product: { findUnique: async () => null, findFirst: async () => null },
    digiflazzLog: { upsert: async () => {}, update: async () => {} },
    auditLog: { create: async () => {} },
  };
  const ctx: any = { console, DIGIFLAZZ_CONFIG: { TESTING: false }, CONSOLE_CONFIG: {},
    mongoDbService: { getAllState: async () => ({ orders: [stored], products: [] }), saveOrder: async (o: any) => { if (options.rejectSave) return { success: false, error: 'fixture DB rejected' }; Object.assign(stored, o); return { success: true }; } },
    supabaseService: { saveOrder: async () => {} }, resolveDigiflazzCallbackUrl: () => undefined,
    createDigiflazzTransaction: async (request: any) => { assert.equal(stored.supplierRefId, request.refId); assert.equal(stored.fulfillmentStatus, 'PROCESSING'); requests.push(request); return { data: { status: options.status || 'Pending', sn: 'fixture-sn', rc: '03', message: 'fixture response' } }; },
  };
  const Service = vm.runInNewContext(ts.transpile(code + ';FulfillmentService', { target: ts.ScriptTarget.ES2022 }), ctx);
  if (options.rejectSave) {
    await assert.rejects(new Service(prisma).fulfillOrder(stored.id), /fixture DB rejected/);
    assert.equal(requests.length, 0, 'never send a transaction after rejected persistence');
    return;
  }
  await new Service(prisma).fulfillOrder(stored.id);
  assert.equal(requests.length, 1, 'paid order must reach supplier once');
  assert.equal(requests[0].buyerSkuCode, 'data');
  assert.equal(requests[0].refId, 'fixture-existing-ref', 'reuse persisted reference');
  assert.equal(stored.fulfillmentStatus, options.status === 'Sukses' ? 'SUCCESS' : options.status === 'Gagal' ? 'FAILED' : 'PROCESSING');
  if (options.status === 'Gagal') assert.equal(stored.paymentStatus, 'PAID', 'supplier rejection alone is not a completed customer refund');
  if (options.status === 'Sukses') assert.equal(stored.serialNumber, 'fixture-sn');
}

test('paid order recovers supplier SKU from canonical Mongo order when mirror loses metadata', () => run(true));
test('paid Digiflazz order stored only in Mongo reaches supplier without a Prisma mirror', () => run(false));
test('supplier success is persisted canonically even when Prisma mirror is absent', () => run(false, { status: 'Sukses' }));
test('rejected canonical persistence prevents sending any supplier transaction', () => run(false, { rejectSave: true }));
test('supplier rejection is persisted without claiming an unexecuted refund', () => run(false, { status: 'Gagal' }));
