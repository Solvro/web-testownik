import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Question } from "@testownik/core/quiz/types";
import type { UIMessage } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PREVIEW_QUESTION } from "@/app/(landing)/preview/preview-fixtures";
import { AiChatProvider } from "@/components/ai/ai-chat-context";
import type { ChatRuntimeValue } from "@/components/ai/chat-runtime";
import { ChatThread } from "@/components/ai/chat-thread";

const { updateQuestion } = vi.hoisted(() => ({ updateQuestion: vi.fn() }));
vi.mock("@/services/client-services", () => ({
  servicesFor: () => ({ quiz: { updateQuestion } }),
}));
vi.mock("@/components/quiz/quick-edit-question-dialog", () => ({
  QuickEditQuestionDialog: ({
    question,
    onSaveDraft,
  }: {
    question: Question;
    onSaveDraft: (question: Question) => void;
  }) => (
    <button
      onClick={() => {
        onSaveDraft({ ...question, text: "Draft correction" });
      }}
    >
      Save draft for {question.id}
    </button>
  ),
}));

const origin = { ...PREVIEW_QUESTION, id: "q-5", order: 5 };
const next = { ...PREVIEW_QUESTION, id: "q-6", order: 6 };
const messages: UIMessage[] = [
  {
    id: "u-5",
    role: "user",
    parts: [{ type: "text", text: "Popraw literówki" }],
  },
  {
    id: "a-5",
    role: "assistant",
    parts: [
      {
        type: "tool-edit_question",
        toolCallId: "edit-5",
        state: "output-available",
        input: { text: "Corrected question", answers: origin.answers },
        output: "ok",
      },
    ],
  },
];

function setup() {
  const client = new QueryClient();
  const runtime = {
    messages,
    status: "ready",
    lengthLimitedMessageIds: new Set(),
    suggestions: [],
    questionContextSnapshots: [{ messageId: "u-5", questionId: origin.id }],
  } as unknown as ChatRuntimeValue;
  const tree = (current: Question, questions: Question[]) => (
    <QueryClientProvider client={client}>
      <AiChatProvider
        value={{
          quizId: "quiz",
          questionId: current.id,
          question: current,
          questions,
          canEdit: true,
        }}
      >
        <ChatThread runtime={runtime} />
      </AiChatProvider>
    </QueryClientProvider>
  );
  const view = render(tree(origin, [origin, next]));
  return { ...view, tree };
}

describe("edit proposal target", () => {
  beforeEach(() => {
    updateQuestion.mockReset();
    updateQuestion.mockResolvedValue(origin);
  });

  it("applies to the originating question after navigating to the next question", async () => {
    const user = userEvent.setup();
    const view = setup();
    view.rerender(view.tree(next, [origin, next]));
    await user.click(screen.getByRole("button", { name: "Zastosuj zmiany" }));
    await waitFor(() => {
      expect(updateQuestion).toHaveBeenCalledWith(
        origin.id,
        expect.objectContaining({ text: "Corrected question" }),
      );
    });
    expect(updateQuestion).toHaveBeenCalledOnce();
  });

  it("keeps the same target when editing a proposal through QuickEditQuestionDialog", async () => {
    const user = userEvent.setup();
    const view = setup();
    view.rerender(view.tree(next, [origin, next]));
    await user.click(
      screen.getByRole("button", { name: "Edytuj przed zastosowaniem" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Save draft for q-5" }),
    );
    await user.click(screen.getByRole("button", { name: "Zastosuj zmiany" }));
    await waitFor(() => {
      expect(updateQuestion).toHaveBeenCalledWith(
        origin.id,
        expect.objectContaining({ text: "Draft correction" }),
      );
    });
  });

  it("disables apply if the originating question has been removed", () => {
    const view = setup();
    view.rerender(view.tree(next, [next]));
    expect(
      screen.getByRole("button", { name: "Zastosuj zmiany" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "Pytanie, którego dotyczy propozycja, nie jest już dostępne.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Edytuj przed zastosowaniem" }),
    ).not.toBeInTheDocument();
    expect(updateQuestion).not.toHaveBeenCalled();
  });
});
