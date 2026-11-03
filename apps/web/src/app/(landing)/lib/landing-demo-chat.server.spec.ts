import type { Question } from "@testownik/core/quiz/types";
import type { UIMessage } from "ai";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  LANDING_DEMO_CHAT_LIMITS,
  parseLandingDemoChatRequest,
  trimLandingDemoChatHistory,
} from "@/app/(landing)/lib/landing-demo-chat";
import {
  LANDING_DEMO_CHAT_MAX_OUTPUT_TOKENS,
  buildLandingDemoChatTools,
  handleLandingDemoChatRequest,
} from "@/app/(landing)/lib/landing-demo-chat.server";
import { LANDING_DEMO_RATE_LIMITS } from "@/app/(landing)/lib/landing-demo.server";
import { resetRateLimitStore } from "@/app/(landing)/lib/rate-limit";
import { buildChatTools } from "@/lib/ai/chat-tools";
import { CURRENT_QUESTION_CONTEXT_MARKER } from "@/lib/ai/prompts";

const mocks = vi.hoisted(() => ({
  env: {
    NEXT_PUBLIC_AI_ENABLED: true,
    LANDING_AI_MODEL: "openai:gpt-6-luna",
  },
  providerConfigured: true,
  getConfiguredAiModel: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("@/lib/ai/model", () => ({
  isAiProviderConfigured: () => mocks.providerConfigured,
  getConfiguredAiModel: mocks.getConfiguredAiModel,
}));

function createMockModel(
  toolSteps: { toolName: string; input: Record<string, unknown> }[][] = [],
) {
  let step = 0;
  return new MockLanguageModelV3({
    doStream: async () => {
      await Promise.resolve();
      const toolCalls = toolSteps.at(step++);
      return {
        stream: simulateReadableStream({
          chunks: [
            ...(toolCalls === undefined
              ? [
                  { type: "text-start" as const, id: "t1" },
                  {
                    type: "text-delta" as const,
                    id: "t1",
                    delta: "Pytanie nr 2.",
                  },
                  { type: "text-end" as const, id: "t1" },
                ]
              : toolCalls.map((call, index) => ({
                  type: "tool-call" as const,
                  toolCallId: `call-${step.toString()}-${index.toString()}`,
                  toolName: call.toolName,
                  input: JSON.stringify(call.input),
                }))),
            {
              type: "finish" as const,
              finishReason: {
                unified:
                  toolCalls === undefined
                    ? ("stop" as const)
                    : ("tool-calls" as const),
                raw: toolCalls === undefined ? "stop" : "tool_calls",
              },
              usage: {
                inputTokens: {
                  total: 10,
                  noCache: 10,
                  cacheRead: 0,
                  cacheWrite: 0,
                },
                outputTokens: { total: 4, text: 4, reasoning: 0 },
              },
            },
          ],
        }),
      };
    },
  });
}

function question(order: number, text = `Pytanie ${order.toString()}?`) {
  return {
    id: `q-${order.toString()}`,
    order,
    text,
    type: "single_choice",
    open_matching: "exact",
    answers: [
      {
        id: `q-${order.toString()}-a`,
        order: 1,
        text: "tak",
        is_correct: true,
      },
      {
        id: `q-${order.toString()}-b`,
        order: 2,
        text: "nie",
        is_correct: false,
      },
    ],
  } satisfies Question;
}

function userMessage(text: string, id = crypto.randomUUID()): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

function assistantMessage(text: string): UIMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    parts: [{ type: "text", text }],
  };
}

const QUESTIONS = [
  question(1),
  question(2, "Jak działa spacing?"),
  question(3),
];

function chatBody(overrides: Record<string, unknown> = {}) {
  return {
    messages: [userMessage("Jakie jest aktualne pytanie?")],
    question: QUESTIONS[1],
    questions: QUESTIONS,
    ...overrides,
  };
}

function chatRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/ai/landing-demo/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("parseLandingDemoChatRequest", () => {
  it("accepts the chat and trims long texts", () => {
    const parsed = parseLandingDemoChatRequest(
      chatBody({
        messages: [
          userMessage("a".repeat(5000)),
          assistantMessage("b".repeat(9000)),
          userMessage("Dalej"),
        ],
      }),
    );
    expect(parsed?.question?.id).toBe("q-2");
    expect(parsed?.questions).toHaveLength(3);
    const lengths = parsed?.messages.map((message) =>
      message.parts[0].type === "text" ? message.parts[0].text.length : 0,
    );
    expect(lengths).toEqual([
      LANDING_DEMO_CHAT_LIMITS.maxUserTextLength,
      LANDING_DEMO_CHAT_LIMITS.maxAssistantTextLength,
      5,
    ]);
  });

  it("accepts the demo's own tool calls in the history", () => {
    const toolCall = {
      id: "m-2",
      role: "assistant",
      parts: [
        { type: "step-start" },
        {
          type: "tool-generate_practice_questions",
          toolCallId: "call-1",
          state: "output-available",
          input: { questions: [] },
          output: "{}",
        },
      ],
    };
    expect(
      parseLandingDemoChatRequest(
        chatBody({
          messages: [userMessage("Wygeneruj"), toolCall, userMessage("Dzięki")],
        }),
      ),
    ).not.toBeNull();
  });

  it.each([
    ["non-object", "hello"],
    ["no messages", { questions: QUESTIONS }],
    ["empty messages", chatBody({ messages: [] })],
    [
      "too many messages",
      chatBody({
        messages: Array.from(
          { length: LANDING_DEMO_CHAT_LIMITS.maxMessages + 1 },
          () => userMessage("a"),
        ),
      }),
    ],
    [
      "history ending with the assistant",
      chatBody({ messages: [userMessage("a"), assistantMessage("b")] }),
    ],
    [
      "a system message",
      chatBody({
        messages: [
          { id: "s", role: "system", parts: [{ type: "text", text: "x" }] },
          userMessage("a"),
        ],
      }),
    ],
    [
      "a file part",
      chatBody({
        messages: [
          {
            id: "f",
            role: "user",
            parts: [
              { type: "file", mediaType: "image/png", url: "https://x/y.png" },
            ],
          },
        ],
      }),
    ],
    [
      "the app's disable_ai tool",
      chatBody({
        messages: [
          userMessage("a"),
          {
            id: "d",
            role: "assistant",
            parts: [{ type: "tool-disable_ai", state: "output-available" }],
          },
          userMessage("b"),
        ],
      }),
    ],
    [
      "too many questions",
      chatBody({
        questions: Array.from(
          { length: LANDING_DEMO_CHAT_LIMITS.maxQuestions + 1 },
          (_, index) => question(index + 1),
        ),
      }),
    ],
    ["an invalid question", chatBody({ question: { id: "q", text: 1 } })],
    [
      "an invalid snapshot",
      chatBody({ questionContextSnapshots: [{ messageId: 1 }] }),
    ],
  ])("rejects %s", (_label, body) => {
    expect(parseLandingDemoChatRequest(body)).toBeNull();
  });
});

describe("trimLandingDemoChatHistory", () => {
  it("keeps the recent turns, starting on a user message", () => {
    const messages = Array.from({ length: 30 }, (_, index) =>
      index % 2 === 0
        ? userMessage(`u${index.toString()}`)
        : assistantMessage(`a${index.toString()}`),
    );
    const trimmed = trimLandingDemoChatHistory(messages);
    expect(trimmed.length).toBeLessThanOrEqual(
      LANDING_DEMO_CHAT_LIMITS.maxMessages,
    );
    expect(trimmed[0].role).toBe("user");
    expect(trimmed.at(-1)).toEqual(messages.at(-1));
    expect(trimLandingDemoChatHistory([assistantMessage("a")])).toEqual([]);
  });
});

describe("handleLandingDemoChatRequest", () => {
  beforeEach(() => {
    resetRateLimitStore();
    mocks.env.NEXT_PUBLIC_AI_ENABLED = true;
    mocks.env.LANDING_AI_MODEL = "openai:gpt-6-luna";
    mocks.providerConfigured = true;
    mocks.getConfiguredAiModel.mockReset();
    mocks.getConfiguredAiModel.mockImplementation(() => createMockModel());
  });

  it("runs the app's assistant on the visitor's quiz", async () => {
    const model = createMockModel();
    mocks.getConfiguredAiModel.mockReturnValue(model);

    const response = await handleLandingDemoChatRequest(
      chatRequest(chatBody()),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(await response.text()).toContain("Pytanie nr 2.");
    expect(mocks.getConfiguredAiModel).toHaveBeenCalledWith(
      "gpt-6-luna",
      "openai",
    );
    const [call] = model.doStreamCalls;
    expect(call.maxOutputTokens).toBe(LANDING_DEMO_CHAT_MAX_OUTPUT_TOKENS);
    expect(call.providerOptions).toEqual({
      openai: { reasoningEffort: "low" },
    });
    expect(call.tools?.map((tool) => tool.name).toSorted()).toEqual([
      "edit_question",
      "generate_practice_questions",
      "get_question",
      "list_questions",
    ]);
    const prompt = JSON.stringify(call.prompt);
    expect(prompt).toContain("Liczba pytań: 3");
    expect(prompt).toContain("To jest pokaz na stronie głównej");
    expect(prompt).not.toContain("disable_ai");
    // The current question goes in as context, as in the app.
    expect(prompt).toContain(CURRENT_QUESTION_CONTEXT_MARKER);
    expect(prompt).toContain("Jak działa spacing?");
  });

  it("returns 400 for invalid JSON and invalid bodies", async () => {
    const invalidJson = await handleLandingDemoChatRequest(
      chatRequest("{not json"),
    );
    expect(invalidJson.status).toBe(400);
    const invalidBody = await handleLandingDemoChatRequest(
      chatRequest(chatBody({ messages: [] })),
    );
    expect(invalidBody.status).toBe(400);
    expect(mocks.getConfiguredAiModel).not.toHaveBeenCalled();
  });

  it("caps demo list pages at 20 previews cut at 180 characters and keeps pagination accurate", () => {
    const questions = Array.from({ length: 60 }, (_, index) =>
      question(index + 1, "x".repeat(2000)),
    );
    const tools = buildLandingDemoChatTools(questions);
    for (const limit of [undefined, 100]) {
      const page = JSON.parse(
        tools.list_questions.execute({ limit, offset: 20 }),
      ) as {
        returned: number;
        matched: number;
        next_offset: number;
        questions: { order: number; text: string }[];
      };
      expect(page.returned).toBe(20);
      expect(page.matched).toBe(60);
      expect(page.next_offset).toBe(40);
      expect(page.questions[0].order).toBe(21);
      expect(
        page.questions.every((item) => item.text === `${"x".repeat(180)}…`),
      ).toBe(true);
    }
    const full = JSON.parse(
      buildChatTools({ questions, canEdit: true }).list_questions.execute({}),
    ) as { returned: number };
    expect(full.returned).toBe(50);
  });

  it("uses the configured LANDING_AI_MODEL", async () => {
    mocks.env.LANDING_AI_MODEL = "xai:grok-mini";
    const response = await handleLandingDemoChatRequest(
      chatRequest(chatBody()),
    );
    await response.text();
    expect(mocks.getConfiguredAiModel).toHaveBeenCalledWith("grok-mini", "xai");
  });

  it("returns 503 without AI or a key for the landing model", async () => {
    mocks.providerConfigured = false;
    const response = await handleLandingDemoChatRequest(
      chatRequest(chatBody()),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "ai_model_unavailable" });

    mocks.providerConfigured = true;
    mocks.env.NEXT_PUBLIC_AI_ENABLED = false;
    const disabled = await handleLandingDemoChatRequest(
      chatRequest(chatBody()),
    );
    expect(disabled.status).toBe(503);
  });

  it("rejects oversized bodies with 413 without counting them", async () => {
    const headers = { "x-forwarded-for": "203.0.113.20" };
    const huge = chatBody({
      questions: Array.from({ length: 50 }, (_, index) =>
        question(index + 1, "x".repeat(2000)),
      ),
    });
    expect(JSON.stringify(huge).length).toBeGreaterThan(
      LANDING_DEMO_CHAT_LIMITS.maxBodyBytes,
    );
    const response = await handleLandingDemoChatRequest(
      chatRequest(huge, headers),
    );
    expect(response.status).toBe(413);

    for (
      let index = 0;
      index < LANDING_DEMO_RATE_LIMITS.perClient.limit;
      index++
    ) {
      const ok = await handleLandingDemoChatRequest(
        chatRequest(chatBody(), headers),
      );
      expect(ok.status).toBe(200);
      await ok.text();
    }
  });

  it("rate limits each client IP with Retry-After", async () => {
    const headers = { "x-forwarded-for": "203.0.113.21" };
    for (
      let index = 0;
      index < LANDING_DEMO_RATE_LIMITS.perClient.limit;
      index++
    ) {
      const chat = await handleLandingDemoChatRequest(
        chatRequest(chatBody(), headers),
      );
      expect(chat.status).toBe(200);
      await chat.text();
    }

    const limited = await handleLandingDemoChatRequest(
      chatRequest(chatBody(), headers),
    );
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);

    const otherClient = await handleLandingDemoChatRequest(
      chatRequest(chatBody(), { "x-forwarded-for": "203.0.113.22" }),
    );
    expect(otherClient.status).toBe(200);
    await otherClient.text();
  });
});
