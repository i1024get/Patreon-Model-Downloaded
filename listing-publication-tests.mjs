import assert from 'node:assert/strict';
import {inspectPage} from './core.mjs';
import {scopePosts} from './runner.mjs';
let bootstrap=true;
const label={getAttribute:()=>null,textContent:'November 1, 2026'};
const card={querySelector:selector=>selector.includes('time')?label:null,innerText:'Post'};
const link={href:'https://www.patreon.com/posts/123',textContent:'Post',closest:()=>card};
globalThis.location={pathname:'/collection/1'};
globalThis.document={title:'Collection',body:{innerText:'1 posts'},querySelector:()=>null,querySelectorAll:selector=>{
 if(selector==='script:not([src])'&&bootstrap)return [{type:'application/json',textContent:JSON.stringify({type:'post',id:'123',attributes:{published_at:'2026-11-01T23:00:00Z'}})}];
 if(selector.includes('a[href'))return [link];return [];
}};
const since=Date.parse('2026-11-01T12:00:00Z')/1000;
assert.equal(scopePosts(inspectPage('collection','1').links,{since}).length,1,'precise timestamp must override a date-only label');
bootstrap=false;assert.equal(inspectPage('collection','1').links[0].publishedAt,null,'a date-only label cannot establish the rolling24h cutoff');
console.log('Precise listing timestamps override date-only labels; insufficient precision stays unresolved');
