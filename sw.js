const CACHE = 'local-llm-v1';

// 安裝時快取本地檔案
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll(['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'])
    )
  );
  self.skipWaiting();
});

// 清除舊快取
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 請求策略：本地優先從快取，外部資源（CDN / HuggingFace）用 network-first + 動態快取
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // HuggingFace 模型檔案太大，不快取（wllama 自己用 Cache API 處理）
  if (url.hostname.includes('huggingface.co')) return;

  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request);
      if (cached) return cached;

      try {
        const response = await fetch(e.request);
        // 只快取成功的 GET 請求
        if (e.request.method === 'GET' && response.ok) {
          cache.put(e.request, response.clone());
        }
        return response;
      } catch {
        return cached ?? new Response('離線中，資源未快取', { status: 503 });
      }
    })
  );
});
