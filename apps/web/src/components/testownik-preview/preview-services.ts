import type { StatsScope } from "@testownik/core/quiz/stats";
import { AccessLevel } from "@testownik/core/quiz/types";
import type { Quiz, SharedQuiz } from "@testownik/core/quiz/types";
import type { UserSettings } from "@testownik/core/user/types";
import { DEFAULT_USER_SETTINGS } from "@testownik/core/user/types";

import type { AppServices } from "@/services/client-services";
import type { ClipboardService } from "@/services/clipboard.service";
import type { QuizService } from "@/services/quiz.service";
import type { UserService } from "@/services/user.service";

import {
  PREVIEW_DIRECTORY,
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

const sharedWith: SharedQuiz[] = PREVIEW_SHARED_WITH.map((user, index) => ({
  id: `shared-${user.id}`,
  quiz: PREVIEW_QUIZ_METADATA,
  access_level: AccessLevel.SHARED,
  user,
  group: null,
  allow_edit: index === 0,
}));

export function createPreviewServices(notify: PreviewNotify): AppServices {
  const quiz = offline<QuizService>("quiz", {
    getQuiz: reply(() => PREVIEW_QUIZ),
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
    // The share dialog gives groups remote placeholder avatars, so the
    // preview has none.
    getStudyGroups: reply(() => []),
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
      notify("To tylko podgląd — udostępnianie nie zostało zapisane.");
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
      notify("To tylko podgląd — quiz nie został skopiowany.");
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
      notify("To tylko podgląd — w aplikacji link trafi do schowka.");
    }),
  });

  return { quiz, user, clipboard };
}
