import { streamText } from "ai";
import type { LanguageModel } from "ai";

import { env } from "@/env";
import { resolveImages } from "@/lib/ai/images";
import { getChatModelForUser } from "@/lib/ai/model";
import { isAiModel } from "@/lib/ai/models";
import {
  buildQuestionHintSystemPrompt,
  buildQuestionHintUserPrompt,
  collectQuestionImages,
} from "@/lib/ai/prompts";
import {
  checkRateLimit,
  createRateLimitExceededResponse,
  createRateLimitHeaders,
} from "@/lib/ai/rate-limit";
import { PermissionAction, hasPermission } from "@/lib/auth/permissions";
import { getServerCurrentUser } from "@/lib/auth/utils.server";
import type { Question } from "@/types/quiz";

export const maxDuration = 30;

export async function POST(request: Request) {
  if (!env.NEXT_PUBLIC_AI_ENABLED) {
    return new Response("AI is not configured", { status: 503 });
  }

  const user = await getServerCurrentUser();
  if (user == null) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!hasPermission(user.account_type, PermissionAction.AI_FEATURES)) {
    return new Response("AI features require a full account", { status: 403 });
  }

  const rateLimitResult = checkRateLimit(user.user_id, "ai-hint", {
    limit: env.AI_EXPLAIN_RATE_LIMIT,
    window: env.AI_EXPLAIN_RATE_WINDOW,
  });
  const rateLimitHeaders = createRateLimitHeaders(rateLimitResult);

  if (!rateLimitResult.allowed) {
    return createRateLimitExceededResponse(rateLimitResult);
  }

  const { question, config } = (await request.json()) as {
    question?: Question;
    config?: { modelName?: unknown };
  };

  if (question === undefined) {
    return new Response("Missing question", { status: 400 });
  }

  const imageParts = await resolveImages(collectQuestionImages(question));
  const prompt = buildQuestionHintUserPrompt(question);

  let model: LanguageModel;
  try {
    const aiModel = isAiModel(config?.modelName) ? config.modelName : undefined;
    model = getChatModelForUser({
      accountLevel: user.account_level,
      requestedModel: aiModel,
    });
  } catch (error) {
    console.error("Failed to resolve AI hint model", error);
    return new Response("AI model is not configured", { status: 503 });
  }

  const result = streamText({
    model,
    system: buildQuestionHintSystemPrompt(),
    prompt:
      imageParts.length > 0
        ? [
            {
              role: "user" as const,
              content: [...imageParts, { type: "text" as const, text: prompt }],
            },
          ]
        : prompt,
  });

  return result.toTextStreamResponse({
    headers: rateLimitHeaders,
  });
}
