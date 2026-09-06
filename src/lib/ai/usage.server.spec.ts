import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildUsageCallbacks,
  checkQuota,
  reportUsage,
} from "@/lib/ai/usage.server";

const afterCallbacks = vi.hoisted(() => [] as (() => Promise<void>)[]);

vi.mock("next/server", () => ({
  after: (callback: () => Promise<void>) => {
    afterCallbacks.push(callback);
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({
  env: {
    INTERNAL_API_KEY: "test-key",
  },
}));
vi.mock("@/lib/api", () => ({ API_URL: "https://backend.test" }));
vi.mock("@/lib/ai/model", () => ({
  isAiProviderConfigured: () => true,
}));

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function parsedRequestBody(body: BodyInit | null | undefined) {
  if (typeof body !== "string") {
    throw new TypeError("Expected a JSON request body");
  }
  return JSON.parse(body) as unknown;
}

describe("AI usage server pipeline", () => {
  beforeEach(() => {
    afterCallbacks.length = 0;
    vi.restoreAllMocks();
  });

  it("reports exactly one terminal result when error and finish both fire", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({}, 201));
    const callbacks = buildUsageCallbacks({
      payload: {
        user_id: "user-1",
        scope: "chat",
        model: "gpt-5.6-terra",
      },
      requestId: "request-1",
      startedAt: Date.now(),
    });

    callbacks.onError({ error: new Error("stream failed") });
    callbacks.onFinish({
      totalUsage: { inputTokens: 3, outputTokens: 4 },
      finishReason: "stop",
    });
    for (const callback of afterCallbacks) {
      await callback();
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(parsedRequestBody(fetchMock.mock.calls[0]?.[1]?.body)).toMatchObject(
      {
        request_id: "request-1",
        input_tokens: 3,
        output_tokens: 4,
        finish_reason: "stop",
        error: "stream failed",
      },
    );
  });

  it("retries a rejected conversation as a billing-only report", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ detail: "invalid conversation" }, 400),
      )
      .mockResolvedValueOnce(jsonResponse({}, 201));

    await reportUsage({
      user_id: "user-1",
      scope: "chat",
      model: "gpt-5.6-terra",
      request_id: "request-2",
      conversation_id: crypto.randomUUID(),
      quiz_id: crypto.randomUUID(),
      messages: [{ role: "user" }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryBody = parsedRequestBody(fetchMock.mock.calls[1]?.[1]?.body);
    expect(retryBody).not.toHaveProperty("conversation_id");
    expect(retryBody).not.toHaveProperty("quiz_id");
    expect(retryBody).not.toHaveProperty("messages");
    expect(retryBody).toMatchObject({ request_id: "request-2" });
  });

  it("sends the requested model and preserves the fallback grant contract", async () => {
    const quotaResult = {
      allowed: true,
      would_block: true,
      limits_enabled: true,
      exceeded_window: "session",
      resets_at: null,
      suggested_max_output_tokens: 100,
      quota_tier: "fallback",
      fallback_model: "gpt-5.6-luna",
      fallback_grant_id: crypto.randomUUID(),
      fallback_resets_at: "2026-08-23T10:00:15Z",
      resolved_model: "gpt-5.6-luna",
      resolved_provider: "openai",
      active_models: ["gpt-5.6-terra", "gpt-5.6-luna"],
      usage: {
        session: {
          used: "1",
          limit: "1",
          remaining: "0",
          resets_at: null,
        },
        weekly: {
          used: "1",
          limit: "1",
          remaining: "0",
          resets_at: null,
        },
      },
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(quotaResult));

    const result = await checkQuota("user-1", {
      requestedModel: "gpt-5.6-terra",
      availableProviders: ["openai"],
    });

    expect(result.fallback_grant_id).toBe(quotaResult.fallback_grant_id);
    expect(parsedRequestBody(fetchMock.mock.calls[0]?.[1]?.body)).toMatchObject(
      {
        requested_model: "gpt-5.6-terra",
        available_providers: ["openai"],
      },
    );
  });
});
