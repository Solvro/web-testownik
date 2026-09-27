import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UIMessage } from "ai";
import { describe, expect, it, vi } from "vitest";

import { AiChatProvider } from "@/components/ai/ai-chat-context";
import type { ChatRuntimeValue } from "@/components/ai/chat-runtime";
import { ChatThread } from "@/components/ai/chat-thread";

function renderThread(
  messages: UIMessage[],
  error?: Error,
  composerDisabled = false,
  options: {
    cooldownLabel?: string;
    disabledMessage?: string;
    lengthLimitedMessageIds?: string[];
    status?: ChatRuntimeValue["status"];
    suggestions?: string[];
    userName?: string;
  } = {},
) {
  const sendMessage = vi.fn();
  const regenerate = vi.fn();
  const clearError = vi.fn();
  const runtime = {
    id: "test-chat",
    messages,
    status: options.status ?? (error === undefined ? "ready" : "error"),
    error,
    lengthLimitedMessageIds: new Set(options.lengthLimitedMessageIds),
    suggestions: options.suggestions ?? [],
    sendMessage,
    regenerate,
    clearError,
    setMessages: vi.fn(),
    stop: vi.fn(),
    resumeStream: vi.fn(),
    addToolResult: vi.fn(),
    addToolOutput: vi.fn(),
    addToolApprovalResponse: vi.fn(),
  } as unknown as ChatRuntimeValue;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <AiChatProvider
        value={{
          quizId: "quiz-1",
          questionId: null,
          question: null,
          canEdit: false,
        }}
      >
        <ChatThread
          runtime={runtime}
          composerDisabled={composerDisabled}
          composerDisabledMessage={options.disabledMessage}
          cooldownLabel={options.cooldownLabel}
          userName={options.userName}
        />
      </AiChatProvider>
    </QueryClientProvider>,
  );

  return { clearError, regenerate, sendMessage, runtime, ...view };
}

describe("ChatThread", () => {
  it("does not render model reasoning parts", () => {
    renderThread([
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: "reasoning",
            text: "private reasoning",
            state: "done",
          },
          { type: "text", text: "Visible answer" },
        ],
      },
    ]);

    expect(screen.getByText("Visible answer")).toBeVisible();
    expect(screen.queryByText("private reasoning")).not.toBeInTheDocument();
    expect(screen.queryByText("Tok rozumowania")).not.toBeInTheDocument();
  });

  it("renders one collapsed task group for all tool calls in an assistant message", async () => {
    const user = userEvent.setup();
    renderThread([
      {
        id: "assistant-tools",
        role: "assistant",
        parts: [
          {
            type: "tool-list_questions",
            toolCallId: "list-1",
            state: "output-available",
            input: { query: "planet" },
            output: JSON.stringify({ total: 11, matched: 7, returned: 7 }),
          },
          {
            type: "tool-get_question",
            toolCallId: "get-1",
            state: "output-available",
            input: { question_order: 7 },
            output: JSON.stringify({
              order: 7,
              text: "Which planet is known as the Red Planet?",
              answers: [],
            }),
          },
          { type: "text", text: "Znalazłem odpowiednie pytania." },
        ],
      },
    ]);

    expect(screen.getAllByText("Wykonano 2 działania")).toHaveLength(1);
    expect(
      screen.queryByRole("button", {
        name: "Pokaż szczegóły: 7 znalezionych pytań",
      }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Pokaż szczegóły: Wykonano 2 działania",
      }),
    );

    expect(screen.getByText("7 znalezionych pytań")).toBeVisible();
    expect(screen.getByText("Pobrano pytanie 7")).toBeVisible();
  });

  it("renders generated questions beside rather than inside the task list", () => {
    renderThread([
      {
        id: "assistant-generated-question",
        role: "assistant",
        parts: [
          {
            type: "tool-list_questions",
            toolCallId: "list-1",
            state: "output-available",
            input: { query: "planety" },
            output: JSON.stringify({ total: 11, matched: 7, returned: 7 }),
          },
          {
            type: "tool-generate_practice_questions",
            toolCallId: "generate-1",
            state: "output-available",
            input: {
              questions: [
                {
                  text: "Która planeta jest nazywana Czerwoną Planetą?",
                  answers: [
                    { text: "Mars", is_correct: true },
                    { text: "Wenus", is_correct: false },
                  ],
                },
              ],
            },
            output: "ok",
          },
        ],
      },
    ]);

    expect(screen.getByText("Wygenerowane pytanie")).toBeVisible();
    expect(
      screen.getByText("Która planeta jest nazywana Czerwoną Planetą?"),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Pokaż szczegóły: Gotowe" }),
    ).toBeVisible();
    expect(
      screen.queryByText("Wygenerowano 1 pytanie"),
    ).not.toBeInTheDocument();
  });

  it("explains a length stop and removes unfinished generated questions", () => {
    renderThread(
      [
        {
          id: "assistant-length-limited",
          role: "assistant",
          parts: [
            {
              type: "tool-generate_practice_questions",
              toolCallId: "generate-limited",
              state: "input-streaming",
              input: {
                questions: [
                  {
                    text: "Która planeta jest nazywana Czerwoną Planetą?",
                    answers: [
                      { text: "Mars", is_correct: true },
                      { text: "Wenus", is_correct: false },
                    ],
                  },
                  {
                    text: "Niedokończone pytanie",
                    answers: [{ text: "Tylko jedna odpowiedź" }],
                  },
                ],
              },
            },
          ],
        },
      ],
      undefined,
      false,
      { lengthLimitedMessageIds: ["assistant-length-limited"] },
    );

    expect(
      screen.getByText(
        "Odpowiedź została przerwana po osiągnięciu limitu długości. Spróbuj ponownie lub poproś o krótszą odpowiedź.",
      ),
    ).toBeVisible();
    expect(
      screen.getByText("Która planeta jest nazywana Czerwoną Planetą?"),
    ).toBeVisible();
    expect(screen.queryByText("Niedokończone pytanie")).not.toBeInTheDocument();
    expect(screen.queryByText("Generowanie…")).not.toBeInTheDocument();
  });

  it("renders proposed edits directly instead of nesting them in a task", () => {
    renderThread([
      {
        id: "assistant-edit",
        role: "assistant",
        parts: [
          {
            type: "tool-edit_question",
            toolCallId: "edit-1",
            state: "output-available",
            input: {
              text: "Zaktualizowana treść pytania",
              answers: [
                { text: "A", is_correct: true },
                { text: "B", is_correct: false },
              ],
            },
            output: "ok",
          },
        ],
      },
    ]);

    expect(screen.getByText("Proponowana edycja")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Pokaż szczegóły: Gotowe" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Przygotowano edycję pytania"),
    ).not.toBeInTheDocument();
  });

  it("retries a failed user request without appending another message", async () => {
    const user = userEvent.setup();
    const controls = renderThread(
      [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Try this" }],
        },
      ],
      new Error("network failed"),
    );

    await user.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));

    expect(controls.clearError).toHaveBeenCalledOnce();
    expect(controls.sendMessage).toHaveBeenCalledWith();
    expect(controls.regenerate).not.toHaveBeenCalled();
  });

  it("regenerates a failed partial assistant response", async () => {
    const user = userEvent.setup();
    const controls = renderThread(
      [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Try this" }],
        },
        {
          id: "assistant-1",
          role: "assistant",
          parts: [{ type: "text", text: "Partial" }],
        },
      ],
      new Error("stream failed"),
    );

    await user.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));

    expect(controls.clearError).toHaveBeenCalledOnce();
    expect(controls.regenerate).toHaveBeenCalledWith({
      messageId: "assistant-1",
    });
    expect(controls.sendMessage).not.toHaveBeenCalled();
  });

  it("shows a request error immediately and disables retry during cooldown", () => {
    renderThread(
      [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Try this" }],
        },
      ],
      new Error("quota exceeded"),
      true,
    );

    expect(
      screen.getByText("Nie udało się wygenerować odpowiedzi."),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Spróbuj ponownie" }),
    ).toBeDisabled();
  });

  it("renders an error as soon as the chat runtime reports it", () => {
    const controls = renderThread([
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "Try this" }],
      },
    ]);

    expect(
      screen.queryByText("Nie udało się wygenerować odpowiedzi."),
    ).not.toBeInTheDocument();

    controls.rerender(
      <ChatThread
        runtime={{
          ...controls.runtime,
          error: new Error("request failed"),
          status: "error",
        }}
      />,
    );

    expect(
      screen.getByText("Nie udało się wygenerować odpowiedzi."),
    ).toBeVisible();
  });

  it("explains why regenerate is unavailable during cooldown", async () => {
    const user = userEvent.setup();
    const controls = renderThread(
      [
        {
          id: "assistant-1",
          role: "assistant",
          parts: [{ type: "text", text: "Existing answer" }],
        },
      ],
      undefined,
      true,
      { cooldownLabel: "za 5 s" },
    );

    const regenerate = screen.getByRole("button", {
      name: "Dostępne za 5 s",
    });
    expect(regenerate).toHaveAttribute("aria-disabled", "true");

    await user.hover(regenerate);
    expect(await screen.findByText("Dostępne za 5 s")).toBeVisible();
    await user.click(regenerate);
    expect(controls.regenerate).not.toHaveBeenCalled();
  });

  it("shows the cooldown timer in edit mode", async () => {
    const user = userEvent.setup();
    renderThread(
      [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Edit this" }],
        },
      ],
      undefined,
      true,
      { cooldownLabel: "za 5 s" },
    );

    await user.click(screen.getByRole("button", { name: "Edytuj" }));

    expect(screen.getByRole("button", { name: "za 5 s" })).toBeDisabled();
  });

  it("shows a personalized greeting and ghost suggestions", () => {
    renderThread([], undefined, false, {
      suggestions: ["Wyjaśnij to pytanie"],
      userName: "Antek",
    });

    expect(
      screen.getByRole("heading", { name: "Cześć, Antek!" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Wyjaśnij to pytanie" }),
    ).toHaveClass("hover:bg-muted/60");
  });

  it("shows shimmer feedback immediately after submitting", () => {
    renderThread(
      [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Think about this" }],
        },
      ],
      undefined,
      false,
      { status: "submitted" },
    );

    expect(screen.getByText("Myślę…")).toHaveClass("shimmer");
  });

  it("keeps the same thinking indicator when the assistant placeholder arrives", () => {
    renderThread(
      [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Think about this" }],
        },
        {
          id: "assistant-1",
          role: "assistant",
          parts: [],
        },
      ],
      undefined,
      false,
      { status: "streaming" },
    );

    const thinking = screen.getByText("Myślę…");
    expect(screen.getAllByText("Myślę…")).toHaveLength(1);
    expect(thinking).toHaveClass("shimmer");
    expect(thinking.closest('[data-slot="marker"]')).not.toBeNull();
  });

  it("keeps thinking feedback visible while a tool is running", () => {
    renderThread(
      [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Find similar questions" }],
        },
        {
          id: "assistant-1",
          role: "assistant",
          parts: [
            {
              type: "tool-list_questions",
              toolCallId: "list-1",
              state: "input-available",
              input: { query: "planety" },
            },
          ],
        },
      ],
      undefined,
      false,
      { status: "streaming" },
    );

    expect(screen.getAllByText("Szukam „planety”").length).toBeGreaterThan(0);
    expect(screen.getByText("Myślę…")).toBeVisible();
  });

  it("shows generation status instead of a changing cooldown while streaming", () => {
    renderThread(
      [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Think about this" }],
        },
      ],
      undefined,
      true,
      {
        cooldownLabel: "za 26 s",
        disabledMessage: "Model zapasowy będzie dostępny: za 26 s",
        status: "streaming",
      },
    );

    expect(screen.getByRole("textbox", { name: "Wiadomość" })).toHaveAttribute(
      "placeholder",
      "Generuję odpowiedź…",
    );
    expect(
      screen.queryByPlaceholderText("Model zapasowy będzie dostępny: za 26 s"),
    ).not.toBeInTheDocument();
  });

  it("does not offer downloading an answer", () => {
    renderThread([
      {
        id: "assistant-1",
        role: "assistant",
        parts: [{ type: "text", text: "Existing answer" }],
      },
    ]);

    expect(
      screen.queryByRole("button", { name: "Pobierz Markdown" }),
    ).not.toBeInTheDocument();
  });
});
