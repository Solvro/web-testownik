// Based off of https://github.com/pwa-builder/PWABuilder/blob/main/docs/sw.js

const CACHE_NAME = "pwa-cache";
const OFFLINE_URL = "/offline";

const HOSTNAME_WHITELIST = new Set([
  globalThis.location.hostname,
  "fonts.gstatic.com",
  "fonts.googleapis.com",
  "cdn.jsdelivr.net",
]);

const STATIC_EXTENSIONS = /\.(?:js|css|png|svg|webp|woff2|ico)$/i;
const SENSITIVE_PATH_PREFIXES = ["/api/", "/auth/"];

const isSensitiveRequest = (request) => {
  if (request.method !== "GET") {
    return true;
  }
  if (request.headers.has("Authorization")) {
    return true;
  }

  const url = new URL(request.url);
  return SENSITIVE_PATH_PREFIXES.some((prefix) =>
    url.pathname.startsWith(prefix),
  );
};

const isCacheableStaticAsset = (request) => {
  const url = new URL(request.url);

  if (url.pathname.startsWith("/_next/static/")) {
    return true;
  }
  if (STATIC_EXTENSIONS.test(url.pathname)) {
    return true;
  }
  if (/^\/icon-\d+/.test(url.pathname)) {
    return true;
  }
  if (url.pathname === "/apple-touch-icon.png") {
    return true;
  }

  return false;
};

const offlineHtmlResponse = () =>
  new Response(
    '<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Brak połączenia</title></head><body><p>Brak połączenia z internetem.</p></body></html>',
    {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );

const handleNavigate = async (request) => {
  try {
    return await fetch(request);
  } catch {
    const offlinePage = await caches.match(OFFLINE_URL);
    return offlinePage ?? offlineHtmlResponse();
  }
};

const handleStaticAsset = async (request, event) => {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(networkFetch);
    return cached;
  }

  const fetched = await networkFetch;
  if (fetched) {
    return fetched;
  }

  if (cached) {
    return cached;
  }

  throw new Error("Network error");
};

globalThis.addEventListener("install", (event) => {
  globalThis.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(OFFLINE_URL))
      .catch(() => {
        // Offline precache is optional; inline HTML fallback is used instead.
      }),
  );
});

globalThis.addEventListener("activate", (event) => {
  event.waitUntil(globalThis.clients.claim());
});

globalThis.addEventListener("fetch", (event) => {
  if (isSensitiveRequest(event.request)) {
    return;
  }

  const hostname = new URL(event.request.url).hostname;
  if (!HOSTNAME_WHITELIST.has(hostname)) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(handleNavigate(event.request));
    return;
  }

  if (isCacheableStaticAsset(event.request)) {
    event.respondWith(handleStaticAsset(event.request, event));
  }
});
