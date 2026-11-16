import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useQuizMetadata } from "./use-quiz-stats";

const { browserMetadata } = vi.hoisted(() => ({ browserMetadata: vi.fn() }));
vi.mock("@/services", () => ({
  getQuizService: () => ({ getQuizMetadata: browserMetadata }),
}));

type BridgeWindow = Window & {
  ReactNativeWebView?: { postMessage: (message: string) => void };
};

afterEach(() => {
  delete document.body.dataset.mobileEmbed;
  delete (window as BridgeWindow).ReactNativeWebView;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("native statistics requests", () => {
  it("notifies native when the isolated report cookie expires", async () => {
    document.body.dataset.mobileEmbed = "true";
    const postMessage = vi.fn();
    (window as BridgeWindow).ReactNativeWebView = { postMessage };
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 401 }));
    vi.stubGlobal("fetch", fetch);
    const { result, unmount } = renderHook(
      () => useQuizMetadata("fixture-id"),
      { wrapper },
    );
    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        '{"type":"embedded-session-expired"}',
      );
    });
    expect(fetch).toHaveBeenCalledWith(
      "/auth/mobile/stats?id=fixture-id&part=metadata",
      { credentials: "same-origin" },
    );
    expect(browserMetadata).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
    unmount();
  });
  it("keeps canonical browser statistics on the normal service", async () => {
    browserMetadata.mockResolvedValue({ title: "Quiz", can_edit: false });
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useQuizMetadata("fixture-id"), {
      wrapper,
    });
    await waitFor(() => {
      expect(result.current.data?.title).toBe("Quiz");
    });
    expect(browserMetadata).toHaveBeenCalledWith("fixture-id");
    expect(fetch).not.toHaveBeenCalled();
  });
});
