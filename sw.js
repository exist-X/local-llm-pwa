const RUNTIME = 'local-llm-v7';

self.addEventListener('install', e => {
  // 不在 install 做快取（避免因某個 URL 失敗導致整個 install 失敗）
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('local-llm-') && k !== RUNTIME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (!url.protocol.startsWith('http')) return;
  if (url.hostname.includes('huggingface.co')) return;

  if (e.request.mode === 'navigate') {
    // 搜尋所有快取（含頁面自己存進去的）
    e.respondWith(
      caches.match(e.request, { ignoreVary: true })
        .then(r => r || fetch(e.request))
        .catch(() => new Response(
          '<html><body style="font:1rem system-ui;padding:2rem"><h2>請先上線開啟一次應用程式以啟用離線功能。</h2></body></html>',
          { status: 200, headers: { 'Content-Type': 'text/html;charset=utf-8' } }
        ))
    );
    return;
  }

  // 其他資源：快取優先，沒有才去網路並動態存入
  e.respondWith(
    caches.match(e.request, { ignoreVary: true })
      .then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok && e.request.method === 'GET') {
            const cloned = res.clone();
            caches.open(RUNTIME).then(c => c.put(e.request, cloned));
          }
          return res;
        });
      })
      .catch(() => new Response('offline', { status: 503 }))
  );
});
