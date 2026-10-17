import { useSyncExternalStore } from "react";

/** Whether the browser runs on macOS or iOS, where ⌘ takes the place of Ctrl. */
export function isApplePlatform() {
  if (typeof navigator === "undefined") {
    return false;
  }
  const platform =
    (navigator as { userAgentData?: { platform?: string } }).userAgentData
      ?.platform ?? navigator.userAgent;
  return /mac|iphone|ipad|ipod/i.test(platform);
}

function subscribe() {
  // The platform never changes, so there is nothing to watch.
  return unsubscribe;
}

function unsubscribe() {
  // Nothing was subscribed.
}

function serverSnapshot() {
  return false;
}

/** `isApplePlatform`, false during server rendering and hydration. */
export function useIsApplePlatform() {
  return useSyncExternalStore(subscribe, isApplePlatform, serverSnapshot);
}
