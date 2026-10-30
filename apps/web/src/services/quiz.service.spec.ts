import type { AnswerRecord } from "@testownik/core/quiz/types";
import { HttpResponse, http } from "msw";
import { describe, expect, test } from "vitest";

import { server } from "@/test-utils/mocks/server";

import { QuizService } from "./quiz.service";

const answer: AnswerRecord = {
  id: "record",
  question: "question",
  answered_at: "2026-01-01T00:00:00Z",
  selected_answers: ["answer"],
  was_correct: true,
};

describe("recordAnswer", () => {
  test.each([true, false, undefined])(
    "sends self_assessment=%s with the appropriate selected answers",
    async (selfAssessment) => {
      let payload: unknown;
      server.use(
        http.post(
          "http://test.local/quizzes/quiz/answer/",
          async ({ request }) => {
            payload = await request.json();
            return HttpResponse.json(answer);
          },
        ),
      );
      const service = new QuizService("http://test.local");
      await service.recordAnswer("quiz", answer, 12, "next", {
        selfAssessment,
      });
      expect(payload).toEqual({
        question_id: "question",
        study_time: 12,
        next_question: "next",
        selected_answers: selfAssessment === undefined ? ["answer"] : [],
        ...(selfAssessment === undefined
          ? {}
          : { self_assessment: selfAssessment }),
      });
    },
  );
});

test("a skip sends skipped=true with no selected answers", async () => {
  let payload: unknown;
  server.use(
    http.post("http://test.local/quizzes/quiz/answer/", async ({ request }) => {
      payload = await request.json();
      return HttpResponse.json(answer);
    }),
  );
  const service = new QuizService("http://test.local");
  await service.recordAnswer("quiz", answer, 12, "next", { skipped: true });
  expect(payload).toEqual({
    question_id: "question",
    study_time: 12,
    next_question: "next",
    selected_answers: [],
    skipped: true,
  });
});

describe("question creation", () => {
  test.each([false, true])("sends type fields for bulk=%s", async (bulk) => {
    let payload: unknown;
    server.use(
      http.post(
        bulk
          ? "http://test.local/questions/bulk-create/"
          : "http://test.local/questions/",
        async ({ request }) => {
          payload = await request.json();
          return HttpResponse.json(bulk ? [] : {});
        },
      ),
    );
    const service = new QuizService("http://test.local");
    const question = {
      text: "Question",
      type: "open" as const,
      open_matching: "similar" as const,
      answers: [{ text: "Answer", is_correct: true }],
    };
    await (bulk
      ? service.bulkCreateQuestions("quiz", [question])
      : service.createQuestion("quiz", question));
    const expected = {
      ...question,
      explanation: "",
      image_url: null,
      image_upload: null,
      is_markdown_enabled: true,
      is_ai_generated: false,
      answers: [
        {
          order: 1,
          text: "Answer",
          is_correct: true,
          image_url: null,
          image_upload: null,
        },
      ],
    };
    expect(payload).toEqual(
      bulk
        ? { quiz: "quiz", questions: [expected] }
        : { quiz: "quiz", ...expected },
    );
  });
});
