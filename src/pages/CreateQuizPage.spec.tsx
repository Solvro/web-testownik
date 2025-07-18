import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppContext from "../AppContext";
import { AppTheme } from "../Theme";
import CreateQuizPage from "./CreateQuizPage";

vi.mock("react-toastify", () => ({
  toast: { error: vi.fn(), info: vi.fn() },
}));

const setup = () => {
  const user = userEvent.setup();

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

  return { user, fillFields };
};

describe("CreateQuizPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("should store quiz in local storage for guest users", async () => {
    const { user, fillFields } = setup();
    const ctx = {
      isGuest: true,
      isAuthenticated: false,
      axiosInstance: { post: vi.fn() },
      theme: new AppTheme(),
    };
    render(
      <AppContext.Provider value={ctx as never}>
        <MemoryRouter>
          <CreateQuizPage />
        </MemoryRouter>
      </AppContext.Provider>
    );

    await fillFields();
    await user.click(screen.getByText(/stwórz quiz/i));

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem("guest_quizzes") || "[]");
      expect(stored).toHaveLength(1);
      expect(stored[0].title).toBe("test quiz");
    });
  });

  it("should try to post quiz if user is authenticated", async () => {
    const { user, fillFields } = setup();
    const createdQuiz = {
      id: "123",
      title: "test quiz",
      description: "test description",
      questions: [
        {
          id: 1,
          question: "test question",
          multiple: true,
          answers: [
            { answer: "test answer 1", correct: true },
            { answer: "test answer 2", correct: false },
          ],
        },
      ],
    };

    const mockPost = vi.fn().mockResolvedValue({
      status: 201,
      data: createdQuiz,
    });

    const ctx = {
      isGuest: false,
      isAuthenticated: true,
      axiosInstance: { post: mockPost },
      theme: new AppTheme(),
    };

    render(
      <AppContext.Provider value={ctx as never}>
        <MemoryRouter>
          <CreateQuizPage />
        </MemoryRouter>
      </AppContext.Provider>
    );

    await fillFields();
    await user.click(screen.getByText(/stwórz quiz/i));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/quizzes/", {
        title: "test quiz",
        description: "test description",
        questions: expect.any(Array),
      });
    });
  });
});
