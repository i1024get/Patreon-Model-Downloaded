import assert from 'node:assert/strict';
import {Runner} from './runner.mjs';
const since=Date.parse('2026-11-01T03:00:00Z')/1000;
const recent='2026-11-01T12:00:00Z',old='2026-10-18T12:00:00Z';
const link=(id,date)=>({url:'https://www.patreon.com/posts/'+id,publishedAt:date});
function fixture(links,kind='feed:/c/D/posts'){
 const opened=[],modes=[];
 const api={storage:{local:{get:async()=>({}),set:async()=>{}}},tabs:{remove:async()=>{}},scripting:{executeScript:async()=>[{result:{publishedAt:old}}]}};
 const r=new Runner(api,()=>{},async()=>{});
 r.read=async(_,mode)=>{modes.push(mode);return {newestFirst:true,loading:false,more:false,expected:links.length,links}};
 r.openPost=async url=>{opened.push(url);return {title:'Post',publishedAt:url.endsWith('/1')?recent:old,files:[],images:[]}};
 return {r,opened,modes,run:()=>r.run(1,kind,'Stage',0,{since,reviewOnly:true})};
}
const missing=fixture([link('1',recent),link('2',null),link('3',null)]);
const a=await missing.run();assert.deepEqual(missing.opened,['https://www.patreon.com/posts/1'],'unknown dates must never trigger old-post probes');assert.equal(a.scope_unresolved,2);assert(!missing.modes.includes('feedAdvance'));
for(const kind of ['feed:/c/D/posts','123']){
 const f=fixture([link('1',recent),link('2',old),link('3',null)],kind);const result=await f.run();
 assert.deepEqual(f.opened,['https://www.patreon.com/posts/1']);assert.equal(result.scope_unresolved,1);assert.equal(result.scope_excluded,1);
}
const direct=fixture([],'post:2');const d=await direct.run();assert.deepEqual(direct.opened,[],'old individual source must not navigate');assert.equal(d.scope_excluded,1);
const human=fixture([link('1','November 1, 2026 12:00:00 UTC')],'123');const h=await human.run();assert.equal(h.models.length,1);assert.equal(typeof h.models[0].published_at,'number','wire dates must be canonical');
const full=fixture([link('2',null)],'123');await full.r.run(1,'123','Stage',0,{reviewOnly:true});assert.equal(full.opened.length,1,'full scan must still inspect undated posts');
const selected=fixture([]);await selected.r.run(null,'feed:/c/D/posts','Stage',0,{reviewOnly:true,since,selectedPostIds:['2'],publicationDates:{'2':old}});assert.deepEqual(selected.opened,[],'selected paths must retain their review cutoff');
console.log('Strict pre-navigation feed, collection, individual and selected scope checks passed');
