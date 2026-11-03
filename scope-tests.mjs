import assert from 'node:assert/strict';
import {Runner} from './runner.mjs';
const cutoff=Date.parse('2026-10-05T00:00:00Z')/1000;
const link=(id,date,pinned=false)=>({url:`https://www.patreon.com/posts/${id}`,publishedAt:date,pinned});
const runner=new Runner({},()=>{},async()=>{});let advances=0;
runner.read=async(_,mode)=>{if(mode==='feedAdvance'){advances++;throw Error('Should have stopped at cutoff');}return {newestFirst:true,links:[link(99,'2020-01-01',true),link(2,'2026-10-12'),link(1,'2026-10-01')],loading:false,more:true};};
assert.deepEqual((await runner.collectFeed(1,'feed:/c/D/posts',{since:cutoff})).map(p=>p.id),['2']);assert.equal(advances,0);
// A collection has no ordering guarantee: enumerate its cards, but don't open old posts.
const collection=new Runner({},()=>{},async()=>{});collection.read=async()=>({links:[link(1,'2020-01-01'),link(2,'2026-10-12'),link(3,null)],expected:3,more:false});
assert.deepEqual((await collection.collect(1,'1',{since:cutoff})).map(p=>p.id),['2']);
assert.equal(collection.scopeCounts().scope_unresolved,1);
// Unknown dates are reported unresolved, never opened by a scoped check.
const unknown=new Runner({},()=>{},async()=>{});let reads=0;
unknown.openPost=async()=>({publishedAt:null});
unknown.read=async(_,mode)=>mode==='feedAdvance'?{}:({newestFirst:true,links:[link(1,null),link(2,'2020-01-01')],more:false,loading:false});
assert.deepEqual((await unknown.collectFeed(1,'feed:/c/D/posts',{since:cutoff})).map(p=>p.id),[]);
assert.equal(unknown.scopeCounts().scope_unresolved,1);
console.log('Date-scope boundaries, pinned cards, collections, and unknown dates passed');
// Real Patreon pages expose dates in Next.js bootstrap records, not always <time>.
const {inspectPage}=await import('./core.mjs');
globalThis.location={pathname:'/posts/123'};
const chunk='1:'+JSON.stringify({bootstrapEnvelope:{pageBootstrap:{post:{data:{id:'123',type:'post',attributes:{published_at:'2026-10-10T12:00:00Z'}}}}}})+'\n';
const script={textContent:'self.__next_f.push('+JSON.stringify([1,chunk])+')'};
globalThis.document={title:'Post',body:{innerText:''},querySelector(){return null},querySelectorAll(s){return s==='script:not([src])'?[script]:[]}};
assert.equal(inspectPage('post','').publishedAt,'2026-10-10T12:00:00Z');
console.log('Patreon Next.js publication metadata extraction passed');

