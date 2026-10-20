import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseLandingDemoRequest } from "@/lib/ai/landing-demo";
import {
  LANDING_DEMO_MAX_OUTPUT_TOKENS,
  LANDING_DEMO_RATE_LIMITS,
  admitLandingDemoRequest,
  getClientKey,
  handleLandingDemoRequest,
  parseLandingAiModel,
} from "@/lib/ai/landing-demo.server";
import { resetRateLimitStore } from "@/lib/ai/rate-limit";

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

function createMockModel() {
  return new MockLanguageModelV3({
    doStream: async () => {
      await Promise.resolve();
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start" as const, id: "t1" },
            { type: "text-delta" as const, id: "t1", delta: "Aktywne " },
            { type: "text-delta" as const, id: "t1", delta: "przypominanie." },
            { type: "text-end" as const, id: "t1" },
            {
              type: "finish" as const,
              finishReason: { unified: "stop" as const, raw: "stop" },
              usage: {
                inputTokens: {
                  total: 10,
                  noCache: 10,
                  cacheRead: 0,
                  cacheWrite: 0,
                },
                outputTokens: { total: 4, text: 4, reasoning: 0 },
              },
            },
          ],
        }),
      };
    },
  });
}

function demoRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/ai/landing-demo", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function admitDeferredClients(clientKeys: string[]) {
  const controllers: ReadableStreamDefaultController<Uint8Array>[] = [];
  const pending = clientKeys.map(async (clientKey) => {
    const request = new Request("http://localhost/ai/landing-demo", {
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
      parse: parseLandingDemoRequest,
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

describe("parseLandingDemoRequest", () => {
  it("accepts a single prompt", () => {
    expect(parseLandingDemoRequest({ prompt: "  Dlaczego?  " })).toEqual({
      messages: [{ role: "user", content: "Dlaczego?" }],
    });
  });

  it("accepts a short history ending with a user turn", () => {
    const messages = [
      { role: "user", content: "Pytanie" },
      { role: "assistant", content: "Odpowiedź" },
      { role: "user", content: "Dalej" },
    ];
    expect(parseLandingDemoRequest({ messages })).toEqual({ messages });
  });

  it.each([
    ["non-object", "hello"],
    ["empty object", {}],
    ["both prompt and messages", { prompt: "a", messages: [] }],
    ["empty prompt", { prompt: "   " }],
    ["non-string prompt", { prompt: 1 }],
    ["too long prompt", { prompt: "a".repeat(401) }],
    ["empty history", { messages: [] }],
    [
      "too many messages",
      {
        messages: Array.from({ length: 7 }, () => ({
          role: "user",
          content: "a",
        })),
      },
    ],
    [
      "history ending with assistant",
      { messages: [{ role: "assistant", content: "a" }] },
    ],
    ["system role", { messages: [{ role: "system", content: "a" }] }],
    [
      "too long assistant message",
      {
        messages: [
          { role: "assistant", content: "a".repeat(1201) },
          { role: "user", content: "a" },
        ],
      },
    ],
  ])("rejects %s", (_label, body) => {
    expect(parseLandingDemoRequest(body)).toBeNull();
  });
});

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

describe("handleLandingDemoRequest", () => {
  beforeEach(() => {
    resetRateLimitStore();
    mocks.env.NEXT_PUBLIC_AI_ENABLED = true;
    mocks.env.LANDING_AI_MODEL = undefined;
    mocks.providerConfigured = true;
    mocks.getConfiguredAiModel.mockReset();
    mocks.getConfiguredAiModel.mockImplementation(() => createMockModel());
  });

  it("streams the model's text with a hard output cap", async () => {
    const model = createMockModel();
    mocks.getConfiguredAiModel.mockReturnValue(model);

    const response = await handleLandingDemoRequest(
      demoRequest({ prompt: "Dlaczego ta odpowiedź?" }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Aktywne przypominanie.");
    expect(mocks.getConfiguredAiModel).toHaveBeenCalledWith(
      "gpt-5.6-luna",
      "openai",
    );
    expect(model.doStreamCalls).toHaveLength(1);
    const [call] = model.doStreamCalls;
    expect(call.maxOutputTokens).toBe(LANDING_DEMO_MAX_OUTPUT_TOKENS);
    const [system] = call.prompt;
    expect(system.role).toBe("system");
    expect(JSON.stringify(system)).toContain(
      "aktywne przypominanie i powtórki w odstępach",
    );
  });

  it("uses the configured LANDING_AI_MODEL", async () => {
    mocks.env.LANDING_AI_MODEL = "xai:grok-mini";
    const response = await handleLandingDemoRequest(
      demoRequest({ prompt: "Hej" }),
    );
    await response.text();
    expect(mocks.getConfiguredAiModel).toHaveBeenCalledWith("grok-mini", "xai");
  });

  it("returns 400 for invalid JSON and invalid bodies", async () => {
    const invalidJson = await handleLandingDemoRequest(
      demoRequest("{not json"),
    );
    expect(invalidJson.status).toBe(400);
    const invalidBody = await handleLandingDemoRequest(
      demoRequest({ prompt: "" }),
    );
    expect(invalidBody.status).toBe(400);
    expect(mocks.getConfiguredAiModel).not.toHaveBeenCalled();
  });

  it("returns 503 when AI is disabled", async () => {
    mocks.env.NEXT_PUBLIC_AI_ENABLED = false;
    const response = await handleLandingDemoRequest(
      demoRequest({ prompt: "a" }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "ai_disabled" });
  });

  it("returns 503 when the model provider has no key", async () => {
    mocks.providerConfigured = false;
    const response = await handleLandingDemoRequest(
      demoRequest({ prompt: "a" }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "ai_model_unavailable" });
    expect(mocks.getConfiguredAiModel).not.toHaveBeenCalled();
  });

  it("rejects oversized bodies with 413 before parsing them", async () => {
    const huge = "x".repeat(20_000);
    const response = await handleLandingDemoRequest(
      demoRequest({ prompt: huge }, { "x-forwarded-for": "203.0.113.9" }),
    );
    expect(response.status).toBe(413);
    // The rejected request did not count against the client.
    const ok = await handleLandingDemoRequest(
      demoRequest({ prompt: "a" }, { "x-forwarded-for": "203.0.113.9" }),
    );
    expect(ok.status).toBe(200);
    await ok.text();
  });

  it("rate limits each client IP with Retry-After", async () => {
    const headers = { "x-forwarded-for": "203.0.113.7" };
    for (
      let index = 0;
      index < LANDING_DEMO_RATE_LIMITS.perClient.limit;
      index++
    ) {
      const response = await handleLandingDemoRequest(
        demoRequest({ prompt: "a" }, headers),
      );
      expect(response.status).toBe(200);
      await response.text();
    }

    const limited = await handleLandingDemoRequest(
      demoRequest({ prompt: "a" }, headers),
    );
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);

    const otherClient = await handleLandingDemoRequest(
      demoRequest({ prompt: "a" }, { "x-forwarded-for": "203.0.113.8" }),
    );
    expect(otherClient.status).toBe(200);
    await otherClient.text();
  });

  it("caps total demo traffic across all clients", async () => {
    for (
      let index = 0;
      index < LANDING_DEMO_RATE_LIMITS.global.limit;
      index++
    ) {
      const response = await handleLandingDemoRequest(
        demoRequest(
          { prompt: "a" },
          {
            "x-forwarded-for": `10.0.${Math.floor(index / 250).toString()}.${(index % 250).toString()}`,
          },
        ),
      );
      expect(response.status).toBe(200);
      await response.text();
    }

    const limited = await handleLandingDemoRequest(
      demoRequest({ prompt: "a" }, { "x-forwarded-for": "198.51.100.200" }),
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).not.toBeNull();
    // 600 streamed responses; the default 5 s is tight on a busy machine.
  }, 30_000);
});

describe("landing demo concurrent admission", () => {
  beforeEach(() => {
    resetRateLimitStore();
    mocks.env.NEXT_PUBLIC_AI_ENABLED = true;
    mocks.env.LANDING_AI_MODEL = undefined;
    mocks.providerConfigured = true;
    mocks.getConfiguredAiModel.mockReset();
    mocks.getConfiguredAiModel.mockReturnValue(createMockModel());
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
        { maxBodyBytes: 16_384, parse: parseLandingDemoRequest },
      );
      expect(admission.admitted).toBe(true);
    }
    const rejected = await admitLandingDemoRequest(
      demoRequest({ prompt: "a" }, { "x-forwarded-for": "198.51.100.1" }),
      { maxBodyBytes: 16_384, parse: parseLandingDemoRequest },
    );
    expect(rejected.admitted).toBe(false);
  }, 30_000);
});
