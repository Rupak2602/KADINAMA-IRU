
const CACHE_NAME = "kadinama-iru-v1";

const APP_FILES = [
  "/",
  "/index.html",
  "/login.html",
  "/signup.html",
  "/manifest.json",
  "/css/style.css",
  "/css/responsive.css",
  "/assets/images/kadinama-logo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_FILES);
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // External requests, including Supabase/API requests,
  // should not be cached by this service worker.
  if (url.origin !== self.location.origin) return;

  // HTML pages: try the network first to get fresh content.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedPage = await caches.match(request);
        return cachedPage || caches.match("/index.html");
      })
    );
    return;
  }

  // Static assets: use cache first, then fetch and cache.
  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;

      const response = await fetch(request);

      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }

      return response;
    })
  );
});
