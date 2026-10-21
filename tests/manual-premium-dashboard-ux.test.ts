import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';

const dashboard = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');
const premiumPage = fs.readFileSync('src/pages/PremiumPage.tsx', 'utf8');
const handlerSource = dashboard.slice(dashboard.indexOf('  const handleAddPremiumProduct ='), dashboard.indexOf('  const handleDeleteProduct ='));
function createHandler(save: (...args: any[]) => Promise<any>) {
  const events: string[] = [];
  const scope: any = {
    newPremiumForm: { name: 'Real Premium', provider: 'Test', sellingPrice: 1000, supplierPrice: 0, duration: '1 Month', accountType: 'Private', warranty: '', description: '', iconUrl: '', rawCodes: 'person|secret\nLICENSE-ONE\n', stock: 99 },
    storage: { getProducts: () => [], getVoucherBatches: () => [], getManualInventoryRevision: () => 1, saveManualInventory: save, addProduct: () => events.push('local-only') },
    persistDashboardInventory: async (products: any[]) => save(products, []),
    parsePremiumStock: (text: string) => text.split(/\r?\n/).map(x => x.trim()).filter(Boolean),
    setIsSubmittingModal: () => {}, triggerTopLoading: { start() {}, done() {} },
    onRefreshData: () => events.push('refresh'), setShowAddPremiumModal: () => events.push('close'), setNewPremiumForm: () => events.push('reset'),
    onShowToast: (_title: string, _message: string, type: string) => events.push(type),
    setTimeout: (fn: () => void) => fn(),
  };
  const code = ts.transpileModule(handlerSource + '\nreturn handleAddPremiumProduct;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return { events, handler: new Function(...Object.keys(scope), code)(...Object.values(scope)) };
}

test('premium create awaits canonical save before success and derives stock from private real lines', async () => {
  let resolve!: (value: any) => void;
  const pending = new Promise(resolveSave => { resolve = resolveSave; });
  let payload: any;
  const { handler, events } = createHandler(async (products) => { payload = products; return pending; });
  const work = handler({ preventDefault() {} });
  assert.ok(payload, 'canonical inventory save must be called');
  assert.equal(payload[0].stock, 2);
  assert.deepEqual(payload[0].voucherCodes, ['person|secret', 'LICENSE-ONE']);
  assert.equal(events.includes('success'), false);
  resolve({ products: payload, wifiBatches: [], revision: 2 });
  await work;
  assert.ok(events.includes('success'));
});

test('failed premium save preserves pending form and never announces success', async () => {
  const { handler, events } = createHandler(async () => { throw new Error('Conflict'); });
  await handler({ preventDefault() {} });
  assert.ok(events.includes('error'));
  assert.equal(events.includes('success'), false);
  assert.equal(events.includes('reset'), false);
  assert.equal(events.includes('close'), false);
});

test('premium storefront never invents ten slots and guards manual empty checkout', () => {
  assert.doesNotMatch(premiumPage, /stock\s*\?\?\s*10/);
  assert.match(premiumPage, /premiumAvailableStock\(product\)/);
});
