import { act, renderHook } from "@testing-library/react";
import { prepareQuizForSubmission } from "@testownik/core/quiz/schema";
import type { QuizFormData } from "@testownik/core/quiz/schema";
import { AccessLevel } from "@testownik/core/quiz/types";
import type { Question, Quiz } from "@testownik/core/quiz/types";
import { HttpResponse, http } from "msw";
import { describe, expect, test } from "vitest";

import { validateLegacyQuiz } from "@/components/quiz/helpers/legacy-quiz-validation";
import { validateQuiz } from "@/components/quiz/helpers/quiz-validation";
import { normalizeQuestionTypeFields } from "@/lib/migration";
import { server } from "@/test-utils/mocks/server";

import {
  countDataUrlImages,
  extractImagesToUpload,
  parseQuestion,
  uploadDataUrlImages,
  useImportQuiz,
} from "./import-quiz";

describe("extractImagesToUpload", () => {
  test("should find images in questions and answers", () => {
    const questions: Question[] = [
      {
        id: "q1",
        text: "Question with [img]q1.png[/img]",
        answers: [
          {
            id: "a1",
            text: "Answer with [img]a1.png[/img]",
            is_correct: true,
            order: 1,
          },
          { id: "a2", text: "Normal answer", is_correct: false, order: 2 },
        ],
        order: 1,
        type: "single_choice",
        shuffle_answers: true,
        open_matching: "exact",
        explanation: "",
      },
      {
        id: "q2",
        text: "Normal question",
        answers: [],
        order: 2,
        type: "single_choice",
        shuffle_answers: true,
        open_matching: "exact",
        explanation: "",
      },
    ];

    const images = extractImagesToUpload(questions);

    expect(images).toHaveLength(2);
    expect(images).toContainEqual({
      type: "question",
      id: "q1",
      filename: "q1.png",
    });
    expect(images).toContainEqual({
      type: "answer",
      id: "a1",
      filename: "a1.png",
    });
  });

  test("should find multiple images in the same question text", () => {
    const questions: Question[] = [
      {
        id: "q1",
        text: "Question with [img]img1.png[/img] and [img]img2.png[/img]",
        answers: [],
        order: 1,
        type: "single_choice",
        shuffle_answers: true,
        open_matching: "exact",
        explanation: "",
      },
    ];

    const images = extractImagesToUpload(questions);

    expect(images).toHaveLength(2);
    expect(images).toContainEqual({
      type: "question",
      id: "q1",
      filename: "img1.png",
    });
    expect(images).toContainEqual({
      type: "question",
      id: "q1",
      filename: "img2.png",
    });
  });

  test("should find multiple images in the same answer text", () => {
    const questions: Question[] = [
      {
        id: "q1",
        text: "Question",
        answers: [
          {
            id: "a1",
            text: "Answer with [img]a1.png[/img] and [img]a2.png[/img]",
            is_correct: true,
            order: 1,
          },
        ],
        order: 1,
        type: "single_choice",
        shuffle_answers: true,
        open_matching: "exact",
        explanation: "",
      },
    ];

    const images = extractImagesToUpload(questions);

    expect(images).toHaveLength(2);
    expect(images).toContainEqual({
      type: "answer",
      id: "a1",
      filename: "a1.png",
    });
    expect(images).toContainEqual({
      type: "answer",
      id: "a1",
      filename: "a2.png",
    });
  });

  test("should handle images with paths", () => {
    const questions: Question[] = [
      {
        id: "q1",
        text: "Question with [img]folder/subfolder/image.png[/img]",
        answers: [],
        order: 1,
        type: "single_choice",
        shuffle_answers: true,
        open_matching: "exact",
        explanation: "",
      },
    ];

    const images = extractImagesToUpload(questions);

    expect(images).toHaveLength(1);
    expect(images).toContainEqual({
      type: "question",
      id: "q1",
      filename: "folder/subfolder/image.png",
    });
  });

  test("should return empty array when no images", () => {
    const questions: Question[] = [
      {
        id: "q1",
        text: "Question without images",
        answers: [
          {
            id: "a1",
            text: "Answer without images",
            is_correct: true,
            order: 1,
          },
        ],
        order: 1,
        type: "single_choice",
        shuffle_answers: true,
        open_matching: "exact",
        explanation: "",
      },
    ];

    const images = extractImagesToUpload(questions);

    expect(images).toHaveLength(0);
  });

  test("should handle empty filename in img tag", () => {
    const questions: Question[] = [
      {
        id: "q1",
        text: "Question with [img][/img]",
        answers: [],
        order: 1,
        type: "single_choice",
        shuffle_answers: true,
        open_matching: "exact",
        explanation: "",
      },
    ];

    const images = extractImagesToUpload(questions);

    expect(images).toHaveLength(1);
    expect(images).toContainEqual({
      type: "question",
      id: "q1",
      filename: "",
    });
  });
});

describe("uploadDataUrlImages", () => {
  test("should upload data url images and replace them with upload ids", async () => {
    const quiz: Quiz = {
      id: "quiz-1",
      title: "Test Quiz",
      description: "Description",
      version: 1,
      visibility: AccessLevel.PRIVATE,
      allow_anonymous: false,
      is_anonymous: false,
      questions: [
        {
          id: "q1",
          order: 1,
          text: "Question 1",
          explanation: "",
          type: "single_choice",
          shuffle_answers: true,
          open_matching: "exact",
          image_url: "data:image/png;base64,aW1hZ2UtYnl0ZXM=",
          answers: [
            {
              id: "a1",
              order: 1,
              text: "Answer 1",
              is_correct: true,
              image_url: "data:image/jpeg;base64,YW5zd2VyLWJ5dGVz",
            },
          ],
        },
      ],
    };

    const uploadedFiles: File[] = [];
    const result = await uploadDataUrlImages(quiz, async (file) => {
      uploadedFiles.push(file);
      return await Promise.resolve(`upload-${String(uploadedFiles.length)}`);
    });

    expect(result.questions[0].image_url).toBeNull();
    expect(result.questions[0].image_upload).toBe("upload-1");
    expect(result.questions[0].answers[0].image_url).toBeNull();
    expect(result.questions[0].answers[0].image_upload).toBe("upload-2");
    expect(uploadedFiles).toHaveLength(2);
    expect(uploadedFiles[0].name).toBe("question-1.png");
    expect(uploadedFiles[0].type).toBe("image/png");
    expect(uploadedFiles[1].name).toBe("answer-1-1.jpg");
    expect(uploadedFiles[1].type).toBe("image/jpeg");
  });

  test("should report upload progress for each data url image", async () => {
    const quiz: Quiz = {
      id: "quiz-1",
      title: "Test Quiz",
      description: "Description",
      version: 1,
      visibility: AccessLevel.PRIVATE,
      allow_anonymous: false,
      is_anonymous: false,
      questions: [
        {
          id: "q1",
          order: 1,
          text: "Question 1",
          type: "single_choice",
          shuffle_answers: true,
          open_matching: "exact",
          image_url: "data:image/png;base64,aW1hZ2UtYnl0ZXM=",
          answers: [
            {
              id: "a1",
              order: 1,
              text: "Answer 1",
              is_correct: true,
              image_url: "data:image/jpeg;base64,YW5zd2VyLWJ5dGVz",
            },
          ],
        },
      ],
    };

    const progress: { current: number; total: number }[] = [];

    await uploadDataUrlImages(quiz, {
      uploadImage: async () => {
        return await Promise.resolve("upload-id");
      },
      onProgress: (current, total) => {
        progress.push({ current, total });
      },
    });

    expect(countDataUrlImages(quiz)).toBe(2);
    expect(progress).toEqual([
      { current: 1, total: 2 },
      { current: 2, total: 2 },
    ]);
  });

  test("should clear skipped data url images without uploading them", async () => {
    const quiz: Quiz = {
      id: "quiz-1",
      title: "Test Quiz",
      description: "Description",
      version: 1,
      visibility: AccessLevel.PRIVATE,
      allow_anonymous: false,
      is_anonymous: false,
      questions: [
        {
          id: "q1",
          order: 1,
          text: "Question 1",
          type: "single_choice",
          shuffle_answers: true,
          open_matching: "exact",
          image_url: "data:image/png;base64,aW1hZ2UtYnl0ZXM=",
          answers: [
            {
              id: "a1",
              order: 1,
              text: "Answer 1",
              is_correct: true,
              image_url: "data:image/jpeg;base64,YW5zd2VyLWJ5dGVz",
            },
          ],
        },
      ],
    };

    const result = await uploadDataUrlImages(quiz, {
      shouldSkip: () => true,
      uploadImage: async () => {
        await Promise.resolve();
        throw new Error("Skipped data urls should not be uploaded");
      },
    });

    expect(result.questions[0].image_url).toBeNull();
    expect(result.questions[0].image_upload).toBeNull();
    expect(result.questions[0].answers[0].image_url).toBeNull();
    expect(result.questions[0].answers[0].image_upload).toBeNull();
  });

  test("should keep regular image urls untouched", async () => {
    const quiz: Quiz = {
      id: "quiz-1",
      title: "Test Quiz",
      description: "Description",
      version: 1,
      visibility: AccessLevel.PRIVATE,
      allow_anonymous: false,
      is_anonymous: false,
      questions: [
        {
          id: "q1",
          order: 1,
          text: "Question 1",
          explanation: "",
          type: "single_choice",
          shuffle_answers: true,
          open_matching: "exact",
          image_url: "https://example.test/image.png",
          answers: [
            {
              id: "a1",
              order: 1,
              text: "Answer 1",
              is_correct: true,
              image_url: "https://example.test/answer.png",
            },
          ],
        },
      ],
    };

    const result = await uploadDataUrlImages(quiz, async () => {
      await Promise.resolve();
      throw new Error("Regular urls should not be uploaded");
    });

    expect(result.questions[0].image_url).toBe(
      "https://example.test/image.png",
    );
    expect(result.questions[0].answers[0].image_url).toBe(
      "https://example.test/answer.png",
    );
  });
});

describe("prepareQuizForSubmission", () => {
  test("should remove read-only image field from questions and answers", () => {
    const quizData: QuizFormData = {
      title: "Test Quiz",
      description: "Description",
      questions: [
        {
          id: "q1",
          order: 1,
          text: "Question 1",
          explanation: "",
          type: "single_choice",
          shuffle_answers: true,
          open_matching: "exact",
          image: "http://example.com/image.png",
          image_url: null,
          image_upload: null,
          answers: [
            {
              id: "a1",
              order: 1,
              text: "Answer 1",
              is_correct: true,
              image: "http://example.com/answer.png",
              image_url: null,
              image_upload: null,
            },
          ],
        },
      ],
    };

    const result = prepareQuizForSubmission(quizData);

    expect(result.questions[0]).not.toHaveProperty("image");
    expect(result.questions[0].answers[0]).not.toHaveProperty("image");
  });

  test("should set image_url to null when image_upload is present", () => {
    const quizData: QuizFormData = {
      title: "Test Quiz",
      description: "Description",
      questions: [
        {
          id: "q1",
          order: 1,
          text: "Question 1",
          explanation: "",
          type: "single_choice",
          shuffle_answers: true,
          open_matching: "exact",
          image: null,
          image_url: "http://example.com/url.png",
          image_upload: "upload-uuid-123",
          answers: [
            {
              id: "a1",
              order: 1,
              text: "Answer 1",
              is_correct: true,
              image: null,
              image_url: "http://example.com/answer-url.png",
              image_upload: "answer-upload-uuid",
            },
          ],
        },
      ],
    };

    const result = prepareQuizForSubmission(quizData);

    expect(result.questions[0].image_upload).toBe("upload-uuid-123");
    expect(result.questions[0].image_url).toBeNull();
    expect(result.questions[0].answers[0].image_upload).toBe(
      "answer-upload-uuid",
    );
    expect(result.questions[0].answers[0].image_url).toBeNull();
  });

  test("should set image_upload to null when only image_url is present", () => {
    const quizData: QuizFormData = {
      title: "Test Quiz",
      description: "Description",
      questions: [
        {
          id: "q1",
          order: 1,
          text: "Question 1",
          explanation: "",
          type: "single_choice",
          shuffle_answers: true,
          open_matching: "exact",
          image: null,
          image_url: "http://example.com/url.png",
          image_upload: null,
          answers: [
            {
              id: "a1",
              order: 1,
              text: "Answer 1",
              is_correct: true,
              image: null,
              image_url: "http://example.com/answer-url.png",
              image_upload: null,
            },
          ],
        },
      ],
    };

    const result = prepareQuizForSubmission(quizData);

    expect(result.questions[0].image_url).toBe("http://example.com/url.png");
    expect(result.questions[0].image_upload).toBeNull();
    expect(result.questions[0].answers[0].image_url).toBe(
      "http://example.com/answer-url.png",
    );
    expect(result.questions[0].answers[0].image_upload).toBeNull();
  });

  test("should handle null and undefined values correctly", () => {
    const quizData: QuizFormData = {
      title: "Test Quiz",
      description: "Description",
      questions: [
        {
          id: "q1",
          order: 1,
          text: "Question 1",
          explanation: "",
          type: "single_choice",
          shuffle_answers: true,
          open_matching: "exact",
          image: null,
          image_url: null,
          image_upload: null,
          answers: [
            {
              id: "a1",
              order: 1,
              text: "Answer 1",
              is_correct: true,
              image: null,
              image_url: null,
              image_upload: null,
            },
          ],
        },
      ],
    };

    const result = prepareQuizForSubmission(quizData);

    expect(result.questions[0]).not.toHaveProperty("image");
    expect(result.questions[0].answers[0]).not.toHaveProperty("image");
  });

  test("should treat empty string as no value", () => {
    const quizData: QuizFormData = {
      title: "Test Quiz",
      description: "Description",
      questions: [
        {
          id: "q1",
          order: 1,
          text: "Question 1",
          explanation: "",
          type: "single_choice",
          shuffle_answers: true,
          open_matching: "exact",
          image: null,
          image_url: "",
          image_upload: "",
          answers: [
            {
              id: "a1",
              order: 1,
              text: "Answer 1",
              is_correct: true,
              image: null,
              image_url: "",
              image_upload: "",
            },
          ],
        },
      ],
    };

    const result = prepareQuizForSubmission(quizData);

    // Neither should be prioritized since both are empty
    expect(result.questions[0]).not.toHaveProperty("image");
    expect(result.questions[0].answers[0]).not.toHaveProperty("image");
  });
});

describe("TXT question type mapping", () => {
  test.each([
    ["X01", "Statement", "Fałsz", "Prawda"],
    ["x10", "Statement", "Nie", "Tak"],
    ["QQ10", "1.\tStatement", "(a) False", "(b) True"],
    ["QQ01", "1.\tStatement", "(a) True", "(b) False"],
  ])(
    "normalizes %s true/false labels without changing correctness",
    (...lines) => {
      const question = parseQuestion(lines, "1.txt", 1);
      expect(question).toMatchObject({
        type: "true_false",
        shuffle_answers: false,
        open_matching: "exact",
        answers: [
          {
            order: 1,
            text: /^(Prawda|Tak|True)$/,
            is_correct: lines[0] === "X01",
          },
          {
            order: 2,
            text: /^(Fałsz|Nie|False)$/,
            is_correct: lines[0] !== "X01",
          },
        ],
      });
      expect(question).not.toHaveProperty("multiple");
    },
  );

  test.each([
    ["X10", "single_choice"],
    ["X11", "multiple_choice"],
    ["QQ10", "single_choice"],
    ["QQ11", "multiple_choice"],
  ])("infers the choice type for %s", (template, type) => {
    const lines = template.startsWith("QQ")
      ? [template, "1.\tQuestion", "(a) A", "(b) B"]
      : [template, "Question", "A", "B"];
    expect(parseQuestion(lines, "1.txt", 1)).toMatchObject({
      type,
      shuffle_answers: true,
      open_matching: "exact",
    });
  });
});

describe("JSON legacy question type mapping", () => {
  test.each([
    [true, 1, "multiple_choice"],
    [false, 1, "single_choice"],
    [false, 2, "multiple_choice"],
    [undefined, 2, "multiple_choice"],
    [undefined, 1, "single_choice"],
  ])(
    "maps multiple=%s with %s correct answers to %s",
    (multiple, count, type) => {
      const question = {
        multiple,
        answers: Array.from({ length: count }, () => ({ is_correct: true })),
      };
      expect(normalizeQuestionTypeFields(question)).toEqual({
        type,
        shuffle_answers: true,
        open_matching: "exact",
      });
    },
  );

  test("preserves an explicit type and settings over a legacy flag", () => {
    expect(
      normalizeQuestionTypeFields({
        type: "open",
        multiple: true,
        shuffle_answers: false,
        open_matching: "similar",
        answers: [{ is_correct: true }],
      }),
    ).toEqual({
      type: "open",
      shuffle_answers: false,
      open_matching: "similar",
    });
  });
});

describe.each([
  ["current", validateQuiz, "text", "is_correct"],
  ["legacy", validateLegacyQuiz, "question", "correct"],
] as const)(
  "%s JSON type validation",
  (_format, validate, textKey, correctKey) => {
    function quiz(
      fields: Record<string, unknown> = {},
      answerFields: Record<string, unknown> = {},
    ) {
      return {
        title: "Quiz",
        questions: [
          {
            [textKey]: "Question",
            ...fields,
            answers: [
              {
                [textKey === "text" ? "text" : "answer"]: "Answer",
                [correctKey]: true,
                ...answerFields,
              },
            ],
          },
        ],
      };
    }

    test.each([
      { type: "unknown" },
      { shuffle_answers: "true" },
      { open_matching: "fuzzy" },
      { multiple: "false" },
    ])("rejects invalid type fields %j", (fields) => {
      expect(validate(quiz(fields))).not.toBeNull();
    });
    test("requires two true/false answers and at least one open answer", () => {
      expect(validate(quiz({ type: "true_false" }))).toContain(
        "dokładnie dwie",
      );
      expect(validate(quiz({ type: "open" }))).toBeNull();
      const emptyQuiz = quiz({ type: "open" });
      emptyQuiz.questions[0].answers = [];
      expect(validate(emptyQuiz)).toContain("przynajmniej jedną");
    });
    test("rejects images on open answers", () => {
      expect(
        validate(quiz({ type: "open" }, { image: "image.png" })),
      ).toContain("nie mogą zawierać zdjęć");
    });
  },
);

test("JSON import sends only the normalized type fields to the API", async () => {
  let payload: { questions: Record<string, unknown>[] } | undefined;
  server.use(
    http.post("*/quizzes/", async ({ request }) => {
      payload = (await request.json()) as {
        questions: Record<string, unknown>[];
      };
      return HttpResponse.json({ id: "imported", ...payload });
    }),
  );
  const { result } = renderHook(() => useImportQuiz());
  const question = {
    text: "Question",
    answers: [{ text: "A", is_correct: true }],
  };
  const quiz = {
    title: "Mapping",
    questions: [
      { ...question, multiple: true },
      { ...question, multiple: false },
      {
        ...question,
        multiple: false,
        answers: [...question.answers, { text: "B", is_correct: true }],
      },
      {
        ...question,
        answers: [...question.answers, { text: "B", is_correct: true }],
      },
      {
        ...question,
        multiple: true,
        type: "open",
        shuffle_answers: false,
        open_matching: "similar",
      },
      {
        ...question,
        type: "true_false",
        shuffle_answers: true,
        answers: [...question.answers, { text: "B", is_correct: false }],
      },
    ],
  };
  act(() => {
    result.current.handleUploadTypeChange("json");
  });
  result.current.monacoEditorRef.current = {
    getValue: () => JSON.stringify(quiz),
  };
  await act(async () => {
    await result.current.handleImport();
  });
  expect(result.current.error).toBeNull();
  expect(
    payload?.questions.map(({ type, shuffle_answers, open_matching }) => ({
      type,
      shuffle_answers,
      open_matching,
    })),
  ).toEqual([
    { type: "multiple_choice", shuffle_answers: true, open_matching: "exact" },
    { type: "single_choice", shuffle_answers: true, open_matching: "exact" },
    { type: "multiple_choice", shuffle_answers: true, open_matching: "exact" },
    { type: "multiple_choice", shuffle_answers: true, open_matching: "exact" },
    { type: "open", shuffle_answers: false, open_matching: "similar" },
    { type: "true_false", shuffle_answers: false, open_matching: "exact" },
  ]);
  for (const imported of payload?.questions ?? []) {
    expect(imported).not.toHaveProperty("multiple");
  }
});
