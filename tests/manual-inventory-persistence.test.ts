import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';

async function invokeInventorySave(persisted: boolean) {
  const file = new URL('../backend/src/index.ts', import.meta.url);
  const source = ts.createSourceFile(file.pathname, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  let handlers: Function[] = [];
  let received: any = null;
  const context: any = {
    app: {
      post: (path: string, ...fns: Function[]) => {
        if (path === '/api/admin/inventory/save') handlers = fns;
      },
    },
    requireAdmin: (_req: any, _res: any, next: any) => next(),
    mongoDbService: {
      getAllState: async () => ({ products: [] }),
      saveManualInventory: async (products: any[], wifiBatches: any[]) => {
        received = { products, wifiBatches };
        return persisted
          ? { success: true, data: { products, wifiBatches } }
          : { success: false };
      },
    },
  };

  for (const statement of source.statements) {
    const code = statement.getText(source);
    if (code.includes("app.post('/api/admin/inventory/save'")) {
      vm.runInNewContext(ts.transpile(code, { target: ts.ScriptTarget.ES2022 }), context);
    }
  }
  assert.equal(handlers.length, 2, 'inventory save route must be protected by requireAdmin');

  const result: any = { status: 200 };
  const res: any = {
    status: (status: number) => { result.status = status; return res; },
    json: (body: any) => { result.body = body; return res; },
  };
  const req = { body: { products: [{ id: 'wifi-1', stock: 2 }], wifiBatches: [{ id: 'batch-1', vouchers: [] }] } };
  await handlers[0](req, res, () => handlers[1](req, res));
  return { result, received };
}

test('manual inventory save persists product stock and WiFi batches before confirming success', async () => {
  const { result, received } = await invokeInventorySave(true);
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(JSON.stringify(received), JSON.stringify({ products: [{ id: 'wifi-1', stock: 2 }], wifiBatches: [{ id: 'batch-1', vouchers: [] }] }));
  assert.equal(JSON.stringify(result.body.data), JSON.stringify(received));
});

test('manual inventory save fails closed when database persistence is rejected', async () => {
  const { result } = await invokeInventorySave(false);
  assert.equal(result.status, 503);
  assert.equal(result.body.success, false);
});

test('manual product and variant edits await authoritative inventory persistence', () => {
  const manager = fs.readFileSync(new URL('../src/components/ManualProductManager.tsx', import.meta.url), 'utf8');
  const productStart = manager.indexOf('const handleUpdateProduct =');
  const variantStart = manager.indexOf('const handleUpdateVariant =');
  const copyStart = manager.indexOf('const handleCopyStock =');
  assert.ok(productStart >= 0 && variantStart > productStart && copyStart > variantStart);
  const productHandler = manager.slice(productStart, variantStart);
  const variantHandler = manager.slice(variantStart, copyStart);
  for (const handler of [productHandler, variantHandler]) {
    assert.match(handler, /async \(e: React\.FormEvent\)/);
    assert.match(handler, /await persistManualInventory\(allProducts, storage\.getVoucherBatches\(\)\)/);
    assert.doesNotMatch(handler, /storage\.saveProducts\(/);
    assert.match(handler, /catch \(error: any\)/);
  }
});
