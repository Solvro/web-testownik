import type { Question, Quiz } from "@testownik/core/quiz/types";
import type { ChatPart } from "./chat-stream";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  parts: ChatPart[];
  // Optional so existing local conversations remain readable.
  questionId?: string;
}

/** Match the existing web chat's per-turn question contract and request limits. */
export function chatContext(
  messages: ChatMessage[],
  quiz: Quiz,
  questionId: string,
) {
  const window = messages.slice(-200);
  // Start with a complete user turn, not a response whose prompt fell out of the window.
  const firstUser = window.findIndex((message) => message.role === "user");
  const recent = firstUser < 0 ? [] : window.slice(firstUser);
  const referenced = new Set(
    recent.flatMap((message) =>
      message.questionId ? [message.questionId] : [],
    ),
  );
  referenced.add(questionId);
  // Keep referenced questions even when a large quiz exceeds the server's 500-question limit.
  const questions = [
    ...quiz.questions.filter((question) => referenced.has(question.id)),
    ...quiz.questions.filter((question) => !referenced.has(question.id)),
  ].slice(0, 500);
  const available = new Set(questions.map((question) => question.id));
  return {
    messages: recent.map(({ id, role, parts }) => ({ id, role, parts })),
    questions,
    questionContextSnapshots: recent.flatMap((message) =>
      message.role === "user" &&
      message.questionId &&
      available.has(message.questionId)
        ? [{ messageId: message.id, questionId: message.questionId }]
        : [],
    ),
  };
}

/** Route parameters carry identity only; never trust them to supply question content. */
export function questionInStudyOrder(
  question: Question | undefined,
  rawOrder?: string,
): Question | undefined {
  if (!question || !rawOrder) return question;
  let ids: unknown;
  try {
    ids = JSON.parse(rawOrder);
  } catch {
    return question;
  }
  if (
    !Array.isArray(ids) ||
    ids.length !== question.answers.length ||
    new Set(ids).size !== ids.length
  )
    return question;
  const byId = new Map(question.answers.map((answer) => [answer.id, answer]));
  if (ids.some((id) => typeof id !== "string" || !byId.has(id)))
    return question;
  return { ...question, answers: ids.map((id) => byId.get(id)!) };
}
