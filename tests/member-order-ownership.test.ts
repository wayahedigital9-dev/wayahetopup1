import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const text=fs.readFileSync(new URL('../backend/src/index.ts',import.meta.url),'utf8');
const source=ts.createSourceFile('index.ts',text,ts.ScriptTarget.Latest,true);
test('anonymous caller cannot delete member orders by guessed ID or bulk request',async()=>{
 for(const [verb,url] of [['delete','/api/orders/:id'],['post','/api/orders/bulk-delete']]){
  let handlers:any[]=[],writes=0,status=200;
  const res:any={status:(s:number)=>{status=s;return res},json:()=>res};
  const context:any={console,app:{[verb]:(path:string,...fns:any[])=>{if(path===url)handlers=fns}},requireAdmin:(_req:any,res:any)=>res.status(401).json({success:false}),prisma:{order:{deleteMany:async()=>{writes++;}}}};
  for(const node of source.statements){const code=node.getText(source);if(code.startsWith(`app.${verb}('${url}'`))vm.runInNewContext(ts.transpile(code,{target:ts.ScriptTarget.ES2022}),context);}
  assert.ok(handlers.length);const req={params:{id:'isolated-only-id'},body:{orderIds:['isolated-only-id']}};const dispatch=async(i:number):Promise<any>=>handlers[i]?.(req,res,()=>dispatch(i+1));await dispatch(0);
  assert.equal(status,401,url);assert.equal(writes,0);
 }
});
test('individual order reads enforce server-owned Mongo identity even when Prisma copy has no owner',async()=>{
 let owner='member_a',member:any={id:'member_b'};
 const context:any={verifyAdminSession:()=>false,mongoDbService:{getClient:async()=>({db:()=>({collection:()=>({findOne:async()=>({userId:owner})})})}),getPrimaryDbName:()=>'',getTransCollectionName:()=>''},memberAuth:{getMember:async()=>member},sameSecret:(a:any,b:any)=>a===b};
 for(const node of source.statements){const code=node.getText(source);if(code.startsWith('async function canReadOrder('))vm.runInNewContext(ts.transpile(code,{target:ts.ScriptTarget.ES2022}),context);}
 const req={query:{token:'legacy_token_long_enough'},headers:{}};const order={id:'fixture',guestAccessToken:'legacy_token_long_enough'};
 assert.equal(await context.canReadOrder(req,order),false);member={id:'member_a'};assert.equal(await context.canReadOrder(req,order),true);
 owner='';member=null;assert.equal(await context.canReadOrder(req,order),true);assert.equal(await context.canReadOrder({query:{},headers:{}},order),false);
});
