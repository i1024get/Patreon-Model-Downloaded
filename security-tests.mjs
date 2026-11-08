import assert from 'node:assert/strict';
import {test} from 'node:test';
import vm from 'node:vm';
import {inspectPage} from './core.mjs';
import {readPostPublication} from './publication.mjs';
import {Runner} from './runner.mjs';

function page({title='Artist | Patreon',text='',post=false,card=false,challenge=false,date=null}={}){
 const node={textContent:'Model',getAttribute:()=>date};
 return {title,body:{innerText:text,textContent:text},querySelector(selector){
  if(selector==='meta[property="article:published_time"]')return date?node:null;
  if(selector.includes('#challenge-form'))return challenge?node:null;
  return null;
 },querySelectorAll(selector){
  if(selector==='h1[data-tag="post-title"]')return post?[node]:[];
  if(selector==='[data-tag="post-card"]')return card?[{querySelectorAll:()=>[]}]:[];
  return [];
 }};
}
function inspect(document){
 // Run the serialized function, as Chrome does, with no module closures.
 return vm.runInNewContext('('+inspectPage.toString()+')('+'"post", "")',{
  document,location:{pathname:'/posts/123'},TextEncoder,TextDecoder,URL
 });
}
test('ordinary creator text and post titles do not count as security screens',()=>{
 for(const text of ['Please verify you are human before commenting','Checking your browser settings','Performing security verification']){
  assert.equal(inspect(page({text,post:true})).blocked,undefined);
 }
 assert.equal(inspect(page({title:'Just a moment of inspiration | Patreon',post:true})).ready,true);
 assert.equal(inspect(page({title:'Artist',text:'Please verify you are human before commenting'})).blocked,undefined);
});
test('actual interstitials remain detectable',()=>{
 assert.equal(inspect(page({title:'Just a moment...'})).blocked,true);
 assert.equal(inspect(page({challenge:true})).blocked,true);
 assert.equal(inspect(page({text:'Performing security verification\nThis may take a few seconds.'})).blocked,true);
});
function runner(states,sleep=async()=>{}){
 let index=0;
 return new Runner({scripting:{executeScript:async()=>[{result:states[Math.min(index++,states.length-1)]}]}},()=>{},sleep);
}
test('a transient challenge clears without aborting or preserving the work tab',async()=>{
 const r=runner([{blocked:true},{blocked:true},{ready:true,title:'Model',files:[],images:[]}]);
 assert.equal((await r.read(1,'post','')).title,'Model');
 assert.equal(r.preserveWorker,false);
});
test('persistent challenge stops after a bounded wait and retains the work tab',async()=>{
 let waits=0;
 const r=runner([{blocked:true}],async()=>{assert(++waits<=60,'security wait must be bounded')});
 await assert.rejects(r.read(1,'post',''),/security verification/i);
 assert(waits>0);assert.equal(r.preserveWorker,true);
});
test('Stop interrupts the security wait',async()=>{
 const r=runner([{blocked:true}],async()=>{r.stop=true});
 await assert.rejects(r.read(1,'post',''),/Stopped\. Progress is saved/);
});
test('sign-in after a transient challenge still stops and preserves the tab',async()=>{
 const r=runner([{blocked:true},{login:true}]);
 await assert.rejects(r.read(1,'post',''),/sign-in is required/);
 assert.equal(r.preserveWorker,true);
});
test('publication metadata ignores challenge phrases in real post content',async()=>{
 const doc=page({text:'Please verify you are human',post:true,date:'2026-11-07T12:00:00Z'});
 const lookup=vm.runInNewContext('('+readPostPublication.toString()+')',{
  fetch:async()=>({ok:true,url:'https://www.patreon.com/posts/123',text:async()=>''}),
  DOMParser:class{parseFromString(){return doc}},AbortSignal,URL,TextEncoder,TextDecoder
 });
 assert.equal((await lookup('123')).publishedAt,1794052800);
});
