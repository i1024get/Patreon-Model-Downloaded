import assert from 'node:assert/strict';
import {Runner} from './runner.mjs';
let calls=[],options,writes=0;
globalThis.document={getElementById(){return null},dispatchEvent(){},addEventListener(){}};globalThis.CustomEvent=class{};
let heartbeat;globalThis.setInterval=fn=>{heartbeat=fn};globalThis.setTimeout=()=>1;globalThis.clearTimeout=()=>{};
const selectedPort={onMessage:{addListener(fn){this.fn=fn}},onDisconnect:{addListener(){}},postMessage(message){calls.push(message);this.onMessage.fn({request_id:message.request_id,result:{job:null}})}};
globalThis.chrome={runtime:{connectNative(){return selectedPort}},tabs:{async create(){return {id:1}},async get(){return {status:'complete'}}},storage:{local:{async get(){writes++;throw Error('review must not ingest')}}}};
Object.defineProperty(globalThis,'navigator',{value:{locks:{async request(a,b,fn){await fn({})}}},configurable:true});
Runner.prototype.run=async(a,b,c,d,o)=>{options=o;return {models:[{id:'1',download_state:'new'}],failed:0}};
const bridge=await import('./bridge.mjs');
assert.equal(typeof bridge.runJob,'function');
bridge.connect();
// Immediate waits so job completion is deterministic.
globalThis.setTimeout=fn=>{queueMicrotask(fn);return 1};
await bridge.runJob({job_id:'review',url:'https://www.patreon.com/collection/1',stage:'Stage',mode:'review'});
assert.equal(options.reviewOnly,true);assert.equal(writes,0);assert(!calls.some(c=>c.action==='ingest'));assert.equal(calls.find(c=>c.action==='finish').result.models[0].id,'1');assert(calls.find(c=>c.action==='poll').capabilities.includes('review_results'));
console.log('Review bridge bypasses manifest and ingest and returns cards passed');

// Concurrent timer ticks must share one in-flight active-job heartbeat.
let finishRun;Runner.prototype.run=async()=>new Promise(resolve=>{finishRun=resolve});
const activeRun=bridge.runJob({job_id:'active-review',url:'https://www.patreon.com/collection/1',stage:'Stage',mode:'review'});
for(let i=0;i<8&&!finishRun;i++)await new Promise(resolve=>queueMicrotask(resolve));
assert(finishRun);const before=calls.filter(c=>c.action==='poll'&&c.active_job==='active-review').length;
const firstTick=heartbeat(),secondTick=heartbeat();await Promise.all([firstTick,secondTick]);
assert.equal(calls.filter(c=>c.action==='poll'&&c.active_job==='active-review').length-before,1);
finishRun({models:[],failed:0});await activeRun;
console.log('Active-job heartbeat suppresses overlapping polls passed');
for(const cause of ['stop','login','collection']){
 Runner.prototype.run=async function(){if(cause!=='collection')this.reviewStats={models:[{id:'1',download_state:'new'}],failed:cause==='login'?1:0};if(cause==='stop')this.stop=true;throw Error(cause==='login'?'Patreon sign-in is required':cause==='stop'?'Stopped.':'No creator post cards found')};
 const job_id='abort-'+cause;await bridge.runJob({job_id,url:'https://www.patreon.com/collection/1',stage:'Stage',mode:'review'});
 const finished=calls.find(c=>c.action==='finish'&&c.job_id===job_id);assert(finished);assert(Array.isArray(finished.result.models));assert.equal(finished.result.models.length,cause==='collection'?0:1);assert.equal(finished.status,cause==='stop'?'stopped':'failed');
}
console.log('Stopped, sign-in and collection failures finish review with partial or empty cards passed');
// Selected posts count as successful only after transfer into Unsorted succeeds.
Runner.prototype.run=async()=>({downloaded_post_ids:['1'],failed_post_ids:['2'],complete:1,failed:1});
chrome.storage.local.get=async()=>({history:{posts:{'1':{status:'complete',resources:[{kind:'model',state:'complete',folder:'Stage',filename:'Stage/Chosen.3mf',downloadId:1}]}}}});
chrome.downloads={async search(){return [{state:'complete',exists:true,bytesReceived:100,filename:'Stage/Chosen.3mf'}]}};
const originalPost=selectedPort.postMessage;selectedPort.postMessage=function(message){if(message.action==='ingest'){calls.push(message);this.onMessage.fn({request_id:message.request_id,error:'Transfer failed'})}else originalPost.call(this,message)};
await bridge.runJob({job_id:'transfer-failure',url:'https://www.patreon.com/collection/1',stage:'Stage',mode:'download',selected_posts:['1','2']});
const transferFailure=calls.find(c=>c.action==='finish'&&c.job_id==='transfer-failure');assert.deepEqual(transferFailure.result.downloaded_post_ids,[]);assert.deepEqual(transferFailure.result.failed_post_ids,['2','1']);
selectedPort.postMessage=originalPost;
Runner.prototype.run=async function(){this.stop=true;this.downloadStats={downloaded_post_ids:['1'],failed_post_ids:[],complete:1,failed:0};throw Error('Stopped. Progress saved')};
await bridge.runJob({job_id:'stopped-transfer',url:'https://www.patreon.com/collection/1',stage:'Stage',mode:'download',selected_posts:['1','2']});
const stoppedTransfer=calls.find(c=>c.action==='finish'&&c.job_id==='stopped-transfer');assert.equal(stoppedTransfer.status,'stopped');assert.deepEqual(stoppedTransfer.result.downloaded_post_ids,['1']);assert.deepEqual(stoppedTransfer.result.failed_post_ids,[]);
console.log('Transfer failure exposes no successes; stopped partial successful transfer preserves completed IDs passed');
