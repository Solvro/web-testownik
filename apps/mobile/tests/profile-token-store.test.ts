import { expect, it, vi } from "vitest";
import { createTokenStore } from "../src/lib/token-store";
import { withProfileOwnership } from "../src/lib/profile-token-store";

function fixture() {
  const persistence = {
    read: vi.fn(async () => ({ access: "A", refresh: "refresh-A" })),
    write: vi.fn(async () => {}),
  };
  const clear = vi.fn();
  const base = createTokenStore(persistence);
  const store = withProfileOwnership(base, clear);
  return { store, persistence, clear };
}

it("keeps the validated profile during hydration and same-session token refresh", async () => {
  const f = fixture();
  expect(await f.store.get()).toEqual({ access: "A", refresh: "refresh-A" });
  const session = f.store.session();
  await f.store.set(
    { access: "rotated-A", refresh: "rotated-refresh-A" },
    session,
  );
  expect(f.clear).not.toHaveBeenCalled();
  expect(f.store.session()).toBe(session);
});

it("clears A profile before B credentials are persisted for a real login", async () => {
  const f = fixture();
  f.persistence.write.mockImplementation(async () => {
    expect(f.clear).toHaveBeenCalledOnce();
  });
  const old = f.store.session();
  await f.store.set({ access: "B", refresh: "refresh-B" });
  expect(old.aborted).toBe(true);
  expect(await f.store.get()).toEqual({ access: "B", refresh: "refresh-B" });
});

for (const guarded of [false, true])
  it(`clears the per-tab profile during ${guarded ? "guarded" : "manual"} sign-out`, async () => {
    const f = fixture();
    await f.store.set(null, guarded ? f.store.session() : undefined);
    expect(f.clear).toHaveBeenCalledOnce();
    expect(await f.store.get()).toBeNull();
  });

it("a stale A sign-out cannot clear B cached profile or credentials", async () => {
  const f = fixture();
  const stale = f.store.session();
  await f.store.set({ access: "B", refresh: "refresh-B" });
  f.clear.mockClear();
  await expect(f.store.set(null, stale)).rejects.toMatchObject({
    code: "signedOut",
  });
  expect(f.clear).not.toHaveBeenCalled();
  expect(await f.store.get()).toEqual({ access: "B", refresh: "refresh-B" });
});

it("a failed profile clear never installs new credentials over an unknown cached owner", async () => {
  const f = fixture();
  await f.store.get();
  f.clear.mockImplementation(() => {
    throw new Error("Session storage denied");
  });
  await expect(
    f.store.set({ access: "B", refresh: "refresh-B" }),
  ).rejects.toThrow("Session storage denied");
  expect(f.persistence.write).not.toHaveBeenCalled();
  expect(await f.store.get()).toEqual({ access: "A", refresh: "refresh-A" });
});

it("retains the known profile if clearing its credentials fails", async () => {
  const f = fixture();
  await f.store.get();
  f.persistence.write.mockRejectedValueOnce(new Error("Token removal denied"));
  await expect(f.store.set(null, f.store.session())).rejects.toThrow(
    "Token removal denied",
  );
  expect(f.clear).not.toHaveBeenCalled();
  expect(await f.store.get()).toEqual({ access: "A", refresh: "refresh-A" });
});

it("keeps profile ownership until successful credential removal completes", async () => {
  const f = fixture();
  f.persistence.write.mockImplementation(async () => {
    expect(f.clear).not.toHaveBeenCalled();
  });
  await f.store.set(null, f.store.session());
  expect(f.clear).toHaveBeenCalledOnce();
});

for (const action of ["login", "signout"] as const) {
  it(`rotates the session synchronously before an unawaited ${action} returns`, async () => {
    const f = fixture();
    const original = f.store.session();
    const pending =
      action === "login"
        ? f.store.set({ access: "B", refresh: "refresh-B" })
        : f.store.set(null, original);
    expect(original.aborted).toBe(true);
    expect(f.store.session()).not.toBe(original);
    await pending;
  });
}
