import assert from 'node:assert/strict';
import {Runner} from './runner.mjs';

const persisted={history:{version:1,posts:{'101':{status:'complete',resources:[{kind:'model',state:'complete',attachmentId:'11',identityKind:'patreon_attachment_id',originalFilename:'A.3mf',key:'model:0:A.3mf',downloadId:1,folder:'Stage'}]}}}};
let starts=0;
const api={storage:{local:{get:async key=>({[key]:structuredClone(persisted[key])}),set:async value=>Object.assign(persisted,structuredClone(value))}},
 downloads:{download:async opts=>{starts++;return starts+1;},search:async ({id})=>[{id,state:'complete',exists:true,bytesReceived:10,mime:'application/octet-stream',filename:'Stage/A.3mf'}]},tabs:{get:async()=>({url:'https://www.patreon.com/posts/101'}),remove:async()=>{}}};
const runner=new Runner(api,()=>{},async()=>{});
runner.collect=async()=>[{id:'101',url:'https://www.patreon.com/posts/101'}];
runner.openPost=async()=>({title:'A',files:[{name:'A.3mf',url:'https://www.patreon.com/file?m=11'},{name:'B.3mf',url:'https://www.patreon.com/file?m=12'}],images:[]});
await runner.run(1,'collection','Stage',0,{contentRecheck:true,known:[{post_id:'101',attachment_id:'11',identity_kind:'patreon_attachment_id'}]});
assert.equal(persisted.history.posts['101'].resources.filter(r=>r.kind==='model').length,2);
assert.ok(starts>=2,'both old identity with possibly changed bytes and newly added attachment must be fetched');
assert.equal(runner.knownResource({kind:'model',identityKind:'patreon_attachment_id',attachmentId:'11'},'101',{files:[]},{contentRecheck:true,known:[{post_id:'101',identity_kind:'patreon_attachment_id',attachment_id:'11'}]}),false);
console.log('Rechecks fetch changed-identity and new files from completed posts');
