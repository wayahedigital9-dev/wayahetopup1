import { qiospayService } from './services/qiospay.js';
import { createPaymentSession } from './services/paymentRouter.js';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   TESTING createPaymentQris SERVICE (qris.mjs Module)');
  console.log('═══════════════════════════════════════════════════════');

  const response = qiospayService.createPaymentQris({
    amount: 15000,
    orderId: 'INV-DEMO-15000',
  });

  console.log('\n[1] Response Status:', response.status);
  console.log('[2] Message:', response.message || 'OK');
  console.log('[3] QR Data:', {
    amount: response.amount,
    isDynamic: response.isDynamic,
    providerConfirmed: response.providerConfirmed,
    method: response.method,
    qr_string_preview: response.qrString.substring(0, 40) + '...',
  });

  console.log('\n[4] Testing Payment Router Session Creation:');
  const session = await createPaymentSession({
    orderId: 'INV-DEMO-15000',
    grossAmount: 15000,
    items: [{ id: '1', name: 'Paket Data 15GB', price: 15000, quantity: 1 }],
  });

  console.log('   Gateway:', session.gateway);
  console.log('   Token:', session.token);
  console.log('   QR String Preview:', session.qrString?.substring(0, 40) + '...');
  console.log('═══════════════════════════════════════════════════════');
}

main();
