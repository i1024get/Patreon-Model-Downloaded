import assert from 'node:assert/strict';
import {Runner} from './runner.mjs';
const stored={history:{version:1,posts:{'1':{status:'complete',resources:[{kind:'model',identityKind:'patreon_attachment_id',attachmentId:'10',state:'complete'}]}}}};
let writes=0,downloads=0,collects=0;
const api={storage:{local:{async get(){return structuredClone(stored)},async set(){writes++}}},downloads:{async download(){downloads++;throw Error('unexpected download')}},tabs:{async get(){return {url:'https://www.patreon.com/posts/1'}},async remove(){}}};
const runner=new Runner(api,()=>{},async()=>{});
runner.collect=async()=>{collects++;return [{id:'1',url:'https://www.patreon.com/posts/1'},{id:'2',url:'https://www.patreon.com/posts/2'}]};
runner.openPost=async url=>({title:'Model',publishedAt:'2026-10-12',images:['https://c10.patreonusercontent.com/image.png?secret=SIGNED'],files:[{name:'A.3mf',url:'https://www.patreon.com/file?m=10'},{name:'B.3mf',url:'https://www.patreon.com/file?m=11'}],locked:false});
const result=await runner.run(1,'feed:/c/creator/posts','Stage',0,{reviewOnly:true,known:[{post_id:'2',identity_kind:'patreon_attachment_id',attachment_id:'10'},{post_id:'2',identity_kind:'patreon_attachment_id',attachment_id:'11'}]});
assert.equal(downloads,0);assert.equal(writes,0);assert.equal(result.models[0].download_state,'updated');assert.equal(result.models[1].download_state,'downloaded');assert.equal(result.models[0].attachment_count,2);assert(result.models[0].image_url.includes('SIGNED'));
const selected=new Runner(api,()=>{},async()=>{});selected.collect=async()=>{throw Error('must not collect')};selected.openPost=async url=>{assert.equal(url,'https://www.patreon.com/posts/2');return {title:'Empty',files:[],images:[],locked:false}};
const subset=await selected.run(1,'2088592','Stage',0,{selectedPostIds:['2','2']});assert.equal(subset.noFiles,1);
await assert.rejects(new Runner(api).run(1,'2088592','Stage',0,{selectedPostIds:['https://bad']}),/Invalid selected post/);
console.log('Review privacy, attachment identities, selected-only traversal and ID validation passed');
// Unknown dates remain eligible, while confirmed old posts do not appear.
const dated=new Runner(api,()=>{},async()=>{});dated.collect=async()=>[1,2,3].map(id=>({id:String(id),url:'https://www.patreon.com/posts/'+id}));
dated.openPost=async url=>({title:'Status',files:[],images:[],publishedAt:url.endsWith('1')?'2020-01-01':null,locked:url.endsWith('2')});
const statuses=await dated.run(1,'2088592','Stage',0,{reviewOnly:true,since:Date.parse('2026-01-01')/1000});assert.deepEqual(statuses.models.map(m=>m.download_state),['locked','no_files']);assert.equal(writes,2); // Only earlier selected no-file run wrote history and lastCollection.
// Aborted reviews retain already-scanned cards so the bridge can finish them.
for(const reason of ['stop','login']){
 const aborted=new Runner(api,()=>{},async()=>{});aborted.collect=async()=>[1,2].map(id=>({id:String(id),url:'https://www.patreon.com/posts/'+id}));
 aborted.openPost=async url=>{if(url.endsWith('2'))throw Error('Patreon sign-in is required');return {title:'First',files:[],images:[],locked:false}};
 aborted.sleep=async()=>{if(reason==='stop')aborted.stop=true};
 await assert.rejects(aborted.run(1,'2088592','Stage',0,{reviewOnly:true}),reason==='stop'?/Stopped/:/sign-in/);
 assert.equal(aborted.reviewStats.models[0].id,'1');assert.equal(aborted.reviewStats.models[0].download_state,'no_files');
 if(reason==='login'){assert.equal(aborted.reviewStats.models[1].download_state,'error');assert.equal(aborted.reviewStats.failed,1)}
}
