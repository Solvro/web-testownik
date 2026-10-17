import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Quiz } from "@testownik/core/quiz/types";
import { HttpResponse, http } from "msw";
import assert from "node:assert";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateQuizPageClient as CreateQuizPage } from "@/app/create-quiz/client";
import { createQuestion } from "@/components/quiz/editor/quiz-editor-factories";
import { server } from "@/test-utils/mocks/server";
import { Providers } from "@/test-utils/providers";
import { generateTestToken } from "@/test-utils/token-factory";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  }),
}));

const testQuiz = {
  title: "test quiz",
  description: "test description",
  questions: ["test question 1", "test question 2"],
  answers: ["test answer 1", "test answer 2", "test answer 3", "test answer 4"],
};

function questionRows() {
  return within(screen.getByRole("list", { name: "Lista pytań" })).getAllByRole(
    "listitem",
  );
}

const setup = async () => {
  const user = userEvent.setup();
  const token = await generateTestToken();

  render(
    <Providers accessToken={token}>
      <CreateQuizPage
        initialValues={{
          title: "",
          description: "",
          questions: [createQuestion(1)],
        }}
      />
    </Providers>,
  );

  const fillFields = async () => {
    const questionTextareas = screen.getAllByPlaceholderText(/treść pytania/i);
    const answers = screen.getAllByPlaceholderText(/Odpowiedź \d/i);
    const fields: [HTMLElement, string][] = [
      [screen.getByRole("textbox", { name: "Tytuł quizu" }), testQuiz.title],
      [
        screen.getByRole("textbox", { name: "Opis quizu" }),
        testQuiz.description,
      ],
      [questionTextareas[0], testQuiz.questions[0]],
      [answers[0], testQuiz.answers[0]],
      [answers[1], testQuiz.answers[1]],
    ];
    // Paste fixtures in submission tests; editor tests cover individual keystrokes.
    for (const [field, text] of fields) {
      await user.click(field);
      await user.paste(text);
    }

    await user.click(
      screen.getByRole("button", { name: "Poprawna odpowiedź 1" }),
    );
  };

  const submit = async () => {
    await user.click(screen.getByRole("button", { name: /utwórz/i }));
  };

  const addQuestion = async () => {
    const addButtons = screen.getAllByRole("button", {
      name: /dodaj pytanie/i,
    });
    await user.click(addButtons[0]);
  };

  const removeQuestion = async () => {
    await user.click(screen.getByRole("button", { name: /^Usuń pytanie \d/ }));
  };

  return {
    user,
    token,
    fillFields,
    submit,
    addQuestion,
    removeQuestion,
  };
};

describe("CreateQuizPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("should try to post quiz if user is authenticated", async () => {
    let authorization: string | null = null;
    let postedQuiz: Quiz | undefined;
    server.use(
      http.post("*/quizzes/", async ({ request }) => {
        authorization = request.headers.get("authorization");
        postedQuiz = (await request.json()) as Quiz;
        return HttpResponse.json({ ...postedQuiz, id: "123" }, { status: 201 });
      }),
    );
    const { token, fillFields, submit } = await setup();

    await fillFields();
    await submit();

    await waitFor(() => {
      expect(postedQuiz).toBeDefined();
    });
    expect(authorization).toBe(`Bearer ${token}`);
    expect(postedQuiz).toEqual(
      expect.objectContaining({ title: testQuiz.title }),
    );
  });

  it("should show error if request fails", async () => {
    const { fillFields, submit } = await setup();
    server.use(
      http.post("*/quizzes/", () => {
        return HttpResponse.error();
      }),
    );

    await fillFields();
    await submit();

    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/błąd/i));
  });

  it("should show validation error if title is empty", async () => {
    const { submit } = await setup();

    await submit();

    // Toast shows validation error when form is invalid
    expect(toast.error).toHaveBeenCalledWith(
      "Tytuł quizu jest wymagany",
      expect.objectContaining({
        actionButtonStyle: expect.objectContaining({}) as unknown as Record<
          string,
          unknown
        >,
      }),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("should show validation error if question field is empty", async () => {
    const { user, submit } = await setup();
    await user.type(
      screen.getByRole("textbox", { name: "Tytuł quizu" }),
      testQuiz.title,
    );

    // Fill answers to satisfy answer validation
    const answers = screen.getAllByPlaceholderText(/Odpowiedź \d/i);
    await user.type(answers[0], testQuiz.answers[0]);
    await user.type(answers[1], testQuiz.answers[1]);

    await submit();

    // Toast shows validation error - question must contain text or image
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Pytanie 1: Pytanie musi zawierać tekst lub zdjęcie",
      ),
      expect.objectContaining({
        action: expect.objectContaining({
          label: "Pokaż",
        }) as unknown as Record<string, unknown>,
      }),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("should show validation error if one of the answer fields is empty", async () => {
    const { user, submit } = await setup();

    await user.type(
      screen.getByRole("textbox", { name: "Tytuł quizu" }),
      testQuiz.title,
    );
    const questionTextareas = screen.getAllByPlaceholderText(/treść pytania/i);
    await user.type(questionTextareas[0], testQuiz.questions[0]);
    await submit();

    // Toast shows validation error when answers are empty (text or image required)
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Pytanie 1, Odpowiedź 1: Odpowiedź musi zawierać tekst lub zdjęcie",
      ),
      expect.objectContaining({
        action: expect.objectContaining({
          label: "Pokaż",
        }) as unknown as Record<string, unknown>,
      }),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("should be possible to add question", async () => {
    const { addQuestion, user, submit, fillFields } = await setup();
    let apiRequest: Quiz | undefined;

    server.use(
      http.post("*/quizzes/", async ({ request }) => {
        apiRequest = (await request.json()) as Quiz;
        return HttpResponse.json({ ...apiRequest, id: "123" }, { status: 201 });
      }),
    );

    await fillFields();
    await addQuestion();

    const newQuestion = await screen.findByRole("article", {
      name: "Pytanie 2",
    });
    expect(
      within(newQuestion).getByRole("textbox", { name: "Treść pytania 2" }),
    ).toHaveValue("");
    await user.type(
      within(newQuestion).getByRole("textbox", { name: "Treść pytania 2" }),
      testQuiz.questions[1],
    );
    await user.type(
      within(newQuestion).getByRole("textbox", { name: "Odpowiedź 1" }),
      testQuiz.answers[2],
    );
    await user.type(
      within(newQuestion).getByRole("textbox", { name: "Odpowiedź 2" }),
      testQuiz.answers[3],
    );
    // Single choice needs exactly one correct answer to save.
    await user.click(
      within(newQuestion).getByRole("button", { name: "Poprawna odpowiedź 1" }),
    );

    await submit();

    assert.ok(apiRequest != null, "API request should be defined");
    expect(apiRequest.questions).toHaveLength(2);
    expect(apiRequest.questions[0].text).toContain(testQuiz.questions[0]);
    expect(apiRequest.questions[1].text).toContain(testQuiz.questions[1]);
  });

  it("should be possible to remove question", async () => {
    const { removeQuestion, addQuestion } = await setup();
    await addQuestion();

    expect(questionRows()).toHaveLength(2);

    await removeQuestion();

    expect(questionRows()).toHaveLength(1);
    expect(toast).toHaveBeenCalledWith(
      "Usunięto pytanie 2",
      expect.objectContaining({
        action: expect.objectContaining({
          label: "Cofnij",
        }) as unknown as Record<string, unknown>,
      }),
    );
  });
});
