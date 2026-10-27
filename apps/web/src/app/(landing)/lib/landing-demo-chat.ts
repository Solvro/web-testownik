import type { Question } from "@testownik/core/quiz/types";
import type { UIMessage } from "ai";

import type { QuestionContextSnapshot } from "@/lib/ai/chat-messages";
import { isQuestion } from "@/lib/ai/request-validation";

/**
 * Shared contract for the landing page's demo chat
 * (`/ai/landing-demo/chat`): the app's assistant, tools included, on the
 * showcase's sample quiz. The quiz lives in the visitor's browser, so its
 * questions come with every request. Kept free of server-only imports so the
 * client trims its requests with the same limits the server enforces.
 */

export const LANDING_DEMO_CHAT_ENDPOINT = "/ai/landing-demo/chat";

export const LANDING_DEMO_CHAT_LIMITS = {
  /** Messages of history sent with one request; older ones are dropped. */
  maxMessages: 20,
  /** Questions of the quiz sent as context. */
  maxQuestions: 60,
  /** Characters per text part, by role; longer ones are cut. */
  maxUserTextLength: 1000,
  maxAssistantTextLength: 4000,
  /** Parts per message. */
  maxParts: 30,
  maxQuestionTextLength: 2000,
  maxAnswerTextLength: 500,
  maxExplanationLength: 2000,
  maxContextSnapshots: 3,
  /** The whole request; tool calls in the history make it larger. */
  maxBodyBytes: 65_536,
} as const;

/** Tool results become model input on the next inference step. */
export const LANDING_DEMO_CHAT_TOOL_LIMITS = {
  /** Tokenized on the server, including JSON syntax; oversized results are errors. */
  maxOutputTokens: 2000,
  maxAnswers: 6,
  maxAnswerTextLength: 300,
  maxQuestionTextLength: 1500,
  maxExplanationLength: 600,
  maxListQuestions: 20,
  maxListPreviewLength: 180,
} as const;

/** The tools whose calls can come back in the history. */
const TOOL_PART_TYPES = new Set([
  "tool-generate_practice_questions",
  "tool-list_questions",
  "tool-get_question",
  "tool-edit_question",
]);

const MAX_ID_LENGTH = 100;

export interface LandingDemoChatRequest {
  messages: UIMessage[];
  question: Question | null;
  questions: Question[];
  questionContextSnapshots: QuestionContextSnapshot[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedId(value: unknown): value is string {
  return (
    typeof value === "string" && value !== "" && value.length <= MAX_ID_LENGTH
  );
}

function isAllowedPart(part: unknown): boolean {
  if (!isRecord(part) || typeof part.type !== "string") {
    return false;
  }
  if (part.type === "text" || part.type === "reasoning") {
    return typeof part.text === "string";
  }
  return part.type === "step-start" || TOOL_PART_TYPES.has(part.type);
}

function isAllowedMessage(message: unknown): message is UIMessage {
  return (
    isRecord(message) &&
    isBoundedId(message.id) &&
    (message.role === "user" || message.role === "assistant") &&
    Array.isArray(message.parts) &&
    message.parts.length <= LANDING_DEMO_CHAT_LIMITS.maxParts &&
    message.parts.every((part) => isAllowedPart(part))
  );
}

function trimText(message: UIMessage): UIMessage {
  const limit =
    message.role === "user"
      ? LANDING_DEMO_CHAT_LIMITS.maxUserTextLength
      : LANDING_DEMO_CHAT_LIMITS.maxAssistantTextLength;
  return {
    ...message,
    parts: message.parts.map((part) =>
      part.type === "text" && part.text.length > limit
        ? { ...part, text: part.text.slice(0, limit) }
        : part,
    ),
  };
}

/**
 * The recent history the demo sends: the last `maxMessages`, starting on a
 * user turn, with long texts cut.
 */
export function trimLandingDemoChatHistory(messages: UIMessage[]): UIMessage[] {
  const recent = messages.slice(-LANDING_DEMO_CHAT_LIMITS.maxMessages);
  const firstUser = recent.findIndex((message) => message.role === "user");
  return firstUser === -1
    ? []
    : recent.slice(firstUser).map((message) => trimText(message));
}

function trimQuestion(question: Question): Question {
  return {
    ...question,
    text: question.text.slice(
      0,
      LANDING_DEMO_CHAT_LIMITS.maxQuestionTextLength,
    ),
    explanation: question.explanation?.slice(
      0,
      LANDING_DEMO_CHAT_LIMITS.maxExplanationLength,
    ),
    answers: question.answers.map((answer) => ({
      ...answer,
      text: answer.text.slice(0, LANDING_DEMO_CHAT_LIMITS.maxAnswerTextLength),
    })),
  };
}

/**
 * Accepts `{ messages, question?, questions?, questionContextSnapshots? }`
 * within the limits above, ending on a user turn. Anything else is rejected
 * so the public endpoint stays cheap.
 */
export function parseLandingDemoChatRequest(
  value: unknown,
): LandingDemoChatRequest | null {
  if (!isRecord(value)) {
    return null;
  }
  const { messages, question, questions, questionContextSnapshots } = value;
  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > LANDING_DEMO_CHAT_LIMITS.maxMessages ||
    !messages.every((message) => isAllowedMessage(message)) ||
    messages.at(-1)?.role !== "user"
  ) {
    return null;
  }
  if (question !== undefined && question !== null && !isQuestion(question)) {
    return null;
  }
  if (
    questions !== undefined &&
    (!Array.isArray(questions) ||
      questions.length > LANDING_DEMO_CHAT_LIMITS.maxQuestions ||
      !questions.every((candidate) => isQuestion(candidate)))
  ) {
    return null;
  }
  if (
    questionContextSnapshots !== undefined &&
    (!Array.isArray(questionContextSnapshots) ||
      questionContextSnapshots.length > LANDING_DEMO_CHAT_LIMITS.maxMessages ||
      !questionContextSnapshots.every(
        (snapshot) =>
          isRecord(snapshot) &&
          isBoundedId(snapshot.messageId) &&
          isBoundedId(snapshot.questionId),
      ))
  ) {
    return null;
  }

  // A snapshot belongs to a user turn. Keep only the three most recent
  // distinct turns, even when the caller repeats snapshot IDs or reorders them.
  const snapshotsByMessageId = new Map(
    ((questionContextSnapshots ?? []) as QuestionContextSnapshot[]).map(
      (snapshot) => [snapshot.messageId, snapshot],
    ),
  );
  const recentSnapshots = messages
    .filter((message) => message.role === "user")
    .flatMap((message) => {
      const snapshot = snapshotsByMessageId.get(message.id);
      return snapshot === undefined ? [] : [snapshot];
    })
    .slice(-LANDING_DEMO_CHAT_LIMITS.maxContextSnapshots);

  return {
    messages: messages.map((message) => trimText(message)),
    question: question == null ? null : trimQuestion(question),
    questions: (questions ?? []).map((candidate: Question) =>
      trimQuestion(candidate),
    ),
    questionContextSnapshots: recentSnapshots,
  };
}
