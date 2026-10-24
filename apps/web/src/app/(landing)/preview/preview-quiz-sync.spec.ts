import { DEFAULT_USER_SETTINGS } from "@testownik/core/user/types";
import { describe, expect, it } from "vitest";

import {
  createQuizPreviewState,
  quizPreviewReducer,
} from "./preview-quiz-machine";
import type { QuizPreviewAction } from "./preview-quiz-machine";
import {
  QUIZ_SYNC_PROTOCOL,
  createSyncedQuizState,
  isQuizPreviewAction,
  parseQuizSyncMessage,
  respondToQuizSyncMessage,
  syncedQuizReducer,
} from "./preview-quiz-sync";
import type { QuizSyncMessage, SyncedQuizState } from "./preview-quiz-sync";

const settings = DEFAULT_USER_SETTINGS;

function message(
  sender: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return { protocol: QUIZ_SYNC_PROTOCOL, sender, ...payload };
}

function parsed(sender: string, payload: Record<string, unknown>) {
  const result = parseQuizSyncMessage(message(sender, payload));
  if (result === null) {
    throw new Error("expected a valid message");
  }
  return result;
}

const SESSION: QuizPreviewAction[] = [
  { type: "select", answers: ["a-1"] },
  { type: "next", settings },
  { type: "next", settings },
  { type: "back" },
  { type: "back" },
  { type: "setFocusMode", active: true },
];

describe("syncedQuizReducer", () => {
  it("replays forwarded actions to the same state as the reducer", () => {
    const initial = createQuizPreviewState();
    const synced = SESSION.reduce<SyncedQuizState>(
      (current, action) =>
        syncedQuizReducer(current, { type: "action", action }),
      createSyncedQuizState(initial),
    );
    expect(synced.revision).toBe(SESSION.length);
    expect(synced.state).toEqual(
      SESSION.reduce(
        (state, action) => quizPreviewReducer(state, action),
        initial,
      ),
    );
  });

  it("only adopts snapshots that have seen more actions", () => {
    const fresh = createSyncedQuizState(createQuizPreviewState());
    const ahead = syncedQuizReducer(fresh, {
      type: "action",
      action: { type: "reset" },
    });

    expect(
      syncedQuizReducer(fresh, {
        type: "snapshot",
        revision: ahead.revision,
        state: ahead.state,
      }),
    ).toEqual(ahead);
    // Not rolled back by a screen that has just loaded.
    expect(
      syncedQuizReducer(ahead, {
        type: "snapshot",
        revision: 0,
        state: fresh.state,
      }),
    ).toBe(ahead);
  });
});

describe("parseQuizSyncMessage", () => {
  it("accepts each kind of message", () => {
    const state = createQuizPreviewState();
    expect(parsed("a", { kind: "hello" }).kind).toBe("hello");
    expect(parsed("a", { kind: "action", action: { type: "back" } }).kind).toBe(
      "action",
    );
    expect(
      parsed("a", { kind: "snapshot", to: "b", revision: 3, state, settings })
        .kind,
    ).toBe("snapshot");
    expect(parsed("a", { kind: "settings", settings }).kind).toBe("settings");
  });

  it.each([
    ["no protocol", { sender: "a", kind: "hello" }],
    ["another protocol", { protocol: "other", sender: "a", kind: "hello" }],
    ["no sender", { protocol: QUIZ_SYNC_PROTOCOL, kind: "hello" }],
    ["an unknown kind", message("a", { kind: "shout" })],
    [
      "an unknown action",
      message("a", { kind: "action", action: { type: "x" } }),
    ],
    [
      "a malformed action",
      message("a", {
        kind: "action",
        action: { type: "select", answers: [1] },
      }),
    ],
    [
      "a negative revision",
      message("a", {
        kind: "snapshot",
        to: "b",
        revision: -1,
        state: createQuizPreviewState(),
      }),
    ],
    [
      "a snapshot without a state",
      message("a", { kind: "snapshot", to: "b", revision: 1, state: {} }),
    ],
    [
      "settings that are not an object",
      message("a", { kind: "settings", settings: 1 }),
    ],
    ["a string", "hello"],
    ["null", null],
  ])("rejects %s", (_, data) => {
    expect(parseQuizSyncMessage(data)).toBeNull();
  });
});

describe("isQuizPreviewAction", () => {
  it("validates every action's payload", () => {
    expect(isQuizPreviewAction({ type: "select", answers: ["a"] })).toBe(true);
    expect(isQuizPreviewAction({ type: "next", settings })).toBe(true);
    expect(isQuizPreviewAction({ type: "next" })).toBe(false);
    expect(isQuizPreviewAction({ type: "setFocusMode", active: "yes" })).toBe(
      false,
    );
    expect(isQuizPreviewAction({ type: "goTo", questionId: "q-12" })).toBe(
      true,
    );
    expect(isQuizPreviewAction({ type: "goTo" })).toBe(false);
    const [question] = createQuizPreviewState().questions;
    expect(
      isQuizPreviewAction({ type: "addQuestions", questions: [question] }),
    ).toBe(true);
    expect(
      isQuizPreviewAction({ type: "addQuestions", questions: [{ id: 1 }] }),
    ).toBe(false);
    expect(isQuizPreviewAction({ type: "updateQuestion", question })).toBe(
      true,
    );
    expect(
      isQuizPreviewAction({ type: "updateQuestion", question: "q-12" }),
    ).toBe(false);
  });
});

describe("respondToQuizSyncMessage", () => {
  const self = {
    id: "me",
    synced: { state: createQuizPreviewState(), revision: 2 },
    settings,
  };

  it("answers a hello with a snapshot addressed to its sender", () => {
    expect(
      respondToQuizSyncMessage(parsed("you", { kind: "hello" }), self),
    ).toEqual({
      reply: {
        kind: "snapshot",
        to: "you",
        revision: 2,
        state: self.synced.state,
        settings,
      },
    });
  });

  it("applies forwarded actions and resets the timer with a reset", () => {
    expect(
      respondToQuizSyncMessage(
        parsed("you", { kind: "action", action: { type: "back" } }),
        self,
      ),
    ).toEqual({
      event: { type: "action", action: { type: "back" } },
      resetTimer: false,
    });
    expect(
      respondToQuizSyncMessage(
        parsed("you", { kind: "action", action: { type: "reset" } }),
        self,
      ).resetTimer,
    ).toBe(true);
  });

  it("ignores snapshots for someone else or that are behind", () => {
    const state = createQuizPreviewState();
    const snapshot = (to: string, revision: number): QuizSyncMessage =>
      parsed("you", { kind: "snapshot", to, revision, state, settings });

    expect(respondToQuizSyncMessage(snapshot("them", 9), self)).toEqual({});
    expect(respondToQuizSyncMessage(snapshot("me", 2), self)).toEqual({});
    expect(respondToQuizSyncMessage(snapshot("me", 3), self)).toEqual({
      event: { type: "snapshot", revision: 3, state },
      settings,
    });
  });

  it("passes settings on and ignores its own echo", () => {
    const changed = { ...settings, initial_reoccurrences: 5 };
    expect(
      respondToQuizSyncMessage(
        parsed("you", { kind: "settings", settings: changed }),
        self,
      ),
    ).toEqual({ settings: changed });
    expect(
      respondToQuizSyncMessage(parsed("me", { kind: "hello" }), self),
    ).toEqual({});
  });
});
