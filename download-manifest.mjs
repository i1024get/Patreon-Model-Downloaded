// Import metadata only: never persist signed attachment or image URLs.
export function attachmentIdentity(url,name){
 const id=new URL(url).searchParams.get('m');
 return id&&/^\d+$/.test(id)?{attachmentId:id,identityKind:'patreon_attachment_id'}:{attachmentId:name,identityKind:'filename_fallback'};
}
function pathParts(filename){return String(filename||'').replaceAll('\\','/').split('/').filter(Boolean)}
function belongs(resource,folder){const parts=pathParts(resource.filename);return resource.folder?resource.folder===folder:parts.at(-2)===folder}
function originalName(resource){return resource.originalFilename||resource.key?.replace(/^model:\d+:/,'')||pathParts(resource.filename).at(-1)||''}
export function buildManifest(history,folder,now=new Date().toISOString()){
 const posts=[];
 for(const [id,entry] of Object.entries(history.posts||{})){
  const resources=(entry.resources||[]).filter(r=>belongs(r,folder));
  const completed=r=>r.state==='complete'||(!r.state&&entry.status==='complete');
  const image=resources.find(r=>r.kind==='image'&&completed(r));
  const models=resources.filter(r=>r.kind==='model').map(r=>{
   const name=originalName(r);const attachmentId=r.attachmentId||name;
   return {attachmentId,identityKind:r.identityKind||'filename_fallback',sourceKey:JSON.stringify(['patreon',id,attachmentId]),originalFilename:name,filename:pathParts(r.filename).at(-1),status:completed(r)?'complete':'incomplete',imageFilename:image?pathParts(image.filename).at(-1):null};
  });
  if(models.length)posts.push({postId:id,postUrl:`https://www.patreon.com/posts/${id}`,title:entry.title||'',status:entry.status,completedAt:entry.completedAt||null,sourceUrls:entry.sourceUrls||[],models});
 }
 return {schemaVersion:1,provider:'patreon',designerFolder:folder,generatedAt:now,posts};
}
export async function exportManifest(api,history,folder){
 const manifest=buildManifest(history,folder);
 const url='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(manifest,null,2));
 const id=await api.downloads.download({url,filename:`${folder}/patreon-download-manifest.json`,conflictAction:'overwrite',saveAs:false});
 for(let i=0;i<60;i++){
  const item=(await api.downloads.search({id}))[0];
  if(item?.state==='complete'&&item.exists!==false&&item.bytesReceived>0)return manifest;
  if(!item||item.state==='interrupted')throw Error('Manifest download failed. Check Chrome Downloads and use Save import manifest to retry.');
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 throw Error('Manifest download is still pending. Check Chrome Downloads.');
}
