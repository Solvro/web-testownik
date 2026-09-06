import { streamText } from "ai";
import "server-only";

import { resolveImages } from "@/lib/ai/images";
import { collectQuestionImages } from "@/lib/ai/prompts";
import { estimateJsonTokens, isQuestion } from "@/lib/ai/request-validation";
import { withAiRoute } from "@/lib/ai/route.server";
import { buildUsageCallbacks } from "@/lib/ai/usage.server";
import type { UsageReportPayload } from "@/lib/ai/usage.server";
import type { Question } from "@/types/quiz";

interface QuestionBody {
  question: Question;
  config?: { modelName?: unknown };
}

interface QuestionRouteOptions {
  scope: Extract<UsageReportPayload["scope"], "explain" | "hint">;
  buildSystemPrompt: () => string;
  buildUserPrompt: (question: Question) => string;
}

function parseQuestionBody(value: unknown): QuestionBody | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("question" in value) ||
    !isQuestion(value.question)
  ) {
    return null;
  }
  return value as QuestionBody;
}

export function createQuestionCompletionRoute(options: QuestionRouteOptions) {
  return async (request: Request) =>
    await withAiRoute(
      {
        request,
        scope: options.scope,
        parseBody: parseQuestionBody,
        requestedModel: ({ config }) =>
          typeof config?.modelName === "string" && config.modelName !== ""
            ? config.modelName
            : undefined,
        estimateInputTokens: ({ question }) => estimateJsonTokens(question),
        prepare: async ({ question }, signal) =>
          await resolveImages(collectQuestionImages(question), signal),
      },
      ({
        body: { question },
        model,
        quota,
        selectedModel,
        signal,
        user,
        prepared: imageParts,
      }) => {
        const prompt = options.buildUserPrompt(question);
        const usageCallbacks = buildUsageCallbacks({
          payload: {
            user_id: user.user_id,
            scope: options.scope,
            model: selectedModel,
            fallback_grant_id: quota.fallback_grant_id ?? undefined,
          },
          requestId: crypto.randomUUID(),
          startedAt: Date.now(),
        });
        const result = streamText({
          model,
          abortSignal: signal,
          system: options.buildSystemPrompt(),
          prompt:
            imageParts.length > 0
              ? [
                  {
                    role: "user" as const,
                    content: [
                      ...imageParts,
                      { type: "text" as const, text: prompt },
                    ],
                  },
                ]
              : prompt,
          maxOutputTokens: quota.suggested_max_output_tokens,
          ...usageCallbacks,
        });
        return result.toTextStreamResponse();
      },
    );
}
