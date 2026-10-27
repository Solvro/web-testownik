import type { Question } from "@testownik/core/quiz/types";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import type { UIMessage } from "ai";

import {
  LANDING_DEMO_CHAT_ENDPOINT,
  LANDING_DEMO_CHAT_LIMITS,
  trimLandingDemoChatHistory,
} from "@/app/(landing)/lib/landing-demo-chat";
import type { ChatRuntimeTransport } from "@/components/ai/chat-runtime";

import { getShowcaseExplanation } from "./showcase-quiz";

const EXPLAIN_PROMPT = "Wyjaśnij to pytanie";

/** The empty chat's suggestions: what the app's assistant can do here. */
export const SUGGESTIONS = [
  EXPLAIN_PROMPT,
  "Wygeneruj 3 podobne pytania",
  "Popraw literówki w tym pytaniu",
  "Pokaż listę pytań w quizie",
] as const;

const UNAVAILABLE_NOTICE =
  "Asystent jest teraz niedostępny. Spróbuj ponownie za chwilę.";

/** Why the last request failed, from its response. */
export interface Failure {
  status: number;
  retryAfter: string | null;
}

function formatRetryAfter(header: string | null): string {
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "za chwilę";
  }
  if (seconds < 60) {
    return `za ${Math.ceil(seconds).toString()} s`;
  }
  return `za ok. ${Math.ceil(seconds / 60).toString()} min`;
}

export function describeFailure(failure: Failure | null): string {
  if (failure?.status === 429) {
    return `To tylko pokaz, więc liczba pytań jest ograniczona. Spróbuj ponownie ${formatRetryAfter(failure.retryAfter)}.`;
  }
  if (failure?.status === 413 || failure?.status === 400) {
    return "Ta rozmowa jest już za długa na pokaz. Zacznij nową rozmowę.";
  }
  return UNAVAILABLE_NOTICE;
}

function lastUserText(messages: UIMessage[]): string | null {
  const message = messages.findLast((candidate) => candidate.role === "user");
  const part = message?.parts.find((candidate) => candidate.type === "text");
  return part?.type === "text" ? part.text.trim() : null;
}

/**
 * Without the live assistant, "explain" still gets an answer: the question's
 * explanation, streamed like a reply.
 */
export function explainOffline(
  messages: UIMessage[],
  question: Question | null,
): Response | undefined {
  if (question === null || lastUserText(messages) !== EXPLAIN_PROMPT) {
    return undefined;
  }
  const id = "demo-offline-explanation";
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: "text-start", id });
        writer.write({
          type: "text-delta",
          id,
          delta: getShowcaseExplanation(question),
        });
        writer.write({ type: "text-end", id });
      },
    }),
  });
}

/**
 * The app's chat runtime against the public demo endpoint: no account, so no
 * usage to report, and only the recent history and the quiz's first questions
 * are sent. Failures are reported; when the endpoint is down, "explain" still
 * gets the question's explanation.
 */
export function createShowcaseChatTransport(
  onFailure: (failure: Failure | null) => void,
): ChatRuntimeTransport {
  return {
    api: LANDING_DEMO_CHAT_ENDPOINT,
    prepareBody: (request) => {
      const messages = trimLandingDemoChatHistory(request.messages);
      const sentIds = new Set(messages.map((message) => message.id));
      return {
        messages,
        questionContextSnapshots: request.questionContextSnapshots.filter(
          (snapshot) => sentIds.has(snapshot.messageId),
        ),
        question: request.question,
        questions: request.questions.slice(
          0,
          LANDING_DEMO_CHAT_LIMITS.maxQuestions,
        ),
      };
    },
    onResponse: (response, request) => {
      onFailure(
        response.ok
          ? null
          : {
              status: response.status,
              retryAfter: response.headers.get("Retry-After"),
            },
      );
      return response.status >= 500
        ? explainOffline(request.messages, request.question)
        : undefined;
    },
    reportsUsage: false,
  };
}
