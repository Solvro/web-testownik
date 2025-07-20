import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { toast } from "react-toastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Quiz } from "../components/quiz/types";
import { server } from "../tests/mocks/server";
import { Providers } from "../tests/Providers";
import CreateQuizPage from "./CreateQuizPage";

vi.mock("react-toastify", () => ({
  toast: { error: vi.fn(), info: vi.fn() },
}));

const setup = (guest = false) => {
  const user = userEvent.setup();

  render(
    <Providers guest={guest}>
      <CreateQuizPage />
    </Providers>
  );

  const fillFields = async () => {
    await user.type(screen.getByPlaceholderText(/tytuł/i), "test quiz");
    await user.type(screen.getByPlaceholderText(/opis/i), "test description");
    await user.type(screen.getByPlaceholderText(/pytania/i), "test question");

    const answers = screen.getAllByPlaceholderText(/odpowiedzi/i);
    await user.type(answers[0], "test answer 1");
    await user.type(answers[1], "test answer 2");

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
  };

  const submit = async () => {
    await user.click(screen.getByRole("button", { name: /stwórz quiz/i }));
  };

  const addQuestion = async () => {
    await user.click(screen.getByRole("button", { name: /dodaj pytanie/i }));
  };

  const removeQuestion = async () => {
    await user.click(
      screen.getAllByRole("button", { name: /usuń pytanie/i })[0]
    );
  };

  return { user, fillFields, submit, addQuestion, removeQuestion };
};

describe("CreateQuizPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("should store quiz in local storage for guest users", async () => {
    const { fillFields, submit } = setup(true);

    await fillFields();
    await submit();

    const stored = JSON.parse(localStorage.getItem("guest_quizzes") || "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe("test quiz");
  });

  it("should try to post quiz if user is authenticated", async () => {
    const { fillFields, submit } = setup();

    await fillFields();
    await submit();

    expect(screen.getByText(/test quiz/i)).toBeInTheDocument();
  });

  it("should show error if request fails", async () => {
    const { fillFields, submit } = setup();
    server.use(
      http.post("/quizzes/", async () => {
        return HttpResponse.error();
      })
    );

    await fillFields();
    await submit();

    expect(toast.error).toHaveBeenCalled();
    expect(screen.getByText(/wystąpił błąd/i)).toBeInTheDocument();
  });

  it("should show validation error if title is empty", async () => {
    const { submit } = setup();

    await submit();

    expect(toast.error).toHaveBeenCalled();
    expect(screen.getByText(/podaj tytuł/i)).toBeInTheDocument();
  });

  it("should show validation error if qustion field is empty", async () => {
    const { user, submit } = setup();
    await user.type(screen.getByPlaceholderText(/podaj tytuł/i), "test quiz");
    await submit();

    expect(toast.error).toBeCalled();
    expect(screen.getByText(/pytanie.*treść/i));
  });

  it("should show validation error if one of the answer fields is empty", async () => {
    const { user, submit } = setup();

    await user.type(screen.getByPlaceholderText(/podaj tytuł/i), "test quiz");
    await user.type(
      screen.getByPlaceholderText(/treść pytania/i),
      "test question"
    );
    await submit();

    expect(toast.error).toBeCalled();
    expect(
      screen.getByText(/odpowiedź.*w pytaniu.*treść/i)
    ).toBeInTheDocument();
  });

  it("should be possible to add question", async () => {
    const { addQuestion, user, submit, fillFields } = setup();
    let apiRequest: Quiz | null = null;

    server.use(
      http.post("*/quizzes", async ({ request }) => {
        apiRequest = (await request.json()) as Quiz;
        return HttpResponse.json({ ...apiRequest, id: "123" }, { status: 201 });
      })
    );

    await fillFields();
    await addQuestion();
    await user.type(
      screen.getAllByPlaceholderText(/treść pytania/i)[1],
      "test question 2"
    );
    await user.type(
      screen.getAllByPlaceholderText(/treść odpowiedzi/i)[2],
      "test answer 3"
    );
    await user.type(
      screen.getAllByPlaceholderText(/treść odpowiedzi/i)[3],
      "test answer 4"
    );
    await submit();

    expect(screen.getByText(/pytanie 2/i)).toBeInTheDocument();

    expect(apiRequest!.questions).toHaveLength(2);
    expect(apiRequest!.questions[0].question).toMatch(/test question/i);
    expect(apiRequest!.questions[1].question).toMatch(/test question/i);
  });

  it("should be possible to remove question", async () => {
    const { removeQuestion, addQuestion } = setup();
    await addQuestion();
    expect(screen.getAllByText(/pytanie \d/i)).toHaveLength(2);

    await removeQuestion();

    expect(screen.getAllByText(/pytanie \d/i)).toHaveLength(1);
  });
});
