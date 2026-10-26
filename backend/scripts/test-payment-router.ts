// Uji direktori PaymentRouter: VA harus gagal jujur (kredensial belum ada);
// QRIS harus tetap berjalan. Tidak ada panggilan jaringan nyata untuk VA.
import { createPaymentSession, listPaymentChannels } from '../src/services/paymentRouter.js';

(async () => {
  let gagal = 0;
  const cek = (nama: string, ok: boolean, info = '') => {
    console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${nama}${info ? ' — ' + info : ''}`);
    if (!ok) gagal++;
  };

  // 1. Daftar channel: QRIS tersedia; VA Qiospay unavailable tanpa kredensial.
  const channels = listPaymentChannels();
  const qris = channels.find((c) => c.kind === 'QRIS');
  const vaBri = channels.find((c) => c.id === 'qiospay_va_002');
  cek('channel QRIS tersedia', Boolean(qris && !qris.unavailable), qris?.label);
  cek('channel VA BRI ada', Boolean(vaBri));
  cek('channel VA BRI unavailable tanpa kredensial', Boolean(vaBri?.unavailable), vaBri?.unavailableReason);

  // 2. VA Qiospay -> harus THROW (tidak boleh menampilkan nomor VA karangan).
  let thrown = '';
  try {
    await createPaymentSession({
      orderId: 'TEST-VA-1', grossAmount: 15000, preferredGateway: 'QIOSPAY',
      paymentMethod: 'va:002', customerName: 'Uji', items: [],
    });
  } catch (e: any) { thrown = e.message; }
  cek('VA Qiospay gagal jujur tanpa kredensial', /belum aktif|gagal dibuat/i.test(thrown), thrown.slice(0, 70));

  // 3. VA Qiospay di bawah gateway PAKASIR tetap TIDAK jatuh ke jalur QRIS.
  let thrown2 = '';
  try {
    await createPaymentSession({
      orderId: 'TEST-VA-2', grossAmount: 15000, preferredGateway: 'PAKASIR',
      paymentMethod: 'va:009', customerName: 'Uji', items: [],
    });
  } catch (e: any) { thrown2 = e.message; }
  cek('VA Qiospay di bawah PAKASIR tetap gagal jujur (bukan QRIS)', /belum aktif|gagal dibuat/i.test(thrown2), thrown2.slice(0, 70));

  // 4. QRIS Qiospay tetap berfungsi dan mengembalikan qrString.
  const qrisRes = await createPaymentSession({
    orderId: 'TEST-QRIS-1', grossAmount: 15000, preferredGateway: 'QIOSPAY',
    paymentMethod: 'qris', customerName: 'Uji', items: [],
  });
  cek('QRIS Qiospay tetap berfungsi', Boolean(qrisRes.qrString && qrisRes.qrString.startsWith('000201')), `gateway=${qrisRes.gateway}`);
  cek('QRIS tidak mengisi field VA', !qrisRes.vaNumber);

  console.log(gagal === 0 ? '\nSEMUA LULUS' : `\n${gagal} GAGAL`);
  process.exit(gagal === 0 ? 0 : 1);
})();
