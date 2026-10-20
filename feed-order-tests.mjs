import assert from 'node:assert/strict';
import {Runner} from './runner.mjs';
const since=Date.parse('2026-10-05')/1000;
const links=[{url:'https://www.patreon.com/posts/2',publishedAt:'2026-10-12'}, {url:'https://www.patreon.com/posts/1',publishedAt:'2026-10-01'}];
// Cards hydrate before the sort control in newly opened automated scan tabs.
const delayed=new Runner({},()=>{},async()=>{});let reads=0,advances=0;
delayed.read=async(_,mode)=>{
 if(mode==='feedAdvance'){advances++;return {}}
 return {links,loading:false,more:true,newestFirst:++reads>=4};
};
assert.deepEqual((await delayed.collectFeed(1,'feed:/c/D/posts',{since})).map(p=>p.id),['2']);
assert.equal(reads,4);assert.equal(advances,0);
// Never scroll or accept a scoped feed whose ordering stays unverified.
const unordered=new Runner({},()=>{},async()=>{});let attempts=0;
unordered.read=async(_,mode)=>{assert.equal(mode,'feed');attempts++;return {links,loading:false,more:true,newestFirst:false}};
await assert.rejects(unordered.collectFeed(1,'feed:/c/D/posts',{since}),/Cannot verify newest-first/);
assert(attempts>1&&attempts<=11);
// Stop remains responsive while waiting for the sort control.
const stopped=new Runner({},()=>{},async()=>{stopped.stop=true});
stopped.read=async()=>({links,loading:false,more:true,newestFirst:false});
await assert.rejects(stopped.collectFeed(1,'feed:/c/D/posts',{since}),/Stopped/);
console.log('Delayed sort hydration, bounded ordering failure, and stop checks passed');
