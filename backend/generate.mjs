import {createQris} from './qris.mjs';
try {
  const qrString = process.env.QIOSPAY_QRIS_STRING || process.env.QIOSPAY_QR_STRING || '';
  const result=createQris(qrString,Number(process.argv[2]),{
    providerConfirmed:process.env.QIOSPAY_LOCAL_DYNAMIC_CONFIRMED==='true'
  });
  console.log(JSON.stringify(result,null,2));
} catch(error) {console.error(error.message);process.exitCode=1;}
