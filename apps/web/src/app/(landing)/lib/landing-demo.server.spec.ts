import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  admitLandingDemoRequest,
  getClientKey,
  parseLandingAiModel,
} from "@/app/(landing)/lib/landing-demo.server";
import { resetRateLimitStore } from "@/app/(landing)/lib/rate-limit";

const mocks = vi.hoisted(() => ({
  env: {
    NEXT_PUBLIC_AI_ENABLED: true,
    LANDING_AI_MODEL: undefined as string | undefined,
  },
  providerConfigured: true,
  getConfiguredAiModel: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("@/lib/ai/model", () => ({
  isAiProviderConfigured: () => mocks.providerConfigured,
  getConfiguredAiModel: mocks.getConfiguredAiModel,
}));

const parseBody = (value: unknown) => value;

function demoRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/ai/landing-demo/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function admitDeferredClients(clientKeys: string[]) {
  const controllers: ReadableStreamDefaultController<Uint8Array>[] = [];
  const pending = clientKeys.map(async (clientKey) => {
    const request = new Request("http://localhost/ai/landing-demo/chat", {
      method: "POST",
      headers: { "x-forwarded-for": clientKey },
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controllers.push(controller);
        },
      }),
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    return admitLandingDemoRequest(request, {
      maxBodyBytes: 16_384,
      parse: parseBody,
    });
  });
  // All requests pass the preliminary peeks before any body finishes.
  expect(mocks.getConfiguredAiModel).not.toHaveBeenCalled();
  const bytes = new TextEncoder().encode(JSON.stringify({ prompt: "a" }));
  for (const controller of controllers) {
    controller.enqueue(bytes);
    controller.close();
  }
  return Promise.all(pending);
}

describe("landing demo helpers", () => {
  it("keys clients by the first forwarded hop, then x-real-ip", () => {
    expect(
      getClientKey(
        new Headers({
          "x-forwarded-for": " 203.0.113.7 , 10.0.0.1",
          "x-real-ip": "198.51.100.1",
        }),
      ),
    ).toBe("203.0.113.7");
    expect(getClientKey(new Headers({ "x-real-ip": "198.51.100.1" }))).toBe(
      "198.51.100.1",
    );
    expect(getClientKey(new Headers())).toBe("unknown");
    // Anything that is not an address shares the fallback bucket, so a caller
    // cannot mint fresh keys by sending arbitrary header values.
    expect(
      getClientKey(
        new Headers({ "x-forwarded-for": `not-an-ip-${"x".repeat(20)}` }),
      ),
    ).toBe("unknown");
    expect(
      getClientKey(new Headers({ "x-forwarded-for": "2001:DB8::1" })),
    ).toBe("2001:db8::1");
  });

  it("parses provider:model and falls back to the Luna default", () => {
    expect(parseLandingAiModel()).toEqual({
      provider: "openai",
      model: "gpt-5.6-luna",
    });
    expect(parseLandingAiModel("anthropic:claude-x:beta")).toEqual({
      provider: "anthropic",
      model: "claude-x:beta",
    });
    expect(parseLandingAiModel("google:gemini")).toBeNull();
    expect(parseLandingAiModel("openai:")).toBeNull();
  });
});

describe("landing demo concurrent admission", () => {
  beforeEach(() => {
    resetRateLimitStore();
    mocks.env.NEXT_PUBLIC_AI_ENABLED = true;
    mocks.env.LANDING_AI_MODEL = undefined;
    mocks.providerConfigured = true;
    mocks.getConfiguredAiModel.mockReset();
    mocks.getConfiguredAiModel.mockReturnValue({});
  });

  it("admits only 600 of 5,600 distinct clients with deferred bodies", async () => {
    const admissions = await admitDeferredClients(
      Array.from(
        { length: 5600 },
        (_, index) =>
          `10.0.${Math.floor(index / 250).toString()}.${(index % 250).toString()}`,
      ),
    );
    expect(admissions.filter((result) => result.admitted)).toHaveLength(600);
    const rejected = admissions.filter((result) => !result.admitted);
    expect(rejected).toHaveLength(5000);
    expect(rejected.every((result) => result.response.status === 429)).toBe(
      true,
    );
    expect(mocks.getConfiguredAiModel).toHaveBeenCalledTimes(600);
  }, 30_000);

  it("returns global reservations when concurrent requests exhaust a client", async () => {
    const admissions = await admitDeferredClients(
      Array.from({ length: 600 }, () => "203.0.113.7"),
    );
    expect(admissions.filter((result) => result.admitted)).toHaveLength(30);
    for (let index = 0; index < 570; index++) {
      const admission = await admitLandingDemoRequest(
        demoRequest(
          { prompt: "a" },
          {
            "x-forwarded-for": `10.0.${Math.floor(index / 250).toString()}.${(index % 250).toString()}`,
          },
        ),
        { maxBodyBytes: 16_384, parse: parseBody },
      );
      expect(admission.admitted).toBe(true);
    }
    const rejected = await admitLandingDemoRequest(
      demoRequest({ prompt: "a" }, { "x-forwarded-for": "198.51.100.1" }),
      { maxBodyBytes: 16_384, parse: parseBody },
    );
    expect(rejected.admitted).toBe(false);
  }, 30_000);
});
