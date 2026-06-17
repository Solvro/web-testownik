import { streamText } from "ai";

import { env } from "@/env";
import { resolveImages } from "@/lib/ai/images";
import { chatModel } from "@/lib/ai/model";
import {
  buildQuestionExplanationSystemPrompt,
  buildQuestionExplanationUserPrompt,
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
  if (!env.NEXT_PUBLIC_AI_ENABLED || env.OPENAI_API_KEY === undefined) {
    return new Response("AI is not configured", { status: 503 });
  }

  const user = await getServerCurrentUser();
  if (user == null) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!hasPermission(user.account_type, PermissionAction.AI_FEATURES)) {
    return new Response("AI features require a full account", { status: 403 });
  }

  const rateLimitResult = checkRateLimit(user.user_id, "ai-explain", {
    limit: env.AI_EXPLAIN_RATE_LIMIT,
    window: env.AI_EXPLAIN_RATE_WINDOW,
  });
  const rateLimitHeaders = createRateLimitHeaders(rateLimitResult);

  if (!rateLimitResult.allowed) {
    return createRateLimitExceededResponse(rateLimitResult);
  }

  const { question } = (await request.json()) as {
    question?: Question;
  };

  if (question === undefined) {
    return new Response("Missing question", { status: 400 });
  }

  const imageParts = await resolveImages(collectQuestionImages(question));
  const prompt = buildQuestionExplanationUserPrompt(question);

  const result = streamText({
    model: chatModel,
    system: buildQuestionExplanationSystemPrompt(),
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
