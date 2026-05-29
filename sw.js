const CACHE = 'local-llm-v6';

self.addEventListener('install', e => {
  // 只快取本地檔案（一定成功），CDN 檔案由 fetch handler 動態快取
  const scope = self.registration.scope;
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll([
      scope + 'index.html',
      scope + 'manifest.json',
      scope + 'icon-192.png',
      scope + 'icon-512.png',
    ])).then(() => self.skipWaiting())
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
  const url = new URL(e.request.url);

  // 只處理 HTTP/HTTPS，跳過 chrome-extension:// 等其他 scheme
  if (!url.protocol.startsWith('http')) return;

  // wllama 模型檔案由 wllama 自己用 OPFS 處理，不攔截
  if (url.hostname.includes('huggingface.co')) return;

  // 導航請求（重啟 PWA）：直接從快取拿 index.html
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.open(CACHE).then(c =>
        c.match(new URL('index.html', self.registration.scope).href, { ignoreVary: true })
      ).then(cached => cached || fetch(e.request))
        .catch(() => new Response(
          '<html><body style="font:1rem system-ui;padding:2rem"><h2>請先連線開啟一次應用程式以啟用離線功能。</h2></body></html>',
          { status: 200, headers: { 'Content-Type': 'text/html;charset=utf-8' } }
        ))
    );
    return;
  }

  // 其他資源（CDN JS/WASM 等）：快取優先，沒有才去網路，成功後存入快取
  e.respondWith(
    caches.open(CACHE).then(async c => {
      const cached = await c.match(e.request, { ignoreVary: true });
      if (cached) return cached;
      try {
        const res = await fetch(e.request);
        if (res.ok && e.request.method === 'GET') {
          const cloned = res.clone(); // 必須在 return 前 clone，否則 body 已被消耗
          c.put(e.request, cloned);
        }
        return res;
      } catch {
        return new Response('offline', { status: 503 });
      }
    })
  );
});
