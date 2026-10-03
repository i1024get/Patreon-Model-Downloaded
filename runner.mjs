import {postId,downloadResources,resourceComplete,inspectPage} from './core.mjs';
export class Runner{
 constructor(api,notify=()=>{},sleep=ms=>new Promise(r=>setTimeout(r,ms))){this.api=api;this.notify=notify;this.sleep=sleep;this.stop=false;this.history={version:1,posts:{}};this.worker=null;this.preserveWorker=false}
 async save(){await this.api.storage.local.set({history:this.history})}
 assertRunning(){if(this.stop)throw Error('Stopped. Progress is saved; click Start / Resume to continue.')}
 async read(tabId,mode,id){
  const results=await this.api.scripting.executeScript({target:{tabId},func:inspectPage,args:[mode,id]});const state=results[0]?.result;
  if(!state)throw Error('Could not read the Patreon page');
  if(state.blocked){this.preserveWorker=true;throw Error('Patreon security verification blocked this tab. Stopped.');}
  if(state.login){this.preserveWorker=true;throw Error('Patreon sign-in is required in your regular Chrome. Stopped.');}
  return state;
 }
 async collectFeed(tabId,id){
  const posts=new Map();let idle=0,empty=0;
  while(true){
   this.assertRunning();const state=await this.read(tabId,'feed',id);const before=posts.size;
   for(const link of state.links){const key=postId(link.url);if(key)posts.set(key,{id:key,url:link.url})}
   this.notify(`Loading creator feed: ${posts.size} posts`);
   if(!posts.size){if(++empty>=60)throw Error('No creator post cards found after 60 seconds. Keep the feed open and check that posts are visible.');}
   else if(posts.size>before)idle=0;
   else if(!state.loading&&!state.more){if(++idle>=10)return [...posts.values()]}
   else {idle=0;if(++empty>=120)throw Error('Creator feed loading stalled. Downloads have not started.');}
   if(posts.size>before)empty=0;
   await this.read(tabId,'feedAdvance',id);await this.sleep(1000);
  }
 }
 async collect(tabId,id){
  if(id.startsWith('feed:'))return this.collectFeed(tabId,id);
  const posts=new Map();let expected=null;let emptyAttempts=0;
  while(true){
   this.assertRunning();const state=await this.read(tabId,'collection',id);
   for(const link of state.links){const key=postId(link.url);if(key)posts.set(key,{id:key,url:link.url})}
   expected=state.expected??expected;this.notify(`Loading collection: ${posts.size}${expected?' / '+expected:''} posts`);
   if(!posts.size){
    if(emptyAttempts++>=60)throw Error(`No collection cards found after waiting 60 seconds (${state.postLinks??0} post links seen). Keep the collection tab open and send this log if its cards are visible.`);
    this.notify('Waiting for Patreon collection cards to appear…');await this.sleep(1000);continue;
   }
   if(!state.more){
    if(expected&&posts.size<expected){
     // A loading page can briefly omit Load More. Give that render a chance to settle.
     await this.sleep(1500);const fresh=await this.read(tabId,'collection',id);
     for(const link of fresh.links){const key=postId(link.url);if(key)posts.set(key,{id:key,url:link.url})}
     if(fresh.more)continue;
     if(posts.size<expected)throw Error(`Only ${posts.size} of ${expected} posts found. Downloads have not started.`);
    }
    if(!posts.size)throw Error('No collection posts found. Open the collection and wait until its cards appear.');
    return [...posts.values()];
   }
   const before=posts.size;
   if(!state.loading)await this.read(tabId,'loadMore',id);
   let added=false;
   for(let attempt=0;attempt<45;attempt++){
    this.assertRunning();await this.sleep(1000);const next=await this.read(tabId,'collection',id);
    for(const link of next.links){const key=postId(link.url);if(key)posts.set(key,{id:key,url:link.url})}
    if(posts.size>before){added=true;break}
   }
   if(!added)throw Error('Load More did not add posts. Stopped to avoid repeated requests.');
  }
 }
 async getDownload(id){return (await this.api.downloads.search({id}))[0]}
 async waitDownload(id,kind){
  // Finish an active download before honoring Stop. Its ID is already saved for resume.
  for(let attempt=0;attempt<1800;attempt++){
   const item=await this.getDownload(id);
   if(!item)throw Error('Download was removed from Chrome history');
   if(item.state==='interrupted')throw Error('Download interrupted: '+(item.error||'unknown error'));
   if(item.state==='complete'){
    if(!resourceComplete(item,kind))throw Error('Downloaded response is empty, missing, or not the expected file type. Check Chrome Downloads.');
    return item;
   }
   await this.sleep(1000);
  }
  throw Error('Download is still pending or paused. Check Chrome Downloads, then resume.');
 }
 async postComplete(entry){
  // A completed post remains downloaded after import or Chrome history cleanup.
  return entry?.status==='complete'&&!!entry.resources?.length;
 }
 async openPost(url){
  if(this.worker===null)this.worker=(await this.api.tabs.create({url,active:false})).id;
  else await this.api.tabs.update(this.worker,{url});
  for(let i=0;i<60;i++){
   this.assertRunning();await this.sleep(1000);const tab=await this.api.tabs.get(this.worker);
   // Avoid reading the previous post while navigation is in progress.
   if(tab.status==='complete'&&tab.url?.includes('/login')){this.preserveWorker=true;throw Error('Patreon sign-in is required in your regular Chrome. Stopped.');}
   if(tab.status!=='complete'||postId(tab.url)!==postId(url))continue;
   const state=await this.read(this.worker,'post','');
   if(state.ready){
    if(state.files.length||state.locked)return state;
    // Attachments may hydrate after the title. Wait for a settled second read.
    await this.sleep(2500);return await this.read(this.worker,'post','');
   }
  }
  throw Error('Post did not finish loading within 60 seconds');
 }
 async run(collectionTab,collectionId,folder,limit=0){
  const stored=await this.api.storage.local.get('history');this.history=stored.history||{version:1,posts:{}};
  if(!this.history.posts||typeof this.history.posts!=='object')throw Error('Invalid stored download history');
  const posts=await this.collect(collectionTab,collectionId);await this.api.storage.local.set({lastCollection:{collectionId,posts,folder}});
  const stats={complete:0,skipped:0,failed:0,noFiles:0};
  try{
   for(let index=0;index<posts.length;index++){
    this.assertRunning();if(limit&&index>=limit)break;
    const post=posts[index];let entry=this.history.posts[post.id];
    this.notify(`${index+1} / ${posts.length}: post ${post.id}`);
    if(await this.postComplete(entry)){stats.skipped++;continue}
    try{
     const data=await this.openPost(post.url);
     if(data.locked&&!data.files.length)throw Error('This post is locked for your current Patreon account');
     if(!data.files.length){this.history.posts[post.id]={status:'no_3mf',title:data.title,resources:[]};await this.save();stats.noFiles++;continue}
     entry=entry||{resources:[]};entry.resources=entry.resources||[];entry.postId=post.id;entry.provider='patreon';entry.title=data.title;entry.status='partial';delete entry.error;
     this.history.posts[post.id]=entry;await this.save();
     const resources=downloadResources(data,post.id,folder);
     if(!resources.some(r=>r.kind==='image'))throw Error('No main gallery image was found');
     for(const resource of resources){
      this.assertRunning();let record=entry.resources.find(r=>r.key===resource.key);
      if(record){const item=await this.getDownload(record.downloadId);if(resourceComplete(item,resource.kind))continue;if(item?.state==='in_progress'){await this.waitDownload(record.downloadId,resource.kind);continue}}
      const downloadId=await this.api.downloads.download({url:resource.url,filename:resource.filename,conflictAction:'uniquify',saveAs:false});
      // Store only IDs and filenames. Signed attachment/image URLs stay in memory.
      record={key:resource.key,kind:resource.kind,filename:resource.filename,downloadId};
      entry.resources=entry.resources.filter(r=>r.key!==resource.key);entry.resources.push(record);await this.save();
      const downloaded=await this.waitDownload(downloadId,resource.kind);record.filename=downloaded.filename;await this.save();
     }
     entry.status='complete';entry.completedAt=new Date().toISOString();await this.save();stats.complete++;
    }catch(error){
     const message=String(error.message||error).replace(/https?:\/\/\S+/g,'[URL removed]');
     entry=this.history.posts[post.id]||{resources:[]};entry.status='partial';entry.error=message;this.history.posts[post.id]=entry;await this.save();
     if(this.stop||/security verification|sign-in is required|no tab with id|cannot access contents|missing host permission/i.test(message))throw error;
     stats.failed++;this.notify(`Post ${post.id} failed: ${message}`,'error');
    }
    await this.sleep(1500);
   }
   return stats;
  }finally{
   // Close only the work tab created by this run. Keep login/security pages visible for diagnosis.
   if(this.worker!==null&&!this.stop&&!this.preserveWorker){try{const t=await this.api.tabs.get(this.worker);if(!t.url?.includes('/login'))await this.api.tabs.remove(this.worker)}catch{}}
  }
 }
}
