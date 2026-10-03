import assert from 'node:assert/strict';
import {safeName,postId,downloadResources,resourceComplete,inspectPage} from './core.mjs';
assert.equal(postId('https://www.patreon.com/posts/161654551?collection=2088592'),'161654551');
assert.equal(postId('https://evil.example/posts/1'),'');
assert(!safeName('../../bad\\name').includes('/'));
assert(!safeName('bad\\name').includes('\\'));
assert.equal(safeName('CON'),'_CON');
const resources=downloadResources({title:'Duck',files:[{name:'Duck.3mf',url:'https://www.patreon.com/file?h=example'},{name:'Duck.stl',url:'https://www.patreon.com/file?h=other'}],images:['https://c10.patreonusercontent.com/image.png']},'123','TheDuckVault');
assert.equal(resources.length,2);assert.equal(resources[0].filename,'TheDuckVault/Duck - Patreon 123.3mf');assert.equal(resources[1].filename,'TheDuckVault/Duck - Patreon 123.png');
assert.throws(()=>downloadResources({title:'Duck',files:[{name:'x.3mf',url:'https://evil.example/file'}],images:[]},'1','folder'));
assert.equal(resourceComplete({state:'complete',exists:true,bytesReceived:10,mime:'application/octet-stream'},'model'),true);
assert.equal(resourceComplete({state:'complete',exists:true,bytesReceived:10,mime:'text/html'},'model'),false);
assert.equal(resourceComplete({state:'complete',exists:false,bytesReceived:10},'model'),false);
globalThis.location={href:'https://www.patreon.com/posts/1',pathname:'/posts/1'};
globalThis.document={title:'Duck',body:{innerText:'Duck Attachments'},querySelectorAll(selector){
 if(selector==='h1[data-tag="post-title"]')return [{textContent:'Captain Duck'},{textContent:'Captain Duck'}];
 if(selector==='a[data-tag="post-attachment-link"]')return [{textContent:'Captain.3mf',href:'https://www.patreon.com/file?h=sample'}];
 if(selector==='img[data-tag="gallery-image"]')return [{currentSrc:'https://c10.patreonusercontent.com/duck.png',src:'',getAttribute(){return null}}];
 return [];
}};
const parsed=inspectPage('post','2088592');assert.equal(parsed.title,'Captain Duck');assert.equal(parsed.files.length,1);assert.equal(parsed.images.length,1);
console.log('Core extraction, resource naming, URL limits, MIME validation, and completion checks passed');

globalThis.location={pathname:'/collection/2088592'};
const card={href:'https://www.patreon.com/posts/123',textContent:'Duck',closest(){return {}}};
const unrelated={href:'https://www.patreon.com/posts/456',textContent:'Recommended',closest(){return null}};
document.body.innerText='In this collection 222 posts';document.querySelectorAll=selector=>selector.includes('a[href')?[card,unrelated]:[];
assert.equal(inspectPage('collection','2088592').links.length,1);
assert.equal(inspectPage('collection','2088592').expected,222);
console.log('Collection card links without query parameters check passed');

assert.equal(postId('https://www.patreon.com/TheDuckVault/posts/captain-america-162199456?collection=2088592'),'162199456');
// Feed URLs are accepted without loosening collection URL validation.
const {sourceId}=await import('./core.mjs');
assert.equal(sourceId('https://www.patreon.com/c/javier3d/posts'),'feed:/c/javier3d/posts');
assert.equal(sourceId('https://www.patreon.com/collection/2088592?view=expanded'),'2088592');
assert.throws(()=>sourceId('https://evil.example/c/javier3d/posts'));
location.pathname='/c/javier3d/posts';
document.querySelectorAll=selector=>selector==='[data-tag="post-card"]'?[{querySelectorAll(){return [card]}}]:[];
document.querySelector=()=>null;
assert.equal(inspectPage('feed','feed:/c/javier3d/posts').links[0].url,card.href);
