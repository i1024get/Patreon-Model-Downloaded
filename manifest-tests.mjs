import assert from 'node:assert/strict';
import {buildManifest,attachmentIdentity} from './download-manifest.mjs';
assert.deepEqual(attachmentIdentity('https://www.patreon.com/file?h=123&m=456&token=SECRET','Duck.3mf'),{attachmentId:'456',identityKind:'patreon_attachment_id'});
const history={posts:{'123':{status:'complete',title:'Duck',completedAt:'2026-10-03T00:00:00Z',resources:[{kind:'model',key:'model:0:Duck.3mf',filename:'G:\\My Drive\\Unsorted\\Designer\\Duck - Patreon 123.3mf'},{kind:'model',key:'model:1:Other.3mf',filename:'Designer/Other - Patreon 123.3mf'},{kind:'image',key:'image',filename:'Designer/Duck - Patreon 123.png'}]},'999':{status:'complete',resources:[{kind:'model',filename:'OtherDesigner/Other.3mf'}]},'124':{status:'partial',resources:[{kind:'model',filename:'Designer/Partial.3mf',state:'complete'},{kind:'image',filename:'Designer/Partial.png',state:'pending'}]}}};
const m=buildManifest(history,'Designer');assert.equal(m.schemaVersion,1);assert.equal(m.posts.length,2);assert.equal(m.posts[0].models.length,2);assert.equal(m.posts[0].models[0].filename,'Duck - Patreon 123.3mf');assert.equal(m.posts[0].models[1].imageFilename,'Duck - Patreon 123.png');assert.equal(m.posts[1].models[0].imageFilename,null);assert.equal(m.posts[0].models[0].identityKind,'filename_fallback');
assert(!JSON.stringify(m).includes('G:'));assert(!JSON.stringify(m).includes('SECRET'));
console.log('Manifest: attachment identity, legacy history, multiple models, folder isolation, partial files, and relative paths passed');

const {exportManifest}=await import('./download-manifest.mjs');let options;
const api={downloads:{async download(value){options=value;return 1},async search(){return [{state:'complete',exists:true,bytesReceived:100}]}}};
await exportManifest(api,history,'Designer');
assert.equal(options.filename,'Designer/patreon-download-manifest.json');assert.equal(options.conflictAction,'overwrite');
assert.equal(JSON.parse(decodeURIComponent(options.url.split(',').slice(1).join(','))).posts.length,2);
console.log('Manifest JSON download and overwrite checks passed');
