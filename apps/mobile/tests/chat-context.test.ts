import { expect, it } from "vitest";
import type { Quiz } from "@testownik/core/quiz/types";
import { chatContext, type ChatMessage } from "../src/lib/chat-context";
const quiz = {
  questions: Array.from({ length: 550 }, (_, i) => ({ id: String(i) })),
} as Quiz;
const message = (id: string, questionId?: string): ChatMessage => ({
  id,
  role: "user",
  questionId,
  parts: [{ type: "text", text: "Explain" }],
});
it("keeps per-turn context across question changes without inventing it for old history", () => {
  const result = chatContext(
    [message("old"), message("a", "549"), message("b", "548")],
    quiz,
    "547",
  );
  expect(result.questionContextSnapshots).toEqual([
    { messageId: "a", questionId: "549" },
    { messageId: "b", questionId: "548" },
  ]);
  expect(result.questions).toHaveLength(500);
  expect(result.questions.slice(0, 3).map((q) => q.id)).toEqual([
    "547",
    "548",
    "549",
  ]);
  expect(result.messages.every((m) => !("questionId" in m))).toBe(true);
});
it("respects the existing server message cap and ignores removed-question snapshots", () => {
  const history = Array.from({ length: 210 }, (_, i) =>
    message(String(i), i === 209 ? "removed" : String(i)),
  );
  const result = chatContext(history, quiz, "549");
  expect(result.messages).toHaveLength(200);
  expect(result.messages[0].id).toBe("10");
  expect(result.messages.at(-1)?.id).toBe("209");
  expect(
    result.questionContextSnapshots.some((s) => s.questionId === "removed"),
  ).toBe(false);
  expect(history).toHaveLength(210);
});

it("keeps assistant answer references in study order and rejects stale or forged orders", async () => {
  const { questionInStudyOrder } = await import("../src/lib/chat-context");
  const question = {
    id: "q",
    answers: [
      { id: "a", text: "first" },
      { id: "b", text: "second" },
    ],
  } as Quiz["questions"][number];
  expect(
    questionInStudyOrder(question, '["b","a"]')?.answers.map((a) => a.text),
  ).toEqual(["second", "first"]);
  for (const value of [
    '["a","a"]',
    '["b"]',
    '["a","unknown"]',
    "{}",
    "not json",
  ])
    expect(questionInStudyOrder(question, value)).toBe(question);
  expect(question.answers[0].id).toBe("a");
});
