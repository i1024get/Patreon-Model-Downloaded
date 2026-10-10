import {Runner} from './runner.mjs';
import {sourceId} from './core.mjs';
import {buildManifest} from './download-manifest.mjs';
let port=null,active=null,runner=null,sequence=0,pending=new Map(),polling=false;
const status=message=>{const el=document.getElementById('bridgeStatus');if(el)el.textContent=message};
export function nativeRequest(data){
 if(!port)return Promise.reject(Error('Connect the extension to 3DHub first.'));
 return new Promise((resolve,reject)=>{const request_id=String(++sequence);const timer=setTimeout(()=>{pending.delete(request_id);reject(Error('Desktop Agent did not respond.'))},35000);pending.set(request_id,{resolve,reject,timer});port.postMessage({...data,request_id})});
}
function connect(){
 if(port)return;
 try{
  port=chrome.runtime.connectNative('com.3dhub.patreon');
  port.onMessage.addListener(message=>{const p=pending.get(message.request_id);if(!p)return;clearTimeout(p.timer);pending.delete(message.request_id);message.error?p.reject(Error(message.error)):p.resolve(message.result)});
  port.onDisconnect.addListener(()=>{const message=chrome.runtime.lastError?.message||'Native bridge disconnected.';port=null;if(runner)runner.stop=true;for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error(message))}pending.clear();status(message+' Run install-patreon-bridge.ps1 if this is the first connection.');});
  status('Connecting to the Desktop Agent…');tick();
 }catch(e){port=null;status(e.message)}
}
function basename(path){return String(path||'').replaceAll('\\','/').split('/').at(-1)}
export async function completedStagingFiles(api,history,folder,manifest){
 const expected=new Set();for(const post of manifest.posts||[])for(const model of post.models||[])if(model.status==='complete'){expected.add(model.filename);if(model.imageFilename)expected.add(model.imageFilename)}
 const files=new Map();
 for(const entry of Object.values(history.posts||{}))for(const resource of entry.resources||[]){
  if(resource.folder!==folder||resource.state!=='complete'||!expected.has(basename(resource.filename)))continue;
  const item=(await api.downloads.search({id:resource.downloadId}))[0];
  if(item?.state==='complete'&&item.exists!==false&&item.bytesReceived>0)files.set(basename(item.filename),{filename:basename(item.filename),path:item.filename});
 }
 return [...files.values()];
}
async function runJob(job){
 active=job;let stats={},failure=null,ingested={moved_files:0};document.dispatchEvent(new CustomEvent('patreon-bridge-busy',{detail:true}));
 try{
  const tab=await chrome.tabs.create({url:job.url,active:true});
  for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,1000));const t=await chrome.tabs.get(tab.id);if(t.status==='complete')break}
  let lastProgress=0;
  runner=new Runner(chrome,message=>{status(message);if(Date.now()-lastProgress>1000){lastProgress=Date.now();nativeRequest({action:'progress',job_id:job.job_id,message}).then(r=>{if(r.stop)runner&&(runner.stop=true)}).catch(()=>{runner&&(runner.stop=true)})}});
  stats=await runner.run(tab.id,sourceId(job.url),job.stage,0,{rescan:true,known:job.known});
 }catch(e){failure=String(e.message||e).replace(/https?:\/\/\S+/g,'[URL removed]');}
 try{
  const {history}=await chrome.storage.local.get('history');const manifest=buildManifest(history||{posts:{}},job.stage);
  const files=await completedStagingFiles(chrome,history||{posts:{}},job.stage,manifest);
  if(files.length){
   ingested=await nativeRequest({action:'ingest',job_id:job.job_id,files,manifest});
   while(ingested.pending){status('Moving completed files into Unsorted…');await new Promise(r=>setTimeout(r,1000));ingested=await nativeRequest({action:'ingest-status',job_id:job.job_id});}
  }
  const stopped=runner?.stop;const state=stopped?'stopped':failure||stats.failed?'failed':'complete';
  const message=failure||`Finished: ${stats.complete||0} posts completed, ${stats.skipped||0} skipped, ${stats.failed||0} failed; ${ingested.moved_files} files moved into Unsorted/${job.designer}.`;
  await nativeRequest({action:'finish',job_id:job.job_id,status:state,message,result:{...stats,...ingested}});status(message);
 }catch(e){status('Completed downloads remain in Chrome’s staging folder: '+e.message);try{await nativeRequest({action:'finish',job_id:job.job_id,status:'failed',message:'File transfer failed: '+e.message,result:stats})}catch{}}
 finally{active=null;runner=null;document.dispatchEvent(new CustomEvent('patreon-bridge-busy',{detail:false}));}
}
async function tick(){
 if(!port)return;
 if(active){try{const result=await nativeRequest({action:'poll',active_job:active.job_id});if(result.stop&&runner)runner.stop=true}catch{}return}
 if(polling)return;polling=true;
 try{
  await navigator.locks.request('duck-vault-downloader',{ifAvailable:true},async lock=>{
   if(!lock)return;const reply=await nativeRequest({action:'poll'});
   if(reply.job)await runJob(reply.job);else status('Connected. Start a Patreon scan from the designer’s download sources in 3DHub.');
  });
 }catch(e){status(e.message)}finally{polling=false}
}
if(typeof document!=='undefined'){
 document.getElementById('connectBridge')?.addEventListener('click',connect);
 document.getElementById('stopBridge')?.addEventListener('click',()=>{if(runner){runner.stop=true;status('Stopping after the current file…')}});
 setInterval(tick,2000);
}
