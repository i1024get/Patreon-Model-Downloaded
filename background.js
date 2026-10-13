chrome.action.onClicked.addListener(()=>chrome.tabs.create({url:chrome.runtime.getURL('dashboard.html')}));

// Native messaging keeps this service worker alive. Its timer delivers message
// events to the dashboard, avoiding throttled timers in a hidden dashboard tab.
chrome.runtime.onConnect.addListener(dashboard=>{
 if(dashboard.name!=='patreon-native')return;
 let native=null,timer=null,closed=false;
 const close=()=>{
  if(closed)return;closed=true;
  if(timer!==null)clearInterval(timer);
  try{native?.disconnect();}catch{}
  try{dashboard.disconnect();}catch{}
 };
 try{
  native=chrome.runtime.connectNative('com.3dhub.patreon');
  native.onMessage.addListener(message=>{try{dashboard.postMessage(message)}catch{close()}});
  native.onDisconnect.addListener(()=>{
   const error=chrome.runtime.lastError?.message||'Native bridge disconnected.';
   try{dashboard.postMessage({bridge_error:error})}catch{}
   close();
  });
  dashboard.onMessage.addListener(message=>{try{native.postMessage(message)}catch{close()}});
  dashboard.onDisconnect.addListener(close);
  timer=setInterval(()=>{try{dashboard.postMessage({bridge_tick:true})}catch{close()}},2000);
 }catch(error){try{dashboard.postMessage({bridge_error:error.message})}catch{}close()}
});
