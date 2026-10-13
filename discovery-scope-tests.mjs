import assert from 'node:assert/strict';
import {Runner} from './runner.mjs';
const cutoff=Date.parse('2026-10-06T12:00:00Z')/1000;
const links=[
 {url:'https://www.patreon.com/posts/99',title:'Pinned',publishedAt:null,pinned:true},
 {url:'https://www.patreon.com/posts/3',title:'Recent',publishedAt:null},
 {url:'https://www.patreon.com/posts/2',title:'Old',publishedAt:null},
 {url:'https://www.patreon.com/posts/1',title:'Older',publishedAt:null}
];
const runner=new Runner({},()=>{},async()=>{});let advanced=0,opened=[];
runner.read=async(_,mode)=>{if(mode==='feedAdvance'){advanced++;throw Error('Must stop before loading another batch');}return {newestFirst:true,links,more:true,loading:false};};
runner.openPost=async url=>{opened.push(url);return {publishedAt:url.endsWith('/1')?'2026-10-01T12:00:00Z':'2026-10-02T12:00:00Z'};};
const posts=await runner.collectFeed(1,'feed:/c/D/posts',{since:cutoff});
assert.deepEqual(posts.map(p=>p.id),['99','3'],'unknown recent and pinned candidates retained for review');
assert.equal(advanced,0,'older feed pages never loaded');
assert.deepEqual(opened.sort(),['https://www.patreon.com/posts/1','https://www.patreon.com/posts/2'],'only boundary dates resolved');

const dated=new Runner({},()=>{},async()=>{});dated.read=runner.read;dated.openPost=()=>{throw Error('Known dates need no post lookup');};
const datedLinks=links.map(l=>({...l,publishedAt:l.url.endsWith('/1')?'2026-10-01T12:00:00Z':l.url.endsWith('/2')?'2026-10-02T12:00:00Z':null}));
dated.read=async()=>({newestFirst:true,links:datedLinks,more:true,loading:false});
assert.deepEqual((await dated.collectFeed(1,'feed:/c/D/posts',{since:cutoff})).map(p=>p.id),['99','3']);

console.log('Scoped creator discovery stops at resolved boundary dates without loading the catalog');

const unordered=new Runner({},()=>{},async()=>{});
unordered.read=async()=>({newestFirst:false,links,more:true,loading:false});
await assert.rejects(unordered.collectFeed(1,'feed:/c/D/posts',{since:cutoff}),/Cannot verify newest-first/);
console.log('Unverified sort order reports a scope error instead of enumerating the full catalog');

const paged=new Runner({},()=>{},async()=>{});let page=0,lookups=0;
paged.read=async(_,mode)=>{if(mode==='feedAdvance'){page++;return {};}
 return {newestFirst:true,loading:false,more:true,links:page?links.slice(1):[
 {url:'https://www.patreon.com/posts/5'}, {url:'https://www.patreon.com/posts/4'}]};};
paged.openPost=async url=>{lookups++;return {publishedAt:/\/(4|5)$/.test(url)?'2026-10-12T12:00:00Z':'2026-10-01T12:00:00Z'};};
assert.deepEqual((await paged.collectFeed(1,'feed:/c/D/posts',{since:cutoff})).map(p=>p.id),['5','4','3']);
assert.equal(page,1,'loads another batch only while boundary remains recent');
assert.equal(lookups,4);
console.log('Multi-batch discovery advances through recent posts and stops at the first old boundary');
