import { stepCountIs, streamText } from "ai";
import "server-only";

import { PREVIEW_QUIZ } from "@/components/testownik-preview/preview-fixtures";
import { buildChatModelMessages } from "@/lib/ai/chat-messages";
import { buildLandingDemoChatTools } from "@/lib/ai/chat-tools";
import {
  LANDING_DEMO_CHAT_LIMITS,
  parseLandingDemoChatRequest,
} from "@/lib/ai/landing-demo-chat";
import {
  LANDING_DEMO_PROVIDER_OPTIONS,
  admitLandingDemoRequest,
} from "@/lib/ai/landing-demo.server";
import { buildChatSystemPrompt } from "@/lib/ai/prompts";
import { estimateJsonTokens } from "@/lib/ai/request-validation";

export const LANDING_DEMO_CHAT_MAX_INPUT_TOKENS = 6000;

/** Room for a short answer or a few generated questions per step. */
export const LANDING_DEMO_CHAT_MAX_OUTPUT_TOKENS = 800;

/** A tool call and the answer that follows it, and one step to spare. */
export const LANDING_DEMO_CHAT_MAX_STEPS = 3;

/**
 * The app's assistant on the landing page's sample quiz, for anonymous
 * visitors: the same prompt, message building and tools as `/ai/chat`
 * (without `disable_ai`), on the landing model and the demo's rate limits
 * instead of an account's quota. The quiz is the visitor's local copy, so
 * its questions arrive with the request; question images are never fetched.
 */
export async function handleLandingDemoChatRequest(
  request: Request,
): Promise<Response> {
  const admission = await admitLandingDemoRequest(request, {
    maxBodyBytes: LANDING_DEMO_CHAT_LIMITS.maxBodyBytes,
    parse: parseLandingDemoChatRequest,
  });
  if (!admission.admitted) {
    return admission.response;
  }
  const { messages, question, questions, questionContextSnapshots } =
    admission.body;

  const system = buildChatSystemPrompt(
    { title: PREVIEW_QUIZ.title, description: PREVIEW_QUIZ.description },
    questions.length,
    undefined,
    true,
    true,
  );
  let recentMessages = messages;
  let modelMessages;
  try {
    for (;;) {
      const recentIds = new Set(recentMessages.map((message) => message.id));
      modelMessages = await buildChatModelMessages({
        messages: recentMessages,
        chatQuestion: question,
        chatQuestions: questions,
        questionContextSnapshots: questionContextSnapshots.filter((snapshot) =>
          recentIds.has(snapshot.messageId),
        ),
        resolveQuestionImages: async () => {
          await Promise.resolve();
          return [];
        },
      });
      if (
        estimateJsonTokens({ system, messages: modelMessages }) <=
        LANDING_DEMO_CHAT_MAX_INPUT_TOKENS
      ) {
        break;
      }
      // Drop a complete old turn, leaving the most recent request intact.
      const nextUserIndex = recentMessages.findIndex(
        (message, index) => index > 0 && message.role === "user",
      );
      if (nextUserIndex === -1) {
        return Response.json(
          { code: "model_input_too_large" },
          { status: 413 },
        );
      }
      recentMessages = recentMessages.slice(nextUserIndex);
    }
  } catch {
    // The history did not convert (a malformed tool part).
    return Response.json({ code: "invalid_request" }, { status: 400 });
  }

  const result = streamText({
    model: admission.model,
    abortSignal: request.signal,
    system,
    messages: modelMessages,
    stopWhen: stepCountIs(LANDING_DEMO_CHAT_MAX_STEPS),
    maxOutputTokens: LANDING_DEMO_CHAT_MAX_OUTPUT_TOKENS,
    maxRetries: 0,
    providerOptions: LANDING_DEMO_PROVIDER_OPTIONS,
    tools: buildLandingDemoChatTools(questions),
    onError: ({ error }) => {
      console.error("Landing AI demo chat stream failed", error);
    },
  });
  return result.toUIMessageStreamResponse({
    headers: { "Cache-Control": "no-store" },
  });
}
