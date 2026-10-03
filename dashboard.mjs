import {exportManifest} from './download-manifest.mjs';
import {Runner} from './runner.mjs';import {safeName,sourceId} from './core.mjs';
const $=id=>document.getElementById(id);let runner=null,running=false;
function log(message,type='info'){const row=document.createElement('div');row.className=type;row.textContent=message;$('log').append(row);while($('log').children.length>100)$('log').firstChild.remove();$('log').scrollTop=$('log').scrollHeight;$('status').textContent=message}
async function render(){const {history}=await chrome.storage.local.get('history');const entries=Object.entries(history?.posts||{});$('results').replaceChildren();for(const [id,item] of entries){const tr=document.createElement('tr');const first=document.createElement('td');const a=document.createElement('a');a.href='https://www.patreon.com/posts/'+id;a.target='_blank';a.rel='noopener';a.textContent=item.title||id;first.append(a);tr.append(first);for(const text of [item.status,item.resources?.filter(r=>r.state==='complete'||(!r.state&&item.status==='complete')).length||0,item.error||item.warnings?.join('; ')||'']){const td=document.createElement('td');td.textContent=text;tr.append(td)}$('results').append(tr)}const completed=entries.filter(([,x])=>x.status==='complete').length;$('summary').textContent=entries.length?`${completed} completed posts · ${entries.length} posts recorded. Incomplete posts are retried when you resume.`:'Sign in to Patreon in your regular Chrome, then start here.'}
function setBusy(value){running=value;$('start').disabled=value;$('stop').disabled=!value;$('collection').disabled=value;$('folder').disabled=value;$('trial').disabled=value;$('manifest').disabled=value}
$('stop').addEventListener('click',()=>{if(runner){runner.stop=true;log('Stopping after the current file. Progress will be retained.')}});
$('start').addEventListener('click',async()=>{
 if(running)return;
 await navigator.locks.request('duck-vault-downloader',{ifAvailable:true},async lock=>{
  if(!lock){log('Another downloader tab is already running.','error');return}
  let u,collectionId;try{u=new URL($('collection').value.trim());collectionId=sourceId(u.href)}catch(error){log(error.message,'error');return}
  const folder=$('folder').value.trim();if(folder!==safeName(folder)||!folder||folder.includes('..')){log('Enter a simple download folder name, such as TheDuckVault.','error');return}
  setBusy(true);
  try{
   const tabs=await chrome.tabs.query({url:'https://www.patreon.com/*'});let tab=tabs.find(t=>new URL(t.url).pathname.replace(/\/$/,'')===u.pathname.replace(/\/$/,''));
   if(!tab){tab=await chrome.tabs.create({url:u.href,active:true});log('Opened the Patreon page in your regular Chrome. Waiting for it to load.');for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,1000));tab=await chrome.tabs.get(tab.id);if(tab.status==='complete')break}}
   runner=new Runner(chrome,(message,type)=>log(message,type));const stats=await runner.run(tab.id,collectionId,folder,$('trial').checked?2:0);
   log(`Finished: ${stats.complete} newly completed · ${stats.skipped} skipped · ${stats.failed} failed · ${stats.noFiles} without 3MF.`);
  }catch(error){log(String(error.message||error).replace(/https?:\/\/\S+/g,'[URL removed]'),'error')}
  finally{runner=null;setBusy(false);await render()}
 });
});
$('report').addEventListener('click',async()=>{const {history}=await chrome.storage.local.get('history');const blob=new Blob([JSON.stringify(history||{version:1,posts:{}},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='Patreon-Model-Downloader-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)});
chrome.storage.onChanged.addListener(changes=>{if(changes.history)render()});
window.addEventListener('beforeunload',event=>{if(running){event.preventDefault();event.returnValue=''}});
render();

$('manifest').addEventListener('click',async()=>{const folder=$('folder').value.trim();if(!folder||folder!==safeName(folder)||folder.includes('..')){log('Enter a simple designer folder name.','error');return}try{const {history}=await chrome.storage.local.get('history');await exportManifest(chrome,history||{posts:{}},folder);log('Saved '+folder+'/patreon-download-manifest.json')}catch(error){log(error.message,'error')}});
