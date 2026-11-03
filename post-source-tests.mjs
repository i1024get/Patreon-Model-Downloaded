import assert from 'node:assert/strict';
import {sourceId,postId} from './core.mjs';
import {Runner} from './runner.mjs';

for(const path of ['/FlexiTown/posts/flexi-town-model-130407907','/posts/model-130407907','/posts/130407907','/c/FlexiTown/posts/model-130407907']){
 assert.equal(sourceId('https://www.patreon.com'+path+'/?x=1'),'post:130407907');
 assert.equal(postId('https://www.patreon.com'+path),'130407907');
}
for(const url of ['https://evil.com/posts/123','https://u:p@www.patreon.com/posts/123','https://www.patreon.com/posts/no-id','https://www.patreon.com/posts/0'])assert.throws(()=>sourceId(url));
const state={history:{version:1,posts:{}}},calls=[];
const api={storage:{local:{get:async key=>({[key]:structuredClone(state[key])}),set:async value=>Object.assign(state,structuredClone(value))}},downloads:{download:async opts=>{calls.push(opts);return calls.length},search:async({id})=>[{id,state:'complete',exists:true,bytesReceived:10,mime:'application/octet-stream',filename:'/Chrome/'+calls[id-1].filename}]},tabs:{remove:async()=>{}}};
let files=[{name:'Spyro.zip',url:'https://www.patreon.com/file?m=11'}];
function runner(){const r=new Runner(api,()=>{},async()=>{});r.openPost=async url=>{assert.equal(url,'https://www.patreon.com/posts/130407907');return {title:'Monthly',publishedAt:'2025-06-01T00:00:00Z',files,images:[]}};r.read=async()=>{throw Error('Direct post must not paginate a collection')};return r;}
const options={}; // All time deliberately inspects old monthly-post attachments.
const review=await runner().run(1,'post:130407907','Stage',0,{...options,reviewOnly:true});
assert.equal(review.models.length,1,'All time inspects an older monthly post');
await runner().run(1,'post:130407907','Stage',0,options);
assert.equal(calls.filter(c=>c.url.includes('/file?')).length,1);
files=[...files,{name:'New.zip',url:'https://www.patreon.com/file?m=12'}];
await runner().run(1,'post:130407907','Stage2',0,options);
assert.equal(calls.filter(c=>c.url.includes('m=11')).length,1,'Known ZIP must stay downloaded');
assert.equal(calls.filter(c=>c.url.includes('m=12')).length,1,'New attachment on old post must be discovered');
assert.deepEqual(state.history.posts['130407907'].sourceUrls,['https://www.patreon.com/posts/130407907']);
console.log('Direct post discovery, repeated scans, publication scope, new attachments and ZIP history passed');
