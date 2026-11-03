import { DEFAULT_USER_SETTINGS } from "@testownik/core/user/types";
import { describe, expect, it } from "vitest";

import {
  createQuizPreviewState,
  quizPreviewReducer,
} from "./preview-quiz-machine";
import type { QuizPreviewAction } from "./preview-quiz-machine";
import {
  INITIAL_SETTINGS_STAMP,
  QUIZ_SYNC_PROTOCOL,
  createSyncedQuizState,
  isQuizPreviewAction,
  parseQuizSyncMessage,
  respondToQuizSyncMessage,
  syncedQuizReducer,
} from "./preview-quiz-sync";
import type {
  QuizSyncMessage,
  QuizSyncPayload,
  SyncedQuizState,
  VersionedSettings,
} from "./preview-quiz-sync";

const settings = DEFAULT_USER_SETTINGS;
const versioned: VersionedSettings = {
  settings,
  stamp: INITIAL_SETTINGS_STAMP,
};

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

/**
 * Screens wired as `useQuizPreviewState` wires them, on a channel whose
 * delivery order each test picks. Like `BroadcastChannel`, every message
 * reaches every other screen, in the order its sender posted it.
 */
interface SimulatedScreen {
  id: string;
  synced: SyncedQuizState;
  settings: VersionedSettings;
  awaiting: string | undefined;
  /** The study timer; simulated screens never tick it. */
  studyTime: number;
  inbox: QuizSyncMessage[];
  actions: number;
}

function createNetwork(ids: string[]) {
  const screens = new Map<string, SimulatedScreen>();
  const post = (from: SimulatedScreen, payload: QuizSyncPayload): void => {
    for (const screen of screens.values()) {
      if (screen !== from) {
        screen.inbox.push({
          ...payload,
          protocol: QUIZ_SYNC_PROTOCOL,
          sender: from.id,
        });
      }
    }
  };
  const join = (id: string): SimulatedScreen => {
    const screen: SimulatedScreen = {
      id,
      synced: createSyncedQuizState(createQuizPreviewState()),
      settings: versioned,
      awaiting: undefined,
      studyTime: 120,
      inbox: [],
      actions: 0,
    };
    screens.set(id, screen);
    post(screen, { kind: "hello" });
    return screen;
  };
  for (const id of ids) {
    join(id);
  }
  const screen = (id: string): SimulatedScreen => {
    const found = screens.get(id);
    if (found === undefined) {
      throw new Error(`no screen ${id}`);
    }
    return found;
  };

  return {
    screen,
    join,
    act(id: string, action: QuizPreviewAction): void {
      const self = screen(id);
      self.actions += 1;
      const actionId = `${id}:${self.actions.toString()}`;
      const parent = self.synced.head;
      self.synced = syncedQuizReducer(self.synced, {
        type: "action",
        action,
        id: actionId,
      });
      if (action.type === "reset") {
        self.studyTime = 0;
      }
      post(self, { kind: "action", action, id: actionId, parent });
    },
    editSettings(id: string, next: typeof settings): void {
      const self = screen(id);
      self.settings = {
        settings: next,
        stamp: { version: self.settings.stamp.version + 1, author: id },
      };
      post(self, { kind: "settings", ...self.settings });
    },
    /** Hands `id` the oldest message waiting for it; false if none. */
    deliver(id: string): boolean {
      const self = screen(id);
      const incoming = self.inbox.shift();
      if (incoming === undefined) {
        return false;
      }
      const response = respondToQuizSyncMessage(incoming, self);
      self.awaiting = response.awaiting;
      if (response.event !== undefined) {
        self.synced = syncedQuizReducer(self.synced, response.event);
      }
      if (response.resetTimer === true) {
        self.studyTime = 0;
      }
      if (response.studyTime !== undefined) {
        self.studyTime = response.studyTime;
      }
      if (response.settings !== undefined) {
        self.settings = response.settings;
      }
      if (response.reply !== undefined) {
        post(self, response.reply);
      }
      return true;
    },
    settle(): void {
      let delivered = true;
      while (delivered) {
        delivered = false;
        for (const id of screens.keys()) {
          delivered = this.deliver(id) || delivered;
        }
      }
    },
    deliverAll(id: string): void {
      while (this.deliver(id)) {
        // Drain.
      }
    },
  };
}

/** A seeded generator of integers below `limit`, so failures replay. */
function createRandom(seed: number): (limit: number) => number {
  let random = seed;
  return (limit) => {
    random = (random * 1_103_515_245 + 12_345) % 2_147_483_648;
    return random % limit;
  };
}

function forwardedAction(
  sender: string,
  type: "back" | "reset",
  parent: string,
): QuizSyncMessage {
  return parsed(sender, {
    kind: "action",
    action: { type },
    id: `${sender}:1`,
    parent,
  });
}

function expectInStep(...screens: SimulatedScreen[]): void {
  const [first, ...rest] = screens;
  for (const other of rest) {
    expect(other.synced).toEqual(first.synced);
    expect(other.settings).toEqual(first.settings);
    expect(other.studyTime).toBe(first.studyTime);
  }
}

describe("syncedQuizReducer", () => {
  it("replays forwarded actions to the same state as the reducer", () => {
    const initial = createQuizPreviewState();
    const synced = SESSION.reduce<SyncedQuizState>(
      (current, action, index) =>
        syncedQuizReducer(current, {
          type: "action",
          action,
          id: index.toString(),
        }),
      createSyncedQuizState(initial),
    );
    expect(synced.revision).toBe(SESSION.length);
    expect(synced.head).toBe((SESSION.length - 1).toString());
    expect(synced.state).toEqual(
      SESSION.reduce(
        (state, action) => quizPreviewReducer(state, action),
        initial,
      ),
    );
  });
});

describe("syncing screens", () => {
  it("replays each screen's actions on the other", () => {
    const network = createNetwork(["a", "b"]);
    network.settle();
    for (const [index, action] of SESSION.entries()) {
      network.act(index % 2 === 0 ? "a" : "b", action);
      network.settle();
    }
    const a = network.screen("a");
    expectInStep(a, network.screen("b"));
    expect(a.synced.revision).toBe(SESSION.length);
  });

  it.each([
    ["a first", ["a", "b"]],
    ["b first", ["b", "a"]],
  ])("settles simultaneous actions on the lower id's quiz (%s)", (_, order) => {
    const network = createNetwork(["a", "b"]);
    network.settle();
    network.act("a", { type: "select", answers: ["a-1"] });
    network.act("b", { type: "setFocusMode", active: true });
    for (const id of order) {
      network.deliverAll(id);
    }
    network.settle();

    const a = network.screen("a");
    expectInStep(a, network.screen("b"));
    expect(a.synced.state.selectedAnswers).toEqual(["a-1"]);
    expect(a.synced.state.focusMode).toBe(false);

    // And they keep replaying each other afterwards.
    network.act("b", { type: "setFocusMode", active: true });
    network.settle();
    expectInStep(a, network.screen("b"));
    expect(a.synced.state.focusMode).toBe(true);
  });

  it.each([
    ["the lower id resets", "a", "b", 0],
    ["the higher id resets", "b", "a", 120],
  ])(
    "keeps the study timers in step when %s during another action",
    (_, resetter, other, studyTime) => {
      const network = createNetwork(["a", "b"]);
      network.settle();
      network.act(resetter, { type: "reset" });
      network.act(other, { type: "select", answers: ["a-1"] });
      network.settle();
      const a = network.screen("a");
      expectInStep(a, network.screen("b"));
      expect(a.studyTime).toBe(studyTime);
    },
  );

  it("adopts only the answer to its latest resync", () => {
    const network = createNetwork(["a", "b"]);
    network.settle();
    network.act("a", { type: "select", answers: ["a-1"] });
    network.act("b", { type: "setFocusMode", active: true });
    // b asks for a's quiz twice, once per conflicting action.
    network.deliver("b");
    network.act("a", { type: "next", settings });
    network.deliver("b");
    network.deliverAll("a");
    // The first answer arrives; b acts before the second one does.
    network.deliver("b");
    network.act("b", { type: "back" });
    network.settle();
    const a = network.screen("a");
    expectInStep(a, network.screen("b"));
    expect(a.synced.head).toBe("a:2");
  });

  it("converges whatever the interleaving", () => {
    const actions: QuizPreviewAction[] = [
      ...SESSION,
      { type: "setFocusMode", active: false },
      { type: "reset" },
    ];
    for (let seed = 1; seed <= 200; seed++) {
      const next = createRandom(seed);
      const network = createNetwork(["a", "b"]);
      for (let step = 0; step < 30; step++) {
        const id = next(2) === 0 ? "a" : "b";
        if (next(3) === 0) {
          network.act(id, actions[next(actions.length)]);
        } else {
          network.deliver(id);
        }
      }
      network.settle();
      expectInStep(network.screen("a"), network.screen("b"));
    }
  });

  it("gives a late joiner the quiz further along", () => {
    const network = createNetwork(["a"]);
    network.act("a", { type: "select", answers: ["a-1"] });
    const late = network.join("b");
    network.settle();
    expectInStep(network.screen("a"), late);
    expect(late.synced.revision).toBe(1);
  });

  it("gives a late joiner the current settings at the same revision", () => {
    const network = createNetwork(["b"]);
    const changed = { ...settings, initial_reoccurrences: 5 };
    network.editSettings("b", changed);
    const late = network.join("a");
    network.settle();
    expect(late.synced.revision).toBe(0);
    expect(late.settings.settings).toEqual(changed);
    expectInStep(network.screen("b"), late);
  });

  it("settles simultaneous settings edits on the lower id's", () => {
    const network = createNetwork(["a", "b"]);
    network.settle();
    const fromA = { ...settings, initial_reoccurrences: 4 };
    network.editSettings("a", fromA);
    network.editSettings("b", { ...settings, initial_reoccurrences: 6 });
    network.settle();
    expectInStep(network.screen("a"), network.screen("b"));
    expect(network.screen("b").settings.settings).toEqual(fromA);
  });
});

describe("parseQuizSyncMessage", () => {
  it("accepts each kind of message", () => {
    const state = createQuizPreviewState();
    expect(parsed("a", { kind: "hello" }).kind).toBe("hello");
    expect(
      parsed("a", {
        kind: "action",
        action: { type: "back" },
        id: "a:1",
        parent: "",
      }).kind,
    ).toBe("action");
    expect(parsed("a", { kind: "resync", to: "b", request: "b:1" }).kind).toBe(
      "resync",
    );
    expect(
      parsed("a", {
        kind: "snapshot",
        to: "b",
        revision: 3,
        head: "a:3",
        state,
        settings: versioned,
        studyTime: 42,
      }).kind,
    ).toBe("snapshot");
    expect(parsed("a", { kind: "settings", ...versioned }).kind).toBe(
      "settings",
    );
  });

  it.each([
    ["no protocol", { sender: "a", kind: "hello" }],
    ["another protocol", { protocol: "other", sender: "a", kind: "hello" }],
    ["no sender", { protocol: QUIZ_SYNC_PROTOCOL, kind: "hello" }],
    ["an unknown kind", message("a", { kind: "shout" })],
    [
      "an unknown action",
      message("a", {
        kind: "action",
        action: { type: "x" },
        id: "1",
        parent: "",
      }),
    ],
    [
      "a malformed action",
      message("a", {
        kind: "action",
        action: { type: "select", answers: [1] },
        id: "1",
        parent: "",
      }),
    ],
    [
      "an action without a parent",
      message("a", { kind: "action", action: { type: "back" }, id: "1" }),
    ],
    ["a resync for no one", message("a", { kind: "resync", request: "1" })],
    [
      "a negative revision",
      message("a", {
        kind: "snapshot",
        to: "b",
        revision: -1,
        head: "",
        state: createQuizPreviewState(),
      }),
    ],
    [
      "a snapshot without a state",
      message("a", {
        kind: "snapshot",
        to: "b",
        revision: 1,
        head: "a:1",
        state: {},
      }),
    ],
    [
      "settings that are not an object",
      message("a", {
        kind: "settings",
        settings: 1,
        stamp: { version: 1, author: "a" },
      }),
    ],
    ["settings without a stamp", message("a", { kind: "settings", settings })],
    [
      "a snapshot without a study time",
      message("a", {
        kind: "snapshot",
        to: "b",
        revision: 1,
        head: "a:1",
        state: createQuizPreviewState(),
        settings: versioned,
      }),
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
    synced: { state: createQuizPreviewState(), revision: 2, head: "me:2" },
    settings: versioned,
    awaiting: undefined,
    studyTime: 42,
  };

  it("answers a hello with a snapshot addressed to its sender", () => {
    expect(
      respondToQuizSyncMessage(parsed("you", { kind: "hello" }), self),
    ).toEqual({
      awaiting: undefined,
      reply: {
        kind: "snapshot",
        to: "you",
        revision: 2,
        head: "me:2",
        state: self.synced.state,
        settings: versioned,
        studyTime: 42,
      },
    });
  });

  it("applies forwarded actions and resets the timer with a reset", () => {
    expect(
      respondToQuizSyncMessage(forwardedAction("you", "back", "me:2"), self),
    ).toEqual({
      awaiting: undefined,
      event: { type: "action", action: { type: "back" }, id: "you:1" },
      resetTimer: false,
    });
    expect(
      respondToQuizSyncMessage(forwardedAction("you", "reset", "me:2"), self)
        .resetTimer,
    ).toBe(true);
  });

  it("asks a lower id for its quiz after a conflicting action", () => {
    expect(
      respondToQuizSyncMessage(forwardedAction("zz", "back", ""), self),
    ).toEqual({ awaiting: undefined });
    expect(
      respondToQuizSyncMessage(forwardedAction("ab", "back", ""), self),
    ).toEqual({
      awaiting: "ab:1",
      reply: { kind: "resync", to: "ab", request: "ab:1" },
    });
  });

  it("adopts only the answer to its latest resync or a quiz further along", () => {
    const state = createQuizPreviewState({ selectedAnswers: [] });
    const snapshot = (fields: {
      to?: string;
      revision: number;
      request?: string;
    }): QuizSyncMessage =>
      parsed("ab", {
        kind: "snapshot",
        to: "me",
        head: "ab:9",
        state,
        settings: versioned,
        studyTime: 7,
        ...fields,
      });
    const awaiting = { ...self, awaiting: "ab:2" };
    const adopted = {
      type: "snapshot",
      revision: 1,
      head: "ab:9",
      state,
    };

    expect(
      respondToQuizSyncMessage(snapshot({ to: "them", revision: 9 }), self),
    ).toEqual({ awaiting: undefined });
    expect(respondToQuizSyncMessage(snapshot({ revision: 2 }), self)).toEqual({
      awaiting: undefined,
    });
    expect(
      respondToQuizSyncMessage(snapshot({ revision: 3 }), self).event,
    ).toEqual({ ...adopted, revision: 3 });
    expect(
      respondToQuizSyncMessage(snapshot({ revision: 3 }), self).studyTime,
    ).toBe(7);
    // An older request's answer is not adopted.
    expect(
      respondToQuizSyncMessage(
        snapshot({ revision: 1, request: "ab:1" }),
        awaiting,
      ),
    ).toEqual({ awaiting: "ab:2" });
    expect(
      respondToQuizSyncMessage(
        snapshot({ revision: 1, request: "ab:2" }),
        awaiting,
      ),
    ).toEqual({ awaiting: undefined, event: adopted, studyTime: 7 });
  });

  it("answers a resync addressed to it", () => {
    const [forThem, forMe] = ["them", "me"].map((to) =>
      parsed("you", { kind: "resync", to, request: "me:2" }),
    );
    expect(respondToQuizSyncMessage(forThem, self)).toEqual({
      awaiting: undefined,
    });
    expect(respondToQuizSyncMessage(forMe, self).reply).toMatchObject({
      kind: "snapshot",
      to: "you",
      request: "me:2",
      head: "me:2",
    });
  });

  it("applies newer settings only and ignores its own echo", () => {
    const changed = { ...settings, initial_reoccurrences: 5 };
    const update = (version: number, author: string) =>
      parsed(author, {
        kind: "settings",
        settings: changed,
        stamp: { version, author },
      });
    const edited = {
      ...self,
      settings: { settings, stamp: { version: 2, author: "me" } },
    };
    expect(respondToQuizSyncMessage(update(1, "ab"), edited)).toEqual({
      awaiting: undefined,
    });
    expect(respondToQuizSyncMessage(update(2, "zz"), edited)).toEqual({
      awaiting: undefined,
    });
    expect(respondToQuizSyncMessage(update(2, "ab"), edited)).toEqual({
      awaiting: undefined,
      settings: { settings: changed, stamp: { version: 2, author: "ab" } },
    });
    expect(
      respondToQuizSyncMessage(parsed("me", { kind: "hello" }), self),
    ).toEqual({ awaiting: undefined });
  });
});
