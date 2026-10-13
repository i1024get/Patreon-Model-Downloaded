import assert from 'node:assert/strict';
import {inspectPage} from './core.mjs';

const published='2026-10-13T18:18:53.000+00:00';
let content=published;
globalThis.location={pathname:'/SpaceMonkey3DDesigns/posts/animals-with-172269548'};
globalThis.document={
 title:'Chimpanzee',body:{innerText:''},
 querySelector(selector){
  if(selector==='meta[property="article:published_time"]')return {getAttribute:name=>name==='content'?content:null};
  if(selector==='meta[property="article:modified_time"]')throw Error('Publication sorting must not use last modified date');
  return null;
 },
 querySelectorAll(selector){
  if(selector==='h1[data-tag="post-title"]')return [{textContent:'ANIMALS WITH ATTITUDE — CHIMPANZEE'}];
  return [];
 }
};
assert.equal(inspectPage('post','').publishedAt,published,'recover current-post date when Flight extraction has no date');
content='50 minutes ago';
assert.equal(inspectPage('post','').publishedAt,null,'relative text must not become a fabricated timestamp');
content=null;
assert.equal(inspectPage('post','').publishedAt,null,'missing dates remain unknown');
console.log('Publication metadata fallback, invalid dates and publication-only sorting passed');
