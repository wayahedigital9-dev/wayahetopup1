import {test} from 'node:test';
import assert from 'node:assert/strict';
import { storage } from '../src/services/storage.ts';
test('member cache never authenticates legacy local accounts; confirmed server data survives fresh hydration without local credentials',async()=>{
 const values=new Map<string,string>();globalThis.localStorage={getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)} as any;
 for(const k of ['wd_user_session_v1','wd_user_v1','wd_registered_members_v1'])values.set(k,JSON.stringify({id:'fake',password:'plaintext',balance:9000}));
 assert.equal(storage.getUser(),null,'localStorage is not proof of member login');
 assert.deepEqual(storage.getRegisteredMembers(),[],'no default demo members or locally trusted accounts');
 globalThis.fetch=async()=>new Response(JSON.stringify({success:true,data:{id:'server',name:'Confirmed',balance:0}}));
 const u=await storage.hydrateMemberFromBackend();assert.equal(u?.id,'server');assert.equal(storage.getUser()?.balance,0);
 assert.ok(![...values.values()].join('').includes('plaintext'));
 storage.saveUser({id:'forged',balance:999} as any);assert.equal(storage.getUser()?.id,'server','saveUser cannot manufacture server authentication');
 globalThis.fetch=async()=>new Response(JSON.stringify({success:false}),{status:401});await storage.hydrateMemberFromBackend();assert.equal(storage.getUser(),null);
});
test('late member order response cannot populate a logged-out or different account',async()=>{
 globalThis.localStorage={getItem:()=>null,removeItem:()=>{},setItem:()=>{}} as any;
 globalThis.fetch=async()=>new Response(JSON.stringify({success:true,data:{id:'account_a',name:'A',balance:0}}));await storage.hydrateMemberFromBackend();
 let finish:any;globalThis.fetch=async()=>new Promise(r=>{finish=r;});const pending=storage.hydrateMemberOrders();
 globalThis.fetch=async()=>new Response(JSON.stringify({success:true}));await storage.logoutMember();
 globalThis.fetch=async()=>new Response(JSON.stringify({success:true,data:{id:'account_b',name:'B',balance:0}}));await storage.hydrateMemberFromBackend();
 finish(new Response(JSON.stringify({success:true,data:[{id:'a_private_order',userId:'account_a'}]})));await pending;
 assert.deepEqual(storage.getMemberOrders(),[],'late account A orders must not show in account B');
});
