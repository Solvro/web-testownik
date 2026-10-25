import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { useSyncAuth } from "@/hooks/use-sync-auth";
import type { JWTPayload } from "@/lib/auth/types";

const mocks = vi.hoisted(() => ({ read: vi.fn(), decode: vi.fn() }));
vi.mock("@/lib/cookies", () => ({
  AUTH_COOKIE_NAMES: {
    ACCESS_TOKEN: "access_token",
    REFRESH_TOKEN: "refresh_token",
  },
  getCookie: mocks.read,
}));
vi.mock("@/lib/auth/jwt-utils", () => ({ decodeAccessToken: mocks.decode }));
vi.mock("@/services", () => ({
  getUserService: () => ({ refreshToken: vi.fn() }),
}));

it("updates the avatar after token refresh without a Cookie Store change or window focus", async () => {
  const original = { user_id: "photo-user", photo: "old-photo" } as JWTPayload;
  const updated = { ...original, photo: "new-photo" };
  mocks.read.mockReturnValue("token");
  mocks.decode.mockReturnValue(original);
  const { result } = renderHook(() => useSyncAuth(original));
  await waitFor(() => {
    expect(result.current.user?.photo).toBe("old-photo");
  });

  mocks.decode.mockReturnValue(updated);
  act(() => {
    window.dispatchEvent(new Event("auth-token-refreshed"));
  });

  await waitFor(() => {
    expect(result.current.user?.photo).toBe("new-photo");
  });
});
