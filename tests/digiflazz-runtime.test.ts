import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';

const root = new URL('../', import.meta.url);
function isolated(file: string, context: any) {
  const source = ts.createSourceFile(file, fs.readFileSync(new URL(file, root), 'utf8'), ts.ScriptTarget.Latest, true);
  const body = source.statements.filter(n => !ts.isImportDeclaration(n)).map(n => n.getText(source).replace(/^export /, '')).join('\n');
  return vm.runInNewContext(ts.transpile(body + '\n;({resolveDigiflazzSettings: typeof resolveDigiflazzSettings === "function" ? resolveDigiflazzSettings : undefined})', {target: ts.ScriptTarget.ES2022}), context);
}

test('saved production credentials override stale environment and select mode-specific key', () => {
  const context: any = { process: { env: { DIGIFLAZZ_API_KEY: 'stale-fixture' } }, dotenv: { config() {} }, path: { dirname: () => '.', resolve: () => '.' }, fileURLToPath: () => '.', console };
  // Read only the resolver declaration: never load dotenv or any real database client.
  const file = new URL('backend/src/services/digiflazzSettings.ts', root);
  assert.ok(fs.existsSync(file), 'database-first runtime resolver is missing');
  const {resolveDigiflazzSettings: resolve} = isolated('backend/src/services/digiflazzSettings.ts', context);
  const fallback = {USERNAME: 'stale-user', API_KEY: 'stale-fixture', TESTING: false, WHITELIST_IP: '1.1.1.1', OUTBOUND_PROXY: 'stale-proxy'};
  const saved = { digiflazzUsername: 'saved-user', digiflazzApiKey: 'old-generic', digiflazzProductionKey: 'saved-production', digiflazzDevelopmentKey: 'saved-development', digiflazzMode: 'PRODUCTION', digiflazzOutboundProxy: '', digiflazzWhitelistIp: '43.159.33.27' };
  const production = resolve(saved, fallback);
  assert.equal(production.API_KEY, 'saved-production'); assert.equal(production.USERNAME, 'saved-user'); assert.equal(production.TESTING, false); assert.equal(production.OUTBOUND_PROXY, '');
  assert.equal(resolve({...saved, digiflazzMode:'DEVELOPMENT'}, fallback).API_KEY, 'saved-development');
  assert.equal(resolve({...saved, digiflazzMode:'DEVELOPMENT'}, fallback).TESTING, true);
  assert.equal(resolve({...saved, digiflazzMode:'DEVELOPMENT', digiflazzDevelopmentKey: ''}, fallback).API_KEY, '');
  assert.equal(resolve({digiflazzMode:'PRODUCTION',digiflazzDevelopmentKey:'dev-only'}, fallback).API_KEY, '', 'explicit production mode must not inherit stale environment key');
});

function indexContext() {
  const source = ts.createSourceFile('index.ts', fs.readFileSync(new URL('backend/src/index.ts', root), 'utf8'), ts.ScriptTarget.Latest, true);
  return source;
}
test('startup hydrates database runtime before accepting traffic; save rehydrates confirmed full settings', () => {
  const text = indexContext().getFullText();
  const listen = text.indexOf("app.listen(PORT");
  assert.ok(text.indexOf('await hydrateDigiflazzRuntime()') > 0 && text.indexOf('await hydrateDigiflazzRuntime()') < listen, 'runtime must hydrate before listening');
  const save = text.slice(text.indexOf("app.post('/api/settings/save'"), text.indexOf('// 14. ADMIN WEB PUSH'));
  assert.ok(save.includes('await hydrateDigiflazzRuntime()'), 'confirmed DB save must refresh every Digiflazz consumer');
});

test('IP config save is database-first and never changes runtime when database rejects', async () => {
 const src=indexContext();let route='';
 for(const n of src.statements){const text=n.getText(src);if(text.startsWith("app.post('/api/digiflazz/update-ip-config'"))route=text;}
 let handler:any;let effects=0;let status=200;let result:any;
 const ctx:any={console,requireAdmin(){},app:{post:(_p:any,_auth:any,fn:any)=>{handler=fn;}},mongoDbService:{getAllState:async()=>({settings:{}}),syncEntity:async()=>false},hydrateDigiflazzRuntime:async()=>{effects++;},outboundIpService:{updateConfig:async()=>{effects++;return {success:true};}}};
 vm.runInNewContext(ts.transpile(route,{target:ts.ScriptTarget.ES2022}),ctx);
 const res:any={status:(s:number)=>{status=s;return res;},json:(r:any)=>{result=r;return res;}};
 await handler({body:{whitelistIp:'43.159.33.27',outboundProxy:''}},res);
 assert.equal(effects,0);assert.equal(status,503);assert.equal(result.success,false);
});
test('shared hydration refreshes service consumers and fails closed on database outage',async()=>{
 const file=new URL('backend/src/services/digiflazzRuntime.ts',root);assert.ok(fs.existsSync(file),'shared worker/backend hydration missing');
 const src=ts.createSourceFile('runtime.ts',fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);const code=src.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(src).replace(/^export /,'')).join('\n');
 let refreshed=0;const cfg:any={USERNAME:'stale-user',API_KEY:'stale-key'};
 const ctx:any={DIGIFLAZZ_CONFIG:cfg,resolveDigiflazzSettings:(s:any)=>({USERNAME:s.digiflazzUsername,API_KEY:s.digiflazzProductionKey}),mongoDbService:{getSettingsFromDatabase:async()=>({digiflazzUsername:'saved-user',digiflazzProductionKey:'saved-key'})},digiflazzService:{refreshConfig:()=>{refreshed++;}}};
 const hydrate=vm.runInNewContext(ts.transpile(code+';hydrateDigiflazzRuntime',{target:ts.ScriptTarget.ES2022}),ctx);
 await hydrate();assert.equal(cfg.API_KEY,'saved-key');assert.equal(refreshed,1);
 ctx.mongoDbService.getSettingsFromDatabase=async()=>{throw new Error('fixture DB down');};await assert.rejects(hydrate(),/DB down/);assert.equal(cfg.API_KEY,'');assert.equal(cfg.USERNAME,'');assert.equal(refreshed,2);
});
test('worker refreshes database credentials before handling game pending orders',async()=>{
 const file=new URL('backend/src/worker.ts',root);const src=ts.createSourceFile('worker.ts',fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 const fn=src.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.getText(src)==='reconcilePendingDigiflazzOrders')!;let hydrated=false,query:any;
 const ctx:any={console,hydrateDigiflazzRuntime:async()=>{hydrated=true;},prisma:{order:{findMany:async(q:any)=>{query=q;return [];}}}};
 const run=vm.runInNewContext(ts.transpile(fn.getText(src)+';reconcilePendingDigiflazzOrders',{target:ts.ScriptTarget.ES2022}),ctx);await run();assert.equal(hydrated,true);assert.ok(query.where.category.in.includes('GAME'));
});
function outbound() {
  const fixture: any = { USERNAME: 'fixture-user', API_KEY: 'fixture-key', WHITELIST_IP:'43.159.33.27', OUTBOUND_PROXY:'', BASE_URL:'https://fixture.invalid' };
  const source = ts.createSourceFile('outbound.ts', fs.readFileSync(new URL('backend/src/services/outboundIpService.ts', root), 'utf8'), ts.ScriptTarget.Latest, true);
  const body = source.statements.filter(n => !ts.isImportDeclaration(n)).map(n => n.getText(source).replace(/^export /, '')).join('\n');
  const service = vm.runInNewContext(ts.transpile(body+';outboundIpService', {target:ts.ScriptTarget.ES2022}), {crypto, DIGIFLAZZ_CONFIG:fixture, process:{env:{}}, console, isIP:(s:string)=>s==='43.159.33.27'?4:0});
  service.detectLiveVpsIp = async () => '43.159.33.27';
  return {service, fixture};
}
test('signature rejection never proves IP whitelist; explicit IP rejection is distinguished', async () => {
  const {service} = outbound();
  service.getHttpClient = () => ({post: async () => ({data:{data:{rc:'41', message:'Signature Anda salah'}}})});
  const rejected = await service.checkDigiflazzWhitelist();
  assert.equal(rejected.isWhitelisted, null); assert.equal(rejected.whitelistStatus,'UNKNOWN'); assert.equal(rejected.connectionStatus,'FAILED');
  service.getHttpClient = () => ({post: async () => {throw {response:{data:{data:{rc:'45', message:'IP Anda tidak kami kenali'}}}};}});
  const ip = await service.checkDigiflazzWhitelist();
  assert.equal(ip.isWhitelisted,false); assert.equal(ip.whitelistStatus,'REJECTED');
});
test('only finite deposit success proves connection, network failures remain unknown', async () => {
  const {service} = outbound();
  service.getHttpClient = () => ({post: async () => ({data:{data:{deposit:0}}})});
  const ok = await service.checkDigiflazzWhitelist(); assert.equal(ok.isWhitelisted,true); assert.equal(ok.connectionStatus,'CONNECTED');
  service.getHttpClient = () => ({post: async () => ({data:{data:{rc:'00'}}})});
  assert.equal((await service.checkDigiflazzWhitelist()).isWhitelisted,null);
  service.getHttpClient = () => ({post: async () => {throw new Error('fixture timeout');}});
  assert.equal((await service.checkDigiflazzWhitelist()).isWhitelisted,null);
});
test('failed live IP detection cannot return configured or invented fallback IP', async () => {
  const {service} = outbound();
  delete service.detectLiveVpsIp;
  service.getHttpClient = () => ({get: async () => {throw new Error('fixture offline');}});
  await assert.rejects(service.detectLiveVpsIp(), /Tidak dapat mendeteksi/);
});
