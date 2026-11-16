import { afterEach, describe, expect, it, vi } from "vitest";

import { notifyMobileSessionExpired } from "./mobile-embed";

type BridgeWindow = Window & {
  ReactNativeWebView?: { postMessage: (message: string) => void };
};

afterEach(() => {
  delete document.body.dataset.mobileEmbed;
  delete (window as BridgeWindow).ReactNativeWebView;
});

describe("isolated native report recovery", () => {
  it("asks native to renew an expired report session", () => {
    const postMessage = vi.fn();
    document.body.dataset.mobileEmbed = "true";
    (window as BridgeWindow).ReactNativeWebView = { postMessage };
    notifyMobileSessionExpired(401);
    expect(postMessage).toHaveBeenCalledWith(
      '{"type":"embedded-session-expired"}',
    );
  });
  it("does not emit expiry for other failures or normal browser sessions", () => {
    const postMessage = vi.fn();
    (window as BridgeWindow).ReactNativeWebView = { postMessage };
    notifyMobileSessionExpired(401);
    document.body.dataset.mobileEmbed = "true";
    for (const status of [403, 404, 429, 500, 503]) {
      notifyMobileSessionExpired(status);
    }
    expect(postMessage).not.toHaveBeenCalled();
  });
  it("works without an installed native bridge", () => {
    document.body.dataset.mobileEmbed = "true";
    expect(() => {
      notifyMobileSessionExpired(401);
    }).not.toThrow();
  });
});
