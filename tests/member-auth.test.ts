import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from '../backend/node_modules/express/index.js';
import { createMemberAuth } from '../backend/src/security/memberAuth.ts';
// All persistence seams are in-memory; this module never imports app/config/drivers.
function match(d:any,q:any):boolean { return Object.entries(q).every(([k,v]:any)=>k==='$or'?v.some((x:any)=>match(d,x)):v instanceof RegExp?v.test(d[k]||''):v && typeof v==='object' && !(v instanceof Date)?('$gt' in v?d[k]>v.$gt:'$in' in v?v.$in.includes(d[k]):false):d[k]===v); }
function fixture() {
 const data:any={users:[],member_sessions:[],orders:[]};let down=false;
 const db:any={collection:(name:string)=>({createIndex:async()=>{},findOne:async(q:any)=>structuredClone(data[name].find((d:any)=>match(d,q))||null),find:(q:any)=>{let limit=100;const c:any={limit:(n:number)=>{limit=n;return c},sort:()=>c,toArray:async()=>structuredClone(data[name].filter((d:any)=>match(d,q)).slice(0,limit))};return c;},insertOne:async(d:any)=>{if(data[name].some((x:any)=>['_id','usernameKey','emailKey','phoneKey'].some(k=>d[k]!==undefined&&x[k]===d[k])))throw Object.assign(new Error('duplicate'),{code:11000});data[name].push(structuredClone(d));return {acknowledged:true};},updateOne:async(q:any,u:any)=>{const d=data[name].find((d:any)=>match(d,q));if(d){Object.assign(d,u.$set);for(const k of Object.keys(u.$unset||{}))delete d[k];}return {acknowledged:true,matchedCount:d?1:0};},deleteOne:async(q:any)=>{const i=data[name].findIndex((d:any)=>match(d,q));if(i>=0)data[name].splice(i,1);return {acknowledged:true};}})};
 return {data,db,getDb:async()=>{if(down)throw Error('isolated outage');return db},fail:()=>down=true};
}
async function setup(t:any) {
 const f=fixture();const app=express();app.use(express.json());app.use('/api/auth',createMemberAuth(f.getDb,false).router);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());const url=`http://127.0.0.1:${(server.address() as any).port}`;
 async function request(path:string,body?:any,cookie='',method=body?'POST':'GET'){const r=await fetch(url+'/api/auth/'+path,{method,headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]||'',headers:r.headers};}
 return {...f,request};
}
const signup={username:'test_member',email:'test@example.invalid',password:'isolated_password_123',name:'Original',phone:'081234567890'};
test('signup durably hashes password; separate context login and reload return DB profile, not browser state',async t=>{
 const f=await setup(t);const r=await f.request('register',signup);assert.equal(r.status,201);assert.equal(f.data.users.length,1);assert.match(f.data.users[0].passwordHash,/^scrypt\$/);assert.equal(f.data.users[0].password,undefined);assert.equal(r.body.data.balance,0);assert.equal(r.body.data.rewardPoints,0);assert.ok(!JSON.stringify(r.body).includes('password'));assert.match(r.headers.get('set-cookie')!,/HttpOnly/);assert.match(r.headers.get('set-cookie')!,/SameSite=Lax/);
 const login=await f.request('login',{identifier:signup.email,password:signup.password});assert.equal(login.status,200);assert.notEqual(login.cookie,r.cookie);assert.equal((await f.request('me',undefined,login.cookie)).body.data.id,r.body.data.id);
 assert.equal((await f.request('me',{name:'Confirmed profile'},login.cookie,'PATCH')).status,200);assert.equal((await f.request('me',undefined,login.cookie)).body.data.name,'Confirmed profile');
 await f.request('logout',{},login.cookie);assert.equal((await f.request('me',undefined,login.cookie)).status,401);
});
test('duplicate identifiers, wrong or missing passwords, missing sessions and arbitrary caller IDs are denied',async t=>{
 const f=await setup(t);const r=await f.request('register',signup);
 for(const body of [signup,{...signup,username:'other'},{...signup,username:'other',email:'other@example.invalid'}])assert.equal((await f.request('register',body)).status,409);
 assert.equal((await f.request('login',{identifier:signup.username,password:'wrong'})).status,401);
 assert.equal((await f.request('me?userId='+r.body.data.id)).status,401);
 assert.equal((await f.request('me',undefined,'wd_member_session=made-up')).status,401);
 for(const body of [{balance:9000},{role:'ADMIN'},{id:'other'},{phone:'081111111111'}])assert.equal((await f.request('me',body,r.cookie,'PATCH')).status,400);
 f.data.orders.push({id:'mine',userId:r.body.data.id},{id:'other',userId:'other'},{id:'unclaimed',customerEmail:signup.email});
 assert.deepEqual((await f.request('orders?userId=other',undefined,r.cookie)).body.data.map((x:any)=>x.id),['mine']);assert.equal((await f.request('orders')).status,401);
});
test('database outage never reports successful signup',async t=>{const f=await setup(t);f.fail();const r=await f.request('register',signup);assert.equal(r.status,503);assert.equal(r.body.success,false);assert.equal(f.data.users.length,0);assert.equal(r.cookie,'');});
test('legacy DB credentials migrate on verified login without changing money; passwordless records never authenticate',async t=>{
 const f=await setup(t);f.data.users.push({id:'legacy',username:'legacy',password:'legacy-secret',balance:42,role:'CUSTOMER'},{id:'noauth',username:'noauth'});
 assert.equal((await f.request('login',{identifier:'legacy',password:'wrong'})).status,401);assert.equal(f.data.users[0].password,'legacy-secret');
 const r=await f.request('login',{identifier:'legacy',password:'legacy-secret'});assert.equal(r.status,200);assert.equal(r.body.data.balance,42);assert.equal(f.data.users[0].password,undefined);assert.match(f.data.users[0].passwordHash,/^scrypt\$/);assert.equal((await f.request('login',{identifier:'noauth',password:'anything'})).status,401);
});
