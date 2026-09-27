import type { AIUsageWindow } from "@/types/ai-usage";

export const AI_RESPONSE_HEADERS = {
  limitType: "X-AI-Limit-Type",
  model: "X-AI-Model",
  quotaTier: "X-AI-Quota-Tier",
  fallbackResetAt: "X-AI-Fallback-Reset-At",
  retryAfter: "Retry-After",
} as const;

export interface QuotaExceededBody {
  code: "ai_quota_exceeded";
  exceeded_window: "session" | "weekly" | "input" | "fallback_throttle" | null;
  resets_at: string | null;
  usage: {
    session: AIUsageWindow;
    weekly: AIUsageWindow;
  };
}

export async function parseQuotaExceededResponse(response: Response) {
  if (
    response.status !== 429 ||
    response.headers.get(AI_RESPONSE_HEADERS.limitType) !== "quota"
  ) {
    return null;
  }
  try {
    const body = (await response.clone().json()) as Partial<QuotaExceededBody>;
    return body.code === "ai_quota_exceeded"
      ? (body as QuotaExceededBody)
      : null;
  } catch {
    return null;
  }
}
