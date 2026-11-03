declare global {
  interface Window {
    umami?: {
      track: (event: string, data?: Record<string, string>) => void;
    };
  }
}

/** Sends a custom Umami event; false when the lazily loaded script is not there yet. */
export function trackUmamiEvent(
  event: string,
  data: Record<string, string>,
): boolean {
  if (typeof window === "undefined" || window.umami === undefined) {
    return false;
  }
  window.umami.track(event, data);
  return true;
}
