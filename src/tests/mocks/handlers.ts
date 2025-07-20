import { HttpResponse, http } from "msw";
import { Quiz } from "../../components/quiz/types";
import { mockTerms, mockCourses } from "./GradesMock";
import { mockQuiz } from "./QuizMock";

export const handlers = [
  http.post("/quizzes/", async ({ request }) => {
    const quiz = (await request.json()) as Quiz;

    return HttpResponse.json(
      {
        ...quiz,
        id: "123",
      },
      { status: 201 }
    );
  }),
  http.get("/study-groups/", () => {
    return HttpResponse.json([]);
  }),
  http.get("/shared-quizzes/", ({ request }) => {
    const url = new URL(request.url);
    const quizId = url.searchParams.get("quiz");
    return HttpResponse.json({ quizId, shared: false });
  }),
  http.get("/grades/", () =>
    HttpResponse.json({ terms: mockTerms, courses: mockCourses })
  ),
  http.post("/import-quiz-from-link/", async () =>
    HttpResponse.json(mockQuiz, { status: 201 })
  ),
];
