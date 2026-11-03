import assert from 'node:assert/strict';
import {downloadResources} from './core.mjs';
for(const ext of ['png','jpg','jpeg','webp','avif','gif']){
 const resources=downloadResources({files:[{name:'Dragon.3mf',url:'https://www.patreon.com/file?h=123&m=456'}],images:['https://c10.patreonusercontent.com/image.'+ext]},'123','FlexiCrea');
 assert(resources.find(r=>r.kind==='image').filename.endsWith('.'+ext),'preserve '+ext+' gallery extension');
}
console.log('PNG, JPEG, WebP, AVIF and GIF gallery extensions preserved');
