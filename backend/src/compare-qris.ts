import { parse, inspect, createQris, crc16, formatTLV } from './utils/qris.js';

function getSampleRawStatic(): string {
  const enc = (tag: string, val: string) => tag + String(val.length).padStart(2, '0') + val;
  const tag26 = enc('26', enc('00', 'ID.CO.QIOSPAY.WWW') + enc('01', '936009110020000000') + enc('02', '000000000000000') + enc('03', 'UME'));
  const tag51 = enc('51', enc('00', 'ID.CO.QRIS.WWW') + enc('01', 'ID1020021000000') + enc('02', '00000000'));
  const prefix = enc('00', '01') + enc('01', '11') + tag26 + tag51 + enc('52', '5411') + enc('53', '360') + enc('58', 'ID') + enc('59', 'WAYAHE DIGITAL') + enc('60', 'BANDUNG') + enc('61', '40115') + enc('62', enc('07', 'A01')) + '6304';
  return prefix + crc16(prefix);
}

const rawStatic = getSampleRawStatic();
const dynamicResult = createQris(rawStatic, 2000, { providerConfirmed: true });
const dynamicConverted = dynamicResult.qrString;

console.log('═══════════════════════════════════════════════════════════════════════');
console.log('   KOMPARASI TEKNIS PAYLOAD MENGGUNAKAN inspect() DARI qris.mjs');
console.log('═══════════════════════════════════════════════════════════════════════');

const inspRaw = inspect(rawStatic);
const inspDyn = inspect(dynamicConverted);

console.log('\n[1] PAYLOAD STRING:');
console.log('  • QRIS Asli (Raw Static):');
console.log(`    ${rawStatic}`);
console.log('  • QRIS Hasil createQris (Rp 2.000):');
console.log(`    ${dynamicConverted}`);

console.log('\n[2] PERBANDINGAN PER TAG TLV:');
const allTags = Array.from(new Set([...inspRaw.rows.map(r => r.tag), ...inspDyn.rows.map(r => r.tag)])).sort();
console.log('-----------------------------------------------------------------------');
console.log(' Tag | Asli (Raw) Value               | Dinamis (Generated) Value');
console.log('-----------------------------------------------------------------------');
for (const tag of allTags) {
  const rVal = inspRaw.values[tag] ? `[len:${inspRaw.values[tag].length}] ${inspRaw.values[tag]}` : '(tidak ada)';
  const dVal = inspDyn.values[tag] ? `[len:${inspDyn.values[tag].length}] ${inspDyn.values[tag]}` : '(tidak ada)';
  console.log(` ${tag.padEnd(3, ' ')} | ${rVal.substring(0, 30).padEnd(30, ' ')} | ${dVal}`);
}
console.log('-----------------------------------------------------------------------');

console.log('\n[3] CRC16 & STATUS:');
console.log('  • CRC QR Asli     :', rawStatic.slice(-4));
console.log('  • CRC QR Dinamis  :', dynamicConverted.slice(-4));
console.log('  • Method          :', dynamicResult.method);
console.log('  • Payment Status  :', dynamicResult.paymentStatus);
console.log('═══════════════════════════════════════════════════════════════════════\n');
