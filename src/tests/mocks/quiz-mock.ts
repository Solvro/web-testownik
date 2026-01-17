import { AccessLevel } from "@/types/quiz";

export const mockQuiz = {
  id: "mock-quiz-uuid-1",
  title: "Sample Quiz",
  description: "A sample quiz for testing",
  visibility: AccessLevel.PRIVATE,
  allow_anonymous: false,
  is_anonymous: false,
  version: 1,
  questions: [
    {
      id: "mock-question-uuid-1",
      order: 1,
      text: "What is 2+2?",
      multiple: false,
      answers: [
        { id: "mock-answer-uuid-1", order: 1, text: "4", is_correct: true },
        { id: "mock-answer-uuid-2", order: 2, text: "5", is_correct: false },
      ],
    },
  ],
};

export const mockLegacyQuiz = {
  title: "Legacy Quiz",
  questions: [
    {
      id: 1,
      question: " Legacy Question?",
      multiple: false,
      answers: [
        { answer: "Yes", correct: true },
        { answer: "No", correct: false },
      ],
    },
  ],
};
