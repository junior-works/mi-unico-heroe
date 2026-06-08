/* Mi único héroe — service worker
   Cache mínimo de shell + glosario. v0.1.0 — bumpear en cada deploy. */

const CACHE_NAME = "muh-shell-v0.2.5";
const PRECACHE = [
  "./",
  "./index.html",
  "./glosario.html",
  "./canciones.html",
  "./cancion.html",
  "./espacios.html",
  "./espacio.html",
  "./tributos.html",
  "./proponer.html",
  "./proponer-tributo.html",
  "./acceder.html",
  "./mi-perfil.html",
  "./acerca.html",
  "./manifest.json",
  "./assets/styles.css",
  "./assets/config.js",
  "./assets/supa.js",
  "./assets/app.js",
  "./data/glosario.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Estrategia: stale-while-revalidate para assets propios.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // dejar pasar YouTube, fonts, etc.

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
