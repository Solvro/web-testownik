import { stepCountIs, streamText } from "ai";
import "server-only";
import { z } from "zod";

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

export const LANDING_DEMO_CHAT_MAX_INPUT_TOKENS = 6000;

/** Room for a short answer or a few generated questions per step. */
export const LANDING_DEMO_CHAT_MAX_OUTPUT_TOKENS = 800;

/** A tool call and the answer that follows it, and one step to spare. */
export const LANDING_DEMO_CHAT_MAX_STEPS = 3;

function buildDemoSystemPrompt(questionCount: number) {
  return buildChatSystemPrompt(
    { title: PREVIEW_QUIZ.title, description: PREVIEW_QUIZ.description },
    questionCount,
    undefined,
    true,
    true,
  );
}

/** No tokenizer dependency: allow more room for UTF-8 than chars / 4 did. */
function estimateDemoTokens(value: unknown): number {
  const json = JSON.stringify(value);
  return Math.ceil(
    Math.max(json.length / 3, Buffer.byteLength(json, "utf8") / 2.5),
  );
}

// Measured once, using the longest allowed question count and the actual tool
// descriptions and JSON schemas. Reserve a little extra for provider framing.
const FIXED_INPUT_TOKENS =
  estimateDemoTokens({
    system: buildDemoSystemPrompt(LANDING_DEMO_CHAT_LIMITS.maxQuestions),
    tools: Object.entries(buildLandingDemoChatTools([])).map(
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
  }) + 128;

export function estimateLandingDemoChatInputTokens(messages: unknown): number {
  return FIXED_INPUT_TOKENS + estimateDemoTokens(messages);
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

  const system = buildDemoSystemPrompt(questions.length);
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
        estimateLandingDemoChatInputTokens(modelMessages) <=
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
    stopWhen: [
      stepCountIs(LANDING_DEMO_CHAT_MAX_STEPS),
      ({ steps }) =>
        estimateLandingDemoChatInputTokens([
          ...modelMessages,
          ...(steps.at(-1)?.response.messages ?? []),
        ]) > LANDING_DEMO_CHAT_MAX_INPUT_TOKENS,
    ],
    prepareStep: ({ messages: stepMessages }) => {
      // stopWhen ends normal tool continuations cleanly. Check the actual SDK
      // messages as well, before any provider call, including the first step.
      if (
        estimateLandingDemoChatInputTokens(stepMessages) >
        LANDING_DEMO_CHAT_MAX_INPUT_TOKENS
      ) {
        throw new Error("Landing demo chat model input budget exceeded");
      }
      return {};
    },
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
