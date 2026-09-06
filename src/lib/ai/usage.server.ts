import { after } from "next/server";
import "server-only";

import { env } from "@/env";
import { AI_RESPONSE_HEADERS } from "@/lib/ai/quota";
import { API_URL } from "@/lib/api";
import type { AIUsageWindow } from "@/types/ai-usage";

export interface QuotaCheckResult {
  allowed: boolean;
  would_block: boolean;
  limits_enabled: boolean;
  exceeded_window:
    | "session"
    | "weekly"
    | "input"
    | "fallback_throttle"
    | "model_unavailable"
    | null;
  resets_at: string | null;
  suggested_max_output_tokens: number;
  quota_tier: "normal" | "fallback";
  fallback_model: string | null;
  fallback_grant_id: string | null;
  fallback_resets_at: string | null;
  resolved_model: string | null;
  resolved_provider: string | null;
  active_models: string[];
  usage: {
    session: AIUsageWindow;
    weekly: AIUsageWindow;
  };
}

export type { QuotaExceededBody } from "@/lib/ai/quota";

export class AIUsageAccessError extends Error {
  constructor(readonly code: "account_disabled" | "ai_disabled") {
    super(code);
  }
}

export interface UsageReportPayload {
  user_id: string;
  scope: "chat" | "explain" | "hint" | "quiz_generation";
  model: string;
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  request_id: string;
  conversation_id?: string;
  quiz_id?: string;
  aborted?: boolean;
  finish_reason?: string;
  error?: string;
  latency_ms?: number;
  fallback_grant_id?: string;
  metadata?: Record<string, unknown>;
  messages?: unknown[];
}

interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  inputTokenDetails?: {
    noCacheTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
}

interface UsageCallbackResult {
  totalUsage: TokenUsage;
  finishReason: string;
  text?: string;
  toolCalls?: readonly unknown[];
}

interface UsageCallbackStep {
  usage: TokenUsage;
}

type UsageReportBase = Omit<
  UsageReportPayload,
  | "request_id"
  | "input_tokens"
  | "output_tokens"
  | "cache_read_tokens"
  | "cache_write_tokens"
  | "aborted"
  | "finish_reason"
  | "error"
  | "latency_ms"
>;

function usageTokens(usage: TokenUsage) {
  const cacheReadTokens = usage.inputTokenDetails?.cacheReadTokens ?? 0;
  const cacheWriteTokens = usage.inputTokenDetails?.cacheWriteTokens ?? 0;
  return {
    input_tokens:
      usage.inputTokenDetails?.noCacheTokens ??
      Math.max(
        0,
        (usage.inputTokens ?? 0) - cacheReadTokens - cacheWriteTokens,
      ),
    output_tokens: usage.outputTokens ?? 0,
    cache_read_tokens: cacheReadTokens,
    cache_write_tokens: cacheWriteTokens,
  };
}

export function buildUsageCallbacks({
  payload,
  requestId,
  startedAt,
  finishExtras,
}: {
  payload: UsageReportBase;
  requestId: string;
  startedAt: number;
  finishExtras?: (result: UsageCallbackResult) => Partial<UsageReportPayload>;
}) {
  let errorMessage = "";
  let terminalReportScheduled = false;
  const scheduleOnce = (report: () => UsageReportPayload) => {
    if (terminalReportScheduled) {
      return;
    }
    terminalReportScheduled = true;
    after(async () => {
      await reportUsage(report());
    });
  };
  return {
    onError: ({ error }: { error: unknown }) => {
      errorMessage = error instanceof Error ? error.message : String(error);
      after(async () => {
        if (terminalReportScheduled) {
          return;
        }
        terminalReportScheduled = true;
        await reportUsage({
          ...payload,
          request_id: requestId,
          finish_reason: "error",
          error: errorMessage,
          latency_ms: Date.now() - startedAt,
        });
      });
    },
    onFinish: (result: UsageCallbackResult) => {
      scheduleOnce(() => ({
        ...payload,
        ...usageTokens(result.totalUsage),
        request_id: requestId,
        finish_reason: result.finishReason,
        error: errorMessage,
        latency_ms: Date.now() - startedAt,
        ...finishExtras?.(result),
      }));
    },
    onAbort: ({ steps }: { steps: readonly UsageCallbackStep[] }) => {
      const totals = steps.reduce(
        (sum, step) => {
          const current = usageTokens(step.usage);
          return {
            input_tokens: sum.input_tokens + current.input_tokens,
            output_tokens: sum.output_tokens + current.output_tokens,
            cache_read_tokens:
              sum.cache_read_tokens + current.cache_read_tokens,
            cache_write_tokens:
              sum.cache_write_tokens + current.cache_write_tokens,
          };
        },
        {
          input_tokens: 0,
          output_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
        },
      );
      scheduleOnce(() => ({
        ...payload,
        ...totals,
        request_id: requestId,
        aborted: true,
        finish_reason: "abort",
        latency_ms: Date.now() - startedAt,
      }));
    },
  };
}

function internalHeaders(): HeadersInit {
  if (env.INTERNAL_API_KEY === undefined) {
    throw new Error("INTERNAL_API_KEY is not configured");
  }
  return {
    "Api-Key": env.INTERNAL_API_KEY,
    "Content-Type": "application/json",
  };
}

export async function checkQuota(
  userId: string,
  options: {
    estimatedInputTokens?: number;
    scope?: UsageReportPayload["scope"];
    requestedModel?: string;
    availableProviders?: readonly string[];
  } = {},
): Promise<QuotaCheckResult> {
  try {
    const response = await fetch(`${API_URL}/ai/usage/check/`, {
      method: "POST",
      headers: internalHeaders(),
      body: JSON.stringify({
        user_id: userId,
        estimated_input_tokens: options.estimatedInputTokens,
        scope: options.scope,
        requested_model: options.requestedModel,
        available_providers: options.availableProviders,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 403) {
      const body = (await response.json()) as { code?: string };
      throw new AIUsageAccessError(
        body.code === "account_disabled" ? "account_disabled" : "ai_disabled",
      );
    }
    if (![200, 409, 429].includes(response.status)) {
      throw new Error(`Quota check failed (${response.status.toString()})`);
    }
    return (await response.json()) as QuotaCheckResult;
  } catch (error) {
    if (error instanceof AIUsageAccessError) {
      throw error;
    }
    console.error("AI quota check unavailable", error);
    throw error;
  }
}

export async function reportUsage(payload: UsageReportPayload): Promise<void> {
  let reportPayload = payload;
  let failures = 0;
  let strippedContext = false;
  while (failures < 2) {
    try {
      const response = await fetch(`${API_URL}/ai/usage/report/`, {
        method: "POST",
        headers: internalHeaders(),
        body: JSON.stringify(reportPayload),
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (
        response.status === 400 &&
        !strippedContext &&
        (reportPayload.conversation_id !== undefined ||
          reportPayload.quiz_id !== undefined ||
          reportPayload.messages !== undefined)
      ) {
        const {
          conversation_id: _conversationId,
          quiz_id: _quizId,
          messages: _messages,
          ...billingOnlyPayload
        } = reportPayload;
        reportPayload = billingOnlyPayload;
        strippedContext = true;
        continue;
      }
      if (!response.ok) {
        throw new Error(`Usage report failed (${response.status.toString()})`);
      }
      return;
    } catch (error) {
      failures += 1;
      if (failures === 2) {
        console.error("AI usage report failed", error);
      }
    }
  }
}

export function createQuotaExceededResponse(quota: QuotaCheckResult) {
  if (quota.exceeded_window === "model_unavailable") {
    return Response.json(
      { code: "ai_model_unavailable", active_models: quota.active_models },
      { status: 503 },
    );
  }
  const retryAfter =
    quota.resets_at === null
      ? 60
      : Math.max(
          1,
          Math.ceil((new Date(quota.resets_at).getTime() - Date.now()) / 1000),
        );
  return Response.json(
    {
      code: "ai_quota_exceeded",
      exceeded_window: quota.exceeded_window,
      resets_at: quota.resets_at,
      usage: quota.usage,
    },
    {
      status: 429,
      headers: {
        [AI_RESPONSE_HEADERS.retryAfter]: retryAfter.toString(),
        [AI_RESPONSE_HEADERS.limitType]: "quota",
      },
    },
  );
}
