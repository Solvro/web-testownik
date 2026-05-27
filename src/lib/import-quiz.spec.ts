import { describe, expect, test } from "vitest";

import { AccessLevel } from "@/types/quiz";
import type { Question, Quiz } from "@/types/quiz";

import {
  countDataUrlImages,
  extractImagesToUpload,
  uploadDataUrlImages,
} from "./import-quiz";
import { prepareQuizForSubmission } from "./schemas/quiz.schema";
import type { QuizFormData } from "./schemas/quiz.schema";

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
        multiple: false,
        explanation: "",
      },
      {
        id: "q2",
        text: "Normal question",
        answers: [],
        order: 2,
        multiple: false,
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
        multiple: false,
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
        multiple: false,
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
        multiple: false,
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
        multiple: false,
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
        multiple: false,
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
          multiple: false,
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
          multiple: false,
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
          multiple: false,
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
          multiple: false,
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
          multiple: false,
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
          multiple: false,
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
          multiple: false,
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
          multiple: false,
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
          multiple: false,
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
