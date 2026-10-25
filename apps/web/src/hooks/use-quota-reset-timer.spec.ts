import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useQuotaResetTimer } from "@/hooks/use-quota-reset-timer";

describe("useQuotaResetTimer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts to the exact deadline and completes once", () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-08-23T10:00:00.000Z");
    const onReset = vi.fn();
    const resetsAt = "2026-08-23T10:00:05.000Z";
    const { result } = renderHook(() => useQuotaResetTimer(resetsAt, onReset));

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current).toBe(new Date("2026-08-23T10:00:04.000Z").getTime());
    expect(onReset).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(new Date(resetsAt).getTime());
    expect(onReset).toHaveBeenCalledOnce();
    expect(onReset).toHaveBeenCalledWith(resetsAt);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("uses the current clock immediately when a new deadline replaces an old one", () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-08-23T10:00:00.000Z");
    const onReset = vi.fn();
    const firstResetAt = "2026-08-23T10:00:05.000Z";
    const initialProps: { resetsAt: string | null } = {
      resetsAt: firstResetAt,
    };
    const { result, rerender } = renderHook(
      ({ resetsAt }: { resetsAt: string | null }) =>
        useQuotaResetTimer(resetsAt, onReset),
      { initialProps },
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    rerender({ resetsAt: null });
    act(() => {
      vi.advanceTimersByTime(55_000);
    });

    rerender({ resetsAt: "2026-08-23T10:01:15.000Z" });

    expect(result.current).toBe(new Date("2026-08-23T10:01:00.000Z").getTime());
  });
});
