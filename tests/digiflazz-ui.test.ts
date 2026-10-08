import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const root=new URL('../',import.meta.url);
function load(file:string,ctx:any,result:string){
 const src=ts.createSourceFile(file,fs.readFileSync(new URL(file,root),'utf8'),ts.ScriptTarget.Latest,true);
 const body=src.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(src).replace(/^export /,'')).join('\n');
 return vm.runInNewContext(ts.transpile(body+';'+result,{target:ts.ScriptTarget.ES2022}),ctx);
}
function provider(){
 const config:any={category:'game',providerName:'cojakuD2AReo',apiUrl:'https://api.digiflazz.com/v1/price-list',isActive:true,connectionStatus:'CONNECTED'};
 let saved:any;
 const storage:any={getSettings:()=>({apiConfigs:{game:config}}),saveSettings:async()=>{},getProducts:()=>[],saveProducts:()=>{throw new Error('Must not pretend local products were synced');}};
 const ctx:any={storage,console,fetch:async()=>{throw new Error('fixture offline');}};
 const x=load('src/services/providerIntegrationService.ts',ctx,'({service:providerIntegrationService, defaults:DEFAULT_API_CONFIGS})');
 x.service.saveApiConfig=async(c:any)=>{saved=c;};
 return {...x,ctx,config,saved:()=>saved};
}
test('saved CONNECTED flag is not a new live game connection test',()=>{
 const {service}=provider();assert.equal(service.getApiConfigs().game.connectionStatus,'NOT_TESTED');
});
test('game defaults cannot manufacture connection, test timestamp or sync success',()=>{
 const {defaults}=provider(); assert.equal(defaults.game.connectionStatus,'NOT_TESTED'); assert.equal(defaults.game.lastTestedAt,undefined); assert.equal(defaults.game.lastSyncStatus,undefined); assert.equal(defaults.game.isActive,false);
});
test('game connection test calls signed backend check and propagates failure',async()=>{
 const {service,ctx,config,saved}=provider();let called='';
 ctx.fetch=async(url:string)=>{called=url;return new Response(JSON.stringify({success:true,data:{isWhitelisted:null,connectionStatus:'FAILED',digiflazzMessage:'Signature Anda salah'}}));};
 const bad=await service.testConnection('game',config);assert.equal(bad.success,false);assert.equal(called,'/api/digiflazz/ip-status');assert.equal(saved().connectionStatus,'FAILED');assert.equal(saved().providerName,'cojakuD2AReo');
 ctx.fetch=async()=>new Response(JSON.stringify({success:true,data:{isWhitelisted:true,connectionStatus:'CONNECTED'}}));
 assert.equal((await service.testConnection('game',config)).success,true);
});
test('game sync uses backend Digiflazz H2H sync not local catalog counting',async()=>{
 const {service,ctx}=provider();let called='';
 ctx.fetch=async(url:string)=>{called=url;return new Response(JSON.stringify({success:true,count:42,message:'Actual backend sync'}));};
 const result=await service.syncProducts('game');assert.equal(called,'/api/digiflazz/sync-products?category=game');assert.equal(result.total,42);
 ctx.fetch=async()=>new Response(JSON.stringify({success:false,message:'upstream failure'}));
 await assert.rejects(service.syncProducts('game'),/upstream failure/);
});
test('whitelist card starts unknown and failure clears previously verified state',async()=>{
 const text=fs.readFileSync(new URL('src/components/AdminDigiflazzIpCard.tsx',root),'utf8');
 assert.ok(text.includes('useState<boolean | null>(null)'), 'initial whitelist must be unknown');
 const src=ts.createSourceFile('card.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let fn='';
 function visit(n:ts.Node){if(ts.isVariableDeclaration(n)&&n.name.getText(src)==='fetchStatus')fn=n.initializer!.getText(src);ts.forEachChild(n,visit);}visit(src);
 let state:any={};const ctx:any={console,apiAdapter:{getDigiflazzIpStatus:async()=>{throw new Error('fixture offline');}}};
 for(const name of ['Loading','ConfiguredIp','OutboundIp','LiveServerIp','ProxyUrl','IsProxyActive','IsWhitelisted','Deposit','StatusMessage','LastChecked'])ctx['set'+name]=(v:any)=>{state[name]=v;};
 await vm.runInNewContext(ts.transpile('('+fn+')',{target:ts.ScriptTarget.ES2022}),ctx)();
 assert.equal(state.IsWhitelisted,null);assert.equal(state.Deposit,null);assert.match(state.StatusMessage,/offline/);
});
test('adapter network failure cannot fabricate whitelist or detect client IP as server IP',async()=>{
 const adapter=load('src/services/apiAdapter.ts',{console,fetch:async()=>{throw new Error('fixture offline');},storage:{},SUPABASE_CONFIG:{}},'apiAdapter');
 await assert.rejects(adapter.getDigiflazzIpStatus(),/Tidak dapat/);
 await assert.rejects(adapter.detectDigiflazzLiveIp(),/Tidak dapat/);
});
test('admin Digiflazz balance test reports success only after a confirmed provider response',()=>{
 const dashboard=fs.readFileSync(new URL('src/pages/AdminDashboard.tsx',root),'utf8');
 const start=dashboard.indexOf('const handleTestDigiflazz = async () =>');
 const end=dashboard.indexOf('const handleTestPaymentGateway = async () =>',start);
 assert.ok(start>=0&&end>start,'Digiflazz test handler must exist');
 const handler=dashboard.slice(start,end);
 assert.match(handler,/credentials:\s*['"]include['"]/);
 assert.match(handler,/response\.ok\s*&&\s*json\.success/);
 assert.doesNotMatch(handler,/2450000/,'must not invent a fallback balance');
 assert.doesNotMatch(handler,/catch\s*\{[\s\S]*Koneksi Aman/,'network failure must not be presented as a successful connection');
});
