// Service worker: appka funguje offline. Při změně souborů zvyš VERSION.
const VERSION = 'v15';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/main.js', 'js/config.js', 'js/lib/dates.js',
  'js/data/idb.js', 'js/data/store.js', 'js/data/sync.js', 'js/data/normalize.js',
  'js/calc/load.js', 'js/calc/readiness.js', 'js/calc/plan.js', 'js/calc/wa.js', 'js/calc/perf.js', 'js/calc/camps.js',
  'js/ui/dom.js', 'js/ui/haptics.js', 'js/ui/inputs.js', 'js/ui/sheet.js', 'js/ui/track-bg.js', 'js/ui/chart.js', 'js/ui/celebrate.js', 'js/ui/toast.js',
  'js/views/today.js', 'js/views/checkin.js', 'js/views/done.js', 'js/views/week.js', 'js/views/settings.js',
  'js/views/performance.js', 'js/views/charts.js', 'js/views/camps.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];
const SHELL_CACHE = `shell-${VERSION}`;
const FONT_CACHE = 'fonts';

self.addEventListener('install', e => {
  // cache: 'reload' – obejít HTTP cache GitHub Pages, jinak by nová verze mohla uložit staré soubory
  e.waitUntil(caches.open(SHELL_CACHE)
    .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('shell-') && k !== SHELL_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Apps Script vždy ze sítě (offline řeší outbox v appce)
  if (url.hostname.endsWith('script.google.com') || url.hostname.endsWith('googleusercontent.com')) return;

  if (url.hostname.includes('fonts.g')) {
    e.respondWith(caches.open(FONT_CACHE).then(async c => {
      const hit = await c.match(e.request);
      const net = fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
  }
});
