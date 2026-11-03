import type { LanguageModel } from "ai";
import "server-only";

import { env } from "@/env";
import { getConfiguredAiModel, isAiProviderConfigured } from "@/lib/ai/model";
import { AI_RESPONSE_HEADERS } from "@/lib/ai/quota";
import {
  AIUsageAccessError,
  checkQuota,
  createQuotaExceededResponse,
} from "@/lib/ai/usage.server";
import type {
  QuotaCheckResult,
  UsageReportPayload,
} from "@/lib/ai/usage.server";
import { PermissionAction, hasPermission } from "@/lib/auth/permissions";
import type { JWTPayload } from "@/lib/auth/types";
import { getServerCurrentUser } from "@/lib/auth/utils.server";

interface AiRouteContext<TBody, TPrepared> {
  body: TBody;
  model: LanguageModel;
  provider: string;
  quota: QuotaCheckResult;
  selectedModel: string;
  user: JWTPayload;
  prepared: TPrepared;
  signal: AbortSignal;
}

interface AiRouteOptions<TBody, TPrepared> {
  request: Request;
  scope: UsageReportPayload["scope"];
  parseBody: (value: unknown) => TBody | null;
  requestedModel: (body: TBody) => string | undefined;
  estimateInputTokens: (body: TBody) => number;
  prepare?: (body: TBody, signal: AbortSignal) => Promise<TPrepared>;
}

function jsonServiceUnavailable(code: string, message: string) {
  return Response.json(
    { code, message },
    { status: 503, headers: { [AI_RESPONSE_HEADERS.retryAfter]: "30" } },
  );
}

function withRouteHeaders(
  response: Response,
  headers: Record<string, string>,
): Response {
  const mergedHeaders = new Headers(response.headers);
  for (const [name, value] of Object.entries(headers)) {
    mergedHeaders.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: mergedHeaders,
  });
}

export async function withAiRoute<TBody, TPrepared = undefined>(
  options: AiRouteOptions<TBody, TPrepared>,
  handler: (
    context: AiRouteContext<TBody, TPrepared>,
  ) => Promise<Response> | Response,
): Promise<Response> {
  if (!env.NEXT_PUBLIC_AI_ENABLED) {
    return jsonServiceUnavailable("ai_disabled", "AI is not configured");
  }

  const user = await getServerCurrentUser();
  if (user === null) {
    return Response.json({ code: "unauthorized" }, { status: 401 });
  }
  if (!hasPermission(user.account_type, PermissionAction.AI_FEATURES)) {
    return Response.json({ code: "ai_access_required" }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await options.request.json();
  } catch {
    return Response.json({ code: "invalid_json" }, { status: 400 });
  }
  const body = options.parseBody(rawBody);
  if (body === null) {
    return Response.json({ code: "invalid_request" }, { status: 400 });
  }

  const availableProviders = (["openai", "xai", "anthropic"] as const).filter(
    isAiProviderConfigured,
  );
  if (availableProviders.length === 0) {
    return jsonServiceUnavailable(
      "ai_model_unavailable",
      "No AI provider is configured",
    );
  }
  const estimatedInputTokens = options.estimateInputTokens(body);
  let quota: QuotaCheckResult;
  try {
    quota = await checkQuota(user.user_id, {
      estimatedInputTokens,
      scope: options.scope,
      requestedModel: options.requestedModel(body),
      availableProviders,
    });
  } catch (error) {
    if (error instanceof AIUsageAccessError) {
      return Response.json({ code: error.code }, { status: 403 });
    }
    return jsonServiceUnavailable(
      "ai_usage_unavailable",
      "AI usage service is temporarily unavailable",
    );
  }
  if (!quota.allowed) {
    return createQuotaExceededResponse(quota);
  }

  let prepared: TPrepared;
  try {
    const preparedPromise = options.prepare?.(body, options.request.signal);
    prepared =
      preparedPromise === undefined
        ? (undefined as TPrepared)
        : await preparedPromise;
  } catch (error) {
    console.error("Failed to prepare AI request", error);
    return Response.json({ code: "invalid_request_content" }, { status: 400 });
  }

  const selectedModel = quota.resolved_model;
  const provider = quota.resolved_provider;
  if (selectedModel === null || provider === null) {
    return jsonServiceUnavailable(
      "ai_model_contract_invalid",
      "AI model resolution is temporarily unavailable",
    );
  }
  const validResolution =
    quota.quota_tier === "fallback"
      ? selectedModel === quota.fallback_model
      : availableProviders.includes(
          provider as (typeof availableProviders)[number],
        );
  if (!validResolution) {
    return jsonServiceUnavailable(
      "ai_model_contract_invalid",
      "AI model resolution is temporarily unavailable",
    );
  }

  let model: LanguageModel;
  try {
    model = getConfiguredAiModel(selectedModel, provider);
  } catch (error) {
    console.error("Failed to configure resolved AI model", error);
    return jsonServiceUnavailable(
      "ai_model_unavailable",
      "AI model is not configured",
    );
  }

  const response = await handler({
    body,
    model,
    provider,
    quota,
    selectedModel,
    user,
    prepared,
    signal: options.request.signal,
  });
  return withRouteHeaders(response, {
    [AI_RESPONSE_HEADERS.model]: selectedModel,
    [AI_RESPONSE_HEADERS.quotaTier]: quota.quota_tier,
    ...(quota.fallback_resets_at === null
      ? {}
      : {
          [AI_RESPONSE_HEADERS.fallbackResetAt]: quota.fallback_resets_at,
        }),
  });
}
