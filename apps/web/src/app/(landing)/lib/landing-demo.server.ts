import { streamText } from "ai";
import "server-only";

import { parseLandingDemoRequest } from "@/app/(landing)/lib/landing-demo";
import { buildLandingDemoSystemPrompt } from "@/app/(landing)/lib/landing-demo-prompts";
import {
  checkRateLimit,
  createRateLimitExceededResponse,
  peekRateLimit,
  releaseRateLimit,
} from "@/app/(landing)/lib/rate-limit";
import { PREVIEW_QUESTION } from "@/app/(landing)/preview/preview-fixtures";
import { env } from "@/env";
import { getConfiguredAiModel, isAiProviderConfigured } from "@/lib/ai/model";
import type { AiModelProvider } from "@/lib/ai/models";

export const DEFAULT_LANDING_AI_MODEL = "openai:gpt-5.6-luna";

export const LANDING_DEMO_MAX_OUTPUT_TOKENS = 220;

/** 10-minute sliding windows: per visitor IP, and across all visitors. */
export const LANDING_DEMO_RATE_LIMITS = {
  perClient: { limit: 30, window: 600 },
  global: { limit: 600, window: 600, nonEvictable: true },
} as const;

const RATE_LIMIT_SCOPE = "ai-landing-demo";
const GLOBAL_RATE_LIMIT_KEY = "global";
const UNKNOWN_CLIENT_KEY = "unknown";
const MAX_CLIENT_KEY_LENGTH = 64;
/** The plain demo's body; the demo chat sets its own. */
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
 * Reads at most `maxBytes`, cancelling the stream as soon as the cap is
 * crossed, so an oversized upload never buffers in full.
 */
async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) {
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
    if (received > maxBytes) {
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

export type LandingDemoAdmission<Body> =
  | { admitted: false; response: Response }
  | {
      admitted: true;
      body: Body;
      model: ReturnType<typeof getConfiguredAiModel>;
    };

/**
 * Everything a public demo endpoint does before it calls the model: AI and
 * the landing model must be available, the caller and all visitors together
 * must be within `LANDING_DEMO_RATE_LIMITS`, and the body must fit
 * `maxBodyBytes` and `parse`. Every demo endpoint draws on the same per-IP
 * and global budget, so a visitor has one allowance whichever they use.
 *
 * Limits are checked before the body is read, so an over-quota caller costs
 * nothing but a header lookup. The global cap is only peeked then: it is
 * reserved again after body parsing, before allocating any client state.
 * The reservation and client check run synchronously; a client rejection
 * releases the reservation. Requests rejected for their body do not count.
 */
export async function admitLandingDemoRequest<Body>(
  request: Request,
  {
    maxBodyBytes,
    parse,
  }: { maxBodyBytes: number; parse: (value: unknown) => Body | null },
): Promise<LandingDemoAdmission<Body>> {
  const reject = (response: Response): LandingDemoAdmission<Body> => ({
    admitted: false,
    response,
  });
  if (!env.NEXT_PUBLIC_AI_ENABLED) {
    return reject(serviceUnavailable("ai_disabled"));
  }
  const modelConfig = parseLandingAiModel(env.LANDING_AI_MODEL);
  if (modelConfig === null || !isAiProviderConfigured(modelConfig.provider)) {
    return reject(serviceUnavailable("ai_model_unavailable"));
  }

  const globalPeek = peekRateLimit(
    GLOBAL_RATE_LIMIT_KEY,
    RATE_LIMIT_SCOPE,
    LANDING_DEMO_RATE_LIMITS.global,
  );
  if (!globalPeek.allowed) {
    return reject(createRateLimitExceededResponse(globalPeek));
  }
  const clientKey = getClientKey(request.headers);
  const clientPeek = peekRateLimit(
    clientKey,
    RATE_LIMIT_SCOPE,
    LANDING_DEMO_RATE_LIMITS.perClient,
  );
  if (!clientPeek.allowed) {
    return reject(createRateLimitExceededResponse(clientPeek));
  }

  let rawBody: unknown;
  try {
    rawBody = await readJsonBody(request, maxBodyBytes);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return reject(
        Response.json({ code: "payload_too_large" }, { status: 413 }),
      );
    }
    return reject(Response.json({ code: "invalid_json" }, { status: 400 }));
  }
  const body = parse(rawBody);
  if (body === null) {
    return reject(Response.json({ code: "invalid_request" }, { status: 400 }));
  }

  // No awaits between reserving the global budget and checking the client:
  // deferred bodies must re-check quota, and rejected clients return it intact.
  const globalLimit = checkRateLimit(
    GLOBAL_RATE_LIMIT_KEY,
    RATE_LIMIT_SCOPE,
    LANDING_DEMO_RATE_LIMITS.global,
  );
  if (!globalLimit.allowed) {
    return reject(createRateLimitExceededResponse(globalLimit));
  }
  const clientLimit = checkRateLimit(
    clientKey,
    RATE_LIMIT_SCOPE,
    LANDING_DEMO_RATE_LIMITS.perClient,
  );
  if (!clientLimit.allowed) {
    releaseRateLimit(
      GLOBAL_RATE_LIMIT_KEY,
      RATE_LIMIT_SCOPE,
      LANDING_DEMO_RATE_LIMITS.global,
    );
    return reject(createRateLimitExceededResponse(clientLimit));
  }

  return {
    admitted: true,
    body,
    model: getConfiguredAiModel(modelConfig.model, modelConfig.provider),
  };
}

/**
 * Luna-tier OpenAI models reason by default; keep it short so answers start
 * quickly and reasoning cannot eat the small output budget. Other providers
 * ignore OpenAI-scoped options.
 */
export const LANDING_DEMO_PROVIDER_OPTIONS = {
  openai: { reasoningEffort: "low" },
} as const;

export async function handleLandingDemoRequest(
  request: Request,
): Promise<Response> {
  const admission = await admitLandingDemoRequest(request, {
    maxBodyBytes: MAX_BODY_BYTES,
    parse: parseLandingDemoRequest,
  });
  if (!admission.admitted) {
    return admission.response;
  }

  const result = streamText({
    model: admission.model,
    abortSignal: request.signal,
    system: buildLandingDemoSystemPrompt(PREVIEW_QUESTION),
    messages: admission.body.messages,
    maxOutputTokens: LANDING_DEMO_MAX_OUTPUT_TOKENS,
    maxRetries: 0,
    providerOptions: LANDING_DEMO_PROVIDER_OPTIONS,
    onError: ({ error }) => {
      console.error("Landing AI demo stream failed", error);
    },
  });
  return result.toTextStreamResponse({
    headers: { "Cache-Control": "no-store" },
  });
}
