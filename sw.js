const CACHE = 'local-llm-v2';
const BASE = new URL('./', self.location.href).href;
const SHELL = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // 模型檔案讓 wllama 自己用 Cache API 處理
  if (url.hostname.includes('huggingface.co')) return;

  // navigation 請求（重啟 PWA、重新整理）一律回傳快取的 index.html
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.open(CACHE).then(c =>
        c.match(BASE + 'index.html').then(cached =>
          cached || fetch(e.request).then(r => {
            c.put(BASE + 'index.html', r.clone());
            return r;
          })
        )
      )
    );
    return;
  }

  // 其他資源：快取優先，沒有才去網路，順便存起來
  e.respondWith(
    caches.open(CACHE).then(async c => {
      const cached = await c.match(e.request);
      if (cached) return cached;
      try {
        const res = await fetch(e.request);
        if (e.request.method === 'GET' && res.ok) c.put(e.request, res.clone());
        return res;
      } catch {
        return new Response('離線中，資源未快取', { status: 503 });
      }
    })
  );
});
