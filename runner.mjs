import {exportManifest} from './download-manifest.mjs';
import {postId,downloadResources,resourceComplete,inspectPage} from './core.mjs';
export function postDateSeconds(value){
 if(value==null||value==='')return null;
 const numeric=Number(value);if(Number.isFinite(numeric)&&numeric>0)return numeric>1e12?numeric/1000:numeric;
 if(!/\b\d{4}\b/.test(String(value)))return null;
 const ms=Date.parse(value);return Number.isFinite(ms)?ms/1000:null;
}
export function scopePosts(posts,options={}){return options.since?posts.filter(p=>{const date=postDateSeconds(p.publishedAt);return date===null||date>=options.since;}):posts;}
function scopeBoundary(state,options){
 if(!options.since||!state.newestFirst||state.loading)return false;
 const cards=[...new Map((state.links||[]).filter(p=>!p.pinned).map(p=>[postId(p.url),p])).values()];
 // Only the tail establishes the cutoff in a verified newest-first feed.
 // Unknown earlier cards remain candidates and get inspected during review.
 const dates=cards.slice(-2).map(p=>postDateSeconds(p.publishedAt));
 return dates.length>=2&&dates.every(d=>d!==null)&&dates.every((d,i)=>!i||d<=dates[i-1])&&dates.at(-1)<options.since;
}
export class Runner{
 constructor(api,notify=()=>{},sleep=ms=>new Promise(r=>setTimeout(r,ms))){this.api=api;this.notify=notify;this.sleep=sleep;this.stop=false;this.history={version:1,posts:{}};this.worker=null;this.preserveWorker=false}
 async save(){if(this.currentPostId&&this.history.posts[this.currentPostId])this.history.posts[this.currentPostId].updatedAt=new Date().toISOString();await this.api.storage.local.set({history:this.history})}
 assertRunning(){if(this.stop)throw Error('Stopped. Progress is saved; click Start / Resume to continue.')}
 async read(tabId,mode,id){
  const results=await this.api.scripting.executeScript({target:{tabId},func:inspectPage,args:[mode,id]});const state=results[0]?.result;
  if(!state)throw Error('Could not read the Patreon page');
  if(state.blocked){this.preserveWorker=true;throw Error('Patreon security verification blocked this tab. Stopped.');}
  if(state.login){this.preserveWorker=true;throw Error('Patreon sign-in is required in your regular Chrome. Stopped.');}
  return state;
 }
 async collectFeed(tabId,id,options={}){
  const posts=new Map(),probed=new Set();let idle=0,empty=0,orderWaits=0;
  while(true){
   this.assertRunning();const state=await this.read(tabId,'feed',id);const before=posts.size;
   for(const link of state.links){const key=postId(link.url);if(key)posts.set(key,{...link,id:key,url:link.url,publishedAt:link.publishedAt||posts.get(key)?.publishedAt||null})}
   this.notify(`Loading creator feed: ${posts.size} posts`);
   if(options.since&&posts.size&&!state.newestFirst&&!state.loading){
    // Newly opened automation tabs can render cards before the sort control.
    // Re-read in place; never paginate or infer ordering while it is unknown.
    if(orderWaits++>=10)throw Error('Cannot verify newest-first ordering for this scoped feed. Choose Newest first on Patreon and retry, or use Full scan.');
    this.notify('Waiting for Patreon feed ordering to finish loading…');
    await this.sleep(1000);continue;
   }
   if(options.since&&state.newestFirst&&!state.loading){
    const boundary=[...new Map(state.links.filter(p=>!p.pinned).map(p=>[postId(p.url),p])).values()].slice(-2);
    if(boundary.length===2)for(const card of boundary){
     const key=postId(card.url),post=posts.get(key);if(!post||postDateSeconds(post.publishedAt)!==null||probed.has(key))continue;
     this.assertRunning();probed.add(key);this.notify('Checking publication date at the scope boundary…');
     const data=await this.openPost(card.url);if(postDateSeconds(data.publishedAt)!==null)post.publishedAt=data.publishedAt;
    }
   }
   const datedState={...state,links:state.links.map(link=>({...link,publishedAt:posts.get(postId(link.url))?.publishedAt||link.publishedAt}))};
   if(scopeBoundary(datedState,options)){this.notify('Reached the date cutoff; older feed posts will not be loaded.');return scopePosts([...posts.values()],options);}
   if(!posts.size){if(++empty>=60)throw Error('No creator post cards found after 60 seconds. Keep the feed open and check that posts are visible.');}
   else if(posts.size>before)idle=0;
   else if(!state.loading&&!state.more){if(++idle>=10)return scopePosts([...posts.values()],options)}
   else {idle=0;if(++empty>=120)throw Error('Creator feed loading stalled. Downloads have not started.');}
   if(posts.size>before)empty=0;
   await this.read(tabId,'feedAdvance',id);await this.sleep(1000);
  }
 }
 async collect(tabId,id,options={}){
  if(id.startsWith('feed:'))return this.collectFeed(tabId,id,options);
  const posts=new Map();let expected=null;let emptyAttempts=0;
  while(true){
   this.assertRunning();const state=await this.read(tabId,'collection',id);
   for(const link of state.links){const key=postId(link.url);if(key)posts.set(key,{...link,id:key,url:link.url})}
   expected=state.expected??expected;this.notify(`Loading collection: ${posts.size}${expected?' / '+expected:''} posts`);
   if(!posts.size){
    if(emptyAttempts++>=60)throw Error(`No collection cards found after waiting 60 seconds (${state.postLinks??0} post links seen). Keep the collection tab open and send this log if its cards are visible.`);
    this.notify('Waiting for Patreon collection cards to appear…');await this.sleep(1000);continue;
   }
   if(!state.more){
    if(expected&&posts.size<expected){
     // A loading page can briefly omit Load More. Give that render a chance to settle.
     await this.sleep(1500);const fresh=await this.read(tabId,'collection',id);
     for(const link of fresh.links){const key=postId(link.url);if(key)posts.set(key,{...link,id:key,url:link.url})}
     if(fresh.more)continue;
     if(posts.size<expected)throw Error(`Only ${posts.size} of ${expected} posts found. Downloads have not started.`);
    }
    if(!posts.size)throw Error('No collection posts found. Open the collection and wait until its cards appear.');
    return scopePosts([...posts.values()],options);
   }
   const before=posts.size;
   if(!state.loading)await this.read(tabId,'loadMore',id);
   let added=false;
   for(let attempt=0;attempt<45;attempt++){
    this.assertRunning();await this.sleep(1000);const next=await this.read(tabId,'collection',id);
    for(const link of next.links){const key=postId(link.url);if(key)posts.set(key,{...link,id:key,url:link.url})}
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
 knownResource(resource,postId,data,options,includeHistory=false){
  if(options.contentRecheck)return false;
  if(resource.kind!=='model')return false;
  const identityMatches=k=>resource.identityKind==='patreon_attachment_id'?k.identity_kind==='patreon_attachment_id'&&String(k.attachment_id)===String(resource.attachmentId):k.identity_kind==='filename_fallback'&&k.original_filename===resource.originalFilename&&data.files.filter(f=>f.name===resource.originalFilename).length===1;
  if((options.known||[]).some(k=>String(k.post_id)===postId&&identityMatches(k)))return true;
  return includeHistory&&(this.history.posts[postId]?.resources||[]).some(r=>r.kind==='model'&&r.state==='complete'&&identityMatches({identity_kind:r.identityKind,attachment_id:r.attachmentId,original_filename:r.originalFilename}));
 }
 async review(posts,folder,limit,options){
  const stats=this.reviewStats={complete:0,skipped:0,failed:0,noFiles:0,models:[]};
  try{
   for(const post of (limit?posts.slice(0,limit):posts)){
    this.assertRunning();let model={id:post.id,title:post.title||'Post '+post.id,published_at:post.publishedAt||null,image_url:null,profile_id:null,attachment_count:0,attachments:[],download_state:'error'};
    try{
     const data=await this.openPost(post.url);
     if(options.since&&postDateSeconds(data.publishedAt)!==null&&postDateSeconds(data.publishedAt)<options.since){stats.skipped++;continue}
     const resources=downloadResources(data,post.id,folder).filter(r=>r.kind==='model');
     const attachments=resources.map(r=>({attachment_id:r.attachmentId,identity_kind:r.identityKind,original_filename:r.originalFilename,download_state:this.knownResource(r,post.id,data,options,true)?'downloaded':'new'}));
     const knownCount=attachments.filter(a=>a.download_state==='downloaded').length;
     model={...model,title:data.title,published_at:data.publishedAt||post.publishedAt||null,image_url:data.images?.[0]||null,profile_id:resources.length?'post':null,attachment_count:resources.length,attachments,download_state:resources.length?(knownCount===resources.length?'downloaded':knownCount?'updated':'new'):data.locked?'locked':'no_files'};
     if(model.download_state==='downloaded')stats.skipped++;else if(model.download_state==='no_files')stats.noFiles++;else if(model.download_state==='locked')stats.failed++;else stats.complete++;
    }catch(error){model.error=String(error.message||error).replace(/https?:\/\/\S+/g,'[URL removed]');stats.failed++;if(this.stop||/security verification|sign-in is required/i.test(model.error)){stats.models.push(model);throw error}}
    stats.models.push(model);this.notify('Reviewed post '+post.id);await this.sleep(1500);
   }
   return stats;
  }finally{if(this.worker!==null&&!this.stop&&!this.preserveWorker)try{await this.api.tabs.remove(this.worker)}catch{}}
 }
 async run(collectionTab,collectionId,folder,limit=0,options={}){
  this.reviewStats=options.reviewOnly?{complete:0,skipped:0,failed:0,noFiles:0,models:[]}:null;
  const stored=await this.api.storage.local.get('history');this.history=stored.history||{version:1,posts:{}};
  if(!this.history.posts||typeof this.history.posts!=='object')throw Error('Invalid stored download history');
  if(options.selectedPostIds!==undefined&&(!Array.isArray(options.selectedPostIds)||options.selectedPostIds.some(id=>typeof id!=='string'||!/^\d+$/.test(id))))throw Error('Invalid selected post ID');
  const posts=options.selectedPostIds!==undefined?[...new Set(options.selectedPostIds)].map(id=>({id,url:'https://www.patreon.com/posts/'+id})):await this.collect(collectionTab,collectionId,options);
  if(options.reviewOnly)return this.review(posts,folder,limit,options);
  await this.api.storage.local.set({lastCollection:{collectionId,posts,folder}});
  const stats=this.downloadStats={complete:0,skipped:0,failed:0,noFiles:0};
  if(options.selectedPostIds!==undefined){stats.downloaded_post_ids=[];stats.failed_post_ids=[];}
  try{
   for(let index=0;index<posts.length;index++){
    this.assertRunning();if(limit&&index>=limit)break;
    const post=posts[index];this.currentPostId=post.id;let entry=this.history.posts[post.id];
    this.notify(`${index+1} / ${posts.length}: post ${post.id}`);
    if(!options.contentRecheck&&!options.rescan&&options.selectedPostIds===undefined&&await this.postComplete(entry)){entry.sourceUrls=[...new Set([...(entry.sourceUrls||[]),collectionId.startsWith('feed:')?'https://www.patreon.com'+collectionId.slice(5):'https://www.patreon.com/collection/'+collectionId])];await this.save();stats.skipped++;continue}
    try{
     const data=await this.openPost(post.url);
     if(options.since&&postDateSeconds(data.publishedAt)!==null&&postDateSeconds(data.publishedAt)<options.since){stats.skipped++;continue;}
     if(data.locked&&!data.files.length)throw Error('This post is locked for your current Patreon account');
     if(!data.files.length){this.history.posts[post.id]={status:'no_3mf',title:data.title,resources:[]};await this.save();stats.noFiles++;continue}
     entry=entry||{resources:[]};entry.resources=entry.resources||[];entry.sourceUrls=[...new Set([...(entry.sourceUrls||[]),collectionId.startsWith('feed:')?'https://www.patreon.com'+collectionId.slice(5):'https://www.patreon.com/collection/'+collectionId])];entry.postId=post.id;entry.provider='patreon';entry.title=data.title;entry.status='partial';delete entry.error;
     this.history.posts[post.id]=entry;await this.save();
     const resources=downloadResources(data,post.id,folder);
     const known=resource=>this.knownResource(resource,post.id,data,options);
     if(resources.filter(r=>r.kind==='model').every(known)){entry.status='complete';await this.save();stats.skipped++;stats.downloaded_post_ids?.push(post.id);continue}
     const errors=[];entry.warnings=resources.some(r=>r.kind==='image')?[]:['No product image available; models downloaded without an image.'];
     if(entry.warnings.length)this.notify(entry.warnings[0]);
     for(const resource of resources){
      this.assertRunning();if(known(resource))continue;let record=entry.resources.find(r=>resource.identityKind==='patreon_attachment_id'?r.attachmentId===resource.attachmentId:r.key===resource.key);
      try{
      if((options.rescan&&record?.folder!==folder)||(options.contentRecheck&&resource.kind==='model'))record=null;
      if(record){Object.assign(record,{attachmentId:resource.attachmentId,identityKind:resource.identityKind,originalFilename:resource.originalFilename,folder});const item=await this.getDownload(record.downloadId);if(resourceComplete(item,resource.kind)){record.filename=item.filename;record.state='complete';await this.save();continue;}if(item?.state==='in_progress'){const resumed=await this.waitDownload(record.downloadId,resource.kind);record.filename=resumed.filename;record.state='complete';await this.save();continue}}
      const downloadId=await this.api.downloads.download({url:resource.url,filename:resource.filename,conflictAction:'uniquify',saveAs:false});
      // Store only IDs and filenames. Signed attachment/image URLs stay in memory.
      record={key:resource.key,kind:resource.kind,filename:resource.filename,downloadId,folder,attachmentId:resource.attachmentId,identityKind:resource.identityKind,originalFilename:resource.originalFilename,state:'pending'};
      entry.resources=entry.resources.filter(r=>r.key!==resource.key);entry.resources.push(record);await this.save();
      const downloaded=await this.waitDownload(downloadId,resource.kind);record.filename=downloaded.filename;record.state='complete';delete record.error;await this.save();
      }catch(error){
       if(this.stop)throw error;
       const message=String(error.message||error).replace(/https?:\/\/\S+/g,'[URL removed]');
       if(record){record.state='interrupted';record.error=message;await this.save()}
       errors.push(resource.kind+': '+(resource.originalFilename||'image')+' — '+message);
       this.notify(errors.at(-1),'error');
      }
     }
     if(errors.length)throw Error(errors.join('; '));
     entry.status='complete';entry.completedAt=new Date().toISOString();await this.save();stats.complete++;stats.downloaded_post_ids?.push(post.id);
    }catch(error){
     const message=String(error.message||error).replace(/https?:\/\/\S+/g,'[URL removed]');
     entry=this.history.posts[post.id]||{resources:[]};entry.status='partial';entry.error=message;this.history.posts[post.id]=entry;await this.save();
     if(this.stop||/security verification|sign-in is required|no tab with id|cannot access contents|missing host permission/i.test(message))throw error;
     stats.failed++;stats.failed_post_ids?.push(post.id);this.notify(`Post ${post.id} failed: ${message}`,'error');
    }
    await this.sleep(1500);
   }
   return stats;
  }finally{
   try{await exportManifest(this.api,this.history,folder);this.notify('Saved '+folder+'/patreon-download-manifest.json')}catch(error){this.notify('Manifest export failed: '+error.message,'error')}
   // Close only the work tab created by this run. Keep login/security pages visible for diagnosis.
   if(this.worker!==null&&!this.stop&&!this.preserveWorker){try{const t=await this.api.tabs.get(this.worker);if(!t.url?.includes('/login'))await this.api.tabs.remove(this.worker)}catch{}}
  }
 }
}

