import { expect, it } from "vitest";
import { ApiClient, ApiError } from "../src/lib/client";
import { UserFacingError, errorKind, userError } from "../src/lib/user-error";

const en = (_pl: string, english: string) => english;
const pl = (polish: string) => polish;

it("localizes the same retained error at display time", () => {
  const failure = new UserFacingError("oauthState");
  expect(userError(failure, en)).toContain("Please start again");
  expect(userError(failure, pl)).toContain("Zacznij ponownie");
});

it("localizes API fallbacks while preserving specific server validation", async () => {
  const api = new ApiClient(
    "http://fixture.invalid",
    {
      session: () => new AbortController().signal,
      get: async () => null,
      set: async () => {},
    },
    async () => Response.json({}, { status: 503 }),
  );
  const failure = await api.request("fixture").catch((error: unknown) => error);
  expect(userError(failure, en)).toContain("temporarily unavailable");
  expect(userError(failure, pl)).toContain("Przerwa techniczna");
  const validation = new ApiError(400, "At least one answer must be correct.");
  expect(userError(validation, en)).toBe(validation.message);
});

it("explains transport errors without hiding unrelated failures", () => {
  expect(userError(new TypeError("Network request failed"), pl)).toContain(
    "Sprawdź połączenie",
  );
  expect(userError(new TypeError("Failed to fetch"), en)).toContain(
    "Check your connection",
  );
  const timeout = new Error("The operation timed out");
  timeout.name = "TimeoutError";
  expect(userError(timeout, en)).toContain("took too long");
  expect(userError(new Error("Storage is full"), en)).toBe("Storage is full");
  expect(userError(null, en)).toBe("Check your connection and try again.");
});

it("replaces stock permission and missing-object details", () => {
  const missing = new ApiError(404, "No Quiz matches the given query.");
  expect(userError(missing, en)).toContain("isn’t available");
  expect(errorKind(missing)).toBe("notFound");
  const denied = new ApiError(
    403,
    "You do not have permission to perform this action.",
  );
  expect(userError(denied, en)).toBe("You don’t have access to this.");
  const specific = new ApiError(403, "Only the owner can share this quiz.");
  expect(userError(specific, en)).toBe(specific.message);
  expect(userError(new ApiError(500, "x", {}, "operation"), en)).toContain(
    "on our side",
  );
  expect(errorKind(new TypeError("Network request failed"))).toBe("offline");
  expect(errorKind(new ApiError(503, "x", {}, "maintenance"))).toBe(
    "maintenance",
  );
});

it("treats Android expo/fetch transport failures as offline", () => {
  const android = new TypeError(
    "fetch failed: java.net.ConnectException: Failed to connect to localhost/127.0.0.1:8000",
  );
  expect(errorKind(android)).toBe("offline");
  expect(userError(android, en)).toBe("Check your connection and try again.");
});

it("treats the Android client timeout as a timeout", () => {
  const timeout = new Error("fetch failed: Fetch request has been canceled");
  expect(errorKind(timeout)).toBe("timeout");
  expect(userError(timeout, en)).toContain("took too long");
});

it.each([undefined, "operation"] as const)(
  "classifies a final HTTP401 as expired authentication with code %s",
  (code) => {
    expect(errorKind(new ApiError(401, "Rejected credentials", {}, code))).toBe(
      "signIn",
    );
  },
);

it("retains explicit failure priority when an HTTP401 also has a known code", () => {
  expect(errorKind(new ApiError(401, "Deadline exceeded", {}, "timeout"))).toBe(
    "timeout",
  );
  expect(
    errorKind(new ApiError(401, "Service unavailable", {}, "maintenance")),
  ).toBe("maintenance");
});

it("classifies a second401 after a successful OAuth refresh without another query retry", async () => {
  const signal = new AbortController().signal;
  let tokens = { access: "original", refresh: "original-refresh" };
  const paths: string[] = [];
  const client = new ApiClient(
    "http://fixture.invalid/api",
    {
      session: () => signal,
      get: async () => tokens,
      set: async (value) => {
        if (value) tokens = value;
      },
    },
    async (input) => {
      const path = new URL(String(input)).pathname;
      paths.push(path);
      return path.endsWith("/oauth/token/")
        ? Response.json({
            access_token: "rotated",
            refresh_token: "rotated-refresh",
            token_type: "Bearer",
          })
        : Response.json({}, { status: 401 });
    },
  );
  const failure = await client
    .request("library/private/")
    .catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(ApiError);
  expect(errorKind(failure)).toBe("signIn");
  expect(paths).toEqual([
    "/api/library/private/",
    "/api/oauth/token/",
    "/api/library/private/",
  ]);
});
