import type { StatsScope } from "@testownik/core/quiz/stats";
import { AccessLevel } from "@testownik/core/quiz/types";
import type { Question, Quiz, SharedQuiz } from "@testownik/core/quiz/types";
import type { UserSettings } from "@testownik/core/user/types";
import { DEFAULT_USER_SETTINGS } from "@testownik/core/user/types";

import type { AppServices } from "@/services/client-services";
import type { ClipboardService } from "@/services/clipboard.service";
import type { QuizService } from "@/services/quiz.service";
import type { UserService } from "@/services/user.service";

import {
  PREVIEW_DIRECTORY,
  PREVIEW_GROUPS,
  PREVIEW_HARDEST,
  PREVIEW_HOURLY,
  PREVIEW_QUIZ,
  PREVIEW_QUIZ_METADATA,
  PREVIEW_SESSIONS,
  PREVIEW_SHARED_WITH,
  PREVIEW_STATS,
  PREVIEW_TIMELINE,
} from "./preview-fixtures";

/**
 * Services for the device previews, bound to their query cache (see
 * `bindServices`): the real app components inside a screen talk to these
 * instead of the API. Reads answer from fixtures, writes resolve without
 * persisting anything, and the clipboard is left alone. Every method the
 * previews do not implement rejects, so a component that grows a new request
 * fails inside the screen instead of reaching the network, the cookies or
 * the token refresh.
 */

/** Something a preview did instead of the real action, shown in the screen. */
export type PreviewNotify = (message: string) => void;

/**
 * The preview quiz's questions, which live in its session (see
 * `preview-quiz-machine`). Question writes go here, so what the assistant
 * saves or edits shows up in the quiz.
 */
export interface PreviewQuizEditor {
  questions: () => Question[];
  add: (questions: Question[]) => void;
  update: (question: Question) => void;
}

type CreateQuestionData = Parameters<QuizService["createQuestion"]>[1];

/** What the API would answer for a created question, numbered after the rest. */
function toCreatedQuestion(data: CreateQuestionData, order: number): Question {
  const id = `preview-added-${crypto.randomUUID()}`;
  return {
    id,
    order,
    text: data.text,
    explanation: data.explanation ?? "",
    multiple: data.multiple,
    is_ai_generated: data.is_ai_generated ?? false,
    is_markdown_enabled: true,
    // Nothing remote is loaded inside a preview.
    image: null,
    answers: data.answers.map((answer, index) => ({
      id: `${id}-a${(index + 1).toString()}`,
      order: index + 1,
      text: answer.text,
      is_correct: answer.is_correct,
      image: null,
    })),
  };
}

function nextOrder(questions: Question[]): number {
  return (
    questions.reduce((highest, { order }) => Math.max(highest, order), 0) + 1
  );
}

/** A PATCH of a question: the given fields win, answers keep their ids. */
function applyQuestionUpdate(
  question: Question,
  data: Partial<Question>,
): Question {
  const answers = (data.answers ?? question.answers).map((answer, index) => ({
    ...answer,
    id: answer.id || `${question.id}-edit-${crypto.randomUUID()}`,
    order: index + 1,
    image: question.answers.find(({ id }) => id === answer.id)?.image ?? null,
  }));
  return {
    ...question,
    ...data,
    id: question.id,
    order: question.order,
    image: question.image ?? null,
    answers,
    multiple:
      data.multiple ?? answers.filter((answer) => answer.is_correct).length > 1,
  };
}

/** Enough of a round trip that loading states show the way they do in the app. */
const LATENCY_MS = 80;

class PreviewOnlyError extends Error {
  constructor(member: string) {
    super(`${member} is not available in the landing-page preview`);
    this.name = "PreviewOnlyError";
  }
}

async function roundTrip(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, LATENCY_MS);
  });
}

/** Answers like an API call: asynchronously, after a short delay. */
function reply<Arguments extends unknown[], Result>(
  answer: (...arguments_: Arguments) => Result,
): (...arguments_: Arguments) => Promise<Result> {
  return async (...arguments_) => {
    await roundTrip();
    return answer(...arguments_);
  };
}

function offline<T extends object>(name: string, implemented: Partial<T>): T {
  return new Proxy(implemented, {
    get(target, property, receiver) {
      // Symbols and `then` stay absent: the object is not a thenable.
      if (
        Reflect.has(target, property) ||
        typeof property !== "string" ||
        property === "then"
      ) {
        return Reflect.get(target, property, receiver) as unknown;
      }
      return reply(() => {
        throw new PreviewOnlyError(`${name}.${property}`);
      });
    },
  }) as T;
}

const sharedWith: SharedQuiz[] = [
  ...PREVIEW_SHARED_WITH.map((user, index) => ({
    id: `shared-${user.id}`,
    quiz: PREVIEW_QUIZ_METADATA,
    access_level: AccessLevel.SHARED,
    user,
    group: null,
    allow_edit: index === 0,
  })),
  {
    id: `shared-${PREVIEW_GROUPS[0].id}`,
    quiz: PREVIEW_QUIZ_METADATA,
    access_level: AccessLevel.SHARED,
    user: null,
    group: PREVIEW_GROUPS[0],
    allow_edit: false,
  },
];

/** Questions kept by the services themselves, for a cache without a session. */
function createLocalEditor(): PreviewQuizEditor {
  let questions = PREVIEW_QUIZ.questions;
  return {
    questions: () => questions,
    add: (added) => {
      questions = [...questions, ...added];
    },
    update: (updated) => {
      questions = questions.map((question) =>
        question.id === updated.id ? updated : question,
      );
    },
  };
}

export function createPreviewServices(
  notify: PreviewNotify,
  editor: PreviewQuizEditor = createLocalEditor(),
): AppServices {
  /**
   * Adds what is not in the quiz yet. A chat card forgets that it saved its
   * questions when the chat remounts, so saving them again returns the ones
   * already there instead of duplicating them.
   */
  const createQuestions = (questions: CreateQuestionData[]): Question[] => {
    const current = editor.questions();
    const added: Question[] = [];
    const result = questions.map((data) => {
      const existing = [...current, ...added].find(
        (question) => question.text === data.text,
      );
      if (existing !== undefined) {
        return existing;
      }
      const created = toCreatedQuestion(
        data,
        nextOrder([...current, ...added]),
      );
      added.push(created);
      return created;
    });
    if (added.length > 0) {
      editor.add(added);
    }
    return result;
  };

  const quiz = offline<QuizService>("quiz", {
    getQuiz: reply(() => ({ ...PREVIEW_QUIZ, questions: editor.questions() })),
    createQuestion: reply(
      (_quizId: string, data: CreateQuestionData) => createQuestions([data])[0],
    ),
    bulkCreateQuestions: reply(
      (_quizId: string, questions: CreateQuestionData[]) =>
        createQuestions(questions),
    ),
    updateQuestion: reply((questionId: string, data: Partial<Question>) => {
      const question = editor
        .questions()
        .find((candidate) => candidate.id === questionId);
      if (question === undefined) {
        throw new PreviewOnlyError(`quiz.updateQuestion(${questionId})`);
      }
      const updated = applyQuestionUpdate(question, data);
      editor.update(updated);
      return updated;
    }),
    getQuizMetadata: reply(() => PREVIEW_QUIZ_METADATA),
    getQuizStats: reply((_quizId: string, scope: StatsScope = "me") => ({
      ...PREVIEW_STATS[scope],
    })),
    getQuizTimeline: reply((_quizId: string, _scope?: StatsScope, days = 30) =>
      PREVIEW_TIMELINE.slice(-Math.max(1, days)),
    ),
    getQuizSessions: reply(() => PREVIEW_SESSIONS),
    getQuizHardestQuestions: reply(
      (_quizId: string, _scope?: StatsScope, limit = 10) =>
        PREVIEW_HARDEST.slice(0, limit),
    ),
    getQuizHourly: reply(() => PREVIEW_HOURLY),
    getStudyGroups: reply(() => PREVIEW_GROUPS),
    getSharedQuizzesForQuiz: reply(() => sharedWith),
    searchUsers: reply((query: string) => {
      const needle = query.toLowerCase();
      return PREVIEW_DIRECTORY.filter(
        (user) =>
          user.full_name.toLowerCase().includes(needle) ||
          user.student_number.includes(needle),
      );
    }),
    updateQuiz: reply((_quizId: string, data: Partial<Quiz>) => {
      notify("To tylko podgląd. Udostępnianie nie zostało zapisane.");
      return { ...PREVIEW_QUIZ, ...data };
    }),
    // The dialog ignores what these return; nothing is shared for real.
    shareQuizWithUser: reply(() => sharedWith[0]),
    shareQuizWithGroup: reply(() => sharedWith[0]),
    updateSharedQuiz: reply(() => sharedWith[0]),
    deleteSharedQuiz: reply(() => {
      // Nothing to delete.
    }),
    copyQuiz: reply(() => {
      notify("To tylko podgląd. Quiz nie został skopiowany.");
      return PREVIEW_QUIZ;
    }),
  });

  // The settings live in the preview's query cache; these only answer a first
  // read and echo writes back, as the API would.
  const user = offline<UserService>("user", {
    getUserSettings: reply(() => DEFAULT_USER_SETTINGS),
    updateUserSettings: reply((settings: Partial<UserSettings>) => ({
      ...DEFAULT_USER_SETTINGS,
      ...settings,
    })),
  });

  const clipboard = offline<ClipboardService>("clipboard", {
    copyLink: reply(() => {
      notify("To tylko podgląd. W aplikacji link trafi do schowka.");
    }),
  });

  return { quiz, user, clipboard };
}
