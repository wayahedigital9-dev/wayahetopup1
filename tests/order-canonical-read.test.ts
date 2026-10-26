import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import test from 'node:test';

test('invoice API reads complete canonical order instead of stale Prisma mirror', async () => {
  const src = ts.createSourceFile('index.ts', fs.readFileSync('backend/src/index.ts','utf8'), ts.ScriptTarget.Latest, true);
  const route = src.statements.find(n => n.getText(src).startsWith("app.get('/api/orders/:ref_id'"))!.getText(src);
  const canonical = { id:'fixture-id', invoiceNumber:'fixture-invoice', paymentStatus:'PAID', fulfillmentStatus:'SUCCESS', supplierSku:'data', serialNumber:'fixture-sn' };
  let handler: any, response: any;
  vm.runInNewContext(ts.transpile(route, {target:ts.ScriptTarget.ES2022}), {
    app:{get:(_p:any, fn:any)=>{handler=fn;}},
    prisma:{order:{findFirst:async()=>({...canonical, fulfillmentStatus:'PROCESSING', serialNumber:undefined})}},
    mongoDbService:{getAllState:async()=>({orders:[canonical]})}, canReadOrder:async()=>true,
  });
  const res:any={status(){return res;},json(value:any){response=value;return res;}};
  await handler({params:{ref_id:'fixture-id'}},res);
  assert.equal(response.success,true);
  assert.equal(response.fulfillmentStatus,'SUCCESS');
});

test('payment polling returns canonical fulfillment result instead of stale paid mirror', async () => {
  const src = ts.createSourceFile('qiospay.ts', fs.readFileSync('backend/src/services/qiospay.ts','utf8'), ts.ScriptTarget.Latest, true);
  const declaration = src.statements.find(n => ts.isClassDeclaration(n) && n.name?.text === 'QiospayPaymentService')!.getText(src).replace(/^export /, '');
  const canonical = { id:'fixture-id', invoiceNumber:'fixture-invoice', paymentStatus:'PAID', fulfillmentStatus:'SUCCESS', supplierSku:'data', serialNumber:'fixture-sn' };
  const Service = vm.runInNewContext(ts.transpile(declaration + ';QiospayPaymentService', {target:ts.ScriptTarget.ES2022}), {
    mongoDbService:{getAllState:async()=>({orders:[canonical]})}, fetch:async()=>{throw new Error('provider must not be called');},
  });
  const prisma:any={order:{findFirst:async()=>({...canonical,fulfillmentStatus:'PROCESSING',serialNumber:undefined})}};
  const result = await new Service().checkAndReconcileOrderStatus('fixture-id',prisma);
  assert.equal(result.fulfillmentStatus,'SUCCESS');
  assert.equal(result.order.serialNumber,'fixture-sn');
});
