import assert from 'node:assert/strict';
import test from 'node:test';
import { createQris, inspect } from '../backend/src/utils/qris';
import { qiospayService } from '../backend/src/services/qiospay';
import { QIOSPAY_CONFIG } from '../backend/src/config/apikeys';
import { mongoDbService } from '../backend/src/services/mongodbService';
import { createPaymentSession } from '../backend/src/services/paymentRouter';

const official = '00020101021126670016COM.NOBUBANK.WWW01189360050300000907180214260525000007320303UMI51440014ID.CO.QRIS.WWW0215ID10265244964310303UMI5204581753033605802ID5923Waroeng Digital QP487976008SIDOARJO61056121162070703A01630472AF';

test('invalid merchant QR is rejected rather than replaced with an invented merchant',()=>{
  assert.throws(()=>createQris('00020101021126370016COM.NOBUBANK.WWW',202),/TLV|tag|CRC|QR/i);
});
test('Qiospay checkout reads valid saved merchant QR instead of broken runtime QR',async()=>{
  QIOSPAY_CONFIG.QRIS_STRING='00020101021126370016COM.NOBUBANK.WWW';
  QIOSPAY_CONFIG.QR_STRING=QIOSPAY_CONFIG.QRIS_STRING;
  mongoDbService.getSettingsFromDatabase=async()=>({qiospayQrString:official});
  const result=await createPaymentSession({orderId:'fixture-invoice',grossAmount:202,preferredGateway:'QIOSPAY',items:[]});
  const source=inspect(official).values, generated=inspect(result.qrString!).values;
  for(const tag of ['26','51','52','58','59','60','61','62']) assert.equal(generated[tag],source[tag],`merchant routing ${tag} must remain original`);
  assert.equal(generated['54'],'202');assert.equal(result.totalPayment,202);
});
test('bad configured QR cannot be returned as successful payment session',()=>{
  QIOSPAY_CONFIG.QRIS_STRING='00020101021126370016COM.NOBUBANK.WWW';
  QIOSPAY_CONFIG.QR_STRING=QIOSPAY_CONFIG.QRIS_STRING;
  assert.throws(()=>qiospayService.createPaymentQris({amount:202,orderId:'fixture'}),/QR|tag|TLV/i);
});
