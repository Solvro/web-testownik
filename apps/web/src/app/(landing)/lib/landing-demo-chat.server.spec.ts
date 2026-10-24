import type { Question } from "@testownik/core/quiz/types";
import type { ModelMessage, UIMessage } from "ai";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  LANDING_DEMO_CHAT_LIMITS,
  LANDING_DEMO_CHAT_TOOL_LIMITS,
  parseLandingDemoChatRequest,
  trimLandingDemoChatHistory,
} from "@/app/(landing)/lib/landing-demo-chat";
import {
  LANDING_DEMO_CHAT_MAX_INPUT_TOKENS,
  LANDING_DEMO_CHAT_MAX_OUTPUT_TOKENS,
  countLandingDemoChatInputTokens,
  handleLandingDemoChatRequest,
} from "@/app/(landing)/lib/landing-demo-chat.server";
import { getLandingDemoTokenCounter } from "@/app/(landing)/lib/landing-demo-tokenizer.server";
import {
  LANDING_DEMO_RATE_LIMITS,
  handleLandingDemoRequest,
} from "@/app/(landing)/lib/landing-demo.server";
import { resetRateLimitStore } from "@/app/(landing)/lib/rate-limit";
import { PREVIEW_QUIZ } from "@/app/(landing)/preview/preview-fixtures";
import { buildChatModelMessages } from "@/lib/ai/chat-messages";
import { buildChatTools, buildLandingDemoChatTools } from "@/lib/ai/chat-tools";
import {
  CURRENT_QUESTION_CONTEXT_MARKER,
  buildChatSystemPrompt,
} from "@/lib/ai/prompts";
import { estimateJsonTokens } from "@/lib/ai/request-validation";

const mocks = vi.hoisted(() => ({
  env: {
    NEXT_PUBLIC_AI_ENABLED: true,
    LANDING_AI_MODEL: undefined as string | undefined,
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
    multiple: false,
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

const countTokens = await getLandingDemoTokenCounter();

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
    mocks.env.LANDING_AI_MODEL = undefined;
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
      "gpt-5.6-luna",
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

  it("bounds context amplification from a valid small HTTP request", async () => {
    const model = createMockModel();
    mocks.getConfiguredAiModel.mockReturnValue(model);
    const questions = [
      question(1, "x ".repeat(11_500)),
      question(2, "y ".repeat(11_500)),
    ];
    const messages = Array.from({ length: 19 }, (_, index) =>
      userMessage("dalej", `m-${index.toString()}`),
    );
    const questionContextSnapshots = messages.map((message, index) => ({
      messageId: message.id,
      questionId: questions[index % 2].id,
    }));
    const body = chatBody({
      question: null,
      questions,
      messages,
      questionContextSnapshots,
    });
    expect(JSON.stringify(body).length).toBeLessThan(
      LANDING_DEMO_CHAT_LIMITS.maxBodyBytes,
    );
    const expanded = await buildChatModelMessages({
      messages,
      chatQuestion: null,
      chatQuestions: questions,
      questionContextSnapshots,
      resolveQuestionImages: async () => {
        await Promise.resolve();
        return [];
      },
    });
    expect(estimateJsonTokens(expanded)).toBeGreaterThan(100_000);
    const parsed = parseLandingDemoChatRequest(body);
    expect(parsed?.questionContextSnapshots).toEqual(
      questionContextSnapshots.slice(-3),
    );
    expect(parsed?.questions[0].text).toHaveLength(
      LANDING_DEMO_CHAT_LIMITS.maxQuestionTextLength,
    );

    const response = await handleLandingDemoChatRequest(chatRequest(body));
    expect(response.status).toBe(200);
    await response.text();
    expect(
      await countLandingDemoChatInputTokens(
        model.doStreamCalls[0].prompt.filter(
          (message) => message.role !== "system",
        ),
      ),
    ).toBeLessThanOrEqual(LANDING_DEMO_CHAT_MAX_INPUT_TOKENS);
    expect(
      JSON.stringify(model.doStreamCalls[0].prompt).split(
        CURRENT_QUESTION_CONTEXT_MARKER,
      ).length - 1,
    ).toBeLessThanOrEqual(3);
  });

  it("drops oldest turns before rejecting an expanded history", async () => {
    const model = createMockModel();
    mocks.getConfiguredAiModel.mockReturnValue(model);
    const messages = Array.from({ length: 19 }, (_, index) =>
      index % 2 === 0
        ? userMessage(
            index === 18 ? "latest-request" : `old-${index.toString()}`,
          )
        : assistantMessage("word ".repeat(800)),
    );
    const response = await handleLandingDemoChatRequest(
      chatRequest(chatBody({ messages })),
    );
    expect(response.status).toBe(200);
    await response.text();
    const prompt = model.doStreamCalls[0].prompt;
    expect(
      await countLandingDemoChatInputTokens(
        prompt.filter((message) => message.role !== "system"),
      ),
    ).toBeLessThanOrEqual(LANDING_DEMO_CHAT_MAX_INPUT_TOKENS);
    expect(JSON.stringify(prompt)).not.toContain("old-0");
    expect(JSON.stringify(prompt)).toContain("latest-request");
  });

  it("rejects an oversized latest turn with a stable 413 code before inference", async () => {
    const model = createMockModel();
    mocks.getConfiguredAiModel.mockReturnValue(model);
    const message: UIMessage = {
      id: "latest",
      role: "user",
      parts: Array.from({ length: 3 }, () => ({
        type: "text",
        text: "࠰".repeat(1000),
      })),
    };
    const response = await handleLandingDemoChatRequest(
      chatRequest(chatBody({ messages: [message] })),
    );
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ code: "model_input_too_large" });
    expect(model.doStreamCalls).toHaveLength(0);
  });

  it("rejects UTF-8 input that the former chars / 4 estimate admitted", async () => {
    const model = createMockModel();
    mocks.getConfiguredAiModel.mockReturnValue(model);
    const messages: UIMessage[] = [
      {
        id: "unicode",
        role: "user",
        parts: Array.from({ length: 20 }, () => ({
          type: "text",
          text: "\u0800".repeat(1000),
        })),
      },
    ];
    const expanded = await buildChatModelMessages({
      messages,
      chatQuestion: null,
      chatQuestions: [],
      resolveQuestionImages: async () => {
        await Promise.resolve();
        return [];
      },
    });
    const previousEstimate = estimateJsonTokens({
      system: buildChatSystemPrompt(PREVIEW_QUIZ, 0, undefined, true, true),
      messages: expanded,
    });
    expect(previousEstimate).toBeLessThan(LANDING_DEMO_CHAT_MAX_INPUT_TOKENS);
    expect(await countLandingDemoChatInputTokens(expanded)).toBeGreaterThan(
      24_000,
    );
    const response = await handleLandingDemoChatRequest(
      chatRequest(
        chatBody({
          messages,
          question: null,
          questions: [],
        }),
      ),
    );
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ code: "model_input_too_large" });
    expect(model.doStreamCalls).toHaveLength(0);
  });

  it("includes the system prompt and tool schemas in the input budget", async () => {
    const model = createMockModel();
    mocks.getConfiguredAiModel.mockReturnValue(model);
    const messages: UIMessage[] = [
      {
        id: "schemas",
        role: "user",
        parts: Array.from({ length: 2 }, () => ({
          type: "text",
          text: "࠰".repeat(750),
        })),
      },
    ];
    const response = await handleLandingDemoChatRequest(
      chatRequest(
        chatBody({
          messages,
          question: null,
          questions: [],
        }),
      ),
    );
    expect(estimateJsonTokens(messages)).toBeLessThan(
      LANDING_DEMO_CHAT_MAX_INPUT_TOKENS,
    );
    expect(response.status).toBe(413);
    expect(model.doStreamCalls).toHaveLength(0);
  });

  it.each([
    ["ascii", "Hello, world!", 1867, 200],
    ["Polish", "Zażółć gęślą jaźń.", 1883, 200],
    ["rare script", "࠰".repeat(1000), 7859, 413],
    ["emoji/ZWJ", "👩‍💻👨‍👩‍👧‍👦".repeat(60), 3779, 200],
    ["surrogate pairs", "𐐷𝄞😀".repeat(100), 3459, 200],
  ])(
    "counts the complete %s request against independent expected tokens",
    async (_, text, expected, status) => {
      const model = createMockModel();
      mocks.getConfiguredAiModel.mockReturnValue(model);
      const messages: UIMessage[] = [
        {
          id: "independent",
          role: "user",
          parts: [
            { type: "text", text },
            { type: "text", text },
          ],
        },
      ];
      const expanded = await buildChatModelMessages({
        messages,
        chatQuestion: null,
        chatQuestions: [],
        resolveQuestionImages: async () => {
          await Promise.resolve();
          return [];
        },
      });
      // Python tiktoken 0.14.0: system=983, schema JSON=868, framing=8,
      // plus two independently tokenized text parts (4/12/3000/960/800).
      expect(await countLandingDemoChatInputTokens(expanded, 0)).toBe(expected);
      const response = await handleLandingDemoChatRequest(
        chatRequest(chatBody({ messages, question: null, questions: [] })),
      );
      expect(response.status).toBe(status);
      if (status === 413) {
        expect(await response.json()).toEqual({
          code: "model_input_too_large",
        });
        expect(model.doStreamCalls).toHaveLength(0);
      } else {
        await response.text();
        expect(model.doStreamCalls).toHaveLength(1);
      }
    },
  );

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

  it("bounds get_question results before a real second inference without changing authenticated tools", async () => {
    const largeQuestion: Question = {
      ...question(1, "q ".repeat(1000)),
      explanation: "e ".repeat(1000),
      answers: Array.from({ length: 50 }, (_, index) => ({
        id: `a-${index.toString()}`,
        order: index + 1,
        text: "tak ".repeat(125),
        is_correct: index === 0,
      })),
    };
    const model = createMockModel([
      [{ toolName: "get_question", input: { question_order: 1 } }],
    ]);
    mocks.getConfiguredAiModel.mockReturnValue(model);
    const response = await handleLandingDemoChatRequest(
      chatRequest(
        chatBody({
          question: null,
          questions: [largeQuestion],
        }),
      ),
    );
    const output = await response.text();
    expect(output).toContain("Pytanie nr 2.");
    expect(model.doStreamCalls).toHaveLength(2);
    const bounded = buildLandingDemoChatTools(
      [largeQuestion],
      countTokens,
    ).get_question.execute({ question_order: 1 });
    const full = buildChatTools({
      questions: [largeQuestion],
      canEdit: true,
    }).get_question.execute({ question_order: 1 });
    const details = JSON.parse(bounded) as {
      text: string;
      explanation: string;
      answers: { text: string }[];
    };
    expect(details.text).toHaveLength(
      LANDING_DEMO_CHAT_TOOL_LIMITS.maxQuestionTextLength,
    );
    expect(details.explanation).toHaveLength(
      LANDING_DEMO_CHAT_TOOL_LIMITS.maxExplanationLength,
    );
    expect(details.answers).toHaveLength(
      LANDING_DEMO_CHAT_TOOL_LIMITS.maxAnswers,
    );
    expect(
      details.answers.every(
        (answer) =>
          answer.text.length ===
          LANDING_DEMO_CHAT_TOOL_LIMITS.maxAnswerTextLength,
      ),
    ).toBe(true);
    expect((JSON.parse(full) as { answers: unknown[] }).answers).toHaveLength(
      50,
    );
    const secondInput = model.doStreamCalls[1].prompt.filter(
      (message) => message.role !== "system",
    );
    expect(JSON.stringify(secondInput)).toContain(JSON.stringify(bounded));
    expect(
      await countLandingDemoChatInputTokens(secondInput),
    ).toBeLessThanOrEqual(LANDING_DEMO_CHAT_MAX_INPUT_TOKENS);
    expect(
      await countLandingDemoChatInputTokens(
        JSON.parse(
          JSON.stringify(secondInput).replace(
            JSON.stringify(bounded),
            JSON.stringify(full),
          ),
        ) as ModelMessage[],
      ),
    ).toBeGreaterThan(LANDING_DEMO_CHAT_MAX_INPUT_TOKENS);
  });

  it("caps demo list pages at 20 previews of 180 characters and keeps pagination accurate", () => {
    const questions = Array.from({ length: 60 }, (_, index) =>
      question(index + 1, "x".repeat(2000)),
    );
    const tools = buildLandingDemoChatTools(questions, countTokens);
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
      expect(page.questions.every((item) => item.text.length === 180)).toBe(
        true,
      );
    }
    const full = JSON.parse(
      buildChatTools({ questions, canEdit: true }).list_questions.execute({}),
    ) as { returned: number };
    expect(full.returned).toBe(50);
  });

  it("bounds every demo tool result in tokens, including generated and edited questions", () => {
    const rare = "࠰".repeat(1000); // Independently measured: 3000 tokens.
    const largeQuestion = question(1, rare);
    const tools = buildLandingDemoChatTools(
      Array.from({ length: 20 }, (_, index) => question(index + 1, rare)),
      countTokens,
    );
    const proposed = {
      text: rare,
      answers: [
        { text: "tak", is_correct: true },
        { text: "nie", is_correct: false },
      ],
    };
    for (const output of [
      tools.get_question.execute({ question_order: 1 }),
      tools.list_questions.execute({}),
      tools.generate_practice_questions.execute({ questions: [proposed] }),
      tools.edit_question.execute(proposed),
    ]) {
      expect(output).toBe('{"error":"demo_tool_output_too_large"}');
    }
    const authenticated = buildChatTools({
      questions: [largeQuestion],
      canEdit: true,
    });
    expect(
      JSON.parse(authenticated.get_question.execute({ question_order: 1 })),
    ).toMatchObject({ text: rare });
    expect(
      authenticated.generate_practice_questions.execute({
        questions: [proposed],
      }),
    ).toBe(JSON.stringify({ questions: [proposed] }));
    expect(authenticated.edit_question?.execute(proposed)).toBe(
      JSON.stringify(proposed),
    );
  });

  it.each([
    ["࠰", 20],
    ["𐐷", 15],
  ] as const)(
    "stops before step two when parallel tool results exhaust the remaining budget (%s)",
    async (character, length) => {
      const model = createMockModel([
        [
          { toolName: "list_questions", input: {} },
          { toolName: "list_questions", input: {} },
          { toolName: "list_questions", input: {} },
        ],
      ]);
      mocks.getConfiguredAiModel.mockReturnValue(model);
      const questions = Array.from({ length: 20 }, (_, index) =>
        question(index + 1, character.repeat(length)),
      );
      const response = await handleLandingDemoChatRequest(
        chatRequest(chatBody({ question: null, questions })),
      );
      const output = await response.text();
      expect(output).toContain('"type":"tool-output-available"');
      expect(output).not.toContain('"type":"error"');
      expect(model.doStreamCalls).toHaveLength(1);
    },
  );

  it("rechecks cumulative tool output before step three", async () => {
    const toolCall = { toolName: "list_questions", input: {} };
    const model = createMockModel([[toolCall], [toolCall]]);
    mocks.getConfiguredAiModel.mockReturnValue(model);
    const questions = Array.from({ length: 20 }, (_, index) =>
      question(index + 1, "࠰".repeat(20)),
    );
    const response = await handleLandingDemoChatRequest(
      chatRequest(
        chatBody({
          question: null,
          questions,
          messages: [userMessage("࠰".repeat(500))],
        }),
      ),
    );
    const output = await response.text();
    expect(output).not.toContain('"type":"error"');
    expect(model.doStreamCalls).toHaveLength(2);
    for (const call of model.doStreamCalls) {
      expect(
        await countLandingDemoChatInputTokens(
          call.prompt.filter((message) => message.role !== "system"),
        ),
      ).toBeLessThanOrEqual(LANDING_DEMO_CHAT_MAX_INPUT_TOKENS);
    }
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

  it("shares one per-client budget with /ai/landing-demo", async () => {
    const headers = { "x-forwarded-for": "203.0.113.21" };
    const half = LANDING_DEMO_RATE_LIMITS.perClient.limit / 2;
    for (let index = 0; index < half; index++) {
      const chat = await handleLandingDemoChatRequest(
        chatRequest(chatBody(), headers),
      );
      expect(chat.status).toBe(200);
      await chat.text();
      const plain = await handleLandingDemoRequest(
        new Request("http://localhost/ai/landing-demo", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ prompt: "a" }),
        }),
      );
      expect(plain.status).toBe(200);
      await plain.text();
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
