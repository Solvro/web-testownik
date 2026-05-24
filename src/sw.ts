/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const OFFLINE_URL = "/offline.html";
const SENSITIVE_PATH_PREFIXES = ["/api/", "/auth/"];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    {
      matcher({ request, sameOrigin, url }) {
        if (!sameOrigin) {
          return false;
        }
        if (request.method !== "GET") {
          return true;
        }
        if (request.headers.has("Authorization")) {
          return true;
        }
        return SENSITIVE_PATH_PREFIXES.some((prefix) =>
          url.pathname.startsWith(prefix),
        );
      },
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
});

const getOfflineResponse = async () => {
  const fromPrecache = await serwist.matchPrecache(OFFLINE_URL);
  if (fromPrecache) {
    return fromPrecache;
  }
  return caches.match(OFFLINE_URL, { ignoreSearch: true });
};

serwist.setCatchHandler(async ({ request }) => {
  if (request.mode === "navigate" || request.destination === "document") {
    const offlinePage = await getOfflineResponse();
    if (offlinePage) {
      return offlinePage;
    }
  }
  return Response.error();
});

serwist.addEventListeners();
