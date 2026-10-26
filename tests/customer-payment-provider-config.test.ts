import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import test from 'node:test';
test('customer payment status uses canonical order and database provider keys, not caller keys',async()=>{
 const source=ts.createSourceFile('index.ts',fs.readFileSync('backend/src/index.ts','utf8'),ts.ScriptTarget.Latest,true);
 const code=source.statements.find(n=>n.getText(source).startsWith('const handleOrderStatusCheck ='))!.getText(source);
 const order={id:'fixture',invoiceNumber:'FIXTURE',paymentStatus:'PENDING',fulfillmentStatus:'NOT_STARTED',paymentGatewayProvider:'QIOSPAY'};
 let received:any,body:any;
 const context:any={console,prisma:{order:{findFirst:async()=>null}},fulfillmentService:{},canReadOrder:async()=>true,
 mongoDbService:{getAllState:async()=>({orders:[order]}),getSettingsFromDatabase:async()=>({qiospayMerchantCode:'db-merchant',qiospayApiKey:'db-fixture-key'})},
 qiospayService:{checkAndReconcileOrderStatus:async(...args:any[])=>{received=args;return {success:true,paymentStatus:'PENDING',fulfillmentStatus:'NOT_STARTED',order};}}};
 const handler=vm.runInNewContext(ts.transpile(code+';handleOrderStatusCheck',{target:ts.ScriptTarget.ES2022}),context);
 const res:any={status(){return res;},json(value:any){body=value;return res;}};
 await handler({params:{identifier:'fixture'},query:{merchant_code:'forged',api_key:'forged'},headers:{}},res);
 assert.equal(body.success,true);assert.equal(received[3],'db-merchant');assert.equal(received[4],'db-fixture-key');
});
