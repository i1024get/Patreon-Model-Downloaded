// Serialized into an existing Patreon tab. Fetches metadata without navigating
// to the post or downloading its attachments; never reads cookies directly.
export async function readPostPublication(id){
 if(!/^[1-9][0-9]{0,29}$/.test(String(id)))throw Error('Invalid publication lookup post ID');
 const response=await fetch('/posts/'+id,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Publication metadata request failed ('+response.status+')');
 const url=new URL(response.url);
 if(url.origin!=='https://www.patreon.com'||url.pathname.startsWith('/login'))throw Error('Patreon sign-in is required for publication metadata');
 const resolved=url.pathname.match(/^\/(?:(?:(?:c|cw)\/)?[A-Za-z0-9_.-]+\/)?posts\/(?:[A-Za-z0-9_.-]+-)?([1-9][0-9]{0,29})\/?$/)?.[1];
 if(resolved!==String(id))throw Error('Publication metadata redirected away from the requested post');
 const doc=new DOMParser().parseFromString(await response.text(),'text/html');
 if(/just a moment/i.test(doc.title)||/verify you are human|checking your browser/i.test((doc.body?.textContent||'').slice(0,6000)))throw Error('Patreon security verification blocked publication metadata');
 const raw=doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content');
 const date=typeof raw==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(raw)?Date.parse(raw):NaN;
 if(Number.isFinite(date))return {publishedAt:date/1000};
 // Relative labels (hours/days ago) are display text. Recover the exact
 // timestamp for this post from hydration metadata instead of estimating it.
 const preciseDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&Number.isFinite(Date.parse(value))?value:null;
 const postDates=new Map();let visited=0;
 const visit=(value,depth=0)=>{
  if(++visited>50000||depth>100||!value||typeof value!=='object')return;
  if(value.type==='post'&&value.id&&preciseDate(value.attributes?.published_at))postDates.set(String(value.id),preciseDate(value.attributes.published_at));
  for(const child of Object.values(value))if(child&&typeof child==='object')visit(child,depth+1);
 };
 const parse=raw=>{try{visit(JSON.parse(raw));}catch(e){}};
 // Flight records can span push calls. Keep every type-1 chunk, including
 // chunks without published_at, before decoding the record stream.
 const chunks=[];
 for(const script of (doc.querySelectorAll?.('script:not([src])')||[])){
  const raw=script.textContent||'';
  try{
   if(script.type==='application/json'){if(raw.includes('published_at'))parse(raw);continue;}
   const match=raw.match(/self\.__next_f\.push\(([\s\S]*)\)\s*;?\s*$/);if(!match)continue;
   const entry=JSON.parse(match[1]);
   if(entry[0]===1&&typeof entry[1]==='string')chunks.push(entry[1]);
  }catch(e){}
 }
 // T records use UTF-8 byte lengths rather than JS character counts. Their
 // payload may contain newlines and need not end at a newline boundary.
 const bytes=new TextEncoder().encode(chunks.join('')),decoder=new TextDecoder();
 let offset=0;
 while(offset<bytes.length){
  const colon=bytes.indexOf(58,offset);if(colon<0)break;
  if(!/^[0-9a-f]+$/i.test(decoder.decode(bytes.subarray(offset,colon))))break;
  let start=colon+1,end;
  if(bytes[start]===84){
   const comma=bytes.indexOf(44,start+1);if(comma<0)break;
   const length=decoder.decode(bytes.subarray(start+1,comma));
   if(!/^[0-9a-f]+$/i.test(length))break;
   start=comma+1;end=start+parseInt(length,16);
   if(end>bytes.length)break;
   parse(decoder.decode(bytes.subarray(start,end)));offset=end;
  }else{
   end=bytes.indexOf(10,start);if(end<0)end=bytes.length;
   const body=decoder.decode(bytes.subarray(start,end));
   if(/^[\[{]/.test(body))parse(body);
   offset=end+1;
  }
 }
 const exact=postDates.get(String(id));
 return {publishedAt:exact?Date.parse(exact)/1000:null};
}

