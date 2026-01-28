import { expect, test } from "vitest";

import type { Question } from "@/types/quiz";

import { extractImagesToUpload } from "./import-quiz";

test("extractImagesToUpload should find images in questions and answers", () => {
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
