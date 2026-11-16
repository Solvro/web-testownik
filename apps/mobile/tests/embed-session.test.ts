import { describe, expect, it } from "vitest";

import { canReceiveEmbeddedMessage } from "../src/lib/embed-navigation";
import { embeddedSessionExpired } from "../src/lib/embed-session";

describe("embedded report session recovery", () => {
  it("recognizes only the explicit expiry message", () => {
    expect(embeddedSessionExpired('{"type":"embedded-session-expired"}')).toBe(
      true,
    );
    for (const input of [
      "invalid",
      "null",
      "[]",
      '{"type":"wrapped-theme"}',
      "x".repeat(257),
    ]) {
      expect(embeddedSessionExpired(input)).toBe(false);
    }
  });

  it("accepts messages only from the selected report document", () => {
    const origin = "https://testownik.solvro.pl";
    const destination = "/wrapped";
    expect(
      canReceiveEmbeddedMessage(`${origin}${destination}`, origin, destination),
    ).toBe(true);
    for (const url of [
      "about:blank",
      `${origin}/auth/mobile`,
      `${origin}/wrapped/global`,
      `https://evil.invalid${destination}`,
    ]) {
      expect(canReceiveEmbeddedMessage(url, origin, destination)).toBe(false);
    }
  });
});
