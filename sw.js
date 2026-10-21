// Service Worker: App funktioniert auch ohne Netz (z.B. in der Turnhalle).
// Strategie: zuerst Netz (immer aktuelle Version), bei Funkloch/Timeout aus dem Cache.
const CACHE = 'uhc-app';
const TIMEOUT_MS = 3000;
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest', 'icon.svg', 'icon-192.png',
  'vendor/preact-htm.module.js',
  'fonts/saira.woff2', 'fonts/saira-italic.woff2', 'fonts/inter.woff2',
  'app/main.js', 'app/api.js', 'app/config.js', 'app/store.js', 'app/stats.js', 'app/ui.js', 'app/effects.js',
  'app/views/login.js', 'app/views/matches.js', 'app/views/setup.js', 'app/views/live.js',
  'app/views/report.js', 'app/views/stats.js', 'app/views/roster.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Nur eigene Dateien; Supabase-Anfragen laufen direkt
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const network = fetch(req).then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    const timeout = new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS));
    try {
      const res = await Promise.race([network, timeout]);
      if (res) return res;
    } catch {}
    const cached = await cache.match(req, { ignoreSearch: true });
    return cached || network;
  })());
});
