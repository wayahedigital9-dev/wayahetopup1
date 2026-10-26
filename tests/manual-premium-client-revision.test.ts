import assert from 'node:assert/strict';
import test from 'node:test';
import { storage } from '../src/services/storage';

const memory = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key) };
const product: any = { id: 'premium-real', categoryId: 'premium', voucherCodes: ['login|password'], stock: 1 };

test('manual inventory loads revision and sends only the confirmed revision with a save', async () => {
  const requests: any[] = [];
  globalThis.fetch = async (url: any, init: any) => {
    requests.push({ url, body: init?.body && JSON.parse(init.body) });
    return new Response(JSON.stringify({ success: true, data: { products: [product], wifiBatches: [], revision: requests.length === 1 ? 7 : 8 } }), { status: 200 });
  };
  const loaded = await storage.hydrateManualInventory();
  assert.equal((loaded as any).revision, 7);
  const saved = await storage.saveManualInventory([product], []);
  assert.equal(requests[1].body.revision, 7);
  assert.equal((saved as any).revision, 8);
});

test('conflict refreshes confirmed inventory but preserves caller draft and never retries save', async () => {
  const draft = structuredClone(product);
  draft.voucherCodes = ['pending|secret'];
  const requests: any[] = [];
  globalThis.fetch = async (url: any, init: any) => {
    requests.push({ url, body: init?.body && JSON.parse(init.body) });
    if (String(url).endsWith('/save')) return new Response(JSON.stringify({ success: false, message: 'Stok berubah' }), { status: 409 });
    return new Response(JSON.stringify({ success: true, data: { products: [{ ...product, voucherCodes: [], stock: 0 }], wifiBatches: [], revision: 9 } }), { status: 200 });
  };
  await assert.rejects(storage.saveManualInventory([draft], []), /konflik|berubah/i);
  assert.equal(requests.length, 2);
  assert.ok(String(requests[1].url).endsWith('/load'));
  assert.deepEqual(draft.voucherCodes, ['pending|secret']);
  assert.equal(storage.getProducts().find(p => p.id === product.id)?.stock, 0);
});

test('uninitialized inventory hydrates before allowing a mutation and fails closed without server revision', async () => {
  storage.manualInventoryRevision = null;
  const requests: string[] = [];
  globalThis.fetch = async (url: any) => {
    requests.push(String(url));
    return new Response(JSON.stringify({ success: true, data: { products: [], wifiBatches: [] } }), { status: 200 });
  };
  await assert.rejects(storage.saveManualInventory([product], []), /revisi|revision|muat/i);
  assert.equal(requests.length, 1);
  assert.ok(requests[0].endsWith('/load'));
});
