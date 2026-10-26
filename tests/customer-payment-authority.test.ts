import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import test from 'node:test';
function adapter(method: string, context: any, file = 'src/services/apiAdapter.ts') {
  const s=ts.createSourceFile('adapter.ts',fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  let found='';
  function visit(n:ts.Node){if(ts.isMethodDeclaration(n)&&n.name?.getText(s)===method)found=n.getText(s);ts.forEachChild(n,visit);}
  visit(s); assert.ok(found);
  return vm.runInNewContext(ts.transpile('({'+found+'})',{target:ts.ScriptTarget.ES2022}),context);
}
test('payment polling ignores local PAID cache and reads verified complete server order without provider keys',async()=>{
  const local={id:'fixture-order',invoiceNumber:'fixture-invoice',paymentStatus:'PAID',fulfillmentStatus:'SUCCESS',guestAccessToken:'fixture-token'};
  const server={...local,fulfillmentStatus:'PROCESSING'};let calls=0,cache:any;
  const a=adapter('checkOrderStatus',{storage:{getOrders:()=>[local],getSettings:()=>({}),cacheServerOrder:(o:any)=>{cache=o;}},fetch:async(url:string,init:any)=>{calls++;assert.ok(!url.includes('api_key')&&!url.includes('merchant_code'));assert.equal(init.credentials,'same-origin');return {ok:true,json:async()=>({success:true,paymentStatus:'PAID',fulfillmentStatus:'PROCESSING',order:server})};},URLSearchParams});
  a.processPaymentWebhook=async()=>{throw new Error('client fulfillment forbidden');};
  const result=await a.checkOrderStatus(local.id);
  assert.equal(calls,1);assert.equal(result.fulfillmentStatus,'PROCESSING');assert.equal(cache?.id,server.id);
});
test('payment confirmation cannot fabricate PAID when server still says PENDING',async()=>{
  const local={id:'fixture-order',paymentStatus:'PENDING'};
  const a=adapter('processPaymentWebhook',{storage:{getOrders:()=>[local]}});
  a.getOrder=async()=>({id:'fixture-order',paymentStatus:'PENDING',fulfillmentStatus:'NOT_STARTED'});
  await assert.rejects(a.processPaymentWebhook('fixture-order','PAID'));
  assert.equal(local.paymentStatus,'PENDING','unconfirmed server state must not be overwritten locally');
});

test('rejected checkout never fabricates a local invoice or QR', async()=>{
  let caches=0;
  const a=adapter('createOrder', { storage:{getSettings:()=>({paymentGatewayProvider:'QIOSPAY'}),getOrders:()=>[],saveOrders:()=>{caches++;},cacheServerOrder:()=>{caches++;}}, generateInvoiceNumber:()=> 'FIXTURE',generateSecureToken:()=> 'fixture-token',convertStaticToDynamicQRIS:()=> 'FAKE-QR',fetch:async()=>({ok:false,status:400,json:async()=>({message:'fixture rejected'})}) });
  a.getProductById=async()=>({id:'fixture',name:'fixture',categoryId:'premium',sellingPrice:1000});
  await assert.rejects(a.createOrder({productId:'fixture',targetDestination:'fixture-buyer'}),/fixture rejected/);
  assert.equal(caches,0);
});
