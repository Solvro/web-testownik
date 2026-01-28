import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import assert from "node:assert";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateQuizPageClient as CreateQuizPage } from "@/app/create-quiz/client";
import { server } from "@/test-utils/mocks/server";
import { Providers } from "@/test-utils/providers";
import { generateTestToken } from "@/test-utils/token-factory";
import type { Quiz } from "@/types/quiz";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

const testQuiz = {
  title: "test quiz",
  description: "test description",
  questions: ["test question 1", "test question 2"],
  answers: ["test answer 1", "test answer 2", "test answer 3", "test answer 4"],
};

const setup = async ({ asGuest = false } = {}) => {
  const user = userEvent.setup();
  const token = await generateTestToken();

  render(
    <Providers guest={asGuest} accessToken={token}>
      <CreateQuizPage />
    </Providers>,
  );

  const fillFields = async () => {
    await user.type(
      screen.getByPlaceholderText(/podaj tytuł quizu/i),
      testQuiz.title,
    );
    await user.type(
      screen.getByPlaceholderText(/podaj opis quizu/i),
      testQuiz.description,
    );

    // Questions are always visible in the restored design
    const questionTextareas = screen.getAllByPlaceholderText(/treść pytania/i);
    await user.type(questionTextareas[0], testQuiz.questions[0]);

    const answers = screen.getAllByPlaceholderText(/Odpowiedź \d/i);
    await user.type(answers[0], testQuiz.answers[0]);
    await user.type(answers[1], testQuiz.answers[1]);

    // Mark first answer as correct
    const checkboxes = screen.getAllByRole("checkbox", {
      name: /oznacz jako poprawną|wielokrotny wybór/i,
    });
    // Skip the "all questions multiple" checkbox and click first answer checkbox
    const answerCheckbox = checkboxes.find(
      (checkbox) =>
        checkbox.getAttribute("id")?.includes("all-multiple") !== true &&
        checkbox.getAttribute("id")?.includes("multiple-choice") !== true,
    );
    if (answerCheckbox != null) {
      await user.click(answerCheckbox);
    }
  };

  const submit = async () => {
    await user.click(screen.getByRole("button", { name: /utwórz/i }));
  };

  const addQuestion = async () => {
    // Use the "Dodaj pytanie" button in the header
    const addButtons = screen.getAllByRole("button", {
      name: /dodaj pytanie/i,
    });
    await user.click(addButtons[0]);
  };

  const removeQuestion = async () => {
    const removeButtons = screen.getAllByRole("button", {
      name: /usuń pytanie/i,
    });
    await user.click(removeButtons[0]);
  };

  return { user, fillFields, submit, addQuestion, removeQuestion };
};

describe("CreateQuizPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("should try to post quiz if user is authenticated", async () => {
    const { fillFields, submit } = await setup();

    await fillFields();
    await submit();

    expect(toast.success).toHaveBeenCalled();
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
    expect(toast.error).toHaveBeenCalledWith("Tytuł quizu jest wymagany");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("should show validation error if question field is empty", async () => {
    const { user, submit } = await setup();
    await user.type(
      screen.getByPlaceholderText(/podaj tytuł quizu/i),
      testQuiz.title,
    );

    // Fill answers to satisfy answer validation
    const answers = screen.getAllByPlaceholderText(/Odpowiedź \d/i);
    await user.type(answers[0], testQuiz.answers[0]);
    await user.type(answers[1], testQuiz.answers[1]);

    await submit();

    // Toast shows validation error - answers are validated first since they're nested
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Pytanie 1: Tekst pytania nie może być pusty"),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("should show validation error if one of the answer fields is empty", async () => {
    const { user, submit } = await setup();

    await user.type(
      screen.getByPlaceholderText(/podaj tytuł quizu/i),
      testQuiz.title,
    );
    const questionTextareas = screen.getAllByPlaceholderText(/treść pytania/i);
    await user.type(questionTextareas[0], testQuiz.questions[0]);
    await submit();

    // Toast shows validation error when answers are empty
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Pytanie 1, Odpowiedź 1: Tekst odpowiedzi nie może być pusty",
      ),
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

    // Wait for the second question's content to be visible
    const questionTextareas =
      await screen.findAllByPlaceholderText(/treść pytania/i);
    expect(questionTextareas).toHaveLength(2);
    await user.type(questionTextareas[1], testQuiz.questions[1]);

    const answerFields = screen.getAllByPlaceholderText(/Odpowiedź \d/i);
    await user.type(answerFields[2], testQuiz.answers[2]);
    await user.type(answerFields[3], testQuiz.answers[3]);

    await submit();

    assert.ok(apiRequest != null, "API request should be defined");
    expect(apiRequest.questions).toHaveLength(2);
    expect(apiRequest.questions[0].text).toContain(testQuiz.questions[0]);
    expect(apiRequest.questions[1].text).toContain(testQuiz.questions[1]);
  });

  it("should be possible to remove question", async () => {
    const { removeQuestion, addQuestion } = await setup();
    await addQuestion();

    // Verify we have 2 questions by checking for "Pytanie 2" label
    const labels = screen.getAllByText(/pytanie \d/i);
    const questionLabels = labels.filter((label) =>
      /^pytanie \d$/i.test(label.textContent),
    );
    expect(questionLabels).toHaveLength(2);

    await removeQuestion();

    // Should now have only 1 question
    const labelsAfter = screen.getAllByText(/pytanie \d/i);
    const questionLabelsAfter = labelsAfter.filter((label) =>
      /^pytanie \d$/i.test(label.textContent),
    );
    expect(questionLabelsAfter).toHaveLength(1);
  });
});
