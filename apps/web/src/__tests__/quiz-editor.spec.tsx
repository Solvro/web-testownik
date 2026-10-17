import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { QuizFormData } from "@testownik/core/quiz/schema";
import type { Quiz, QuizVersion } from "@testownik/core/quiz/types";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { leaveSafely } from "@/components/quiz/editor/leave-safely";
import { createQuestion } from "@/components/quiz/editor/quiz-editor-form";
import { QuizEditor } from "@/components/quiz/quiz-editor";
import type { SaveQuiz } from "@/components/quiz/quiz-editor";
import { getImageService, getQuizService } from "@/services";
import type { ImageUploadResponse } from "@/services/image.service";
import type { ApiResponse } from "@/services/types";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  }),
}));

interface ToastAction {
  label: string;
  onClick: () => void;
}

function quizFixture(count = 3): Quiz {
  return {
    id: "quiz-id",
    title: "Quiz elektroniki",
    description: "Opis quizu",
    questions: Array.from({ length: count }, (_, index) => ({
      ...createQuestion(index + 1),
      text: `Treść numer ${String(index + 1)}`,
      answers: [
        {
          ...createQuestion(1).answers[0],
          text: `Poprawna ${String(index + 1)}`,
          is_correct: true,
        },
        {
          ...createQuestion(1).answers[1],
          text: `Błędna ${String(index + 1)}`,
        },
      ],
    })),
    visibility: 0,
    allow_anonymous: false,
    is_anonymous: false,
    version: 1,
  };
}

/** Saves like the API for known IDs: the quiz comes back unchanged. */
async function echoSave(value: QuizFormData) {
  await Promise.resolve();
  return value;
}

function saveMock() {
  return vi.fn<SaveQuiz>().mockImplementation(echoSave);
}

function questionList() {
  return screen.getByRole("list", { name: "Lista pytań" });
}

function listRows() {
  return within(questionList()).getAllByRole("button");
}

function imagePaste() {
  return {
    clipboardData: {
      getData: () => "",
      items: [
        {
          type: "image/png",
          getAsFile: () =>
            new File(["image"], "test.png", { type: "image/png" }),
        },
      ],
    },
  };
}

function textPaste(text: string) {
  return { clipboardData: { getData: () => text, items: [] } };
}

/** Sets the choice type of every question from the quiz menu's submenu. */
async function chooseAllQuestions(
  user: ReturnType<typeof userEvent.setup>,
  label: "Jednokrotny wybór" | "Wielokrotny wybór",
) {
  await user.click(screen.getByRole("button", { name: "Opcje quizu" }));
  const trigger = await screen.findByRole("menuitem", { name: "Typ wyboru" });
  // The submenu opens from the keyboard like a real menu.
  trigger.focus();
  await user.keyboard("{ArrowRight}");
  const item = await screen.findByRole("menuitemradio", { name: label });
  item.focus();
  await user.keyboard("{Enter}");
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Quiz editor", () => {
  it("switches questions and keeps edits, correct answers, and explanations", async () => {
    const user = userEvent.setup();
    const onSave = saveMock();
    render(
      <QuizEditor mode="edit" initialQuiz={quizFixture()} onSave={onSave} />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Treść pytania 1" }), {
      target: { value: "**Zmienione pytanie** $x$" },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: "Wyjaśnienie pytania 1" }),
      { target: { value: "Bo $x = 1$." } },
    );
    await user.click(
      screen.getByRole("button", { name: "Poprawna odpowiedź 2" }),
    );
    expect(
      screen.getByRole("button", { name: "Poprawna odpowiedź 1" }),
    ).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: /^Pytanie 2:/ }));
    expect(
      screen.getByRole("textbox", { name: "Treść pytania 2" }),
    ).toHaveValue("Treść numer 2");
    expect(
      screen.queryByRole("textbox", { name: "Treść pytania 1" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Pytanie 1: Zmienione pytanie/ }),
    ).toHaveAccessibleName(/2 odpowiedzi, 1 poprawna$/);
    expect(listRows()[1]).toHaveAttribute("aria-current", "true");

    await user.click(listRows()[0]);
    expect(
      screen.getByRole("textbox", { name: "Treść pytania 1" }),
    ).toHaveValue("**Zmienione pytanie** $x$");
    expect(
      screen.getByRole("textbox", { name: "Wyjaśnienie pytania 1" }),
    ).toHaveValue("Bo $x = 1$.");
    expect(
      screen.getByRole("button", { name: "Poprawna odpowiedź 2" }),
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    const [first, second, third] = onSave.mock.calls[0][0].questions;
    expect(first).toMatchObject({
      text: "**Zmienione pytanie** $x$",
      explanation: "Bo $x = 1$.",
    });
    expect(first.answers.map((answer) => answer.is_correct)).toEqual([
      false,
      true,
    ]);
    expect(second.text).toBe("Treść numer 2");
    expect(third.text).toBe("Treść numer 3");
  });

  it("moves to the next question with Ctrl+Enter and adds one after the last", async () => {
    const user = userEvent.setup();
    render(
      <QuizEditor
        mode="edit"
        initialQuiz={quizFixture(2)}
        onSave={saveMock()}
      />,
    );
    await user.click(screen.getByRole("textbox", { name: "Treść pytania 1" }));
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(
      screen.getByRole("textbox", { name: "Treść pytania 2" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("textbox", { name: "Odpowiedź 1" }));
    await user.keyboard("{Control>}{Enter}{/Control}");
    const added = await screen.findByRole("textbox", {
      name: "Treść pytania 3",
    });
    expect(added).toHaveValue("");
    await waitFor(() => {
      expect(added).toHaveFocus();
    });
    expect(listRows()).toHaveLength(3);
  });

  it("reveals the first invalid answer on save and marks its question", async () => {
    const user = userEvent.setup();
    const quiz = quizFixture(3);
    quiz.questions[2].answers[1].text = "";
    const onSave = saveMock();
    render(<QuizEditor mode="edit" initialQuiz={quiz} onSave={onSave} />);

    await user.click(screen.getByRole("button", { name: "Zapisz" }));

    const answer = await screen.findByRole("textbox", { name: "Odpowiedź 2" });
    expect(
      screen.getByRole("textbox", { name: "Treść pytania 3" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(answer).toHaveFocus();
    });
    expect(answer).toHaveAttribute("aria-invalid", "true");
    expect(
      within(listRows()[2]).getByRole("img", { name: "Wymaga uzupełnienia" }),
    ).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Pytanie 3, Odpowiedź 2"),
      expect.objectContaining({
        action: expect.objectContaining({ label: "Pokaż" }) as unknown,
      }),
    );
    expect(onSave).not.toHaveBeenCalled();

    await user.type(answer, "Uzupełniona");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    expect(onSave.mock.calls[0][0].questions).toHaveLength(3);
    expect(onSave.mock.calls[0][0].questions[2].answers[1].text).toBe(
      "Uzupełniona",
    );
  });

  it("shows unsaved changes only while the draft differs from the saved quiz", () => {
    render(
      <QuizEditor
        mode="edit"
        initialQuiz={quizFixture(1)}
        onSave={saveMock()}
      />,
    );
    const title = screen.getByRole("textbox", { name: "Tytuł quizu" });
    fireEvent.change(title, { target: { value: "Inny tytuł" } });
    expect(screen.getByRole("status")).toHaveTextContent("Niezapisane zmiany");
    fireEvent.change(title, { target: { value: "Quiz elektroniki" } });
    expect(screen.getByRole("status")).not.toHaveTextContent(
      "Niezapisane zmiany",
    );
  });

  it("continues from the IDs the API gave new questions and answers", async () => {
    const user = userEvent.setup();
    // Like the API: unknown IDs are replaced with new ones.
    const onSave = vi.fn<SaveQuiz>().mockImplementation(async (value) => {
      await Promise.resolve();
      return {
        ...value,
        questions: value.questions.map((question) =>
          question.id.startsWith("saved-")
            ? question
            : {
                ...question,
                id: `saved-${question.id}`,
                answers: question.answers.map((answer) => ({
                  ...answer,
                  id: `saved-${answer.id}`,
                })),
              },
        ),
      };
    });
    render(
      <QuizEditor mode="edit" initialQuiz={quizFixture(1)} onSave={onSave} />,
    );
    await user.click(
      screen.getAllByRole("button", { name: "Dodaj pytanie" })[0],
    );
    const added = screen.getByRole("textbox", { name: "Treść pytania 2" });
    fireEvent.change(added, { target: { value: "Nowe" } });
    for (const [index, text] of ["Tak", "Nie"].entries()) {
      fireEvent.change(
        screen.getByRole("textbox", { name: `Odpowiedź ${String(index + 1)}` }),
        { target: { value: text } },
      );
    }
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Zapisano");
    });
    // The new question stays open under its saved ID, in the same fields, so
    // the author's focus and caret survive the save.
    expect(screen.getByRole("textbox", { name: "Treść pytania 2" })).toBe(
      added,
    );
    expect(added).toHaveValue("Nowe");
    expect(added.id).toMatch(/^question-text-saved-/);
    const firstIds = onSave.mock.results[0].value as Promise<QuizFormData>;
    const first = await firstIds;

    fireEvent.change(screen.getByRole("textbox", { name: "Treść pytania 2" }), {
      target: { value: "Nowe, poprawione" },
    });
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(2);
    });
    const second = onSave.mock.calls[1][0].questions[1];
    expect(second.id).toBe(first.questions[1].id);
    expect(second.answers.map((answer) => answer.id)).toEqual(
      first.questions[1].answers.map((answer) => answer.id),
    );
    expect(second.text).toBe("Nowe, poprawione");
  });

  it("keeps validation errors on the right answers after one is removed", async () => {
    const user = userEvent.setup();
    const quiz = quizFixture(1);
    quiz.questions[0].answers = [
      { ...quiz.questions[0].answers[0], text: "A" },
      { ...quiz.questions[0].answers[1], text: "" },
      { ...quiz.questions[0].answers[1], id: "third", order: 3, text: "C" },
    ];
    render(<QuizEditor mode="edit" initialQuiz={quiz} onSave={saveMock()} />);
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: "Odpowiedź 2" }),
      ).toHaveAttribute("aria-invalid", "true");
    });

    await user.click(screen.getByRole("button", { name: "Usuń odpowiedź 1" }));
    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: "Odpowiedź 1" }),
      ).toHaveAttribute("aria-invalid", "true");
    });
    expect(screen.getByRole("textbox", { name: "Odpowiedź 1" })).toHaveValue(
      "",
    );
    expect(screen.getByRole("textbox", { name: "Odpowiedź 2" })).toHaveValue(
      "C",
    );
    expect(
      screen.getByRole("textbox", { name: "Odpowiedź 2" }),
    ).toHaveAttribute("aria-invalid", "false");
  });

  it("opens a quiz without questions and lets one be added", async () => {
    const user = userEvent.setup();
    render(
      <QuizEditor
        mode="edit"
        initialQuiz={{ ...quizFixture(1), questions: [] }}
        onSave={saveMock()}
      />,
    );
    expect(
      screen.getByText("Ten quiz nie ma jeszcze pytań."),
    ).toBeInTheDocument();
    await user.click(
      screen.getAllByRole("button", { name: "Dodaj pytanie" })[0],
    );
    expect(
      await screen.findByRole("textbox", { name: "Treść pytania 1" }),
    ).toBeInTheDocument();
  });

  it("refuses toast undo while a save is pending", async () => {
    const user = userEvent.setup();
    const saveResult = Promise.withResolvers<QuizFormData | null>();
    const onSave = vi.fn<SaveQuiz>().mockReturnValue(saveResult.promise);
    render(
      <QuizEditor mode="edit" initialQuiz={quizFixture(2)} onSave={onSave} />,
    );
    await user.click(screen.getByRole("button", { name: "Usuń pytanie 1" }));
    const [, options] = vi.mocked(toast).mock.calls[0];
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    act(() => {
      (options?.action as ToastAction).onClick();
    });
    expect(listRows()).toHaveLength(1);
    expect(toast.info).toHaveBeenCalledWith("Poczekaj na zakończenie zapisu.");
    await act(async () => {
      saveResult.resolve(onSave.mock.calls[0][0]);
      await saveResult.promise;
    });
  });

  it("focuses the title when it is missing", async () => {
    const user = userEvent.setup();
    render(
      <QuizEditor
        mode="edit"
        initialQuiz={{ ...quizFixture(1), title: "" }}
        onSave={saveMock()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: "Tytuł quizu" }),
      ).toHaveFocus();
    });
    expect(toast.error).toHaveBeenCalledWith(
      "Tytuł quizu jest wymagany",
      expect.objectContaining({ action: undefined }),
    );
  });

  it("keeps the draft after a failed save and retries with the latest edits", async () => {
    const user = userEvent.setup();
    const onSave = vi
      .fn<SaveQuiz>()
      .mockResolvedValueOnce(null)
      .mockImplementation(echoSave);
    render(
      <QuizEditor mode="edit" initialQuiz={quizFixture(1)} onSave={onSave} />,
    );
    const title = screen.getByRole("textbox", { name: "Tytuł quizu" });
    fireEvent.change(title, { target: { value: "Pierwsza wersja" } });
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Twoje zmiany są nadal w edytorze",
    );
    expect(title).toHaveValue("Pierwsza wersja");

    fireEvent.change(title, { target: { value: "Druga wersja" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(2);
    });
    expect(onSave.mock.calls[1][0].title).toBe("Druga wersja");
    await waitFor(() => {
      expect(screen.getByText("Zapisano")).toBeInTheDocument();
    });
  });

  it("adds answers with Enter and removes empty ones with Backspace", async () => {
    const user = userEvent.setup();
    render(
      <QuizEditor
        mode="create"
        initialValues={{
          title: "",
          description: "",
          questions: [createQuestion(1)],
        }}
        onSave={saveMock()}
      />,
    );
    await user.click(screen.getByRole("textbox", { name: "Odpowiedź 1" }));
    await user.keyboard("Alfa{Enter}");
    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: "Odpowiedź 2" }),
      ).toHaveFocus();
    });
    await user.keyboard("Beta{Shift>}{Enter}{/Shift}ciąg dalszy{Enter}");
    const third = await screen.findByRole("textbox", { name: "Odpowiedź 3" });
    await waitFor(() => {
      expect(third).toHaveFocus();
    });
    expect(screen.getByRole("textbox", { name: "Odpowiedź 2" })).toHaveValue(
      "Beta\nciąg dalszy",
    );

    // Enter on the last, still empty answer does not add another one.
    await user.keyboard("{Enter}");
    expect(
      screen.queryByRole("textbox", { name: "Odpowiedź 4" }),
    ).not.toBeInTheDocument();

    await user.keyboard("{Backspace}");
    expect(
      screen.queryByRole("textbox", { name: "Odpowiedź 3" }),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: "Odpowiedź 2" }),
      ).toHaveFocus();
    });
  });

  it("splits a pasted list into answers and can keep it as one answer", async () => {
    const user = userEvent.setup();
    const quiz = quizFixture(1);
    quiz.questions[0].answers = quiz.questions[0].answers.map((answer) => ({
      ...answer,
      text: "",
    }));
    const onSave = saveMock();
    render(<QuizEditor mode="edit" initialQuiz={quiz} onSave={onSave} />);
    const pasted = "a) Alfa\nb) Beta\nc) $\\gamma$";

    fireEvent.paste(
      screen.getByRole("textbox", { name: "Odpowiedź 1" }),
      textPaste(pasted),
    );

    expect(screen.getByRole("textbox", { name: "Odpowiedź 1" })).toHaveValue(
      "Alfa",
    );
    expect(screen.getByRole("textbox", { name: "Odpowiedź 2" })).toHaveValue(
      "Beta",
    );
    expect(screen.getByRole("textbox", { name: "Odpowiedź 3" })).toHaveValue(
      String.raw`$\gamma$`,
    );
    expect(
      screen.getByRole("button", { name: "Poprawna odpowiedź 1" }),
    ).toHaveAttribute("aria-pressed", "true");
    const [message, options] = vi.mocked(toast.success).mock.calls[0];
    expect(message).toBe("Wklejono odpowiedzi: 3");

    act(() => {
      (options?.action as ToastAction).onClick();
    });
    expect(screen.getByRole("textbox", { name: "Odpowiedź 1" })).toHaveValue(
      pasted,
    );
    expect(screen.getByRole("textbox", { name: "Odpowiedź 2" })).toHaveValue(
      "",
    );
    expect(
      screen.queryByRole("textbox", { name: "Odpowiedź 3" }),
    ).not.toBeInTheDocument();

    // Text pasted into an answer which already has content stays as typed.
    fireEvent.paste(
      screen.getByRole("textbox", { name: "Odpowiedź 1" }),
      textPaste("x\ny"),
    );
    expect(toast.success).toHaveBeenCalledTimes(1);
    await user.click(
      screen.getByRole("button", { name: "Poprawna odpowiedź 1" }),
    );
    expect(
      screen.getByRole("button", { name: "Poprawna odpowiedź 1" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("searches questions and answers and shows an empty state", async () => {
    const user = userEvent.setup();
    const onSave = saveMock();
    render(
      <QuizEditor mode="edit" initialQuiz={quizFixture()} onSave={onSave} />,
    );
    const search = screen.getByRole("searchbox", {
      name: "Szukaj w pytaniach i odpowiedziach",
    });
    await user.type(search, "błędna 3{Enter}");
    expect(listRows()).toHaveLength(1);
    expect(listRows()[0]).toHaveTextContent("Treść numer 3");
    expect(onSave).not.toHaveBeenCalled();

    await user.click(listRows()[0]);
    expect(
      screen.getByRole("textbox", { name: "Treść pytania 3" }),
    ).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "nic takiego");
    expect(screen.getByText("Brak pasujących pytań.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pokaż wszystkie" }));
    expect(listRows()).toHaveLength(3);
  });

  it("removes a question with undo", async () => {
    const user = userEvent.setup();
    const onSave = saveMock();
    render(
      <QuizEditor mode="edit" initialQuiz={quizFixture()} onSave={onSave} />,
    );

    await user.click(listRows()[1]);
    await user.click(screen.getByRole("button", { name: "Usuń pytanie 2" }));
    expect(listRows()).toHaveLength(2);
    expect(
      screen.getByRole("textbox", { name: "Treść pytania 2" }),
    ).toHaveValue("Treść numer 3");
    const [message, options] = vi.mocked(toast).mock.calls[0];
    expect(message).toBe("Usunięto pytanie 2");

    act(() => {
      (options?.action as ToastAction).onClick();
    });
    expect(listRows().map((row) => row.textContent)).toEqual([
      "1 · Treść numer 1",
      "2 · Treść numer 2",
      "3 · Treść numer 3",
    ]);
    expect(
      screen.getByRole("textbox", { name: "Treść pytania 2" }),
    ).toHaveValue("Treść numer 2");

    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    expect(
      onSave.mock.calls[0][0].questions.map((question) => [
        question.order,
        question.text,
      ]),
    ).toEqual([
      [1, "Treść numer 1"],
      [2, "Treść numer 2"],
      [3, "Treść numer 3"],
    ]);
  });

  it("does not remove the only question or the only answer", () => {
    const quiz = quizFixture(1);
    quiz.questions[0].answers = quiz.questions[0].answers.slice(0, 1);
    render(<QuizEditor mode="edit" initialQuiz={quiz} onSave={saveMock()} />);
    expect(
      screen.getByRole("button", { name: "Usuń odpowiedź 1" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Usuń pytanie 1" }),
    ).toBeDisabled();
  });

  it("changes the choice type for one question or for all of them", async () => {
    const user = userEvent.setup();
    const onSave = saveMock();
    render(
      <QuizEditor mode="edit" initialQuiz={quizFixture()} onSave={onSave} />,
    );
    await chooseAllQuestions(user, "Wielokrotny wybór");
    expect(screen.getByRole("radio", { name: "Wielokrotny" })).toBeChecked();
    await user.click(
      screen.getByRole("button", { name: "Poprawna odpowiedź 2" }),
    );
    expect(
      screen.getByRole("button", { name: "Poprawna odpowiedź 1" }),
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("radio", { name: "Jednokrotny" }));
    expect(
      screen.getByRole("button", { name: "Poprawna odpowiedź 1" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Poprawna odpowiedź 2" }),
    ).toHaveAttribute("aria-pressed", "false");

    await user.click(listRows()[2]);
    expect(screen.getByRole("radio", { name: "Wielokrotny" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    expect(
      onSave.mock.calls[0][0].questions.map((question) => question.multiple),
    ).toEqual([false, true, true]);
  });

  it("reminds about questions without a correct answer once they are left", async () => {
    const user = userEvent.setup();
    const quiz = quizFixture(2);
    quiz.questions[0].answers[0].is_correct = false;
    render(<QuizEditor mode="edit" initialQuiz={quiz} onSave={saveMock()} />);
    expect(
      screen.getByText("Zaznacz kółko przy poprawnej odpowiedzi."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: "Brak poprawnej odpowiedzi" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Pytanie 2:/ }));
    expect(
      within(listRows()[0]).getByRole("img", {
        name: "Brak poprawnej odpowiedzi",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Pytanie 1:/ }),
    ).toHaveAccessibleName(/Brak poprawnej odpowiedzi$/);
  });

  it("collapses the open question and opens another from the outline", async () => {
    const user = userEvent.setup();
    render(
      <QuizEditor
        mode="edit"
        initialQuiz={quizFixture()}
        onSave={saveMock()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Zwiń pytanie 1" }));
    expect(
      screen.queryByRole("textbox", { name: /^Treść pytania/ }),
    ).toBeNull();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^Pytanie 1: Treść numer 1/ }),
      ).toHaveFocus();
    });
    await user.click(listRows()[2]);
    expect(
      screen.getByRole("textbox", { name: "Treść pytania 3" }),
    ).toHaveValue("Treść numer 3");
    expect(listRows()[2]).toHaveAttribute("aria-current", "true");
  });

  it("navigates questions with the keyboard", async () => {
    const user = userEvent.setup();
    render(
      <QuizEditor
        mode="edit"
        initialQuiz={quizFixture(4)}
        onSave={saveMock()}
      />,
    );
    // The outline is one tab stop, on the open question.
    expect(listRows().map((row) => row.getAttribute("tabindex"))).toEqual([
      "0",
      "-1",
      "-1",
      "-1",
    ]);
    listRows()[0].focus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(listRows()[2]).toHaveFocus();
    await user.keyboard("{End}");
    expect(listRows()[3]).toHaveFocus();
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: "Treść pytania 4" }),
      ).toHaveFocus();
    });

    // Escape closes the question and returns to its row.
    await user.keyboard("{Escape}");
    const fourth = screen.getByRole("button", { name: /^Pytanie 4:/ });
    await waitFor(() => {
      expect(fourth).toHaveFocus();
    });
    expect(fourth).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("button", { name: /^Pytanie 1:/ })).toHaveAttribute(
      "tabindex",
      "-1",
    );
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("button", { name: /^Pytanie 3:/ })).toHaveFocus();
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: "Treść pytania 3" }),
      ).toHaveFocus();
    });
  });

  it("keeps the toolbar and the choice type to one tab stop each", async () => {
    const user = userEvent.setup();
    render(
      <QuizEditor
        mode="edit"
        initialQuiz={quizFixture(1)}
        onSave={saveMock()}
      />,
    );
    const toolbar = screen.getByRole("toolbar", {
      name: "Formatowanie tekstu",
    });
    // Enabled only while a field has focus.
    expect(
      within(toolbar).getByRole("button", { name: "Kod" }),
    ).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("textbox", { name: "Treść pytania 1" }));
    const buttons = within(toolbar).getAllByRole("button");
    expect(buttons.filter((button) => button.tabIndex === 0)).toHaveLength(1);
    buttons[0].focus();
    await user.keyboard("{ArrowRight}");
    expect(buttons[1]).toHaveFocus();
    expect(buttons[1]).toHaveAttribute("tabindex", "0");
    expect(buttons[0]).toHaveAttribute("tabindex", "-1");

    const single = screen.getByRole("radio", { name: "Jednokrotny" });
    expect(single).toBeChecked();
    single.focus();
    await user.keyboard("{ArrowRight}");
    const multiple = screen.getByRole("radio", { name: "Wielokrotny" });
    expect(multiple).toBeChecked();
    expect(multiple).toHaveFocus();
  });

  it("asks before an app link leaves unsaved changes", async () => {
    const user = userEvent.setup();
    render(
      <>
        <a href="/quizzes">Twoje quizy</a>
        <QuizEditor
          mode="edit"
          initialQuiz={quizFixture(1)}
          onSave={saveMock()}
        />
      </>,
    );
    const link = screen.getByRole("link", { name: "Twoje quizy" });
    const followed = vi.fn((event: MouseEvent) => {
      event.preventDefault();
    });
    link.addEventListener("click", followed);

    // Nothing to lose yet.
    await user.click(link);
    expect(followed).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    const title = screen.getByRole("textbox", { name: "Tytuł quizu" });
    fireEvent.change(title, { target: { value: "Szkic" } });
    await user.click(link);
    expect(followed).toHaveBeenCalledTimes(1);
    const dialog = await screen.findByRole("alertdialog", {
      name: "Masz niezapisane zmiany",
    });
    await user.click(within(dialog).getByRole("button", { name: "Zostań" }));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(title).toHaveValue("Szkic");
  });

  it("tells the author when a pending save succeeds while asking to leave", async () => {
    const user = userEvent.setup();
    const saveResult = Promise.withResolvers<QuizFormData | null>();
    const onSave = vi.fn<SaveQuiz>().mockReturnValue(saveResult.promise);
    render(
      <>
        <a href="/quizzes">Twoje quizy</a>
        <QuizEditor mode="edit" initialQuiz={quizFixture(1)} onSave={onSave} />
      </>,
    );
    const link = screen.getByRole("link", { name: "Twoje quizy" });
    link.addEventListener("click", (event) => {
      event.preventDefault();
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Tytuł quizu" }), {
      target: { value: "Szkic" },
    });
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    await user.click(link);
    await screen.findByRole("alertdialog", { name: "Masz niezapisane zmiany" });

    await act(async () => {
      saveResult.resolve(onSave.mock.calls[0][0]);
      await saveResult.promise;
    });
    const dialog = await screen.findByRole("alertdialog", {
      name: "Zmiany zostały zapisane",
    });
    expect(
      within(dialog)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Zostań", "Przejdź dalej"]);
    await user.click(within(dialog).getByRole("button", { name: "Zostań" }));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });

  it("confirms leaving from code such as logging out", async () => {
    const user = userEvent.setup();
    render(
      <QuizEditor
        mode="edit"
        initialQuiz={quizFixture(1)}
        onSave={saveMock()}
      />,
    );
    const logout = vi.fn();
    act(() => {
      leaveSafely(logout);
    });
    expect(logout).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByRole("textbox", { name: "Tytuł quizu" }), {
      target: { value: "Szkic" },
    });
    act(() => {
      leaveSafely(logout);
    });
    expect(logout).toHaveBeenCalledTimes(1);
    const dialog = await screen.findByRole("alertdialog", {
      name: "Masz niezapisane zmiany",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Odrzuć zmiany" }),
    );
    expect(logout).toHaveBeenCalledTimes(2);
  });

  it("reveals an invalid field hidden by the search", async () => {
    const user = userEvent.setup();
    const quiz = quizFixture(2);
    quiz.questions[1].answers[0].text = "";
    render(<QuizEditor mode="edit" initialQuiz={quiz} onSave={saveMock()} />);
    await user.type(
      screen.getByRole("searchbox", {
        name: "Szukaj w pytaniach i odpowiedziach",
      }),
      "nic takiego",
    );
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    const answer = await screen.findByRole("textbox", { name: "Odpowiedź 1" });
    await waitFor(() => {
      expect(answer).toHaveFocus();
    });
    expect(
      screen.getByRole("textbox", { name: "Treść pytania 2" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", {
        name: "Szukaj w pytaniach i odpowiedziach",
      }),
    ).toHaveValue("");
  });

  it("moves focus after deleting an answer and can bring it back", async () => {
    const user = userEvent.setup();
    const quiz = quizFixture(1);
    quiz.questions[0].answers.push({
      ...quiz.questions[0].answers[1],
      id: "third",
      order: 3,
      text: "Trzecia",
    });
    render(<QuizEditor mode="edit" initialQuiz={quiz} onSave={saveMock()} />);
    await user.click(screen.getByRole("button", { name: "Usuń odpowiedź 1" }));
    expect(
      screen.queryByRole("textbox", { name: "Odpowiedź 3" }),
    ).not.toBeInTheDocument();
    // The first answer has no previous one, so focus moves to the next.
    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: "Odpowiedź 1" }),
      ).toHaveFocus();
    });
    expect(screen.getByRole("textbox", { name: "Odpowiedź 1" })).toHaveValue(
      "Błędna 1",
    );
    const [message, options] = vi.mocked(toast).mock.calls[0];
    expect(message).toBe("Usunięto odpowiedź 1");
    act(() => {
      (options?.action as ToastAction).onClick();
    });
    expect(screen.getByRole("textbox", { name: "Odpowiedź 1" })).toHaveValue(
      "Poprawna 1",
    );
    expect(
      screen.getByRole("button", { name: "Poprawna odpowiedź 1" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("textbox", { name: "Odpowiedź 3" })).toHaveValue(
      "Trzecia",
    );
  });

  it("can undo correct answers unmarked by single choice", async () => {
    const user = userEvent.setup();
    const quiz = quizFixture(2);
    quiz.questions[0].multiple = true;
    quiz.questions[0].answers[1].is_correct = true;
    render(<QuizEditor mode="edit" initialQuiz={quiz} onSave={saveMock()} />);
    await chooseAllQuestions(user, "Jednokrotny wybór");
    expect(
      screen.getByRole("button", { name: "Poprawna odpowiedź 2" }),
    ).toHaveAttribute("aria-pressed", "false");
    const [message, options] = vi.mocked(toast).mock.calls[0];
    expect(message).toBe("Ustawiono jednokrotny wybór we wszystkich pytaniach");
    expect(options?.description).toBe("Odznaczono poprawne odpowiedzi: 1.");

    // Edits made after the change survive the undo.
    fireEvent.change(screen.getByRole("textbox", { name: "Odpowiedź 1" }), {
      target: { value: "Zmieniona" },
    });
    act(() => {
      (options?.action as ToastAction).onClick();
    });
    expect(screen.getByRole("radio", { name: "Wielokrotny" })).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Poprawna odpowiedź 2" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("textbox", { name: "Odpowiedź 1" })).toHaveValue(
      "Zmieniona",
    );
  });

  it("undoes and redoes every change to the open question", async () => {
    const user = userEvent.setup();
    render(
      <QuizEditor
        mode="edit"
        initialQuiz={quizFixture(2)}
        onSave={saveMock()}
      />,
    );
    const undo = screen.getByRole("button", { name: "Cofnij" });
    const redo = screen.getByRole("button", { name: "Ponów" });
    expect(undo).toHaveAttribute("aria-disabled", "true");

    const answer = screen.getByRole("textbox", { name: "Odpowiedź 1" });
    const before = (answer as HTMLTextAreaElement).value;
    await user.type(answer, " dopisek");
    await user.click(
      screen.getByRole("button", { name: "Poprawna odpowiedź 2" }),
    );
    // Nothing is focused, yet the steps can still be undone.
    (document.activeElement as HTMLElement).blur();
    expect(undo).toHaveAttribute("aria-disabled", "false");
    expect(screen.getByRole("button", { name: "Pogrubienie" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    await user.click(undo);
    expect(
      screen.getByRole("button", { name: "Poprawna odpowiedź 2" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(answer).toHaveValue(`${before} dopisek`);

    await user.click(undo);
    expect(answer).toHaveValue(before);
    expect(undo).toHaveAttribute("aria-disabled", "true");
    expect(redo).toHaveAttribute("aria-disabled", "false");

    await user.click(redo);
    expect(answer).toHaveValue(`${before} dopisek`);
    await user.click(redo);
    expect(
      screen.getByRole("button", { name: "Poprawna odpowiedź 2" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(redo).toHaveAttribute("aria-disabled", "true");
  });

  it("undoes with Ctrl+Z inside a field and brings removed answers back", async () => {
    const user = userEvent.setup();
    render(
      <QuizEditor
        mode="edit"
        initialQuiz={quizFixture(2)}
        onSave={saveMock()}
      />,
    );
    const question = screen.getByRole("textbox", { name: "Treść pytania 1" });
    const before = (question as HTMLTextAreaElement).value;
    await user.type(question, "!");
    await user.keyboard("{Control>}z{/Control}");
    expect(question).toHaveValue(before);
    await user.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
    expect(question).toHaveValue(`${before}!`);

    await user.click(screen.getByRole("button", { name: "Usuń odpowiedź 2" }));
    expect(
      screen.queryByRole("textbox", { name: "Odpowiedź 2" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cofnij" }));
    expect(
      screen.getByRole("textbox", { name: "Odpowiedź 2" }),
    ).toBeInTheDocument();
  });

  it("keeps a question's undo steps while it is collapsed", async () => {
    const user = userEvent.setup();
    render(
      <QuizEditor
        mode="edit"
        initialQuiz={quizFixture(2)}
        onSave={saveMock()}
      />,
    );
    const first = screen.getByRole("textbox", { name: "Treść pytania 1" });
    const before = (first as HTMLTextAreaElement).value;
    await user.type(first, "?");
    await user.click(screen.getByRole("button", { name: /^Pytanie 2:/ }));
    expect(screen.getByRole("button", { name: "Cofnij" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(listRows()[0]);
    await user.click(screen.getByRole("button", { name: "Cofnij" }));
    expect(
      screen.getByRole("textbox", { name: "Treść pytania 1" }),
    ).toHaveValue(before);
  });

  it("keeps recently open fields mounted so their undo history survives", async () => {
    const user = userEvent.setup();
    render(
      <QuizEditor
        mode="edit"
        initialQuiz={quizFixture(2)}
        onSave={saveMock()}
      />,
    );
    const field = screen.getByRole("textbox", { name: "Treść pytania 1" });
    await user.click(screen.getByRole("button", { name: /^Pytanie 2:/ }));
    expect(
      screen.queryByRole("textbox", { name: "Treść pytania 1" }),
    ).not.toBeInTheDocument();
    expect(field).toBeInTheDocument();
    await user.click(listRows()[0]);
    expect(screen.getByRole("textbox", { name: "Treść pytania 1" })).toBe(
      field,
    );
  });

  it("keeps recent fields mounted while a search hides every question", async () => {
    const user = userEvent.setup();
    render(
      <QuizEditor
        mode="edit"
        initialQuiz={quizFixture(3)}
        onSave={saveMock()}
      />,
    );
    const first = screen.getByRole("textbox", { name: "Treść pytania 1" });
    await user.click(screen.getByRole("button", { name: /^Pytanie 2:/ }));
    const second = screen.getByRole("textbox", { name: "Treść pytania 2" });
    const search = screen.getByRole("searchbox", {
      name: "Szukaj w pytaniach i odpowiedziach",
    });

    await user.type(search, "nic takiego");
    expect(screen.getByText("Brak pasujących pytań.")).toBeInTheDocument();
    expect(first).toBeInTheDocument();
    expect(second).toBeInTheDocument();
    // Only the open question shows; the kept one is hidden with its row.
    expect(
      screen.queryByRole("button", { name: /^Pytanie 1:/ }),
    ).not.toBeInTheDocument();

    await user.clear(search);
    await user.click(screen.getByRole("button", { name: /^Pytanie 1:/ }));
    expect(screen.getByRole("textbox", { name: "Treść pytania 1" })).toBe(
      first,
    );
  });

  it("skips hidden rows when moving with the arrow keys", async () => {
    const user = userEvent.setup();
    render(
      <QuizEditor
        mode="edit"
        initialQuiz={quizFixture(4)}
        onSave={saveMock()}
      />,
    );
    // Question 2 becomes a kept editor, then question 4 is open.
    await user.click(screen.getByRole("button", { name: /^Pytanie 2:/ }));
    await user.click(screen.getByRole("button", { name: /^Pytanie 4:/ }));
    // Only question 1 matches; question 2's row stays mounted but hidden.
    await user.type(
      screen.getByRole("searchbox", {
        name: "Szukaj w pytaniach i odpowiedziach",
      }),
      "numer 1",
    );
    const row = screen.getByRole("button", { name: /^Pytanie 1:/ });
    row.focus();
    await user.keyboard("{ArrowDown}");
    expect(row).toHaveFocus();
  });

  it("gives the question and each answer their own image button", () => {
    render(
      <QuizEditor
        mode="edit"
        initialQuiz={quizFixture(1)}
        onSave={saveMock()}
      />,
    );
    const toolbar = screen.getByRole("toolbar", {
      name: "Formatowanie tekstu",
    });
    expect(
      within(toolbar).queryByRole("button", { name: /zdjęcie/ }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Dodaj zdjęcie do pytania" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Dodaj zdjęcie do odpowiedzi 1" }),
    ).toBeInTheDocument();
  });

  it("previews and restores an earlier version from the history", async () => {
    const user = userEvent.setup();
    const quiz = quizFixture(1);
    const [question] = quiz.questions;
    const removed = {
      ...question,
      id: "removed-question",
      text: "Usunięte pytanie",
    };
    const author = {
      id: "author",
      full_name: "Ada Autorka",
      photo: "",
      student_number: "1",
    };
    const versions: QuizVersion[] = [
      {
        version: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author,
        source: "editor",
        restored_from: null,
        title: quiz.title,
        question_count: 1,
        summary: { removed: 1 },
      },
      {
        version: 1,
        created_at: "2026-01-02T08:00:00Z",
        updated_at: "2026-01-02T08:00:00Z",
        author,
        source: "create",
        restored_from: null,
        title: "Pierwszy tytuł",
        question_count: 2,
        summary: { created: true, added: 2 },
      },
    ];
    const toContent = (items: typeof quiz.questions, title: string) => ({
      title,
      description: "",
      questions: items.map((item) => ({
        id: item.id,
        order: item.order,
        text: item.text,
        explanation: "",
        multiple: item.multiple,
        image: null,
        answers: item.answers.map((answer) => ({
          id: answer.id,
          order: answer.order,
          text: answer.text,
          is_correct: answer.is_correct,
          image:
            answer.id === removed.answers[0].id
              ? "https://example.com/a.png"
              : null,
        })),
      })),
    });
    const service = getQuizService();
    vi.spyOn(service, "getQuizVersions").mockResolvedValue(versions);
    vi.spyOn(service, "getQuizVersion").mockImplementation(
      async (_id, version) => {
        await Promise.resolve();
        const summary = versions.find((item) => item.version === version);
        if (summary === undefined) {
          throw new Error("Unknown version");
        }
        return {
          ...summary,
          content:
            version === 1
              ? toContent([question, removed], "Pierwszy tytuł")
              : toContent([question], quiz.title),
        };
      },
    );
    const restored = {
      ...quiz,
      title: "Pierwszy tytuł",
      version: 4,
      questions: [question, { ...removed, order: 2 }],
    };
    const restore = vi
      .spyOn(service, "restoreQuizVersion")
      .mockResolvedValue(restored);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <QuizEditor mode="edit" initialQuiz={quiz} onSave={saveMock()} />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Opcje quizu" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Historia wersji" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Historia wersji",
    });
    const list = within(dialog).getByRole("navigation", { name: "Wersje" });
    expect(await within(list).findByText("Aktualna")).toBeInTheDocument();
    expect(within(list).getAllByText("Ada Autorka")).toHaveLength(2);
    expect(within(list).getByText("Zapis w edytorze")).toBeInTheDocument();
    expect(within(dialog).getByText("Obecna wersja quizu")).toBeInTheDocument();

    await user.click(
      within(list).getByRole("button", { name: /Nowy quiz, 2 pytania/ }),
    );
    expect(
      await within(dialog).findByText("Usunięte pytanie"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Później usunięte")).toBeInTheDocument();
    expect(
      within(dialog)
        .getAllByRole("img")
        .some((img) => img.getAttribute("src") === "https://example.com/a.png"),
    ).toBe(true);

    await user.click(
      within(dialog).getByRole("button", { name: "Przywróć tę wersję" }),
    );
    await waitFor(() => {
      expect(restore).toHaveBeenCalledWith(quiz.id, 1);
    });
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Tytuł quizu" })).toHaveValue(
        "Pierwszy tytuł",
      );
    });
    expect(listRows()).toHaveLength(2);
    // The restored content is saved, so nothing is left unsaved.
    expect(screen.getByRole("status")).not.toHaveTextContent(
      "Niezapisane zmiany",
    );
    const [message, options] = vi.mocked(toast.success).mock.calls[0];
    expect(message).toBe("Przywrócono wersję 1");
    expect((options?.action as ToastAction).label).toBe("Cofnij");
  });

  it("opens the question named in the address", () => {
    const quiz = quizFixture(3);
    window.history.replaceState(null, "", `/#question-${quiz.questions[1].id}`);
    const { unmount } = render(
      <QuizEditor mode="edit" initialQuiz={quiz} onSave={saveMock()} />,
    );
    expect(
      screen.getByRole("textbox", { name: "Treść pytania 2" }),
    ).toHaveValue("Treść numer 2");
    unmount();

    window.history.replaceState(null, "", `/?question=${quiz.questions[2].id}`);
    render(<QuizEditor mode="edit" initialQuiz={quiz} onSave={saveMock()} />);
    expect(
      screen.getByRole("textbox", { name: "Treść pytania 3" }),
    ).toHaveValue("Treść numer 3");
  });

  it("opens the keyboard shortcuts from the quiz menu", async () => {
    const user = userEvent.setup();
    render(
      <QuizEditor
        mode="edit"
        initialQuiz={quizFixture(1)}
        onSave={saveMock()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Opcje quizu" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Skróty klawiszowe" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Skróty klawiszowe",
    });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getAllByText("Ctrl").length).toBeGreaterThan(0);
    expect(within(dialog).queryByText("⌘")).not.toBeInTheDocument();
  });

  it("shows ⌘ and ⇧ in the shortcuts on Apple systems", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605.1.15",
    );
    render(
      <QuizEditor
        mode="edit"
        initialQuiz={quizFixture(1)}
        onSave={saveMock()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Opcje quizu" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Skróty klawiszowe" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Skróty klawiszowe",
    });
    expect(within(dialog).queryByText("Ctrl")).not.toBeInTheDocument();
    expect(within(dialog).getAllByText("⌘").length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText("⇧").length).toBeGreaterThan(0);
  });

  it("attaches an uploaded image to its answer after switching and removing questions", async () => {
    const user = userEvent.setup();
    const quiz = quizFixture(2);
    const targetId = quiz.questions[1].answers[1].id;
    const uploadResult =
      Promise.withResolvers<ApiResponse<ImageUploadResponse>>();
    const upload = vi
      .spyOn(getImageService(), "upload")
      .mockReturnValue(uploadResult.promise);
    const onSave = saveMock();
    render(<QuizEditor mode="edit" initialQuiz={quiz} onSave={onSave} />);

    await user.click(listRows()[1]);
    fireEvent.paste(
      screen.getByRole("textbox", { name: "Odpowiedź 2" }),
      imagePaste(),
    );
    await waitFor(() => {
      expect(upload).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole("button", { name: "Zapisz" })).toBeDisabled();
    expect(screen.getByText("Przesyłanie zdjęć…")).toBeInTheDocument();

    await user.click(listRows()[0]);
    await user.click(screen.getByRole("button", { name: "Usuń pytanie 1" }));
    expect(
      screen.getByRole("textbox", { name: "Treść pytania 1" }),
    ).toHaveValue("Treść numer 2");

    await act(async () => {
      uploadResult.resolve({
        status: 201,
        data: {
          id: "upload-id",
          url: "https://example.com/image.png",
          width: 600,
          height: 80,
          original_filename: "test.png",
          content_type: "image/png",
          file_size: 5,
          uploaded_at: "2026-09-29T00:00:00Z",
        },
      });
      await uploadResult.promise;
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Zapisz" })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    expect(onSave.mock.calls[0][0].questions).toHaveLength(1);
    expect(onSave.mock.calls[0][0].questions[0].answers[1]).toMatchObject({
      id: targetId,
      image_upload: "upload-id",
      image: "https://example.com/image.png",
      image_width: 600,
      image_height: 80,
    });
  });

  it("keeps an existing image when replacing it fails and allows saving afterward", async () => {
    const user = userEvent.setup();
    const quiz = quizFixture(1);
    quiz.questions[0].image = "https://example.com/original.png";
    quiz.questions[0].image_url = "https://example.com/original.png";
    vi.spyOn(getImageService(), "upload").mockRejectedValue(
      new Error("Upload failed"),
    );
    const onSave = saveMock();
    render(<QuizEditor mode="edit" initialQuiz={quiz} onSave={onSave} />);
    fireEvent.paste(
      screen.getByRole("textbox", { name: "Treść pytania 1" }),
      imagePaste(),
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Zapisz" })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    expect(onSave.mock.calls[0][0].questions[0].image_url).toBe(
      "https://example.com/original.png",
    );
  });

  it("preserves a draft across data refreshes and disables duplicate submissions", async () => {
    const user = userEvent.setup();
    const quiz = quizFixture(1);
    const saveResult = Promise.withResolvers<QuizFormData | null>();
    const onSave = vi.fn<SaveQuiz>().mockReturnValue(saveResult.promise);
    const onClose = vi.fn();
    const { rerender } = render(
      <QuizEditor
        mode="edit"
        initialQuiz={quiz}
        onSave={onSave}
        onClose={onClose}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Tytuł quizu" }), {
      target: { value: "Lokalny szkic" },
    });
    rerender(
      <QuizEditor
        mode="edit"
        initialQuiz={{ ...quiz, title: "Odpowiedź od serwera" }}
        onSave={onSave}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole("textbox", { name: "Tytuł quizu" })).toHaveValue(
      "Lokalny szkic",
    );
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole("textbox", { name: "Tytuł quizu" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Zapisz i wróć" }),
    ).toBeDisabled();
    await act(async () => {
      saveResult.resolve(onSave.mock.calls[0][0]);
      await saveResult.promise;
    });
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Zapisano");
    });
    await user.click(screen.getByRole("button", { name: "Zapisz i wróć" }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    // Zapisz i wróć saves before leaving.
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave.mock.calls[1][0].title).toBe("Lokalny szkic");
  });

  it("keeps guarding the draft while a save is pending and after it fails", async () => {
    const user = userEvent.setup();
    const saveResult = Promise.withResolvers<QuizFormData | null>();
    const onSave = vi.fn<SaveQuiz>().mockReturnValue(saveResult.promise);
    const onClose = vi.fn();
    render(
      <>
        <a href="/quizzes">Twoje quizy</a>
        <QuizEditor
          mode="edit"
          initialQuiz={quizFixture(1)}
          onSave={onSave}
          onClose={onClose}
        />
      </>,
    );
    const link = screen.getByRole("link", { name: "Twoje quizy" });
    const followed = vi.fn((event: MouseEvent) => {
      event.preventDefault();
    });
    link.addEventListener("click", followed);
    fireEvent.change(screen.getByRole("textbox", { name: "Tytuł quizu" }), {
      target: { value: "Szkic" },
    });

    await user.click(screen.getByRole("button", { name: "Zapisz i wróć" }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    await user.click(link);
    expect(followed).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog", {
      name: "Masz niezapisane zmiany",
    });
    expect(
      within(dialog)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Zostań", "Odrzuć zmiany"]);
    await user.click(within(dialog).getByRole("button", { name: "Zostań" }));

    await act(async () => {
      saveResult.resolve(null);
      await saveResult.promise;
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Tytuł quizu" })).toHaveValue(
      "Szkic",
    );
    await user.click(link);
    expect(followed).not.toHaveBeenCalled();
    const again = await screen.findByRole("alertdialog", {
      name: "Masz niezapisane zmiany",
    });
    await user.click(within(again).getByRole("button", { name: "Zostań" }));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });
});
