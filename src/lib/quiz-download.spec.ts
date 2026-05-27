import { afterEach, describe, expect, test, vi } from "vitest";

import { AccessLevel } from "@/types/quiz";
import type { Quiz } from "@/types/quiz";

import { prepareQuizForDownload } from "./quiz-download";

describe("prepareQuizForDownload", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("exports uploaded question and answer images as base64 data urls", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => {
      return await Promise.resolve({
        ok: true,
        blob: async () =>
          await Promise.resolve(
            new Blob(["image-bytes"], { type: "image/png" }),
          ),
      } satisfies Pick<Response, "blob" | "ok">);
    });
    vi.stubGlobal("fetch", fetchMock);

    const quiz: Quiz = {
      id: "quiz-1",
      title: "Quiz",
      description: "Description",
      version: 1,
      visibility: AccessLevel.PRIVATE,
      allow_anonymous: false,
      is_anonymous: false,
      questions: [
        {
          id: "q1",
          order: 1,
          text: "Question",
          multiple: false,
          image: "https://api.example.test/uploads/q1.png",
          image_upload: "question-upload-id",
          answers: [
            {
              id: "a1",
              order: 1,
              text: "Answer",
              is_correct: true,
              image: "https://api.example.test/uploads/a1.png",
              image_upload: "answer-upload-id",
            },
          ],
        },
      ],
    };

    const result = await prepareQuizForDownload(quiz);

    expect(result.questions[0].image_url).toBe(
      "data:image/png;base64,aW1hZ2UtYnl0ZXM=",
    );
    expect(result.questions[0].answers[0].image_url).toBe(
      "data:image/png;base64,aW1hZ2UtYnl0ZXM=",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("keeps external image urls as urls", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const quiz: Quiz = {
      id: "quiz-1",
      title: "Quiz",
      description: "Description",
      version: 1,
      visibility: AccessLevel.PRIVATE,
      allow_anonymous: false,
      is_anonymous: false,
      questions: [
        {
          id: "q1",
          order: 1,
          text: "Question",
          multiple: false,
          image: "https://example.test/q1.png",
          image_upload: null,
          answers: [
            {
              id: "a1",
              order: 1,
              text: "Answer",
              is_correct: true,
              image: "https://example.test/a1.png",
              image_upload: null,
            },
          ],
        },
      ],
    };

    const result = await prepareQuizForDownload(quiz);

    expect(result.questions[0].image_url).toBe("https://example.test/q1.png");
    expect(result.questions[0].answers[0].image_url).toBe(
      "https://example.test/a1.png",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
