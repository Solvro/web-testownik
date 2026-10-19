import { streamText } from "ai";
import "server-only";

import { PREVIEW_QUESTION } from "@/components/testownik-preview/preview-fixtures";
import { env } from "@/env";
import { parseLandingDemoRequest } from "@/lib/ai/landing-demo";
import { getConfiguredAiModel, isAiProviderConfigured } from "@/lib/ai/model";
import type { AiModelProvider } from "@/lib/ai/models";
import { buildLandingDemoSystemPrompt } from "@/lib/ai/prompts";
import {
  checkRateLimit,
  createRateLimitExceededResponse,
  peekRateLimit,
} from "@/lib/ai/rate-limit";

export const DEFAULT_LANDING_AI_MODEL = "openai:gpt-5.6-luna";

export const LANDING_DEMO_MAX_OUTPUT_TOKENS = 220;

/** 10-minute sliding windows: per visitor IP, and across all visitors. */
export const LANDING_DEMO_RATE_LIMITS = {
  perClient: { limit: 30, window: 600 },
  global: { limit: 600, window: 600 },
} as const;

const RATE_LIMIT_SCOPE = "ai-landing-demo";
const GLOBAL_RATE_LIMIT_KEY = "global";
const UNKNOWN_CLIENT_KEY = "unknown";
const MAX_CLIENT_KEY_LENGTH = 64;
const MAX_BODY_BYTES = 16_384;

function serviceUnavailable(code: string) {
  return Response.json(
    { code },
    { status: 503, headers: { "Retry-After": "60" } },
  );
}

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[\da-f:.]{2,45}$/i;

function isIpAddress(value: string): boolean {
  return IPV4.test(value) || (value.includes(":") && IPV6.test(value));
}

/**
 * First `x-forwarded-for` hop (set by the reverse proxy), then `x-real-ip`.
 * Only well-formed addresses become keys: anything else, and clients without
 * either header, share one bucket that the global cap backs up. The header is
 * only as trustworthy as the ingress that writes it, so the global cap is the
 * real backstop against rotated keys.
 */
export function getClientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate =
    forwarded === undefined || forwarded === ""
      ? headers.get("x-real-ip")?.trim()
      : forwarded;
  if (
    candidate === undefined ||
    candidate === "" ||
    candidate.length > MAX_CLIENT_KEY_LENGTH ||
    !isIpAddress(candidate)
  ) {
    return UNKNOWN_CLIENT_KEY;
  }
  return candidate.toLowerCase();
}

export function parseLandingAiModel(
  value?: string,
): { provider: AiModelProvider; model: string } | null {
  const [provider, ...rest] = (value ?? DEFAULT_LANDING_AI_MODEL).split(":");
  const model = rest.join(":");
  if (
    (provider !== "openai" && provider !== "xai" && provider !== "anthropic") ||
    model === ""
  ) {
    return null;
  }
  return { provider, model };
}

class BodyTooLargeError extends Error {}

/**
 * Reads at most `MAX_BODY_BYTES`, cancelling the stream as soon as the cap is
 * crossed, so an oversized upload never buffers in full.
 */
async function readJsonBody(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    throw new BodyTooLargeError();
  }
  if (request.body === null) {
    throw new Error("Missing body");
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    received += value.byteLength;
    if (received > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

export async function handleLandingDemoRequest(
  request: Request,
): Promise<Response> {
  if (!env.NEXT_PUBLIC_AI_ENABLED) {
    return serviceUnavailable("ai_disabled");
  }
  const modelConfig = parseLandingAiModel(env.LANDING_AI_MODEL);
  if (modelConfig === null || !isAiProviderConfigured(modelConfig.provider)) {
    return serviceUnavailable("ai_model_unavailable");
  }

  // Limits are checked before the body is read, so an over-quota caller costs
  // nothing but a header lookup. The global cap is only peeked here: it is
  // consumed after the per-client check, so one noisy visitor is stopped by
  // their own bucket without allocating or eating into the shared allowance.
  const globalPeek = peekRateLimit(
    GLOBAL_RATE_LIMIT_KEY,
    RATE_LIMIT_SCOPE,
    LANDING_DEMO_RATE_LIMITS.global,
  );
  if (!globalPeek.allowed) {
    return createRateLimitExceededResponse(globalPeek);
  }
  const clientKey = getClientKey(request.headers);
  const clientPeek = peekRateLimit(
    clientKey,
    RATE_LIMIT_SCOPE,
    LANDING_DEMO_RATE_LIMITS.perClient,
  );
  if (!clientPeek.allowed) {
    return createRateLimitExceededResponse(clientPeek);
  }

  let rawBody: unknown;
  try {
    rawBody = await readJsonBody(request);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return Response.json({ code: "payload_too_large" }, { status: 413 });
    }
    return Response.json({ code: "invalid_json" }, { status: 400 });
  }
  const body = parseLandingDemoRequest(rawBody);
  if (body === null) {
    return Response.json({ code: "invalid_request" }, { status: 400 });
  }

  const clientLimit = checkRateLimit(
    clientKey,
    RATE_LIMIT_SCOPE,
    LANDING_DEMO_RATE_LIMITS.perClient,
  );
  if (!clientLimit.allowed) {
    return createRateLimitExceededResponse(clientLimit);
  }
  const globalLimit = checkRateLimit(
    GLOBAL_RATE_LIMIT_KEY,
    RATE_LIMIT_SCOPE,
    LANDING_DEMO_RATE_LIMITS.global,
  );
  if (!globalLimit.allowed) {
    return createRateLimitExceededResponse(globalLimit);
  }

  const model = getConfiguredAiModel(modelConfig.model, modelConfig.provider);
  const result = streamText({
    model,
    abortSignal: request.signal,
    system: buildLandingDemoSystemPrompt(PREVIEW_QUESTION),
    messages: body.messages,
    maxOutputTokens: LANDING_DEMO_MAX_OUTPUT_TOKENS,
    maxRetries: 0,
    // Luna-tier OpenAI models reason by default; keep it short so answers
    // start quickly and reasoning cannot eat the small output budget.
    // Other providers ignore OpenAI-scoped options.
    providerOptions: { openai: { reasoningEffort: "low" } },
    onError: ({ error }) => {
      console.error("Landing AI demo stream failed", error);
    },
  });
  return result.toTextStreamResponse({
    headers: { "Cache-Control": "no-store" },
  });
}
