import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { test, after } from 'node:test';
import { MongoClient } from '../backend/node_modules/mongodb/lib/index.js';

const sandbox = fs.mkdtempSync(path.join(process.env.TMPDIR || '/root/.hermes/cache/scratch', 'manual-allocation-'));
process.chdir(sandbox);
const { MongoDbService } = await import('../backend/src/services/mongodbService.ts');
const service: any = new MongoDbService();
const socket = net.createServer();
await new Promise<void>(r => socket.listen(0, '127.0.0.1', r));
const port = (socket.address() as net.AddressInfo).port;
await new Promise<void>(r => socket.close(() => r()));
const mongoDir = path.join(sandbox, 'mongo'); fs.mkdirSync(mongoDir);
const mongod = spawn('mongod', ['--dbpath', mongoDir, '--port', String(port), '--bind_ip', '127.0.0.1', '--noauth', '--quiet'], { stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise<void>((resolve, reject) => {
  const timer = setTimeout(() => { mongod.kill(); reject(new Error('isolated fixture Mongo startup timeout')); }, 10000);
  mongod.on('error', reject);
  mongod.stdout.on('data', bytes => { if (String(bytes).includes('Waiting for connections')) { clearTimeout(timer); resolve(); } });
  mongod.on('exit', code => { clearTimeout(timer); if (code) reject(new Error('isolated fixture Mongo startup failed')); });
});
const client = await new MongoClient(`mongodb://127.0.0.1:${port}`, { serverSelectionTimeoutMS: 2000 }).connect();
const db = client.db('fixture_manual_' + randomUUID().replaceAll('-', ''));
after(async () => { try { await db.dropDatabase(); } finally { await client.close(); const stopped = new Promise<void>(r => mongod.once('exit', () => r())); mongod.kill(); await stopped; fs.rmSync(sandbox, { recursive: true, force: true }); } });
service.getClient = async () => client;
service.getPrimaryDbName = () => db.databaseName;
service.getTransCollectionName = () => 'fixture_orders';
const premiumProduct = () => ({ id: 'premium-product', categoryId: 'premium', deliveryMethod: 'AUTOMATIC', stock: 2, variants: [{ id: 'premium-variant', stock: 2, voucherCodes: ['fixture-login|fixture-password', 'fixture-code-only'] }] });
async function seed(product: any = premiumProduct(), count = 1) {
  await db.collection('manual_inventory').deleteMany({});
  await db.collection('fixture_orders').deleteMany({});
  await db.collection('orders').deleteMany({});
  fs.writeFileSync(path.join(sandbox, 'data/db.json'), JSON.stringify({ orders: [], products: [] }));
  await db.collection('manual_inventory').insertOne({ _id: 'current' as any, revision: 1, products: [product], wifiBatches: [] });
  await db.collection('fixture_orders').insertMany(Array.from({ length: count }, (_, i) => ({ id: 'order-' + i, invoiceNumber: 'fixture-invoice-' + i, productId: product.id, variantId: product.variants?.[0]?.id, category: product.categoryId, paymentStatus: 'PAID', fulfillmentStatus: 'NOT_STARTED', userId: 'fixture-owner', guestAccessToken: 'fixture-token' })));
}

test('premium fulfillment writes real credentials canonically without a Prisma mirror', async () => {
  await seed();
  const { mongoDbService } = await import('../backend/src/services/mongodbService.ts');
  const { supabaseService } = await import('../backend/src/services/supabaseService.ts');
  const { FulfillmentService } = await import('../backend/src/services/fulfillment.ts');
  mongoDbService.getAllState = () => service.getAllState();
  mongoDbService.saveOrder = (order: any) => service.saveOrder(order);
  mongoDbService.reserveManualPremiumCredential = (input: any) => service.reserveManualPremiumCredential(input);
  mongoDbService.reserveManualWifiVoucher = (input: any) => service.reserveManualWifiVoucher(input);
  supabaseService.saveOrder = async () => ({ success: true });
  const prisma: any = { order: { findUnique: async () => null, update: async () => { throw new Error('fixture mirror absent'); } }, auditLog: { create: async () => {} } };
  const fulfillment = new FulfillmentService(prisma);
  await fulfillment.fulfillOrder('order-0');
  await fulfillment.fulfillOrder('order-0');
  const order: any = await db.collection('fixture_orders').findOne({ id: 'order-0' });
  assert.equal(order.fulfillmentStatus, 'SUCCESS');
  assert.deepEqual(order.credentials, [{ email: 'fixture-login', password: 'fixture-password' }]);
  assert.deepEqual(order.fulfillmentResult.credentials, order.credentials);
  assert.equal(order.userId, 'fixture-owner');
  assert.equal(order.guestAccessToken, 'fixture-token');
  const inventory: any = await db.collection('manual_inventory').findOne({ _id: 'current' as any });
  assert.equal(inventory.products[0].stock, 1);
});

test('stale inventory snapshot is rejected and allocated credentials cannot be re-imported', async () => {
  await seed();
  const stale = premiumProduct();
  await service.reserveManualPremiumCredential({ productId: stale.id, variantId: 'premium-variant', orderId: 'order-0' });
  const conflict = await service.saveManualInventory([stale], [], 1);
  assert.equal(conflict.success, false);
  assert.equal(conflict.conflict, true);
  const saved = await service.saveManualInventory([stale], [], 2);
  assert.equal(saved.success, true);
  assert.equal(saved.data.revision, 3);
  assert.deepEqual(saved.data.products[0].variants[0].voucherCodes, ['fixture-code-only']);
  const inventory: any = await db.collection('manual_inventory').findOne({ _id: 'current' as any });
  assert.equal(inventory.allocations.length, 1);
  assert.equal(inventory.products[0].stock, 1);
});

test('legacy WiFi username,password stock is allocated with the correct separate password', async () => {
  await seed({ id: 'wifi-product', categoryId: 'wifi', stock: 1, voucherCodes: ['fixture-wifi,fixture-password'] });
  const result = await service.reserveManualWifiVoucher({ productId: 'wifi-product', orderId: 'order-0' });
  assert.equal(result.code, 'fixture-wifi');
  assert.equal(result.password, 'fixture-password');
});

test('premium reserves existing admin credential once and binds allocation to paid order', async () => {
  await seed();
  const input = { productId: 'premium-product', variantId: 'premium-variant', orderId: 'order-0' };
  const first = await service.reserveManualPremiumCredential(input);
  assert.deepEqual(first.credentials, [{ email: 'fixture-login', password: 'fixture-password' }]);
  assert.deepEqual(await service.reserveManualPremiumCredential(input), first);
  const inventory: any = await db.collection('manual_inventory').findOne({ _id: 'current' as any });
  assert.equal(inventory.products[0].stock, 1);
  assert.equal(inventory.products[0].variants[0].voucherCodes.length, 1);
  assert.equal(inventory.allocations.length, 1);
  assert.equal(inventory.allocations[0].orderId, 'order-0');
});
