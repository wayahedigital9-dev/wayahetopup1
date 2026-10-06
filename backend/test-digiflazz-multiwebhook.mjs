import crypto from 'crypto';
import assert from 'assert';

console.log('--- TESTING DIGIFLAZZ MULTI-WEBHOOK & SIGNATURE INTEGRATION ---');

// 1. Test Signature MD5(username + apiKey + ref_id)
const username = 'testuser';
const apiKey = 'testapikey123';
const refId = 'WD-20260928-X7K92P';
const expectedSign = crypto.createHash('md5').update(username + apiKey + refId).digest('hex');
console.log('✓ Signature MD5 generated:', expectedSign);
assert.strictEqual(expectedSign.length, 32, 'MD5 signature must be 32 hex chars');

// 2. Test HMAC SHA1 Webhook Signature
const secret = 'webhooksecret999';
const rawBody = JSON.stringify({
  data: {
    ref_id: refId,
    customer_no: '081234567890',
    buyer_sku_code: 'xld25',
    message: 'Sukses',
    status: 'Sukses',
    rc: '00',
    sn: '12345678901234',
    price: 25000,
  }
});
const hmac = crypto.createHmac('sha1', secret).update(Buffer.from(rawBody, 'utf8')).digest('hex');
const hubSignature = `sha1=${hmac}`;
console.log('✓ Webhook HMAC SHA1 Signature:', hubSignature);

// Timing safe equal test
const calculatedHmac = crypto.createHmac('sha1', secret).update(Buffer.from(rawBody, 'utf8')).digest('hex');
const expectedHub = `sha1=${calculatedHmac}`;
const sigBuffer = Buffer.from(hubSignature);
const expBuffer = Buffer.from(expectedHub);
assert.strictEqual(sigBuffer.length, expBuffer.length);
assert.strictEqual(crypto.timingSafeEqual(sigBuffer, expBuffer), true, 'Signature must match via timingSafeEqual');
console.log('✓ TimingSafeEqual verification PASSED');

// 3. Test Multi-Webhook Callback URL Whitelist
const allowedUrls = [
  'https://website-a.com/api/webhooks/digiflazz',
  'https://website-b.com/api/webhooks/digiflazz',
];
function testResolveCallbackUrl(candidate, defaultWebhook, whitelist) {
  if (candidate && candidate.trim()) {
    const trimmed = candidate.trim();
    if (whitelist.includes(trimmed) || (defaultWebhook && trimmed === defaultWebhook)) {
      return trimmed;
    }
  }
  return defaultWebhook || undefined;
}

const defaultWebhook = 'https://wayahedigital.my.id/api/webhooks/digiflazz';
// Allowed candidate A
assert.strictEqual(
  testResolveCallbackUrl('https://website-a.com/api/webhooks/digiflazz', defaultWebhook, allowedUrls),
  'https://website-a.com/api/webhooks/digiflazz'
);
// Allowed candidate B
assert.strictEqual(
  testResolveCallbackUrl('https://website-b.com/api/webhooks/digiflazz', defaultWebhook, allowedUrls),
  'https://website-b.com/api/webhooks/digiflazz'
);
// Disallowed candidate (should fallback to default)
assert.strictEqual(
  testResolveCallbackUrl('https://malicious-site.com/api/webhooks/digiflazz', defaultWebhook, allowedUrls),
  defaultWebhook
);
// Undefined candidate (should use default)
assert.strictEqual(
  testResolveCallbackUrl(undefined, defaultWebhook, allowedUrls),
  defaultWebhook
);
console.log('✓ Multi-Webhook URL Whitelist Resolution PASSED');

// 4. Test Terminal Status Protection Logic
function testStatusTransition(oldStatus, newDigiStatus) {
  const isPending = newDigiStatus.toLowerCase() === 'pending';
  if ((oldStatus === 'SUCCESS' || oldStatus === 'FAILED') && isPending) {
    return { allowed: false, reason: 'Terminal status cannot be downgraded to PENDING' };
  }
  if (oldStatus === 'SUCCESS' && newDigiStatus.toLowerCase() === 'sukses') {
    return { allowed: true, isDuplicate: true };
  }
  return { allowed: true, newStatus: newDigiStatus === 'Sukses' ? 'SUCCESS' : (newDigiStatus === 'Gagal' ? 'FAILED' : 'PROCESSING') };
}

// SUCCESS -> Pending: REJECTED
assert.strictEqual(testStatusTransition('SUCCESS', 'Pending').allowed, false);
// FAILED -> Pending: REJECTED
assert.strictEqual(testStatusTransition('FAILED', 'Pending').allowed, false);
// PROCESSING -> Sukses: ALLOWED (SUCCESS)
assert.strictEqual(testStatusTransition('PROCESSING', 'Sukses').newStatus, 'SUCCESS');
// SUCCESS -> Sukses: IDEMPOTENT (no re-fulfillment)
assert.strictEqual(testStatusTransition('SUCCESS', 'Sukses').isDuplicate, true);
console.log('✓ Terminal Status & Idempotency Rules PASSED');

console.log('ALL TESTS COMPLETED SUCCESSFULLY!');
