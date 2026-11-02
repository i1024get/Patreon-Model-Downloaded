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
 return {publishedAt:Number.isFinite(date)?date/1000:null};
}
