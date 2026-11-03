import assert from 'node:assert/strict';
import {Runner} from './runner.mjs';
import {readPostPublication} from './publication.mjs';
const since=Date.parse('2026-10-31T18:06:53Z')/1000;
const recent=Date.parse('2026-11-02T12:00:00Z')/1000,old=Date.parse('2026-10-30T12:00:00Z')/1000;
const links=['123','124','125'].map(id=>({url:'https://www.patreon.com/posts/'+id,publishedAt:null}));
function fixture(source,results){
 const lookups=[],opened=[],advances=[];
 const api={storage:{local:{get:async()=>({}),set:async()=>{}}},scripting:{executeScript:async({target,func,args})=>{
  assert.equal(target.tabId,1);assert.equal(func,readPostPublication);
  lookups.push(args[0]);const result=results[args[0]];
  if(result instanceof Error)throw result;
  return [{result:{publishedAt:result??null}}];
 }}};
 const r=new Runner(api,()=>{},async()=>{});
 r.read=async(_,mode)=>{if(mode==='feedAdvance')advances.push(mode);return {links,newestFirst:true,more:false,loading:false,expected:3}};
 r.openPost=async url=>{opened.push(url);return {title:'Post',publishedAt:recent,files:[],images:[]}};
 return {r,lookups,opened,advances,run:()=>r.run(1,source,'Stage',0,{since,reviewOnly:true})};
}
for(const source of ['feed:/c/Vodka85/posts','123']){
 const f=fixture(source,{'123':recent,'124':old});const stats=await f.run();
 assert.deepEqual(f.opened,['https://www.patreon.com/posts/123'],'only exactly verified in-scope posts navigate');
 assert.deepEqual(f.lookups,['123','124','125'],'one bounded metadata lookup per undated listing');
 assert.equal(stats.scope_excluded,1);assert.equal(stats.scope_unresolved,1);
 if(source.startsWith('feed:'))assert.equal(f.advances.length,0,'do not expand an unresolved boundary');
}
const rejected=fixture('feed:/c/Vodka85/posts',{'123':new Error('Publication metadata request failed (429)')});
const partial=await rejected.run();assert.equal(partial.scope_unresolved,3);assert.equal(rejected.opened.length,0);
const stopped=fixture('feed:/c/Vodka85/posts',{});stopped.r.stop=true;
await assert.rejects(stopped.run(),/Stopped/);assert.equal(stopped.lookups.length,0);
const security=fixture('feed:/c/Vodka85/posts',{'123':new Error('Patreon security verification blocked publication metadata')});
await assert.rejects(security.run(),/security verification/);assert.equal(security.lookups.length,1);
const pinned=fixture('feed:/c/Vodka85/posts',{'123':recent});
pinned.r.read=async()=>({links:[{...links[0],pinned:true},{...links[1],publishedAt:old},{...links[2],publishedAt:old}],newestFirst:true,more:false,loading:false});
await pinned.run();assert.deepEqual(pinned.lookups,['123'],'resolve pinned dates even when normal cards are all dated');
assert.deepEqual(pinned.opened,['https://www.patreon.com/posts/123']);
const budget=fixture('feed:/c/Vodka85/posts',{});
const many=Array.from({length:45},(_,i)=>({id:String(i+1000),url:'https://www.patreon.com/posts/'+(i+1000)}));
await budget.r.resolveListingDates(1,many);await budget.r.resolveListingDates(1,many);
assert.equal(budget.lookups.length,40,'metadata attempts are cached and capped per run');
const full=fixture('123',{});await full.r.run(1,'123','Stage',0,{reviewOnly:true});
assert.equal(full.lookups.length,0,'All time must not perform publication metadata requests');
console.log('Listing metadata fallback resolves relative labels without navigating old or unknown posts; failures, scope counts and stop/security checks passed');
