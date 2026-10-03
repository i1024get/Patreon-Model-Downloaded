import assert from 'node:assert/strict';import {Runner} from './runner.mjs';
function fakeAPI(){
 const stored={},tabs=new Map([[1,{id:1,url:'https://www.patreon.com/collection/2088592',status:'complete'}]]),items=new Map();let batch=0,nextTab=2,nextDownload=1;
 const api={storage:{local:{async get(key){return {[key]:structuredClone(stored[key])}},async set(values){Object.assign(stored,structuredClone(values))}}},tabs:{async create({url}){const tab={id:nextTab++,url,status:'complete'};tabs.set(tab.id,tab);return tab},async update(id,{url}){const tab=tabs.get(id);tab.url=url;return tab},async get(id){return tabs.get(id)},async remove(id){tabs.delete(id)}},scripting:{async executeScript({target,args}){const [mode]=args;let result;if(mode==='loadMore'){batch=1;result={clicked:true}}else if(mode==='collection'){result={expected:2,more:batch===0,loading:false,links:Array.from({length:batch+1},(_,i)=>({url:`https://www.patreon.com/posts/${i+1}?collection=2088592`}))}}else{const id=tabs.get(target.tabId).url.match(/posts\/(\d+)/)[1];result={ready:true,title:'Duck '+id,files:[{name:'Duck.3mf',url:'https://www.patreon.com/file?h=PRIVATE_SIGNED_'+id}],images:['https://c10.patreonusercontent.com/duck.png'],locked:false}}return [{result}]}},downloads:{async download(options){const id=nextDownload++;items.set(id,{id,state:'complete',exists:true,bytesReceived:100,mime:options.url.includes('.png')?'image/png':'application/octet-stream',filename:options.filename});return id},async search({id}){return items.has(id)?[items.get(id)]:[]}}};return {api,stored,items};
}
const {api,stored,items}=fakeAPI();
const first=new Runner(api,()=>{},async()=>{});const stats=await first.run(1,'2088592','TheDuckVault');
assert.deepEqual(stats,{complete:2,skipped:0,failed:0,noFiles:0});assert.equal(items.size,4);assert.equal(Object.keys(stored.history.posts).length,2);assert(!JSON.stringify(stored).includes('PRIVATE_SIGNED'));
const again=new Runner(api,()=>{},async()=>{});assert.deepEqual(await again.run(1,'2088592','TheDuckVault'),{complete:0,skipped:2,failed:0,noFiles:0});assert.equal(items.size,4);
// Importing/moving a completed post must not trigger another download.
items.get(stored.history.posts['1'].resources[0].downloadId).exists=false;
items.clear();
const missing=new Runner(api,()=>{},async()=>{});assert.equal((await missing.run(1,'2088592','TheDuckVault')).skipped,2);assert.equal(items.size,0);
// A count mismatch must stop before requesting any downloads.
const bad=fakeAPI();const original=bad.api.scripting.executeScript;
bad.api.scripting.executeScript=async arg=>{const output=await original(arg);if(arg.args[0]==='collection')output[0].result.expected=3;return output};
await assert.rejects(new Runner(bad.api,()=>{},async()=>{}).run(1,'2088592','TheDuckVault'),/Only 2 of 3/);assert.equal(bad.items.size,0);
console.log('Runner: pagination, downloads, resume, imported-file history, URL privacy, and incomplete-scan checks passed');
// An interrupted image must not cause its completed model to be downloaded again.
const partial=fakeAPI();const startDownload=partial.api.downloads.download;let starts=0;
partial.api.downloads.download=async options=>{const id=await startDownload(options);if(++starts===2)Object.assign(partial.items.get(id),{state:'interrupted',error:'SERVER_FAILED'});return id};
const partialStats=await new Runner(partial.api,()=>{},async()=>{}).run(1,'2088592','TheDuckVault');assert.equal(partialStats.failed,1);assert.equal(partialStats.complete,1);
const partialResume=await new Runner(partial.api,()=>{},async()=>{}).run(1,'2088592','TheDuckVault');assert.equal(partialResume.complete,1);assert.equal(partialResume.skipped,1);assert.equal(partial.items.size,5);
// Stop retains the current native download ID and does not start the image.
const stopping=fakeAPI();const stopRunner=new Runner(stopping.api,()=>{},async()=>{});const stopStart=stopping.api.downloads.download;
stopping.api.downloads.download=async options=>{const id=await stopStart(options);stopRunner.stop=true;return id};
await assert.rejects(stopRunner.run(1,'2088592','TheDuckVault'),/Stopped/);assert.equal(stopping.items.size,1);assert.equal(stopping.stored.history.posts['1'].resources.length,1);
console.log('Interrupted-image resume and stop-after-file checks passed');

// Chrome document completion can precede Patreon card rendering.
const delayed=fakeAPI();const delayedRead=delayed.api.scripting.executeScript;let emptyReads=0;
delayed.api.scripting.executeScript=async arg=>arg.args[0]==='collection'&&emptyReads++<4?[{result:{links:[],more:false,expected:null}}]:delayedRead(arg);
assert.equal((await new Runner(delayed.api,()=>{},async()=>{}).run(1,'2088592','TheDuckVault')).complete,2);
console.log('Delayed collection rendering check passed');

// Patreon redirects legacy post URLs to creator-prefixed canonical URLs.
const redirected=fakeAPI();const originalGet=redirected.api.tabs.get;
redirected.api.tabs.get=async id=>{const tab=await originalGet(id);return {...tab,url:tab.url.replace('/posts/','/TheDuckVault/posts/duck-')}};
assert.equal((await new Runner(redirected.api,()=>{},async()=>{}).run(1,'2088592','TheDuckVault')).complete,2);
console.log('Creator-prefixed post redirect check passed');
// Feed scrolling can yield delayed batches and duplicate pinned posts.
const feed=fakeAPI();const feedRead=feed.api.scripting.executeScript;let scrolls=0;
feed.api.scripting.executeScript=async arg=>{
 if(arg.args[0]==='feedAdvance'){scrolls++;return [{result:{}}]}
 if(arg.args[0]==='feed')return [{result:{links:Array.from({length:scrolls>=3?2:1},(_,i)=>({url:`https://www.patreon.com/posts/${i+1}`})),more:false,loading:scrolls<3}}];
 return feedRead(arg);
};
assert.equal((await new Runner(feed.api,()=>{},async()=>{}).run(1,'feed:/c/javier3d/posts','Javier3D')).complete,2);
assert.equal(feed.items.size,4);assert(scrolls>=13);
console.log('Creator feed scrolling, delayed batches, deduplication, and download checks passed');
