// CHROMA offline helper. Keep this file next to the HTML in the repo.
// With signal: the newest version is loaded straight from GitHub (and saved), so a
// pushed update shows on the next launch. No signal, or GitHub slower than 2.5 s:
// the saved copy opens instead. No version bumping needed.
// The cache name is unique per tool: every repo on floptopbop.github.io shares
// one origin, so tools must never touch each other's caches.
const CACHE='chroma-offline-v1',PREFIX='chroma-offline-';

// Safari refuses to show a saved page that came from a redirect, so those are never stored.
function storable(res){return !!res&&!res.redirected&&(res.ok||res.type==='opaque')}
function save(url){return fetch(new Request(url,{cache:'reload'})).then(res=>storable(res)?caches.open(CACHE).then(c=>c.put(url,res)):null).catch(()=>{})}

self.addEventListener('install',e=>{
  // Save the tool's folder URL now; the page also sends its exact URL once it is running.
  e.waitUntil(save(self.registration.scope).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});
self.addEventListener('message',e=>{
  const m=e.data;
  if(m&&m.t==='cache'&&typeof m.url==='string')e.waitUntil(save(m.url));
});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const nav=req.mode==='navigate';
  e.respondWith(caches.open(CACHE).then(async c=>{
    // ?debug, ?main etc. still open the saved page
    const hit=await c.match(req,{ignoreSearch:nav});
    const fresh=fetch(nav?new Request(req.url,{cache:'no-cache'}):req).then(res=>{
      if(storable(res))c.put(nav?new Request(req.url.split('?')[0].split('#')[0]):req,res.clone()).catch(()=>{});
      return res;
    });
    if(!hit)return fresh.catch(()=>nav?c.match(self.registration.scope):Response.error());
    // newest first; the saved copy if offline or slow
    const slow=new Promise(r=>setTimeout(()=>r(hit),2500));
    e.waitUntil(fresh.catch(()=>{}));
    return Promise.race([fresh.then(res=>res.ok?res:hit).catch(()=>hit),slow]);
  }));
});
