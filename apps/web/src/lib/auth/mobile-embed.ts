/** Ask the native report screen to renew its isolated, read-only session. */
export function notifyMobileSessionExpired(status: number): void {
  if (
    status !== 401 ||
    typeof window === "undefined" ||
    document.body.dataset.mobileEmbed !== "true"
  ) {
    return;
  }
  const bridge = (
    window as Window & {
      ReactNativeWebView?: { postMessage: (message: string) => void };
    }
  ).ReactNativeWebView;
  bridge?.postMessage(JSON.stringify({ type: "embedded-session-expired" }));
}
