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
