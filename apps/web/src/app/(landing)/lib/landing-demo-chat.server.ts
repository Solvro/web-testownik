import type { Question } from "@testownik/core/quiz/types";
import type { ModelMessage } from "ai";
import { stepCountIs, streamText } from "ai";
import "server-only";
import { z } from "zod";

import {
  LANDING_DEMO_CHAT_LIMITS,
  LANDING_DEMO_CHAT_TOOL_LIMITS,
  parseLandingDemoChatRequest,
} from "@/app/(landing)/lib/landing-demo-chat";
import { buildLandingDemoChatSystemPrompt } from "@/app/(landing)/lib/landing-demo-prompts";
import { getLandingDemoTokenCounter } from "@/app/(landing)/lib/landing-demo-tokenizer.server";
import {
  LANDING_DEMO_PROVIDER_OPTIONS,
  admitLandingDemoRequest,
} from "@/app/(landing)/lib/landing-demo.server";
import { buildChatModelMessages } from "@/lib/ai/chat-messages";
import { buildEditQuestionTool, buildQuizTools } from "@/lib/ai/chat-tools";
import type { ChatToolLimits } from "@/lib/ai/chat-tools";

export const LANDING_DEMO_CHAT_MAX_INPUT_TOKENS = 6000;

/** Room for a short answer or a few generated questions per step. */
export const LANDING_DEMO_CHAT_MAX_OUTPUT_TOKENS = 800;

/** A tool call and the answer that follows it, and one step to spare. */
export const LANDING_DEMO_CHAT_MAX_STEPS = 3;

/**
 * The app chat's tools on the visitor's copy of the sample quiz, with results
 * bounded in tokens. The visitor owns that copy, so it can be edited; there
 * are no settings to switch AI off in, so no `disable_ai`.
 */
export function buildLandingDemoChatTools(
  questions: Question[],
  countTokens: (text: string) => number,
) {
  const limits: ChatToolLimits = {
    defaultListQuestions: LANDING_DEMO_CHAT_TOOL_LIMITS.maxListQuestions,
    maxListQuestions: LANDING_DEMO_CHAT_TOOL_LIMITS.maxListQuestions,
    listPreviewLength: LANDING_DEMO_CHAT_TOOL_LIMITS.maxListPreviewLength,
    maxQuestionTextLength: LANDING_DEMO_CHAT_TOOL_LIMITS.maxQuestionTextLength,
    maxAnswers: LANDING_DEMO_CHAT_TOOL_LIMITS.maxAnswers,
    maxAnswerTextLength: LANDING_DEMO_CHAT_TOOL_LIMITS.maxAnswerTextLength,
    maxExplanationLength: LANDING_DEMO_CHAT_TOOL_LIMITS.maxExplanationLength,
    maxOutput: {
      tokens: LANDING_DEMO_CHAT_TOOL_LIMITS.maxOutputTokens,
      countTokens,
    },
  };
  return {
    ...buildQuizTools(questions, limits),
    edit_question: buildEditQuestionTool(limits),
  };
}

// These schemas do not depend on the visitor's quiz. Count them once with the
// same cached counter used for the prompt, history and tool output bounds.
let toolSchemaTokens: number | undefined;

async function createInputTokenCounter(questionCount: number) {
  const countText = await getLandingDemoTokenCounter();
  toolSchemaTokens ??= countText(
    JSON.stringify(
      Object.entries(buildLandingDemoChatTools([], countText)).map(
        ([name, tool]) => ({
          type: "function",
          name,
          description: tool.description,
          inputSchema: z.toJSONSchema(tool.inputSchema, {
            target: "draft-7",
            io: "input",
          }),
        }),
      ),
    ),
  );
  const fixedTokens =
    toolSchemaTokens +
    countText(buildLandingDemoChatSystemPrompt(questionCount)) +
    4;
  return (messages: ModelMessage[]) =>
    fixedTokens +
    messages.reduce((total, message) => {
      const contentTokens =
        typeof message.content === "string"
          ? countText(message.content)
          : message.content.reduce(
              (sum, part) =>
                sum +
                countText(
                  part.type === "text" || part.type === "reasoning"
                    ? part.text
                    : JSON.stringify(part),
                ),
              0,
            );
      // Include serialized tool calls/results as well as every text part.
      return total + contentTokens + 4;
    }, 0);
}

export async function countLandingDemoChatInputTokens(
  messages: ModelMessage[],
  questionCount: number = LANDING_DEMO_CHAT_LIMITS.maxQuestions,
): Promise<number> {
  return (await createInputTokenCounter(questionCount))(messages);
}

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

  const system = buildLandingDemoChatSystemPrompt(questions.length);
  const countInputTokens = await createInputTokenCounter(questions.length);
  const countText = await getLandingDemoTokenCounter();
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
        countInputTokens(modelMessages) <= LANDING_DEMO_CHAT_MAX_INPUT_TOKENS
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
    stopWhen: [
      stepCountIs(LANDING_DEMO_CHAT_MAX_STEPS),
      ({ steps }) =>
        countInputTokens([
          ...modelMessages,
          ...(steps.at(-1)?.response.messages ?? []),
        ]) > LANDING_DEMO_CHAT_MAX_INPUT_TOKENS,
    ],
    prepareStep: ({ messages: stepMessages }) => {
      // stopWhen ends normal tool continuations cleanly. Check the actual SDK
      // messages as well, before any provider call, including the first step.
      if (countInputTokens(stepMessages) > LANDING_DEMO_CHAT_MAX_INPUT_TOKENS) {
        throw new Error("Landing demo chat model input budget exceeded");
      }
      return {};
    },
    maxOutputTokens: LANDING_DEMO_CHAT_MAX_OUTPUT_TOKENS,
    maxRetries: 0,
    providerOptions: LANDING_DEMO_PROVIDER_OPTIONS,
    tools: buildLandingDemoChatTools(questions, countText),
    onError: ({ error }) => {
      console.error("Landing AI demo chat stream failed", error);
    },
  });
  return result.toUIMessageStreamResponse({
    headers: { "Cache-Control": "no-store" },
  });
}
