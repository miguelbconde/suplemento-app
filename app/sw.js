/* Suplemento — service worker: o app abre sem internet.
 * Casca do app: do cache, atualizada em segundo plano. Edições (JSON): primeiro da rede, cache como reserva. */
var VERSAO = 'suplemento-v10';
var CASCA = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'fonts/newsreader-latin-opsz-normal.woff2', 'fonts/newsreader-latin-opsz-italic.woff2',
  'icons/icon-192.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSAO).then(function (c) { return c.addAll(CASCA); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSAO; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (/\.json$/.test(url.pathname)) {
    e.respondWith(fetch(e.request).then(function (r) {
      var copia = r.clone(); caches.open(VERSAO).then(function (c) { c.put(e.request, copia); }); return r;
    }).catch(function () { return caches.match(e.request); }));
    return;
  }
  // casca: responde do cache e atualiza em segundo plano (a versão nova vale na próxima abertura)
  e.respondWith(caches.open(VERSAO).then(function (c) {
    return c.match(e.request, { ignoreSearch: true }).then(function (r) {
      var rede = fetch(e.request).then(function (resp) { if (resp.ok) c.put(e.request, resp.clone()); return resp; }).catch(function () { return r; });
      return r || rede;
    });
  }));
});
