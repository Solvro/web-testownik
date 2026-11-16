import { afterEach, expect, it, vi } from "vitest";
import { withOfflineDataLock } from "../src/lib/account-data-lock.native";
afterEach(() => vi.unstubAllGlobals());
it("does not require browser capabilities on native", async () => {
  vi.stubGlobal("navigator", undefined);
  await expect(withOfflineDataLock(async () => "native")).resolves.toBe(
    "native",
  );
});
