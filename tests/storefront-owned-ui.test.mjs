import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const require = createRequire(join(process.cwd(), 'package.json'));
const { build } = require('esbuild');
const React = require('react');
const { act } = React;
const { createRoot } = require('react-dom/client');
// Keep the optional DOM harness outside the repository/lockfile.
const { JSDOM } = require(process.env.STOREFRONT_JSDOM || '/root/.hermes/cache/scratch/storefront-ui-harness/node_modules/jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const scratch = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'storefront-owned-ui-'));
const output = join(scratch, 'components.cjs');
symlinkSync(join(process.cwd(), 'node_modules'), join(scratch, 'node_modules'));
writeFileSync(join(scratch, 'storage.cjs'), `exports.storage = { getSettings: () => globalThis.__storefront.settings, getVoucherBatches: () => { globalThis.__storefront.stockReads++; return []; }, getOrders: () => [] };`);
writeFileSync(join(scratch, 'adapter.cjs'), `exports.apiAdapter = { checkOrderStatus: async () => { globalThis.__storefront.paymentChecks++; return globalThis.__storefront.payment; }, simulatePakasirPayment: async () => { globalThis.__storefront.simulations++; return { success: true }; } };`);
const built = await build({ stdin: { contents: `export { WifiVoucherPage } from './src/pages/WifiVoucherPage'; export { InvoiceModal } from './src/components/InvoiceModal'; export { SnapSimulatorModal } from './src/components/SnapSimulatorModal';`, resolveDir: process.cwd(), loader: 'tsx' }, outfile: output, bundle: true, platform: 'node', format: 'cjs', jsx: 'transform', external: ['react', 'react-dom'], plugins: [{ name: 'fixture-only-services', setup(builder) { builder.onResolve({ filter: /services\/(storage|apiAdapter)$/ }, args => ({ path: join(scratch, args.path.endsWith('storage') ? 'storage.cjs' : 'adapter.cjs') })); } }], write: false });
writeFileSync(output, built.outputFiles[0].contents);
const { WifiVoucherPage, InvoiceModal, SnapSimulatorModal } = require(output);
let root;
let host;
function reset() {
  globalThis.__storefront = { settings: { siteName: 'Fixture Store', paymentGatewayProvider: 'QIOSPAY' }, stockReads: 0, paymentChecks: 0, simulations: 0, payment: { paymentStatus: 'PENDING', fulfillmentStatus: 'NOT_STARTED' } };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
}
async function render(Component, props) { await act(async () => { root.render(React.createElement(Component, props)); await new Promise(resolve => setTimeout(resolve, 20)); }); }
async function click(element) { assert.ok(element, 'requested control exists'); await act(async () => { element.click(); await new Promise(resolve => setTimeout(resolve, 20)); }); }
function button(name) { return [...host.querySelectorAll('button')].find(el => el.textContent.includes(name) || el.getAttribute('aria-label') === name); }
afterEach(async () => { if (root) await act(async () => root.unmount()); host?.remove(); root = null; });
process.on('exit', () => rmSync(scratch, { recursive: true, force: true }));
const product = { id: 'wifi-test', categoryId: 'wifi', name: 'WiFi Fixture', provider: 'Fixture', sku: 'fixture', description: '', supplierPrice: 1000, sellingPrice: 2000, deliveryMethod: 'AUTOMATIC', isActive: true, stock: 0, voucherCodes: ['UNSOLD-SECRET'] };
const receipt = { id: 'order-test', invoiceNumber: 'INV-FIXTURE', targetDestination: 'Fixture Buyer', category: 'wifi', items: [{ productId: 'wifi-test', productName: 'WiFi Fixture', provider: 'Fixture', category: 'wifi', sellingPrice: 2000, deliveryMethod: 'AUTOMATIC', targetNumberOrAccount: 'Fixture Buyer' }], subtotal: 2000, adminFee: 0, discount: 0, totalAmount: 2000, paymentStatus: 'PENDING', fulfillmentStatus: 'NOT_STARTED', deliveryMethod: 'AUTOMATIC', guestAccessToken: 'fixture-guest-token', createdAt: '2026-10-09T01:00:00Z', updatedAt: '2026-10-09T01:00:00Z' };
test('WiFi catalog never reads public stock codes and blocks unknown/zero stock', async () => {
  reset(); let purchases = 0;
  await render(WifiVoucherPage, { products: [product], onSelectProductToCheckout: () => purchases++ });
  assert.equal(__storefront.stockReads, 0, 'must not read browser voucher batches');
  assert.doesNotMatch(host.textContent, /Unlimited|No FUP|Up to 10 Mbps|UNSOLD-SECRET/);
  assert.equal(host.querySelector('#buy-wifi-wifi-test').disabled, true);
  await click(host.querySelector('#buy-wifi-wifi-test')); assert.equal(purchases, 0);
  await render(WifiVoucherPage, { products: [{ ...product, stock: undefined }], onSelectProductToCheckout: () => purchases++ });
  assert.equal(host.querySelector('#buy-wifi-wifi-test').disabled, true);
});
test('WiFi selected active variant controls checkout stock, price and safe payload', async () => {
  reset(); let purchased;
  const variants = [ { id: 'deleted', name: 'Hidden variant', stock: 999, sellingPrice: 1, isDeleted: true }, { id: 'empty', name: 'Sold out', stock: 0, sellingPrice: 2000 }, { id: 'available', name: 'Available variant', stock: 3, sellingPrice: 4500, duration: '2 jam', speed: '5 Mbps', voucherCodes: ['VARIANT-SECRET'] } ];
  await render(WifiVoucherPage, { products: [{ ...product, stock: 99, hasVariants: true, variants }], onSelectProductToCheckout: p => purchased = p });
  assert.doesNotMatch(host.textContent, /Hidden variant/);
  assert.equal(host.querySelector('#buy-wifi-wifi-test').disabled, true);
  await click(button('Available variant'));
  assert.match(host.textContent, /3 tersedia/);
  await click(host.querySelector('#buy-wifi-wifi-test'));
  assert.equal(purchased.selectedVariantId, 'available'); assert.equal(purchased.sellingPrice, 4500); assert.equal(purchased.stock, 3);
  assert.equal(purchased.voucherCodes, undefined); assert.ok(purchased.variants.every(v => !v.voucherCodes));
});
test('receipt reads authenticated canonical order immediately and never discloses unpaid fulfillment', async () => {
  reset(); const requests = [];
  globalThis.fetch = async (url, options) => { requests.push([url, options]); return { ok: true, json: async () => ({ data: { ...receipt, fulfillmentStatus: 'SUCCESS', voucherCode: 'UNPAID-CANONICAL' } }) }; };
  await render(InvoiceModal, { order: { ...receipt, paymentStatus: 'PAID', fulfillmentStatus: 'SUCCESS', voucherCode: 'STALE-BROWSER-CODE' }, isOpen: true, onClose() {}, onCopyText() {} });
  assert.ok(requests.length > 0, 'must fetch even a locally final order');
  assert.equal(requests[0][0], '/api/orders/order-test');
  assert.equal(requests[0][1].headers['x-guest-token'], 'fixture-guest-token');
  assert.doesNotMatch(host.textContent, /STALE-BROWSER-CODE|UNPAID-CANONICAL/);
});
test('payment cannot invent QR or paid success from adapter/local state', async () => {
  reset(); let paid = 0;
  __storefront.payment = { paymentStatus: 'PAID', fulfillmentStatus: 'SUCCESS' };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ data: receipt }) });
  await render(SnapSimulatorModal, { order: { ...receipt, category: 'premium' }, snapToken: '', isOpen: true, onClose() {}, onCopyText() {}, onSimulateResult() { paid++; } });
  assert.equal(host.querySelector('img[alt^="QRIS"]'), null, 'no merchant fallback or fictitious QR');
  await new Promise(resolve => setTimeout(resolve, 450));
  assert.equal(paid, 0, 'adapter PAID cannot override canonical PENDING');
});
