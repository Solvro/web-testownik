import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Quiz } from "@testownik/core/quiz/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditQuizPageClient } from "@/app/edit-quiz/[quizId]/client";
import { createQuestion } from "@/components/quiz/editor/quiz-editor-form";

const queryState = vi.hoisted(() => ({
  data: undefined as Quiz | undefined,
  isLoading: false,
  isError: false,
}));
vi.mock("@/hooks/use-quiz", () => ({ useQuiz: () => queryState }));

function fixture(): Quiz {
  return {
    id: "quiz-id",
    title: "Quiz",
    description: "",
    questions: [{ ...createQuestion(1), text: "Pytanie" }],
    visibility: 0,
    allow_anonymous: false,
    is_anonymous: false,
    version: 1,
  };
}

function page() {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <EditQuizPageClient quizId="quiz-id" />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  queryState.data = undefined;
  queryState.isLoading = false;
  queryState.isError = false;
});
afterEach(cleanup);

describe("Edit quiz data loading", () => {
  it("shows a load error without mounting a blank editable quiz", () => {
    queryState.isError = true;
    render(page());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Wystąpił błąd podczas ładowania quizu",
    );
    expect(
      screen.queryByRole("textbox", { name: "Tytuł quizu" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Zapisz" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the draft mounted when refreshing cached quiz data fails", () => {
    queryState.data = fixture();
    const { rerender } = render(page());
    fireEvent.change(screen.getByRole("textbox", { name: "Tytuł quizu" }), {
      target: { value: "Lokalne zmiany" },
    });
    queryState.isError = true;
    rerender(page());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Twoje zmiany są nadal w edytorze",
    );
    expect(screen.getByRole("textbox", { name: "Tytuł quizu" })).toHaveValue(
      "Lokalne zmiany",
    );
    queryState.isError = false;
    queryState.data = { ...fixture(), title: "Świeża odpowiedź serwera" };
    rerender(page());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Tytuł quizu" })).toHaveValue(
      "Lokalne zmiany",
    );
  });
});
