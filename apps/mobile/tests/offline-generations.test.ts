import type {
  AnswerRecord,
  QuizWithUserProgress,
} from "@testownik/core/quiz/types";
import { expect, it, vi } from "vitest";
import type { ApiClient } from "../src/lib/client";
import { purgeAccountData } from "../src/lib/account-data";
import {
  OfflineLibrary,
  type OfflineState,
  type PendingAnswer,
} from "../src/lib/offline";

function quiz(id = "bank"): QuizWithUserProgress {
  return {
    id,
    title: id,
    version: 1,
    questions: [],
    current_session: {
      id: `session-${id}`,
      answers: [],
      current_question: "q",
      study_time: 0,
    },
  } as unknown as QuizWithUserProgress;
}
function attempt(previous: QuizWithUserProgress, id: string, question = "q") {
  const local: AnswerRecord = {
    id,
    question,
    selected_answers: [],
    was_correct: false,
    answered_at: "2026-10-12T03:00:00Z",
  };
  const item: PendingAnswer = {
    request_id: id,
    quiz_id: previous.id,
    session_id: previous.current_session!.id,
    version: previous.version,
    question_id: question,
    selected_answers: [],
    elapsed_seconds: 1,
    next_question: question,
    local,
  };
  return {
    item,
    quiz: {
      ...previous,
      current_session: {
        ...previous.current_session!,
        answers: [...previous.current_session!.answers, local],
      },
    },
  };
}
function setup() {
  const values = new Map<string, string>();
  let tail = Promise.resolve() as Promise<unknown>;
  const facade = () => ({
    read: async <T>(key: string, fallback: T): Promise<T> =>
      values.has(key) ? JSON.parse(values.get(key)!) : fallback,
    write: vi.fn(async (key: string, value: unknown) => {
      values.set(key, JSON.stringify(value));
    }),
    keys: async () => [...values.keys()],
    remove: async (key: string) => {
      values.delete(key);
    },
    withOfflineTransaction<T>(run: () => Promise<T>) {
      const next = tail.then(run);
      tail = next.catch(() => undefined);
      return next;
    },
  });
  const post = vi.fn(
    async (
      _path: string,
      payload: { request_id: string; question_id: string },
    ): Promise<AnswerRecord> => ({
      id: `server-${payload.request_id}`,
      question: payload.question_id,
      selected_answers: [],
      was_correct: false,
      answered_at: "2026-10-12T03:00:00Z",
    }),
  );
  const api = { post } as unknown as ApiClient,
    storeA = facade(),
    storeB = facade();
  return {
    values,
    post,
    storeA,
    storeB,
    api,
    a: new OfflineLibrary("owner", storeA, api),
    b: new OfflineLibrary("owner", storeB, api),
  };
}

it("retains another tab's acknowledged answer when a GET begun before it finishes last, then accepts a fresh GET", async () => {
  const { a, b } = setup(),
    original = quiz();
  await a.cache(original);
  const snapshot = a.captureSnapshot(original.id, await a.read());
  let finish!: (value: QuizWithUserProgress) => void;
  const oldGet = new Promise<QuizWithUserProgress>((resolve) => {
    finish = resolve;
  });
  const fetching = oldGet.then((value) => a.cache(value, snapshot));
  const next = attempt(original, "tab-B");
  await b.enqueue(next.item, next.quiz);
  await b.sync();
  const before = await b.read();
  expect(before.queue).toEqual([]);
  expect(before.quizzes.bank.current_session!.answers[0].id).toBe(
    "server-tab-B",
  );
  finish(original);
  await fetching;
  expect((await a.read()).quizzes.bank).toEqual(before.quizzes.bank);
  const fresh = { ...before.quizzes.bank, title: "Fresh authoritative title" };
  await a.cache(fresh, a.captureSnapshot("bank", await a.read()));
  expect((await a.read()).quizzes.bank.title).toBe(fresh.title);
});

it("rejects an older overlapping GET after a newer GET was applied by another context", async () => {
  const { a, b } = setup(),
    original = quiz();
  await a.cache(original);
  const old = a.captureSnapshot("bank", await a.read()),
    fresh = b.captureSnapshot("bank", await b.read());
  await b.cache({ ...original, title: "New response" }, fresh);
  await a.cache({ ...original, title: "Old response" }, old);
  expect((await a.read()).quizzes.bank.title).toBe("New response");
});

it("scopes persisted generations to each quiz and owner", async () => {
  const { a, b, storeB, api } = setup(),
    original = quiz();
  await a.cache(original);
  const snapshot = a.captureSnapshot("bank", await a.read());
  await b.cache(quiz("other"));
  await new OfflineLibrary("other-owner", storeB, api).cache(original);
  await a.cache({ ...original, title: "Still current" }, snapshot);
  expect((await a.read()).quizzes.bank.title).toBe("Still current");
});

it("reads a legacy blob without generations and preserves generation metadata through old-style JSON writes", async () => {
  const { a, values, storeA } = setup(),
    original = quiz();
  values.set(
    "offline.owner",
    JSON.stringify({ quizzes: { bank: original }, queue: [], errors: {} }),
  );
  const snapshot = a.captureSnapshot("bank", await a.read());
  expect(snapshot.generation).toBe(0);
  await a.cache(original, snapshot);
  const legacy = await storeA.read<OfflineState>(
    "offline.owner",
    {} as OfflineState,
  );
  legacy.quizzes.bank.title = "Old-style writer preserves unknown keys";
  await storeA.write("offline.owner", legacy);
  expect((await a.read()).generations?.bank).toBe(1);
});

it.each([
  null,
  [],
  { bank: -1 },
  { bank: 1.5 },
  { bank: "1" },
  { bank: Number.MAX_SAFE_INTEGER + 1 },
])(
  "preserves malformed generation metadata unchanged: %j",
  async (generations) => {
    const { a, values, storeA } = setup();
    const raw = JSON.stringify({
      quizzes: { bank: quiz() },
      queue: [],
      errors: {},
      generations,
    });
    values.set("offline.owner", raw);
    await expect(a.cache(quiz())).rejects.toMatchObject({ code: "localData" });
    expect(values.get("offline.owner")).toBe(raw);
    expect(storeA.write).not.toHaveBeenCalled();
  },
);

it("does not advance either generation after a failed persistence write", async () => {
  const { a, values, storeA } = setup();
  await a.cache(quiz());
  const raw = values.get("offline.owner"),
    state = await a.read(),
    snapshot = a.captureSnapshot("bank", state);
  storeA.write.mockRejectedValueOnce(new Error("Full storage"));
  const next = attempt(state.quizzes.bank, "failed");
  await expect(a.enqueue(next.item, next.quiz)).rejects.toThrow("Full storage");
  expect(values.get("offline.owner")).toBe(raw);
  expect(a.captureSnapshot("bank", await a.read())).toEqual(snapshot);
});

it.each(["remove", "discard"] as const)(
  "retains a generation through %s/recreate so an old GET cannot restore the old quiz",
  async (action) => {
    const { a, b } = setup(),
      original = quiz();
    await a.cache(original);
    const old = a.captureSnapshot("bank", await a.read());
    await b[action]("bank");
    expect((await b.read()).generations?.bank).toBeGreaterThan(old.generation);
    const staleAttempt = attempt(original, "stale");
    await expect(
      a.enqueue(staleAttempt.item, staleAttempt.quiz),
    ).rejects.toMatchObject({ code: "quizProgressChanged" });
    await b.cache({ ...original, title: "Recreated" });
    await a.cache(original, old);
    expect((await a.read()).quizzes.bank.title).toBe("Recreated");
  },
);

it("purges generation metadata with the deleted owner's entire record while preserving another owner", async () => {
  const { a, b, storeA, storeB, api, values } = setup();
  await a.cache(quiz());
  await new OfflineLibrary("other-owner", storeB, api).cache(quiz());
  const other = values.get("offline.other-owner");
  await purgeAccountData(storeA, "owner");
  expect(values.has("offline.owner")).toBe(false);
  expect(values.get("offline.other-owner")).toBe(other);
  expect((await b.read()).generations).toBeUndefined();
});

it("rejects a stale same-quiz submit without growing the queue or changing bytes/generation", async () => {
  const { a, b, values, post } = setup(),
    original = quiz();
  await a.cache(original);
  const first = attempt(original, "tab-A"),
    second = attempt(original, "tab-B");
  await a.enqueue(first.item, first.quiz);
  const raw = values.get("offline.owner"),
    before = await a.read();
  await expect(b.enqueue(second.item, second.quiz)).rejects.toMatchObject({
    code: "quizProgressChanged",
  });
  expect(values.get("offline.owner")).toBe(raw);
  expect(await a.read()).toEqual(before);
  expect(post).not.toHaveBeenCalled();
});

it("treats a duplicate request ID as a no-op before checking its stale history", async () => {
  const { a, b, values } = setup(),
    first = attempt(quiz(), "same-request");
  await a.enqueue(first.item, first.quiz);
  const raw = values.get("offline.owner");
  await expect(b.enqueue(first.item, first.quiz)).resolves.toBeUndefined();
  expect(values.get("offline.owner")).toBe(raw);
});

it("keeps a rejected-answer sync error ahead of idempotent retry and stale-progress handling", async () => {
  const { a, b, storeA } = setup(),
    first = attempt(quiz(), "same-request");
  await a.enqueue(first.item, first.quiz);
  const state = await a.read();
  state.errors.bank = "Server rejected";
  await storeA.write("offline.owner", state);
  await expect(b.enqueue(first.item, first.quiz)).rejects.toMatchObject({
    code: "syncConflict",
  });
});

it("allows the next single-tab answer after an acknowledgement changes an older local answer ID", async () => {
  const { a, post } = setup(),
    original = quiz();
  await a.cache(original);
  const first = attempt(original, "first", "q1");
  await a.enqueue(first.item, first.quiz);
  const viewBeforeAck = (await a.read()).quizzes.bank;
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  post.mockImplementationOnce(async () => {
    await gate;
    return { ...first.item.local, id: "server-first" };
  });
  const syncing = a.sync();
  await vi.waitFor(() => expect(post).toHaveBeenCalledOnce());
  finish();
  await syncing;
  const second = attempt(viewBeforeAck, "second", "q2");
  await expect(a.enqueue(second.item, second.quiz)).resolves.toBeUndefined();
  expect((await a.read()).queue.map((item) => item.request_id)).toEqual([
    "second",
  ]);
  expect(
    (await a.read()).quizzes.bank.current_session!.answers.map(
      (answer) => answer.id,
    ),
  ).toEqual(["server-first", "second"]);
});

it("allows successive offline answers and a next answer after reconnect drains their IDs", async () => {
  const { a } = setup();
  let view = quiz();
  await a.cache(view);
  for (const id of ["one", "two", "three"]) {
    const next = attempt(view, id);
    await a.enqueue(next.item, next.quiz);
    view = next.quiz;
  }
  expect((await a.read()).queue).toHaveLength(3);
  expect((await a.read()).quizzes.bank.current_session!.answers).toHaveLength(
    3,
  );
  await a.sync();
  const fourth = attempt(view, "four");
  await expect(a.enqueue(fourth.item, fourth.quiz)).resolves.toBeUndefined();
  expect((await a.read()).queue.map((item) => item.request_id)).toEqual([
    "four",
  ]);
  expect(
    (await a.read()).quizzes.bank.current_session!.answers.map(
      (answer) => answer.id,
    ),
  ).toEqual(["server-one", "server-two", "server-three", "four"]);
});

it.each(["session", "version"] as const)(
  "rejects a stale %s without changing stored work",
  async (change) => {
    const { a, b, values } = setup(),
      original = quiz();
    await a.cache(original);
    const changed =
      change === "session"
        ? {
            ...original,
            current_session: {
              ...original.current_session!,
              id: "new-session",
            },
          }
        : { ...original, version: 2 };
    await b.cache(changed);
    const raw = values.get("offline.owner"),
      next = attempt(original, "stale");
    await expect(a.enqueue(next.item, next.quiz)).rejects.toMatchObject({
      code: "quizProgressChanged",
    });
    expect(values.get("offline.owner")).toBe(raw);
  },
);

it.each(["question-order", "null-session"] as const)(
  "rejects changed %s without replacing stored progress",
  async (change) => {
    const { a, b, values } = setup(),
      original = quiz();
    const stored = attempt(original, "stored", "q1").quiz;
    await a.cache(
      change === "null-session" ? { ...stored, current_session: null } : stored,
    );
    const view =
      change === "question-order"
        ? {
            ...stored,
            current_session: {
              ...stored.current_session!,
              answers: [
                { ...stored.current_session!.answers[0], question: "q2" },
              ],
            },
          }
        : original;
    const next = attempt(view, "next", "q3"),
      raw = values.get("offline.owner"),
      before = await a.read();
    await expect(b.enqueue(next.item, next.quiz)).rejects.toMatchObject({
      code: "quizProgressChanged",
    });
    expect(values.get("offline.owner")).toBe(raw);
    expect(await a.read()).toEqual(before);
  },
);
