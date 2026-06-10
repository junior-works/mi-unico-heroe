/* Mi único héroe — service worker v0.4.0 */
const CACHE_NAME = "muh-shell-v0.4.0";
const PRECACHE = [
  "./",
  "./index.html",
  "./discografia.html",
  "./disco.html",
  "./cancion.html",
  "./glosario.html",
  "./canciones.html",
  "./espacios.html",
  "./espacio.html",
  "./tributos.html",
  "./proponer.html",
  "./proponer-tributo.html",
  "./acceder.html",
  "./mi-perfil.html",
  "./acerca.html",
  "./manifest.json",
  "./assets/styles.css?v=040",
  "./assets/config.js?v=040",
  "./assets/supa.js?v=040",
  "./assets/app.js?v=040"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});
function esImagen(req, url) {
  if (req.destination === "image") return true;
  return /\.(png|jpe?g|gif|webp|svg|ico|avif)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Imágenes: cache-first (rápido, no cambian).
  if (esImagen(req, url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((resp) => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
          }
          return resp;
        });
      })
    );
    return;
  }

  // HTML/JS/CSS y todo lo demás: network-first con fallback a cache.
  // Evita clientes "pegados": siempre intenta la red primero.
  event.respondWith(
    fetch(req).then((resp) => {
      if (resp && resp.status === 200) {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
      }
      return resp;
    }).catch(() => caches.match(req))
  );
});
