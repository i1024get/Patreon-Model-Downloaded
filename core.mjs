import {attachmentIdentity} from './download-manifest.mjs';
export function sourceId(value){
 const u=new URL(value);if(u.origin!=='https://www.patreon.com')throw Error('Enter a Patreon collection or creator posts URL');
 const path=u.pathname.replace(/\/$/,'');
 if(/^\/collection\/\d+$/.test(path))return path.split('/').pop();
 if(/^\/(?:c|cw)\/[^/]+\/posts$/.test(path))return 'feed:'+path;
 throw Error('Enter a Patreon collection or creator posts URL');
}
export function safeName(input){
 let value=String(input||'Model').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/^\.+|[. ]+$/g,'').trim().slice(0,140)||'Model';
 if(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(value))value='_'+value;
 return value;
}
export function postId(url){try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='www.patreon.com'?(u.pathname.match(/^\/(?:[^/]+\/)?posts\/(?:[^/]*-)?(\d+)\/?$/)?.[1]||''):''}catch{return ''}}
export function resourceComplete(item,kind){return !!item&&item.state==='complete'&&item.exists!==false&&item.bytesReceived>0&&!/^(text\/|application\/json)/i.test(item.mime||'')&&(kind!=='image'||!item.mime||item.mime.startsWith('image/'))}
export function downloadResources(post,id,folder){
 if(!/^\d+$/.test(id))throw Error('Invalid post ID');
 if(!folder||folder!==safeName(folder)||folder.includes('..'))throw Error('Use a folder name, not an absolute path');
 const files=post.files.filter(f=>/\.(3mf|zip)$/i.test(f.name));
 const resources=files.map((f,index)=>{
  const u=new URL(f.url);if(u.protocol!=='https:'||u.hostname!=='www.patreon.com'||u.pathname!=='/file')throw Error('Attachment link is not a Patreon file URL');
  const ext=f.name.match(/\.(3mf|zip)$/i)[1].toLowerCase();
  const stem=safeName(f.name.replace(/\.(3mf|zip)$/i,''));
  return {...attachmentIdentity(u.href,f.name),originalFilename:f.name,key:`model:${index}:${f.name}`,kind:'model',url:u.href,filename:`${folder}/${stem} - Patreon ${id}${index?` - ${index+1}`:''}.${ext}`};
 });
 if(resources.length&&post.images.length){
  const u=new URL(post.images[0]);if(u.protocol!=='https:'||!(u.hostname.endsWith('.patreonusercontent.com')||u.hostname.endsWith('.patreon.com')||u.hostname==='www.patreon.com'))throw Error('Gallery image host is not Patreon');
  const ext=u.pathname.match(/\.(png|jpe?g|webp|avif)(?:$|\/)/i)?.[1]?.toLowerCase()||'jpg';
  resources.push({key:'image',kind:'image',url:u.href,filename:resources[0].filename.replace(/\.(3mf|zip)$/i,'.'+ext)});
 }
 return resources;
}
// Self-contained because Chrome serializes this function into the Patreon tab.
export function inspectPage(mode,collectionId){
 const text=document.body?.innerText||'';
 const postDates=new Map();let visited=0;
 const visit=value=>{
  if(++visited>50000||!value||typeof value!=='object')return;
  if(value.type==='post'&&value.id&&value.attributes?.published_at)postDates.set(String(value.id),value.attributes.published_at);
  for(const child of Object.values(value))if(child&&typeof child==='object')visit(child);
 };
 for(const script of document.querySelectorAll('script:not([src])')){
  const raw=script.textContent||'';if(!raw.includes('published_at'))continue;
  try{
   if(script.type==='application/json'){visit(JSON.parse(raw));continue;}
   const match=raw.match(/self\.__next_f\.push\(([\s\S]*)\)\s*;?\s*$/);if(!match)continue;
   for(const chunk of JSON.parse(match[1]))if(typeof chunk==='string')for(const record of chunk.split('\n')){
    const body=record.slice(record.indexOf(':')+1);if(!/^[\[{]/.test(body))continue;
    try{visit(JSON.parse(body));}catch(e){}
   }
  }catch(e){}
 }
 const cardDate=card=>{
  if(!card)return null;
  const time=card.querySelector?.('time[datetime], [data-tag="post-published-at"], [data-tag="post-published-date"]');
  const value=time?.getAttribute?.('datetime')||time?.getAttribute?.('data-published-at')||time?.getAttribute?.('title')||time?.textContent||'';
  return /\b\d{4}\b/.test(value)?value.trim():null;
 };
 const linkInfo=a=>{const card=a.closest?.('[data-tag="post-card"]');return {url:a.href,title:a.innerText||a.textContent||'',publishedAt:cardDate(card)||postDates.get(a.href.match(/(?:^|\/)(?:[^/]*-)?(\d+)(?:[?/#]|$)/)?.[1])||null,pinned:!!card&&(!!card.querySelector?.('[aria-label*="Pinned"], [title*="Pinned"]')||/^pinned\b/i.test(card.innerText?.trim()||''))};};
 const newestFirst=[...document.querySelectorAll('select option:checked, [aria-selected="true"], [aria-checked="true"], button[aria-haspopup], [data-tag="posts-sort-button"]')].some(el=>/^(newest|newest first|most recent)$/i.test(el.textContent.trim()));

 const blocked=/just a moment/i.test(document.title)||/performing security verification|verify you are human|checking your browser/i.test(text.slice(0,6000));
 const login=location.pathname.startsWith('/login');
 if(blocked)return {blocked:true};if(login)return {login:true};
 if(mode==='feed'||mode==='feedAdvance'){
  const path=collectionId.replace(/^feed:/,'');
  if(location.pathname.replace(/\/$/,'').replace(/^\/cw\//,'/c/')!==path.replace(/^\/cw\//,'/c/'))return {links:[],more:false,loading:true};
  const cards=[...document.querySelectorAll('[data-tag="post-card"]')];
  const anchors=cards.flatMap(card=>[...card.querySelectorAll('a[href*="/posts/"]')]);
  const links=anchors.filter(a=>{try{const u=new URL(a.href);return u.origin==='https://www.patreon.com'&&/^\/(?:[^/]+\/)?posts\/(?:[^/]*-)?\d+\/?$/.test(u.pathname)}catch{return false}}).map(linkInfo);
  const button=[...document.querySelectorAll('button')].find(b=>/^load more$/i.test(b.textContent.trim()));
  const loading=!!button?.disabled||!!document.querySelector('[role="progressbar"], [aria-busy="true"]');
  if(mode==='feedAdvance'){
   if(button&&!button.disabled)button.click();
   else {cards.at(-1)?.scrollIntoView({block:'end'});window.scrollTo(0,document.documentElement.scrollHeight)}
  }
  return {links,more:!!button,loading,postLinks:anchors.length,newestFirst};
 }
 if(mode==='collection'){
  const anchors=[...document.querySelectorAll('a[href*="/posts/"]')];
  const onCollection=location.pathname===`/collection/${collectionId}`;
  const links=anchors.filter(a=>{try{const u=new URL(a.href);return u.protocol==='https:'&&u.hostname==='www.patreon.com'&&(u.searchParams.get('collection')===collectionId||(onCollection&&!u.searchParams.has('collection')&&!!a.closest?.('[data-tag="post-card"]')))}catch{return false}}).map(linkInfo);
  const button=[...document.querySelectorAll('button')].find(b=>/^load more$/i.test(b.textContent.trim()));
  const expected=text.match(/([\d,]+)\s+posts\b/i)?.[1];
  if(mode==='collection')return {links,postLinks:anchors.length,more:!!button,loading:!!button?.disabled,expected:expected?Number(expected.replaceAll(',','')):null};
 }
 if(mode==='loadMore'){
  const button=[...document.querySelectorAll('button')].find(b=>/^load more$/i.test(b.textContent.trim()));
  if(!button||button.disabled)return {clicked:false};button.click();return {clicked:true};
 }
 const title=[...document.querySelectorAll('h1[data-tag="post-title"]')].map(n=>n.textContent.trim()).find(Boolean)||'';
 const files=[...document.querySelectorAll('a[data-tag="post-attachment-link"]')].map(a=>({name:a.textContent.trim(),url:a.href})).filter(a=>/\.(3mf|zip)$/i.test(a.name));
 const gallery=[...document.querySelectorAll('img[data-tag="gallery-image"]')];
 // Some image posts embed the product in rich text rather than a gallery.
 const candidates=gallery.length?gallery:[...document.querySelectorAll('.patreon-post-content figure img')];
 const images=candidates.map(img=>img.currentSrc||img.src).filter(Boolean);
 // Flight text records can contain the post JSON without a newline boundary.
 // The current article's public metadata supplies the same publication timestamp.
 const metadataDate=document.querySelector?.('meta[property="article:published_time"]')?.getAttribute?.('content');
 const publishedDate=typeof metadataDate==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(metadataDate)&&Number.isFinite(Date.parse(metadataDate))?metadataDate:null;
 return {publishedAt:postDates.get(location.pathname.match(/(?:^|\/)(?:[^/]*-)?(\d+)\/?$/)?.[1])||publishedDate||cardDate(document),title,files,images:[...new Set(images)],locked:/join to unlock|unlock this post|this post is locked/i.test(text),ready:!!title};
}
