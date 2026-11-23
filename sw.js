var CACHE = 'lift-v18';
var ASSETS = ['./', './index.html', './manifest.json',
              './icon-192.png', './icon-512.png', './apple-touch-icon.png',
              './favicon-32.png', './favicon-64.png'];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); })
    .then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== CACHE; })
      .map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

/*
 * Network first so updates land, but never at the cost of opening.
 *
 * Without a time limit, weak signal in a gym left the app waiting on the
 * network for a minute. Without the ok check, an error page from the server or
 * a Wi-Fi login page was shown, and saved over the good copy so it stuck.
 * Now: three seconds for the network, then the saved copy; only good
 * responses are ever saved.
 */
var NETWORK_WAIT_MS = 3000;

function fromCache(req){
  return caches.match(req).then(function(r){ return r || caches.match('./index.html'); });
}

self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;
  if(new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(new Promise(function(resolve){
    var done = false;
    function finish(res){ if(!done){ done = true; resolve(res); } }
    function fallback(){
      fromCache(e.request).then(function(r){
        // Nothing saved yet (first ever open): keep waiting on the network.
        if(r) finish(r);
      });
    }
    var timer = setTimeout(fallback, NETWORK_WAIT_MS);
    fetch(e.request).then(function(res){
      if(res && res.ok){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
        clearTimeout(timer);
        finish(res);
      } else {
        clearTimeout(timer);
        fromCache(e.request).then(function(r){ finish(r || res); });
      }
    }).catch(function(){
      clearTimeout(timer);
      fromCache(e.request).then(function(r){ finish(r || Response.error()); });
    });
  }));
});
