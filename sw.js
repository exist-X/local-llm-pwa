const CACHE = 'local-llm-v4';
const SCOPE = self.registration.scope;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll([
        SCOPE + 'index.html',
        SCOPE + 'manifest.json',
        SCOPE + 'icon-192.png',
        SCOPE + 'icon-512.png',
      ]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('local-llm-') && k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (new URL(e.request.url).hostname.includes('huggingface.co')) return;

  // 導航請求（重啟 PWA 的第一個請求）：cache-first，一定不碰網路
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match(SCOPE + 'index.html', { ignoreVary: true })
        .then(cached => cached || fetch(e.request))
        .catch(() => new Response(
          '<html><body style="font:1rem system-ui;padding:2rem"><h2>請先連線開啟一次應用程式以啟用離線功能。</h2></body></html>',
          { status: 200, headers: { 'Content-Type': 'text/html;charset=utf-8' } }
        ))
    );
    return;
  }

  // 其他資源：快取優先，沒有才去網路並動態快取
  e.respondWith(
    caches.match(e.request, { ignoreVary: true })
      .then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok && e.request.method === 'GET') {
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          }
          return res;
        });
      })
      .catch(() => new Response('offline', { status: 503 }))
  );
});
