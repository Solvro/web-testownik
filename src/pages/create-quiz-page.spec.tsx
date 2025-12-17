import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import assert from "node:assert";
import { toast } from "react-toastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Quiz } from "@/types/quiz";

import { server } from "../tests/mocks/server";
import { Providers } from "../tests/providers";
import { CreateQuizPage } from "./create-quiz-page";

vi.mock("react-toastify", () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

const testQuiz = {
  title: "test quiz",
  description: "test description",
  questions: ["test question 1", "test question 2"],
  answers: ["test answer 1", "test answer 2", "test answer 3", "test answer 4"],
};

const setup = ({ asGuest: guest = false } = {}) => {
  const user = userEvent.setup();

  render(
    <Providers guest={guest}>
      <CreateQuizPage />
    </Providers>,
  );

  const fillFields = async () => {
    await user.type(screen.getByPlaceholderText(/tytuł/i), testQuiz.title);
    await user.type(screen.getByPlaceholderText(/opis/i), testQuiz.description);
    await user.type(
      screen.getByPlaceholderText(/treść pytania/i),
      testQuiz.questions[0],
    );

    const answers = screen.getAllByPlaceholderText(/treść odpowiedzi/i);
    await user.type(answers[0], testQuiz.answers[0]);
    await user.type(answers[1], testQuiz.answers[1]);

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
  };

  const submit = async () => {
    await user.click(screen.getByRole("button", { name: /utwórz/i }));
  };

  const addQuestion = async () => {
    await user.click(screen.getByRole("button", { name: /dodaj pytanie/i }));
  };

  const removeQuestion = async () => {
    await user.click(
      screen.getAllByRole("button", { name: /usuń pytanie/i })[0],
    );
  };

  return { user, fillFields, submit, addQuestion, removeQuestion };
};

describe("CreateQuizPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("should try to post quiz if user is authenticated", async () => {
    const { fillFields, submit } = setup();

    await fillFields();
    await submit();

    expect(toast.success).toHaveBeenCalled();
  });

  it("should show error if request fails", async () => {
    const { fillFields, submit } = setup();
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
    const { submit } = setup();

    await submit();

    expect(toast.error).not.toHaveBeenCalled();
    expect(await screen.findByText(/podaj tytuł quizu\./i)).toBeVisible();
  });

  it("should show validation error if question field is empty", async () => {
    const { user, submit } = setup();
    await user.type(
      screen.getByPlaceholderText(/podaj tytuł/i),
      testQuiz.title,
    );
    await submit();

    expect(toast.error).not.toHaveBeenCalled();
    expect(await screen.findByText(/pytanie.*treść/i)).toBeVisible();
  });

  it("should show validation error if one of the answer fields is empty", async () => {
    const { user, submit } = setup();

    await user.type(
      screen.getByPlaceholderText(/podaj tytuł/i),
      testQuiz.title,
    );
    await user.type(
      screen.getByPlaceholderText(/treść pytania/i),
      testQuiz.questions[0],
    );
    await submit();

    expect(toast.error).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/odpowiedź.*musi mieć treść\./i),
    ).toBeVisible();
  });

  it("should be possible to add question", async () => {
    const { addQuestion, user, submit, fillFields } = setup();
    let apiRequest: Quiz | undefined;

    server.use(
      http.post("*/quizzes/", async ({ request }) => {
        apiRequest = (await request.json()) as Quiz;
        return HttpResponse.json({ ...apiRequest, id: "123" }, { status: 201 });
      }),
    );

    await fillFields();
    await addQuestion();
    await user.type(
      screen.getAllByPlaceholderText(/treść pytania/i)[1],
      testQuiz.questions[1],
    );
    await user.type(
      screen.getAllByPlaceholderText(/treść odpowiedzi/i)[2],
      testQuiz.answers[2],
    );
    await user.type(
      screen.getAllByPlaceholderText(/treść odpowiedzi/i)[3],
      testQuiz.answers[3],
    );
    await submit();

    expect(screen.getByText(/pytanie 2/i)).toBeVisible();

    assert.ok(apiRequest != null, "API request should be defined");
    expect(apiRequest.questions).toHaveLength(2);
    expect(apiRequest.questions[0].question).toContain(testQuiz.questions[0]);
    expect(apiRequest.questions[1].question).toContain(testQuiz.questions[1]);
  });

  it("should be possible to remove question", async () => {
    const { removeQuestion, addQuestion } = setup();
    await addQuestion();
    expect(screen.getAllByText(/pytanie \d/i)).toHaveLength(2);

    await removeQuestion();

    expect(screen.getAllByText(/pytanie \d/i)).toHaveLength(1);
  });
});
