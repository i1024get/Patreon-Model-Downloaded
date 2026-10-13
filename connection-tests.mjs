import assert from 'node:assert/strict';
const timers=new Map();let nextTimer=0;globalThis.setTimeout=(fn)=>{timers.set(++nextTimer,fn);return nextTimer;};globalThis.clearTimeout=id=>timers.delete(id);
const ports=[];
globalThis.chrome={runtime:{lastError:null,connect(){const listeners={};const port={onMessage:{addListener(fn){listeners.message=fn}},onDisconnect:{addListener(fn){listeners.disconnect=fn}},postMessage(message){listeners.message({request_id:message.request_id,result:{job:null}})},disconnect(){listeners.disconnect()},listeners};ports.push(port);return port;}}};
Object.defineProperty(globalThis,'navigator',{value:{locks:{async request(_,__,fn){await fn({});}}},configurable:true});
const bridge=await import('./bridge.mjs');
globalThis.document={getElementById(){return null;}};
assert.equal(typeof bridge.connect,'function');
bridge.connect();await new Promise(resolve=>queueMicrotask(resolve));assert.equal(ports.length,1);
const old=ports[0];old.disconnect();assert(timers.size>0,'Disconnect should schedule reconnect');
for(const [id,fn] of [...timers]){timers.delete(id);fn();}
await new Promise(resolve=>queueMicrotask(resolve));assert.equal(ports.length,2,'Reconnect must not require a page refresh');
// A late old-port callback must not disconnect the new native connection.
old.listeners.disconnect();assert.deepEqual(await bridge.nativeRequest({action:'poll'}),{job:null});
console.log('Native disconnect recovery and stale-port callback isolation passed');
// A silent host times out every pending request and schedules a replacement.
const silent=ports.at(-1);silent.postMessage=()=>{};
const timedOut=bridge.nativeRequest({action:'poll'});const rejection=assert.rejects(timedOut,/did not respond/);
for(const [id,fn] of [...timers]){timers.delete(id);fn();}
await rejection;
for(const [id,fn] of [...timers]){timers.delete(id);fn();}
await new Promise(resolve=>queueMicrotask(resolve));
assert.equal(ports.length,3);assert.deepEqual(await bridge.nativeRequest({action:'poll'}),{job:null});
console.log('Silent-host timeout rejects pending requests and reconnects passed');

// No dashboard timer is run: worker messages must still renew idle polling.
let polls=0;ports.at(-1).postMessage=function(message){polls++;this.listeners.message({request_id:message.request_id,result:{job:null}})};
await ports.at(-1).listeners.message({bridge_tick:true});
assert.equal(polls,1,'worker tick renews idle connection after job completion');
console.log('Worker polling events renew idle connection without dashboard timers passed');
