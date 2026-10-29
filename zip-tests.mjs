import assert from 'node:assert/strict';
import {downloadResources,inspectPage} from './core.mjs';
import {Runner} from './runner.mjs';
import {buildManifest} from './download-manifest.mjs';

const post={title:'Vodka bundle',files:[{name:'Bundle.ZIP',url:'https://www.patreon.com/file?m=11'},{name:'Model.3mf',url:'https://www.patreon.com/file?m=12'}],images:[]};
const resources=downloadResources(post,'101','Stage');
assert.equal(resources.length,2,'ZIPs must be discovered alongside 3MFs');
assert.match(resources[0].filename,/\.zip$/i);
assert.equal(resources[0].originalFilename,'Bundle.ZIP');

function fixture(initial={version:1,posts:{}}){
 const persisted={history:structuredClone(initial)},downloads=new Map(),calls=[];let sequence=0,fail=false;
 const api={storage:{local:{get:async key=>({[key]:structuredClone(persisted[key])}),set:async value=>Object.assign(persisted,structuredClone(value))}},
  downloads:{download:async opts=>{const id=++sequence;calls.push(opts);downloads.set(id,{id,state:fail&&!opts.url.startsWith('data:')?'interrupted':'complete',error:'NETWORK_FAILED',exists:true,bytesReceived:20,mime:'application/octet-stream',filename:'/Chrome/'+opts.filename});return id;},search:async({id})=>downloads.has(id)?[downloads.get(id)]:[]},
  tabs:{get:async()=>({url:'https://www.patreon.com/posts/101'}),remove:async()=>{}}};
 const runner=()=>{const r=new Runner(api,()=>{},async()=>{});r.collect=async()=>[{id:'101',url:'https://www.patreon.com/posts/101'}];r.openPost=async()=>structuredClone(post);return r;};
 return {persisted,calls,downloads,runner,setFail:value=>fail=value};
}
const attachmentCalls=f=>f.calls.filter(c=>!c.url.startsWith('data:'));
const f=fixture();
await f.runner().run(1,'1','Stage',0,{rescan:true,contentRecheck:true});
assert.equal(attachmentCalls(f).length,2);
f.downloads.clear(); // Import and Chrome history cleanup must not reset ZIP completion.
await f.runner().run(1,'1','NewStage',0,{rescan:true,contentRecheck:true});
assert.equal(attachmentCalls(f).filter(c=>c.url.endsWith('m=11')).length,1,'content rechecks and new staging folders cannot redownload ZIPs');
assert.equal(attachmentCalls(f).filter(c=>c.url.endsWith('m=12')).length,2,'3MF content rechecks still run');
const manifest=buildManifest(f.persisted.history,'Stage');
assert(manifest.posts.some(p=>p.models.some(m=>m.originalFilename==='Bundle.ZIP'&&m.status==='complete')));

const explicit={postId:'101',attachmentId:'11',identityKind:'patreon_attachment_id'};
await f.runner().run(null,'1','NewStage',0,{selectedPostIds:['101'],zipRedownload:explicit,contentRecheck:true});
assert.equal(attachmentCalls(f).filter(c=>c.url.endsWith('m=11')).length,2);
assert.equal(attachmentCalls(f).filter(c=>c.url.endsWith('m=12')).length,2,'dedicated ZIP click cannot redownload 3MFs');
f.setFail(true);
const failed=await f.runner().run(null,'1','NewStage',0,{selectedPostIds:['101'],zipRedownload:explicit,contentRecheck:true});
assert.equal(failed.failed,1);
assert.equal(f.persisted.history.posts['101'].resources.find(r=>r.attachmentId==='11').state,'complete','failed explicit retry preserves previous completion');
f.setFail(false);
await f.runner().run(1,'1','Again',0,{rescan:true,contentRecheck:true});
assert.equal(attachmentCalls(f).filter(c=>c.url.endsWith('m=11')).length,3,'normal runs cannot retry an explicit redownload without another click');

const retry=fixture();retry.setFail(true);
await retry.runner().run(1,'1','Stage',0,{rescan:true});
assert.equal(retry.persisted.history.posts['101'].resources[0].state,'interrupted');
retry.setFail(false);await retry.runner().run(1,'1','Stage',0,{rescan:true});
assert.equal(retry.persisted.history.posts['101'].resources[0].state,'complete','initial failed ZIP downloads remain retryable');

const known=fixture();
await known.runner().run(1,'1','Stage',0,{rescan:true,contentRecheck:true,known:[{post_id:'101',identity_kind:'patreon_attachment_id',attachment_id:'11',original_filename:'old-name.zip'}]});
assert.equal(attachmentCalls(known).filter(c=>c.url.endsWith('m=11')).length,0,'same ID with a changed name stays downloaded');
const invalid=await known.runner().run(null,'1','Stage',0,{selectedPostIds:['101'],zipRedownload:{...explicit,attachmentId:'12'}});
assert.equal(invalid.failed,1,'a 3MF cannot be targeted by the ZIP-only action');
assert.match(known.persisted.history.posts['101'].error,/ZIP/);
console.log('ZIP once-only, explicit attachment redownload, retries, durable history, mixed-post and filename identity tests passed');

const absent=fixture();await absent.runner().run(1,'1','Stage',0,{rescan:true});
const noFiles=absent.runner();noFiles.openPost=async()=>({...post,files:[]});
await noFiles.run(1,'1','Stage',0,{rescan:true});
await absent.runner().run(1,'1','Stage',0,{rescan:true,contentRecheck:true});
assert.equal(attachmentCalls(absent).filter(c=>c.url.endsWith('m=11')).length,1,'temporary attachment absence must preserve ZIP completion');

const stopped=fixture();await stopped.runner().run(1,'1','Stage',0,{rescan:true});
const stoppedRunner=stopped.runner();stoppedRunner.waitDownload=async function(){this.stop=true;throw Error('NETWORK_FAILED');};
await assert.rejects(stoppedRunner.run(null,'1','NewStage',0,{selectedPostIds:['101'],zipRedownload:explicit}),/NETWORK_FAILED/);
assert.equal(stopped.persisted.history.posts['101'].resources.find(r=>r.attachmentId==='11').state,'complete');
await stopped.runner().run(1,'1','Stage',0,{rescan:true,contentRecheck:true});
assert.equal(attachmentCalls(stopped).filter(c=>c.url.endsWith('m=11')).length,2,'stopped explicit attempt cannot enable ordinary ZIP redownload');

const crashed=fixture();await crashed.runner().run(1,'1','Stage',0,{rescan:true});
// Simulate a process exit after an explicit download stored its pending replacement.
const pending=crashed.persisted.history.posts['101'].resources.find(r=>r.attachmentId==='11');pending.state='pending';pending.downloadId=999;pending.folder='NewStage';pending.filename='NewStage/Bundle.zip';
crashed.downloads.clear();
await crashed.runner().run(1,'1','Again',0,{rescan:true,contentRecheck:true});
assert.equal(attachmentCalls(crashed).filter(c=>c.url.endsWith('m=11')).length,1,'a pending replacement cannot erase durable prior ZIP completion after restart');
console.log('ZIP completion survives empty pages, stopped failures, and process restart with a pending replacement');
