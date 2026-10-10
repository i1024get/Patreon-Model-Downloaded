import assert from 'node:assert/strict';import {Runner} from './runner.mjs';
function fakeAPI(){
 const stored={},tabs=new Map([[1,{id:1,url:'https://www.patreon.com/collection/2088592',status:'complete'}]]),items=new Map(),manifests=new Map();let batch=0,nextTab=2,nextDownload=1;
 const api={storage:{local:{async get(key){return {[key]:structuredClone(stored[key])}},async set(values){Object.assign(stored,structuredClone(values))}}},tabs:{async create({url}){const tab={id:nextTab++,url,status:'complete'};tabs.set(tab.id,tab);return tab},async update(id,{url}){const tab=tabs.get(id);tab.url=url;return tab},async get(id){return tabs.get(id)},async remove(id){tabs.delete(id)}},scripting:{async executeScript({target,args}){const [mode]=args;let result;if(mode==='loadMore'){batch=1;result={clicked:true}}else if(mode==='collection'){result={expected:2,more:batch===0,loading:false,links:Array.from({length:batch+1},(_,i)=>({url:`https://www.patreon.com/posts/${i+1}?collection=2088592`}))}}else{const id=tabs.get(target.tabId).url.match(/posts\/(\d+)/)[1];result={ready:true,title:'Duck '+id,files:[{name:'Duck.3mf',url:'https://www.patreon.com/file?h=PRIVATE_SIGNED_'+id}],images:['https://c10.patreonusercontent.com/duck.png'],locked:false}}return [{result}]}},downloads:{async download(options){const id=nextDownload++;(options.filename.endsWith('patreon-download-manifest.json')?manifests:items).set(id,{id,state:'complete',exists:true,bytesReceived:100,mime:options.url.includes('.png')?'image/png':'application/octet-stream',filename:options.filename});return id},async search({id}){return items.has(id)?[items.get(id)]:manifests.has(id)?[manifests.get(id)]:[]}}};return {api,stored,items,manifests};
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

assert.equal(feed.manifests.size,1);assert.equal(stopping.manifests.size,1);
console.log('Automatic manifest export after full and stopped runs passed');
// A broken first attachment must not block later same-name models or the image.
const broken=fakeAPI();const readBroken=broken.api.scripting.executeScript;
broken.api.scripting.executeScript=async arg=>{const out=await readBroken(arg);if(arg.args[0]==='post')out[0].result.files=[1,2,3].map((id,i)=>({name:i<2?'Bebop.3mf':'Bebop4c.3mf',url:`https://www.patreon.com/file?h=1&m=${id}`}));return out};
const downloadBroken=broken.api.downloads.download;
broken.api.downloads.download=async options=>{const id=await downloadBroken(options);if(options.url.endsWith('m=1'))Object.assign(broken.items.get(id),{state:'interrupted',error:'SERVER_BAD_CONTENT'});return id};
await new Runner(broken.api,()=>{},async()=>{}).run(1,'2088592','Designer',1);
assert.equal([...broken.items.values()].filter(x=>x.state==='complete').length,3);
const noImage=fakeAPI();const readNoImage=noImage.api.scripting.executeScript;
noImage.api.scripting.executeScript=async arg=>{const out=await readNoImage(arg);if(arg.args[0]==='post')out[0].result.images=[];return out};
assert.equal((await new Runner(noImage.api,()=>{},async()=>{}).run(1,'2088592','Designer',1)).complete,1);
assert.equal(noImage.items.size,1);
console.log('Broken first attachment isolation and model downloads without images passed');
await new Runner(broken.api,()=>{},async()=>{}).run(1,'2088592','Designer',1);
assert.equal(broken.items.size,5); // Only the broken attachment is retried.
assert.equal(noImage.stored.history.posts['1'].warnings.length,1);
console.log('Partial retry preserves working attachments and image passed');
// Bridge scans must inspect completed posts and discover newly added attachments.
const rescan=fakeAPI();await new Runner(rescan.api,()=>{},async()=>{}).run(1,'2088592','BridgeFolder');const before=rescan.items.size,oldRead=rescan.api.scripting.executeScript;
rescan.api.scripting.executeScript=async args=>{const result=await oldRead(args);if(args.args[0]==='post')result[0].result.files.push({name:'New.3mf',url:'https://www.patreon.com/file?m=999'});return result};
const rescanned=await new Runner(rescan.api,()=>{},async()=>{}).run(1,'2088592','BridgeFolder',0,{rescan:true,known:[{post_id:'1',attachment_id:'Duck.3mf',identity_kind:'filename_fallback',original_filename:'Duck.3mf'},{post_id:'2',attachment_id:'Duck.3mf',identity_kind:'filename_fallback',original_filename:'Duck.3mf'}]});assert.equal(rescanned.complete,2);assert.equal(rescan.items.size,before+2);
console.log('Bridge rescan discovers new attachments on completed posts');
const manual=fakeAPI();await new Runner(manual.api,()=>{},async()=>{}).run(1,'2088592','Manual');
await new Runner(manual.api,()=>{},async()=>{}).run(1,'2088592','Stage',0,{rescan:true,known:[]});
assert.equal(manual.items.size,8);assert(Object.values(manual.stored.history.posts).every(p=>p.resources.every(r=>r.filename.startsWith('Stage/'))));
const unique=fakeAPI();await new Runner(unique.api,()=>{},async()=>{}).run(1,'2088592','Stage');
const record=unique.stored.history.posts['1'].resources[0];unique.items.get(record.downloadId).filename='Stage/Actual (1).3mf';record.state='pending';
await new Runner(unique.api,()=>{},async()=>{}).run(1,'2088592','Stage',0,{rescan:true,known:[]});
assert.equal(unique.stored.history.posts['1'].resources[0].filename,'Stage/Actual (1).3mf');
console.log('Manual-folder isolation and actual resumed filename checks passed');
