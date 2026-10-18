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
} from "@/lib/ai/rate-limit";

export const DEFAULT_LANDING_AI_MODEL = "openai:gpt-5.6-luna";

export const LANDING_DEMO_MAX_OUTPUT_TOKENS = 220;

/** 10-minute sliding windows: per visitor IP, and across all visitors. */
export const LANDING_DEMO_RATE_LIMITS = {
  perClient: { limit: 8, window: 600 },
  global: { limit: 120, window: 600 },
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

/**
 * First `x-forwarded-for` hop (set by the reverse proxy), then `x-real-ip`.
 * Clients without either share one bucket, which the global cap backs up.
 */
export function getClientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate =
    forwarded === undefined || forwarded === ""
      ? headers.get("x-real-ip")?.trim()
      : forwarded;
  if (candidate === undefined || candidate === "") {
    return UNKNOWN_CLIENT_KEY;
  }
  return candidate.toLowerCase().slice(0, MAX_CLIENT_KEY_LENGTH);
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

async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new Error("Request body too large");
  }
  return JSON.parse(text) as unknown;
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

  let rawBody: unknown;
  try {
    rawBody = await readJsonBody(request);
  } catch {
    return Response.json({ code: "invalid_json" }, { status: 400 });
  }
  const body = parseLandingDemoRequest(rawBody);
  if (body === null) {
    return Response.json({ code: "invalid_request" }, { status: 400 });
  }

  // Per-client first, so one noisy visitor is stopped by their own bucket
  // without eating into the shared global allowance.
  const clientLimit = checkRateLimit(
    getClientKey(request.headers),
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
