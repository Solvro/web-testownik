import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { MaintenanceWrapper } from "@/components/maintenance";
import { BaseApiService } from "@/services/base-api.service";

class ProbeService extends BaseApiService {
  async request() {
    return this.get("/probe/");
  }
}

function enterMaintenance() {
  act(() => {
    window.dispatchEvent(new Event("backend-maintenance"));
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
  vi.useRealTimers();
});

it("switches to maintenance without an app context provider", () => {
  render(
    <MaintenanceWrapper>
      <p>Quiz content</p>
    </MaintenanceWrapper>,
  );
  expect(screen.getByText("Quiz content")).toBeVisible();

  enterMaintenance();

  expect(screen.queryByText("Quiz content")).not.toBeInTheDocument();
  expect(screen.getByText("Przerwa techniczna")).toBeVisible();
});

it.each([false, true])(
  "shows maintenance for 503 after token refresh: %s",
  async (refresh) => {
    render(
      <MaintenanceWrapper>
        <p>Quiz content</p>
      </MaintenanceWrapper>,
    );
    const fetchMock = vi.fn();
    if (refresh) {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
      fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    }
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    void new ProbeService("http://test.local").request();

    expect(await screen.findByText("Przerwa techniczna")).toBeVisible();
    expect(screen.queryByText("Quiz content")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(refresh ? 3 : 1);
  },
);

it.each([500, 502, 503, 504, 429, 200])(
  "reloads only after a healthy status response: %i",
  async (status) => {
    vi.useFakeTimers();
    render(
      <MaintenanceWrapper>
        <p>Quiz content</p>
      </MaintenanceWrapper>,
    );
    enterMaintenance();
    const reload = vi.fn();
    // JSDOM's Location is non-configurable; replace window only during polling.
    vi.stubGlobal("window", { location: { reload } });
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status }));
    vi.stubGlobal("fetch", fetchMock);

    await vi.advanceTimersByTimeAsync(30_000);

    expect(fetchMock).toHaveBeenCalledWith("http://test.local/status/");
    expect(reload).toHaveBeenCalledTimes(status === 200 ? 1 : 0);
  },
);

it("polls only while the maintenance screen is mounted", async () => {
  vi.useFakeTimers();
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 503 }));
  vi.stubGlobal("fetch", fetchMock);
  const { unmount } = render(
    <MaintenanceWrapper>
      <p>Quiz content</p>
    </MaintenanceWrapper>,
  );

  await vi.advanceTimersByTimeAsync(30_000);
  expect(fetchMock).not.toHaveBeenCalled();
  enterMaintenance();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(fetchMock).toHaveBeenCalledTimes(1);

  unmount();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
