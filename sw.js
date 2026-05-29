const CACHE = 'local-llm-v3';
const BASE = self.registration.scope; // e.g. https://exist-x.github.io/local-llm-pwa/

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll([
        BASE,
        BASE + 'index.html',
        BASE + 'manifest.json',
        BASE + 'icon-192.png',
        BASE + 'icon-512.png',
      ]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.hostname.includes('huggingface.co')) return;

  e.respondWith(handle(e));
});

async function handle(e) {
  const cache = await caches.open(CACHE);
  const OPT = { ignoreVary: true };

  if (e.request.mode === 'navigate') {
    // 網路優先，offline 時從快取找 index.html
    try {
      const res = await fetch(e.request);
      cache.put(e.request, res.clone());
      return res;
    } catch {
      return (
        await cache.match(BASE + 'index.html', OPT) ||
        await cache.match(BASE, OPT) ||
        new Response(
          '<html><body style="font:1rem system-ui;padding:2rem">' +
          '<h2>請先連線開啟一次應用程式，以啟用離線功能。</h2></body></html>',
          { status: 200, headers: { 'Content-Type': 'text/html;charset=utf-8' } }
        )
      );
    }
  }

  // 其他資源：快取優先
  const cached = await cache.match(e.request, OPT);
  if (cached) return cached;

  try {
    const res = await fetch(e.request);
    if (e.request.method === 'GET' && res.ok) cache.put(e.request, res.clone());
    return res;
  } catch {
    return new Response('offline', { status: 503 });
  }
}
