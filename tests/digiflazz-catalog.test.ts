import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';
const root=new URL('../',import.meta.url);
function digi(){
 const src=ts.createSourceFile('digi.ts',fs.readFileSync(new URL('backend/src/services/digiflazz.ts',root),'utf8'),ts.ScriptTarget.Latest,true);
 const body=src.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(src).replace(/^export /,'')).join('\n');
 let payload:any,endpoint='';let writes=0;
 const cfg:any={USERNAME:'fixture-user',API_KEY:'fixture-key',BASE_URL:'https://fixture.invalid',ALLOWED_CALLBACK_URLS:[],TESTING:false};
 const ctx:any={crypto,console:{log(){},warn(){},error(){}},DIGIFLAZZ_CONFIG:cfg,process:{cwd:()=>'/fixture'},path:{join:(...p:string[])=>p.join('/')},fs:{existsSync:()=>true,readFileSync:()=>JSON.stringify([{buyer_sku_code:'cached-game'}]),writeFileSync:()=>{writes++;}},outboundIpService:{getHttpClient:()=>({post:async(url:string,p:any)=>{endpoint=url;payload=p;return {data:{data:{rc:'41',message:'Signature Anda salah'}}};}})}};
 const loaded=vm.runInNewContext(ts.transpile(body+';({service:digiflazzService,create:createDigiflazzTransaction})',{target:ts.ScriptTarget.ES2022}),ctx);
 return {...loaded,ctx,cfg,request:()=>({payload,endpoint}),writes:()=>writes};
}
test('strict catalog probe rejects bad credentials instead of returning historical cache',async()=>{
 const {service}=digi();await assert.rejects(service.fetchPriceList({allowCache:false}),/Signature Anda salah/);
});
test('strict catalog probe verifies POST signing without mutating products or cache',async()=>{
 const {service,ctx,request,writes}=digi();
 ctx.outboundIpService.getHttpClient=()=>({post:async(url:string,p:any)=>{ctx.last={url,p};return {data:{data:[{buyer_sku_code:'fixture-game',category:'Games',buyer_product_status:true,seller_product_status:true}]}};}});
 const rows=await service.fetchPriceList({allowCache:false});assert.equal(rows.length,1);assert.equal(ctx.last.url,'https://fixture.invalid/price-list');assert.equal(ctx.last.p.cmd,'prepaid');assert.equal(ctx.last.p.sign,crypto.createHash('md5').update('fixture-userfixture-keypricelist').digest('hex'));assert.equal(writes(),0);
});
test('transaction and pending status use H2H POST signature and same ref_id with isolated network',async()=>{
 const {service,ctx,cfg,create}=digi();const calls:any[]=[];
 ctx.outboundIpService.getHttpClient=()=>({post:async(url:string,p:any)=>{calls.push({url,p});return {data:{data:{status:'Pending',rc:'03',ref_id:p.ref_id}}};}});
 const params={buyerSkuCode:'fixture-game',customerNo:'fixture-account',refId:'fixture-ref'};
 await create(params);await service.checkTransactionStatus(params);
 assert.equal(calls.length,2);for(const {url,p} of calls){assert.equal(url,'https://fixture.invalid/transaction');assert.equal(p.ref_id,'fixture-ref');assert.equal(p.sign,crypto.createHash('md5').update('fixture-userfixture-keyfixture-ref').digest('hex'));}
});
test('read-only game probe counts actual available upstream SKUs without state mirror writes',async()=>{
 const text=fs.readFileSync(new URL('backend/src/index.ts',root),'utf8');const src=ts.createSourceFile('index.ts',text,ts.ScriptTarget.Latest,true);let route='';
 for(const n of src.statements){const s=n.getText(src);if(s.startsWith("app.get('/api/digiflazz/game-status'"))route=s;}
 let handler:any,body:any;const res:any={status:()=>res,json:(v:any)=>{body=v;}};
 const ctx:any={console,requireAdmin(){},app:{get:(_p:any,_a:any,fn:any)=>{handler=fn;}},digiflazzService:{fetchPriceList:async(opts:any)=>{assert.equal(opts.allowCache,false);return [{category:'Games',buyer_sku_code:'one',buyer_product_status:true,seller_product_status:true,unlimited_stock:true},{category:'Games',buyer_sku_code:'two',buyer_product_status:true,seller_product_status:false,stock:2}];}},mongoDbService:{getAllState:async()=>{throw new Error('Read-only probe must not invoke mirrored/seedable full state');},getClient:async()=>({db:()=>({collection:()=>({find:()=>({toArray:async()=>[{supplierSku:'one'},{sku:'two'}]})})})}),getPrimaryDbName:()=>''}};
 assert.ok(route,'game status route missing');vm.runInNewContext(ts.transpile(route,{target:ts.ScriptTarget.ES2022}),ctx);await handler({},res);
 assert.equal(body.success,true);assert.equal(body.data.savedGameCount,2);assert.equal(body.data.availableSavedGameCount,1);assert.equal(body.data.fulfillmentVerified,false);
});
test('game-only H2H sync preserves non-game categories and reports real added/updated counts',async()=>{
 const src=ts.createSourceFile('index.ts',fs.readFileSync(new URL('backend/src/index.ts',root),'utf8'),ts.ScriptTarget.Latest,true);
 const fn=src.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.getText(src)==='syncDigiflazzCatalog')!;
 let saved:any;const ctx:any={console:{log(){},warn(){},error(){}},digiflazzService:{fetchPriceList:async()=>[{category:'Games',buyer_sku_code:'one'},{category:'Games',buyer_sku_code:'two'},{category:'Pulsa',buyer_sku_code:'pulse'}]},mongoDbService:{getAllState:async()=>({products:[{id:'df-one',categoryId:'game'},{id:'old-pulse',categoryId:'pulsa'},{id:'smm-other',categoryId:'smm'}]}),syncEntity:async(_name:any,p:any)=>{saved=p;return true;}},transformDigiflazzProduct:(p:any)=>({id:'df-'+p.buyer_sku_code,categoryId:p.category==='Games'?'game':'pulsa'}),prisma:{product:{upsert:async()=>{}}}};
 const run=vm.runInNewContext(ts.transpile(fn.getText(src).replace(/^export /,'')+';syncDigiflazzCatalog',{target:ts.ScriptTarget.ES2022}),ctx);
 const result=await run('game');assert.equal(result.count,2);assert.equal(result.added,1);assert.equal(result.updated,1);assert.ok(saved.some((p:any)=>p.id==='old-pulse'));assert.ok(saved.some((p:any)=>p.id==='smm-other'));assert.equal(saved.some((p:any)=>p.id==='df-pulse'),false);
});
test('read-only game probe exists; startup cannot silently rewrite catalog after restart',()=>{
 const text=fs.readFileSync(new URL('backend/src/index.ts',root),'utf8');assert.ok(text.includes("app.get('/api/digiflazz/game-status', requireAdmin"));
 const startup=text.slice(text.indexOf('app.listen(PORT'));assert.equal(startup.includes('setTimeout('),false);
});
