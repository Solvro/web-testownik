import type { UserSettings } from "@testownik/core/user/types";

import { isQuestion } from "@/lib/ai/request-validation";

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
 * actions from the same state keeps both screens identical.
 *
 * Every action names the action it was applied after (`parent`), and a screen
 * only replays an action whose parent is its own latest one. Actions made on
 * two screens at once both fail that check. The screen with the lower id wins
 * and ignores the other's actions; the other asks it for a snapshot
 * (`resync`) and adopts only the answer to its latest request, so nothing it
 * learns later is rolled back. Local actions still apply at once.
 *
 * A screen that joins late (or reloads) says `hello` and adopts the snapshot
 * of whichever screen has applied more actions. Settings edited in either
 * screen's dialog travel separately, with their own version, because `next`
 * and the mastered count depend on them; a late joiner takes the newest.
 *
 * Everything below except `openQuizSyncChannel` is pure.
 */

export const QUIZ_SYNC_PROTOCOL = "testownik-preview-quiz/3";

/** The order settings changes are applied in: version, then lower author. */
export interface SettingsStamp {
  version: number;
  author: string;
}

export const INITIAL_SETTINGS_STAMP: SettingsStamp = { version: 0, author: "" };

export interface VersionedSettings {
  settings: UserSettings;
  stamp: SettingsStamp;
}

export type QuizSyncPayload =
  | { kind: "hello" }
  | {
      kind: "resync";
      to: string;
      /** Echoed by the snapshot that answers it. */
      request: string;
    }
  | {
      kind: "action";
      action: QuizPreviewAction;
      /** This action's id and the id of the one it was applied after. */
      id: string;
      parent: string;
    }
  | {
      kind: "snapshot";
      /** The screen this is for, and the `resync` it answers if any. */
      to: string;
      request?: string;
      revision: number;
      head: string;
      state: QuizPreviewState;
      settings: VersionedSettings | undefined;
    }
  | ({ kind: "settings" } & VersionedSettings);

export type QuizSyncMessage = QuizSyncPayload & {
  protocol: typeof QUIZ_SYNC_PROTOCOL;
  sender: string;
};

/**
 * The local quiz, how many actions produced it and the id of the last one
 * (`""` for the initial state every screen opens on).
 */
export interface SyncedQuizState {
  state: QuizPreviewState;
  revision: number;
  head: string;
}

export type SyncedQuizEvent =
  | { type: "action"; action: QuizPreviewAction; id: string }
  | {
      type: "snapshot";
      revision: number;
      head: string;
      state: QuizPreviewState;
    };

export function createSyncedQuizState(
  state: QuizPreviewState,
): SyncedQuizState {
  return { state, revision: 0, head: "" };
}

/** Which snapshots a screen adopts is decided by `respondToQuizSyncMessage`. */
export function syncedQuizReducer(
  current: SyncedQuizState,
  event: SyncedQuizEvent,
): SyncedQuizState {
  if (event.type === "action") {
    return {
      state: quizPreviewReducer(current.state, event.action),
      revision: current.revision + 1,
      head: event.id,
    };
  }
  return { state: event.state, revision: event.revision, head: event.head };
}

function isNewerSettings(
  incoming: SettingsStamp,
  current: SettingsStamp,
): boolean {
  return (
    incoming.version > current.version ||
    (incoming.version === current.version && incoming.author < current.author)
  );
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
    case "goTo": {
      return typeof value.questionId === "string";
    }
    case "addQuestions": {
      return (
        Array.isArray(value.questions) && value.questions.every(isQuestion)
      );
    }
    case "updateQuestion": {
      return isQuestion(value.question);
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
    typeof value.hiddenQuestionCount === "number" &&
    typeof value.currentQuestionId === "string" &&
    isStringArray(value.selectedAnswers) &&
    typeof value.questionChecked === "boolean" &&
    Array.isArray(value.answers) &&
    isRecord(value.baseline) &&
    typeof value.focusMode === "boolean" &&
    typeof value.recorded === "number"
  );
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isVersionedSettings(value: unknown): boolean {
  return (
    isRecord(value) &&
    isRecord(value.settings) &&
    isRecord(value.stamp) &&
    isCount(value.stamp.version) &&
    typeof value.stamp.author === "string"
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
    case "resync": {
      return typeof data.to === "string" && typeof data.request === "string"
        ? (data as QuizSyncMessage)
        : null;
    }
    case "action": {
      return isQuizPreviewAction(data.action) &&
        typeof data.id === "string" &&
        typeof data.parent === "string"
        ? (data as QuizSyncMessage)
        : null;
    }
    case "snapshot": {
      return typeof data.to === "string" &&
        (data.request === undefined || typeof data.request === "string") &&
        isCount(data.revision) &&
        typeof data.head === "string" &&
        isQuizPreviewState(data.state) &&
        (data.settings === undefined || isVersionedSettings(data.settings))
        ? (data as QuizSyncMessage)
        : null;
    }
    case "settings": {
      return isVersionedSettings(data) ? (data as QuizSyncMessage) : null;
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
  settings?: VersionedSettings;
  /** The `resync` this screen now waits on, if any. */
  awaiting: string | undefined;
  /** A forwarded reset also zeroes the study timer, as a local one does. */
  resetTimer?: boolean;
}

export function respondToQuizSyncMessage(
  message: QuizSyncMessage,
  self: {
    id: string;
    synced: SyncedQuizState;
    settings: VersionedSettings | undefined;
    awaiting: string | undefined;
  },
): QuizSyncResponse {
  const unchanged = { awaiting: self.awaiting };
  if (message.sender === self.id) {
    return unchanged;
  }
  const snapshotFor = (to: string, request?: string): QuizSyncPayload => ({
    kind: "snapshot",
    to,
    ...(request !== undefined && { request }),
    revision: self.synced.revision,
    head: self.synced.head,
    state: self.synced.state,
    settings: self.settings,
  });
  const newerSettings = (incoming: VersionedSettings | undefined) =>
    incoming !== undefined &&
    isNewerSettings(
      incoming.stamp,
      self.settings?.stamp ?? INITIAL_SETTINGS_STAMP,
    )
      ? { settings: incoming.settings, stamp: incoming.stamp }
      : undefined;

  switch (message.kind) {
    case "hello": {
      return { ...unchanged, reply: snapshotFor(message.sender) };
    }
    case "resync": {
      return message.to === self.id
        ? { ...unchanged, reply: snapshotFor(message.sender, message.request) }
        : unchanged;
    }
    case "action": {
      if (message.parent === self.synced.head) {
        return {
          ...unchanged,
          event: { type: "action", action: message.action, id: message.id },
          resetTimer: message.action.type === "reset",
        };
      }
      // Both screens acted at once. The lower id keeps its quiz; the higher
      // one asks for it and drops what it did meanwhile.
      if (message.sender > self.id) {
        return unchanged;
      }
      return {
        awaiting: message.id,
        reply: { kind: "resync", to: message.sender, request: message.id },
      };
    }
    case "snapshot": {
      if (message.to !== self.id) {
        return unchanged;
      }
      const settings = newerSettings(message.settings);
      const answersResync =
        message.request !== undefined && message.request === self.awaiting;
      // A late joiner takes a quiz further along than its own.
      const adopt =
        answersResync ||
        (message.request === undefined &&
          message.revision > self.synced.revision);
      return {
        awaiting: answersResync ? undefined : self.awaiting,
        ...(adopt &&
          message.head !== self.synced.head && {
            event: {
              type: "snapshot",
              revision: message.revision,
              head: message.head,
              state: message.state,
            },
          }),
        ...(settings !== undefined && { settings }),
      };
    }
    case "settings": {
      const settings = newerSettings(message);
      return settings === undefined ? unchanged : { ...unchanged, settings };
    }
  }
}

/** Unique enough to tell screens and their actions apart. */
export function createQuizSyncId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
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
  const id = createQuizSyncId();
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
