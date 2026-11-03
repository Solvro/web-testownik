import type { Question } from "@testownik/core/quiz/types";
import { stepCountIs, streamText } from "ai";
import "server-only";

import {
  LANDING_DEMO_CHAT_LIMITS,
  LANDING_DEMO_CHAT_TOOL_LIMITS,
  parseLandingDemoChatRequest,
} from "@/app/(landing)/lib/landing-demo-chat";
import { buildLandingDemoChatSystemPrompt } from "@/app/(landing)/lib/landing-demo-prompts";
import {
  LANDING_DEMO_PROVIDER_OPTIONS,
  admitLandingDemoRequest,
} from "@/app/(landing)/lib/landing-demo.server";
import { buildChatModelMessages } from "@/lib/ai/chat-messages";
import { buildEditQuestionTool, buildQuizTools } from "@/lib/ai/chat-tools";
import type { ChatToolLimits } from "@/lib/ai/chat-tools";

/** Room for a short answer or a few generated questions per step. */
export const LANDING_DEMO_CHAT_MAX_OUTPUT_TOKENS = 800;

/** A tool call and the answer that follows it, and one step to spare. */
export const LANDING_DEMO_CHAT_MAX_STEPS = 3;

/** The visitor owns their copy of the quiz, so it can be edited; no `disable_ai`. */
export function buildLandingDemoChatTools(questions: Question[]) {
  const limits: ChatToolLimits = {
    defaultListQuestions: LANDING_DEMO_CHAT_TOOL_LIMITS.maxListQuestions,
    maxListQuestions: LANDING_DEMO_CHAT_TOOL_LIMITS.maxListQuestions,
    listPreviewLength: LANDING_DEMO_CHAT_TOOL_LIMITS.maxListPreviewLength,
    maxQuestionTextLength: LANDING_DEMO_CHAT_TOOL_LIMITS.maxQuestionTextLength,
    maxAnswers: LANDING_DEMO_CHAT_TOOL_LIMITS.maxAnswers,
    maxAnswerTextLength: LANDING_DEMO_CHAT_TOOL_LIMITS.maxAnswerTextLength,
    maxExplanationLength: LANDING_DEMO_CHAT_TOOL_LIMITS.maxExplanationLength,
  };
  return {
    ...buildQuizTools(questions, limits),
    edit_question: buildEditQuestionTool(),
  };
}

/**
 * The same prompt, messages and tools as `/ai/chat`, on the landing model and
 * the demo's rate limits. The quiz arrives with the request; its images are
 * never fetched.
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

  let modelMessages;
  try {
    modelMessages = await buildChatModelMessages({
      messages,
      chatQuestion: question,
      chatQuestions: questions,
      questionContextSnapshots,
      resolveQuestionImages: async () => {
        await Promise.resolve();
        return [];
      },
    });
  } catch {
    // The history did not convert (a malformed tool part).
    return Response.json({ code: "invalid_request" }, { status: 400 });
  }

  const result = streamText({
    model: admission.model,
    abortSignal: request.signal,
    system: buildLandingDemoChatSystemPrompt(questions.length),
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
