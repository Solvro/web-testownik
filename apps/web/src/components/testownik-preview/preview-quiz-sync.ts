import type { UserSettings } from "@testownik/core/user/types";

import { quizPreviewReducer } from "./preview-quiz-machine";
import type {
  QuizPreviewAction,
  QuizPreviewState,
} from "./preview-quiz-machine";

/**
 * Keeps one preview quiz in step across documents.
 *
 * The desktop hero renders the laptop and the iPhone screens in separate
 * iframes, so they cannot share a React state. Each runs its own
 * `quizPreviewReducer` and forwards every action it dispatches over a
 * `BroadcastChannel`; the reducer is deterministic, so replaying the same
 * actions from the same state keeps both screens identical. A screen that
 * joins late (or reloads) says `hello` and adopts the snapshot of whichever
 * screen has applied more actions. Settings edited in either screen's dialog
 * travel the same way, because `next` and the mastered count depend on them.
 *
 * Everything below except `openQuizSyncChannel` is pure.
 */

export const QUIZ_SYNC_PROTOCOL = "testownik-preview-quiz/1";

export type QuizSyncPayload =
  | { kind: "hello" }
  | { kind: "action"; action: QuizPreviewAction }
  | {
      kind: "snapshot";
      /** The `hello` sender this answers. */
      to: string;
      revision: number;
      state: QuizPreviewState;
      settings: UserSettings | undefined;
    }
  | { kind: "settings"; settings: UserSettings };

export type QuizSyncMessage = QuizSyncPayload & {
  protocol: typeof QUIZ_SYNC_PROTOCOL;
  sender: string;
};

/** The local quiz plus how many actions produced it. */
export interface SyncedQuizState {
  state: QuizPreviewState;
  revision: number;
}

export type SyncedQuizEvent =
  | { type: "action"; action: QuizPreviewAction }
  | { type: "snapshot"; revision: number; state: QuizPreviewState };

export function createSyncedQuizState(
  state: QuizPreviewState,
): SyncedQuizState {
  return { state, revision: 0 };
}

/**
 * Local and forwarded actions both count towards the revision. A snapshot only
 * wins when it has seen more actions than this screen, so the screen the
 * visitor has been using is never rolled back by a fresh one.
 */
export function syncedQuizReducer(
  current: SyncedQuizState,
  event: SyncedQuizEvent,
): SyncedQuizState {
  if (event.type === "action") {
    return {
      state: quizPreviewReducer(current.state, event.action),
      revision: current.revision + 1,
    };
  }
  return event.revision > current.revision
    ? { state: event.state, revision: event.revision }
    : current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

export function isQuizPreviewAction(
  value: unknown,
): value is QuizPreviewAction {
  if (!isRecord(value)) {
    return false;
  }
  switch (value.type) {
    case "select": {
      return isStringArray(value.answers);
    }
    case "next": {
      return isRecord(value.settings);
    }
    case "back":
    case "reset": {
      return true;
    }
    case "setFocusMode": {
      return typeof value.active === "boolean";
    }
    default: {
      return false;
    }
  }
}

function isQuizPreviewState(value: unknown): value is QuizPreviewState {
  return (
    isRecord(value) &&
    Array.isArray(value.questions) &&
    typeof value.currentQuestionId === "string" &&
    isStringArray(value.selectedAnswers) &&
    typeof value.questionChecked === "boolean" &&
    Array.isArray(value.answers) &&
    isRecord(value.baseline) &&
    typeof value.focusMode === "boolean" &&
    typeof value.recorded === "number"
  );
}

/** Validates what arrives on the channel; anything else is ignored. */
export function parseQuizSyncMessage(data: unknown): QuizSyncMessage | null {
  if (
    !isRecord(data) ||
    data.protocol !== QUIZ_SYNC_PROTOCOL ||
    typeof data.sender !== "string"
  ) {
    return null;
  }
  switch (data.kind) {
    case "hello": {
      return data as QuizSyncMessage;
    }
    case "action": {
      return isQuizPreviewAction(data.action)
        ? (data as QuizSyncMessage)
        : null;
    }
    case "snapshot": {
      return typeof data.to === "string" &&
        typeof data.revision === "number" &&
        Number.isInteger(data.revision) &&
        data.revision >= 0 &&
        isQuizPreviewState(data.state) &&
        (data.settings === undefined || isRecord(data.settings))
        ? (data as QuizSyncMessage)
        : null;
    }
    case "settings": {
      return isRecord(data.settings) ? (data as QuizSyncMessage) : null;
    }
    default: {
      return null;
    }
  }
}

/** What a screen should do about one message from another screen. */
export interface QuizSyncResponse {
  event?: SyncedQuizEvent;
  reply?: QuizSyncPayload;
  settings?: UserSettings;
  /** A forwarded reset also zeroes the study timer, as a local one does. */
  resetTimer?: boolean;
}

export function respondToQuizSyncMessage(
  message: QuizSyncMessage,
  self: {
    id: string;
    synced: SyncedQuizState;
    settings: UserSettings | undefined;
  },
): QuizSyncResponse {
  if (message.sender === self.id) {
    return {};
  }
  switch (message.kind) {
    case "hello": {
      return {
        reply: {
          kind: "snapshot",
          to: message.sender,
          revision: self.synced.revision,
          state: self.synced.state,
          settings: self.settings,
        },
      };
    }
    case "action": {
      return {
        event: { type: "action", action: message.action },
        resetTimer: message.action.type === "reset",
      };
    }
    case "snapshot": {
      if (message.to !== self.id || message.revision <= self.synced.revision) {
        return {};
      }
      return {
        event: {
          type: "snapshot",
          revision: message.revision,
          state: message.state,
        },
        settings: message.settings,
      };
    }
    case "settings": {
      return { settings: message.settings };
    }
  }
}

export interface QuizSyncChannel {
  id: string;
  post: (payload: QuizSyncPayload) => void;
  close: () => void;
}

/** `null` where `BroadcastChannel` does not exist; the screen then runs alone. */
export function openQuizSyncChannel(
  name: string,
  onMessage: (message: QuizSyncMessage) => void,
): QuizSyncChannel | null {
  if (typeof BroadcastChannel === "undefined") {
    return null;
  }
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const channel = new BroadcastChannel(`${QUIZ_SYNC_PROTOCOL}:${name}`);
  channel.addEventListener("message", (event: MessageEvent<unknown>) => {
    const message = parseQuizSyncMessage(event.data);
    if (message !== null && message.sender !== id) {
      onMessage(message);
    }
  });
  return {
    id,
    post: (payload) => {
      channel.postMessage({
        ...payload,
        protocol: QUIZ_SYNC_PROTOCOL,
        sender: id,
      } satisfies QuizSyncMessage);
    },
    close: () => {
      channel.close();
    },
  };
}
