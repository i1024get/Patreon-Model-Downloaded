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
// Missing sort UI must not reject the source or stop at an old tail: a later
// listing page can still contain a recent post.
const unordered=new Runner({},()=>{},async()=>{});let attempts=0,page=0;
unordered.read=async(_,mode)=>{
 if(mode==='feedAdvance'){page++;return {}}
 attempts++;
 return {links:page?[{url:'https://www.patreon.com/posts/4',publishedAt:'2026-10-13'},...links]:links,loading:false,more:false,newestFirst:false};
};
assert.deepEqual((await unordered.collectFeed(1,'feed:/c/D/posts',{since})).map(p=>p.id),['2','4']);
assert(page>0);assert(attempts<20);
// Stop remains responsive while waiting for the sort control.
const stopped=new Runner({},()=>{},async()=>{stopped.stop=true});
stopped.read=async()=>({links,loading:false,more:true,newestFirst:false});
await assert.rejects(stopped.collectFeed(1,'feed:/c/D/posts',{since}),/Stopped/);
console.log('Delayed sort hydration, unordered listing fallback, and stop checks passed');

