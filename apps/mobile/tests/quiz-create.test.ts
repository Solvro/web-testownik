import { createHash } from "node:crypto";
import { prepareQuizForSubmission } from "@testownik/core/quiz/schema";
import {
  createAndroidChunkStorage,
  MAX_CHUNK_VALUE_BYTES,
  storedValueBytes,
  type AtomicAndroidStorage,
} from "../src/lib/android-chunk-storage";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/lib/client";
import {
  assertQuizCreateAckFits,
  acknowledgeQuizCreate,
  adoptCreatedDraft,
  clearQuizCreate,
  createQuiz,
  loadQuizCreate,
  quizCreateKey,
  sameDraftContent,
  type CreatePayload,
  type CreateResult,
  type CreateStorage,
} from "../src/lib/quiz-create";
import type { EditorDraft } from "../src/lib/editor-draft";

const requestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const nextId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab";
const quizId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const questionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const answerId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const serverQuestion = "cccccccc-cccc-4ccc-8ccc-cccccccccccd";
const serverAnswer = "dddddddd-dddd-4ddd-8ddd-ddddddddddde";
const snapshot: EditorDraft = {
  schemaVersion: 1,
  title: "Original",
  description: "",
  questions: [
    {
      id: questionId,
      text: "Question",
      order: 1,
      multiple: false,
      answers: [{ id: answerId, text: "Answer", order: 1, is_correct: true }],
    },
  ],
};
const payload = structuredClone(snapshot) as CreatePayload;
const response: CreateResult = {
  request_id: requestId,
  status: "created",
  created_version: 1,
  id_map: {
    questions: { [questionId]: serverQuestion },
    answers: { [answerId]: serverAnswer },
  },
  quiz: {
    ...snapshot,
    id: quizId,
    version: 1,
    visibility: 0,
    is_anonymous: false,
    allow_anonymous: false,
    questions: [
      {
        ...snapshot.questions[0],
        id: serverQuestion,
        answers: [{ ...snapshot.questions[0].answers[0], id: serverAnswer }],
      },
    ],
  },
};
function fixture(initial?: Map<string, unknown>) {
  const values = initial ?? new Map<string, unknown>();
  const store: CreateStorage = {
    readStrict: async <T>(key: string, fallback: T) =>
      structuredClone(values.has(key) ? values.get(key) : fallback) as T,
    write: vi.fn(async (key: string, value: unknown) => {
      values.set(key, structuredClone(value));
    }),
    remove: vi.fn(async (key: string) => {
      values.delete(key);
    }),
  };
  const post = vi.fn(
    async (_body: { request_id: string; quiz: CreatePayload }) => response,
  );
  const newId = vi.fn(() => requestId);
  const run = (overrides: Partial<Parameters<typeof createQuiz>[0]> = {}) =>
    createQuiz({
      store,
      owner: "owner",
      snapshot,
      payload,
      post,
      newId,
      ...overrides,
    });
  return { values, store, post, newId, run };
}

describe("durable editor create operation", () => {
  it("persists an immutable snapshot and request ID before the first POST", async () => {
    const f = fixture();
    f.post.mockImplementation(async () => {
      expect(await loadQuizCreate({ ...f.store }, "owner")).toMatchObject({
        state: "pending",
        snapshot,
        requestId,
      });
      return response;
    });
    const result = await f.run();
    expect(result.state).toBe("created");
    expect(result.acknowledged?.snapshot.questions[0].id).toBe(serverQuestion);
    expect(f.post).toHaveBeenCalledWith({
      request_id: requestId,
      quiz: payload,
    });
  });

  it("does not POST if writing the operation fails or a deletion marker refuses it", async () => {
    for (const fails of [true, false]) {
      const f = fixture();
      f.store.write = async () => {
        if (fails) throw new Error("Disk full");
      };
      await expect(f.run()).rejects.toThrow();
      expect(f.post).not.toHaveBeenCalled();
    }
  });

  it("replays the original payload after lost acknowledgement and process restart, retaining later edits", async () => {
    const first = fixture();
    first.post.mockRejectedValueOnce(new ApiError(0, "Lost response"));
    await expect(first.run()).rejects.toThrow("Lost response");
    const second = fixture(first.values);
    const edited = { ...snapshot, title: "Later edit" };
    const saved = await second.run({
      snapshot: edited,
      payload: { ...payload, title: "Later edit" },
    });
    expect(second.newId).not.toHaveBeenCalled();
    expect(second.post).toHaveBeenCalledWith({
      request_id: requestId,
      quiz: payload,
    });
    const adopted = adoptCreatedDraft(edited, saved.result!);
    expect(adopted.title).toBe("Later edit");
    expect(adopted.baseVersion).toBe(1);
    expect(adopted.questions[0].id).toBe(serverQuestion);
    expect(adopted.questions[0].answers[0].id).toBe(serverAnswer);
    expect(sameDraftContent(adopted, saved.acknowledged!.snapshot)).toBe(false);
  });

  it.each([403, 404, 409, 429, 500, 503])(
    "retains a pending operation on ambiguous HTTP%s without minting another ID",
    async (status) => {
      const f = fixture();
      f.post.mockRejectedValueOnce(new ApiError(status, "Retry later"));
      await expect(f.run()).rejects.toThrow();
      expect(await loadQuizCreate(f.store, "owner")).toMatchObject({
        state: "pending",
        requestId,
      });
      await f.run();
      expect(f.newId).toHaveBeenCalledOnce();
      expect(f.post.mock.calls.map((call) => call[0])).toEqual([
        { request_id: requestId, quiz: payload },
        { request_id: requestId, quiz: payload },
      ]);
    },
  );

  it("never retries a known created operation as POST when local cleanup was interrupted", async () => {
    const f = fixture();
    await f.run();
    f.post.mockClear();
    const restarted = fixture(f.values);
    const saved = await restarted.run();
    expect(saved.result?.quiz.id).toBe(quizId);
    expect(restarted.post).not.toHaveBeenCalled();
  });

  it("does not retire invalid or missing response mappings", async () => {
    const f = fixture();
    f.post.mockResolvedValueOnce({
      ...response,
      id_map: { questions: {}, answers: {} },
    });
    await expect(f.run()).rejects.toMatchObject({ reason: "response" });
    expect(await loadQuizCreate(f.store, "owner")).toMatchObject({
      state: "pending",
    });
  });

  it("recovers a response known to have committed when saving its local result failed", async () => {
    const f = fixture();
    const write = f.store.write;
    let writes = 0;
    f.store.write = async (key, value) => {
      if (++writes === 2) throw new Error("Disk full after201");
      await write(key, value);
    };
    await expect(f.run()).rejects.toThrow("Disk full after201");
    expect(await loadQuizCreate(f.store, "owner")).toMatchObject({
      state: "pending",
    });
    const restarted = fixture(f.values);
    await restarted.run();
    expect(restarted.post).toHaveBeenCalledWith({
      request_id: requestId,
      quiz: payload,
    });
    expect(restarted.newId).not.toHaveBeenCalled();
  });

  it("permits a new edited operation only after a matching durable rejection", async () => {
    const f = fixture();
    f.post.mockRejectedValueOnce(
      new ApiError(400, "Invalid", {
        request_id: requestId,
        status: "rejected",
        code: "validation_failed",
      }),
    );
    await expect(f.run()).rejects.toMatchObject({ reason: "rejected" });
    expect(await loadQuizCreate(f.store, "owner")).toMatchObject({
      state: "rejected",
    });
    f.post.mockResolvedValueOnce({ ...response, request_id: nextId });
    await f.run({
      newId: () => nextId,
      snapshot: { ...snapshot, title: "Fixed" },
      payload: { ...payload, title: "Fixed" },
    });
    expect(f.post).toHaveBeenLastCalledWith({
      request_id: nextId,
      quiz: { ...payload, title: "Fixed" },
    });
  });

  it("keeps generic or wrong-ID validation errors ambiguous", async () => {
    for (const body of [
      { detail: "Invalid" },
      { request_id: requestId, status: "rejected" },
      { request_id: nextId, status: "rejected", code: "validation_failed" },
    ]) {
      const f = fixture();
      f.post.mockRejectedValueOnce(new ApiError(400, "Invalid", body));
      await expect(f.run()).rejects.toThrow();
      expect(await loadQuizCreate(f.store, "owner")).toMatchObject({
        state: "pending",
        requestId,
      });
    }
  });

  it("keeps a deleted quiz receipt and never recreates it", async () => {
    const f = fixture();
    f.post.mockRejectedValueOnce(
      new ApiError(410, "Deleted", {
        ...response,
        status: "deleted",
        quiz_id: quizId,
      }),
    );
    await expect(f.run()).rejects.toMatchObject({ reason: "deleted" });
    await expect(f.run()).rejects.toMatchObject({ reason: "deleted" });
    expect(f.post).toHaveBeenCalledOnce();
    expect(await loadQuizCreate(f.store, "owner")).toMatchObject({
      state: "deleted",
    });
  });

  it("persists a known PATCH acknowledgement before local cleanup and keeps the original receipt version", async () => {
    const f = fixture();
    await f.run();
    const edited = {
      ...adoptCreatedDraft(snapshot, response),
      title: "Later edit",
    };
    await acknowledgeQuizCreate(f.store, "owner", requestId, edited, {
      ...response.quiz,
      version: 2,
    });
    const operation = await loadQuizCreate(f.store, "owner");
    expect(operation?.result?.created_version).toBe(1);
    expect(operation?.acknowledged).toMatchObject({
      snapshot: { title: "Later edit", baseVersion: 2 },
      quiz: { version: 2 },
    });
  });

  it("never clears an unknown pending operation, another request or another owner's data", async () => {
    const f = fixture();
    f.post.mockRejectedValueOnce(new Error("Lost"));
    await expect(f.run()).rejects.toThrow();
    await clearQuizCreate(f.store, "owner", requestId);
    expect(f.values.has(quizCreateKey("owner"))).toBe(true);
    await f.run();
    await clearQuizCreate(f.store, "owner", nextId);
    expect(f.values.has(quizCreateKey("owner"))).toBe(true);
    expect(await loadQuizCreate(f.store, "other-owner")).toBeNull();
    await clearQuizCreate(f.store, "owner", requestId);
    expect(f.values.has(quizCreateKey("owner"))).toBe(false);
  });

  it("fails closed on damaged operation JSON shape without overwriting it", async () => {
    const f = fixture();
    const damaged = { schemaVersion: 9, requestId };
    f.values.set(quizCreateKey("owner"), damaged);
    await expect(f.run()).rejects.toMatchObject({ reason: "local" });
    expect(f.post).not.toHaveBeenCalled();
    expect(f.values.get(quizCreateKey("owner"))).toEqual(damaged);
  });
  it("normalizes original UUID case when adopting canonical server mappings", async () => {
    const f = fixture();
    const uppercase = {
      ...snapshot,
      questions: snapshot.questions.map((q) => ({
        ...q,
        id: q.id.toUpperCase(),
        answers: q.answers.map((a) => ({ ...a, id: a.id.toUpperCase() })),
      })),
    };
    const saved = await f.run({
      snapshot: uppercase,
      payload: uppercase as CreatePayload,
    });
    expect(
      adoptCreatedDraft(uppercase, saved.result!).questions[0],
    ).toMatchObject({ id: serverQuestion, answers: [{ id: serverAnswer }] });
  });

  it("accepts current replay content while retaining original mappings and CAS base", async () => {
    const f = fixture();
    f.post.mockResolvedValueOnce({
      ...response,
      quiz: { ...response.quiz, version: 3, questions: [] },
    });
    const saved = await f.run();
    expect(saved.acknowledged?.snapshot.baseVersion).toBe(1);
    expect(saved.result?.quiz.version).toBe(3);
    expect(saved.acknowledged?.snapshot.questions[0].id).toBe(serverQuestion);
  });

  it("fails closed when a persisted created receipt has lost its original mappings", async () => {
    const f = fixture();
    const created = await f.run();
    f.values.set(quizCreateKey("owner"), {
      ...created,
      result: { ...created.result, id_map: { questions: {}, answers: {} } },
    });
    f.post.mockClear();
    await expect(f.run()).rejects.toMatchObject({ reason: "local" });
    expect(f.post).not.toHaveBeenCalled();
  });

  it("fails closed on contradictory pending and created result state", async () => {
    const f = fixture();
    const created = await f.run();
    f.values.set(quizCreateKey("owner"), { ...created, state: "pending" });
    f.post.mockClear();
    await expect(f.run()).rejects.toMatchObject({ reason: "local" });
    expect(f.post).not.toHaveBeenCalled();
  });
  it("records matching lost-access proof as terminal without recreating or exposing quiz content", async () => {
    const f = fixture();
    f.post.mockRejectedValueOnce(
      new ApiError(403, "Lost access", {
        request_id: requestId,
        code: "create_access_lost",
      }),
    );
    await expect(f.run()).rejects.toMatchObject({ reason: "access-lost" });
    const restarted = fixture(f.values);
    await expect(restarted.run()).rejects.toMatchObject({
      reason: "access-lost",
    });
    expect(restarted.post).not.toHaveBeenCalled();
    expect(await loadQuizCreate(f.store, "owner")).toMatchObject({
      state: "access-lost",
    });
    await clearQuizCreate(f.store, "owner", requestId);
    expect(await loadQuizCreate(f.store, "owner")).toBeNull();
  });

  it("keeps wrong-ID lost-access proof ambiguous", async () => {
    const f = fixture();
    f.post.mockRejectedValueOnce(
      new ApiError(403, "Lost access", {
        request_id: nextId,
        code: "create_access_lost",
      }),
    );
    await expect(f.run()).rejects.toThrow();
    expect(await loadQuizCreate(f.store, "owner")).toMatchObject({
      state: "pending",
    });
  });

  it("normalizes a nullable current server description without changing the original CAS version", async () => {
    const f = fixture();
    f.post.mockResolvedValueOnce({
      ...response,
      quiz: { ...response.quiz, description: null, version: 2 },
    } as unknown as CreateResult);
    const saved = await f.run();
    expect(saved.result?.quiz).toEqual({ id: quizId, version: 2 });
    expect(saved.result?.created_version).toBe(1);
    expect(await loadQuizCreate(f.store, "owner")).toMatchObject({
      state: "created",
    });
  });
  it("normalizes nullable PATCH acknowledgement and never poisons its journal", async () => {
    const f = fixture();
    await f.run();
    const savedQuiz = {
      ...response.quiz,
      description: null,
      version: 2,
    } as unknown as CreateResult["quiz"];
    await acknowledgeQuizCreate(
      f.store,
      "owner",
      requestId,
      adoptCreatedDraft(snapshot, response),
      savedQuiz,
    );
    expect(await loadQuizCreate(f.store, "owner")).toMatchObject({
      state: "created",
      acknowledged: {
        quiz: { version: 2 },
        snapshot: { baseVersion: 2 },
      },
    });
  });

  it("rejects malformed PATCH acknowledgement before overwriting the last valid receipt", async () => {
    const f = fixture();
    const original = await f.run();
    const malformed = { ...response.quiz, id: "damaged-server-id", version: 2 };
    await expect(
      acknowledgeQuizCreate(f.store, "owner", requestId, snapshot, malformed),
    ).rejects.toThrow();
    expect(await loadQuizCreate(f.store, "owner")).toEqual(original);
  });
});

describe("compact editor acknowledgement storage", () => {
  const stored = (f: ReturnType<typeof fixture>) =>
    f.values.get(quizCreateKey("owner")) as Record<string, any>;
  it("stores only one draft after create, pruning unused server map entries and all server content", async () => {
    const f = fixture();
    f.post.mockResolvedValueOnce({
      ...response,
      quiz: { ...response.quiz, description: "server content".repeat(10000) },
      id_map: {
        questions: { ...response.id_map.questions, [nextId]: requestId },
        answers: response.id_map.answers,
      },
    });
    await f.run();
    expect(stored(f)).toMatchObject({
      schemaVersion: 2,
      state: "created",
      snapshot,
      mapped: { questions: 1, answers: 1 },
      result: { quiz: { id: quizId, version: 1 } },
    });
    expect(stored(f)).not.toHaveProperty("payload");
    expect(stored(f)).not.toHaveProperty("acknowledged");
    expect(stored(f).result.id_map.questions).toEqual(
      response.id_map.questions,
    );
    expect(JSON.stringify(stored(f))).not.toContain("server content");
  });
  it("keeps only a version reference when a PATCH submits the initial mapped draft", async () => {
    const f = fixture();
    await f.run();
    await acknowledgeQuizCreate(
      f.store,
      "owner",
      requestId,
      adoptCreatedDraft(snapshot, response),
      { id: quizId, version: 2 },
    );
    expect(stored(f).acknowledged).toEqual({
      quiz: { id: quizId, version: 2 },
    });
    expect(stored(f).snapshot).toEqual(snapshot);
    expect(
      (await loadQuizCreate({ ...f.store }, "owner"))?.acknowledged?.snapshot,
    ).toMatchObject({ baseVersion: 2, questions: [{ id: serverQuestion }] });
  });
  it("replaces the original draft after a changed PATCH and restores that exact ACK without POST", async () => {
    const f = fixture();
    await f.run();
    const edited = {
      ...adoptCreatedDraft(snapshot, response),
      title: "Changed",
      questions: [],
    };
    await acknowledgeQuizCreate(f.store, "owner", requestId, edited, {
      id: quizId,
      version: 2,
    });
    expect(stored(f)).not.toHaveProperty("snapshot");
    expect(stored(f).acknowledged.snapshot).toEqual({
      ...edited,
      baseVersion: 2,
    });
    const restarted = fixture(f.values);
    const recovered = await restarted.run();
    expect(recovered.snapshot).toEqual({ ...edited, baseVersion: 2 });
    expect(recovered.acknowledged?.snapshot).toEqual(recovered.snapshot);
    expect(restarted.post).not.toHaveBeenCalled();
  });
  it("does not replace a newer known PATCH acknowledgement with an older one", async () => {
    const f = fixture();
    await f.run();
    await acknowledgeQuizCreate(f.store, "owner", requestId, snapshot, {
      id: quizId,
      version: 3,
    });
    const before = structuredClone(stored(f));
    await expect(
      acknowledgeQuizCreate(f.store, "owner", requestId, snapshot, {
        id: quizId,
        version: 2,
      }),
    ).rejects.toMatchObject({ reason: "response" });
    expect(stored(f)).toEqual(before);
  });
  it("retains the original CAS base when replay returns a newer server version", async () => {
    const f = fixture();
    f.post.mockResolvedValueOnce({
      ...response,
      quiz: { ...response.quiz, version: 99 },
    });
    const created = await f.run();
    expect(created.result?.quiz.version).toBe(99);
    expect(created.acknowledged?.quiz.version).toBe(1);
    expect(created.acknowledged?.snapshot.baseVersion).toBe(1);
  });
  it.each(["rejected", "access-lost", "deleted"] as const)(
    "drops payload and server maps after known %s",
    async (state) => {
      const f = fixture();
      const failure =
        state === "rejected"
          ? new ApiError(400, "Rejected", {
              request_id: requestId,
              status: "rejected",
              code: "validation_failed",
            })
          : state === "access-lost"
            ? new ApiError(403, "Lost", {
                request_id: requestId,
                code: "create_access_lost",
              })
            : new ApiError(410, "Deleted", {
                ...response,
                status: "deleted",
                quiz_id: quizId,
              });
      f.post.mockRejectedValueOnce(failure);
      await expect(f.run()).rejects.toMatchObject({ reason: state });
      expect(stored(f)).not.toHaveProperty("payload");
      expect(stored(f)).not.toHaveProperty("result");
      expect(stored(f)).toMatchObject({ schemaVersion: 2, snapshot, state });
      if (state === "deleted")
        expect(stored(f).deleted).toEqual({
          quiz_id: quizId,
          created_version: 1,
        });
    },
  );
  it("detects a removal which did not actually delete the known receipt", async () => {
    const f = fixture();
    await f.run();
    f.store.remove = async () => {};
    await expect(
      clearQuizCreate(f.store, "owner", requestId),
    ).rejects.toMatchObject({ reason: "local" });
    expect((await loadQuizCreate(f.store, "owner"))?.state).toBe("created");
  });
  it("replays legacy pending journal with its immutable request and adopts schema2 only after ACK", async () => {
    const f = fixture();
    f.values.set(quizCreateKey("owner"), {
      schemaVersion: 1,
      owner: "owner",
      requestId,
      state: "pending",
      snapshot,
      payload,
    });
    const before = structuredClone(stored(f));
    f.post.mockRejectedValueOnce(new Error("Offline"));
    await expect(f.run()).rejects.toThrow("Offline");
    expect(stored(f)).toEqual(before);
    await f.run({ snapshot: { ...snapshot, title: "Later" } });
    expect(f.newId).not.toHaveBeenCalled();
    expect(stored(f).schemaVersion).toBe(2);
    expect(f.post.mock.calls[1][0]).toEqual({
      request_id: requestId,
      quiz: payload,
    });
  });
  it("reads legacy created and upgrades only after a known subsequent PATCH", async () => {
    const f = fixture();
    const legacy = {
      schemaVersion: 1,
      owner: "owner",
      requestId,
      state: "created",
      snapshot,
      payload,
      result: response,
      acknowledged: {
        snapshot: adoptCreatedDraft(snapshot, response),
        quiz: response.quiz,
      },
    };
    f.values.set(quizCreateKey("owner"), legacy);
    expect((await f.run()).result?.quiz).toEqual({ id: quizId, version: 1 });
    expect(stored(f)).toEqual(legacy);
    expect(f.post).not.toHaveBeenCalled();
    await acknowledgeQuizCreate(
      f.store,
      "owner",
      requestId,
      { ...snapshot, title: "Changed" },
      { id: quizId, version: 2 },
    );
    expect(stored(f).schemaVersion).toBe(2);
    expect(stored(f)).not.toHaveProperty("payload");
  });
  it.each([
    "missing-map",
    "wrong-count",
    "both-snapshots",
    "neither-snapshot",
    "wrong-id",
    "wrong-version",
    "extra-server-body",
  ])("preserves malformed schema2 %s without POST", async (defect) => {
    const f = fixture();
    await f.run();
    const damaged = structuredClone(stored(f));
    if (defect === "missing-map")
      delete damaged.result.id_map.answers[answerId];
    if (defect === "wrong-count") damaged.mapped.questions = 99;
    if (defect === "both-snapshots")
      damaged.acknowledged = {
        quiz: { id: quizId, version: 2 },
        snapshot: { ...snapshot, baseVersion: 2 },
      };
    if (defect === "neither-snapshot") delete damaged.snapshot;
    if (defect === "wrong-id")
      damaged.acknowledged = { quiz: { id: nextId, version: 2 } };
    if (defect === "wrong-version")
      damaged.acknowledged = { quiz: { id: quizId, version: 0 } };
    if (defect === "extra-server-body") damaged.result.quiz.title = "Body";
    f.values.set(quizCreateKey("owner"), damaged);
    f.post.mockClear();
    await expect(f.run()).rejects.toMatchObject({ reason: "local" });
    expect(stored(f)).toEqual(damaged);
    expect(f.post).not.toHaveBeenCalled();
  });
});

describe("compact editor size boundaries", () => {
  function cappedFixture() {
    const f = fixture();
    const sizes: number[] = [];
    const write = f.store.write;
    f.store.write = async (key, value) => {
      const bytes = storedValueBytes(value);
      sizes.push(bytes);
      if (bytes > MAX_CHUNK_VALUE_BYTES) throw new Error("Android8MiB cap");
      await write(key, value);
    };
    return { ...f, sizes };
  }
  it("persists and restarts a2MiB create acknowledgement while a20MiB server replay body is discarded", async () => {
    const f = cappedFixture();
    const large = { ...snapshot, description: "x".repeat(2 * 1024 * 1024) };
    f.post.mockResolvedValueOnce({
      ...response,
      quiz: {
        ...response.quiz,
        description: "z".repeat(20 * 1024 * 1024),
        version: 4,
      },
    });
    await f.run({ snapshot: large, payload: prepareQuizForSubmission(large) });
    expect(f.sizes).toHaveLength(2);
    expect(Math.max(...f.sizes)).toBeLessThan(MAX_CHUNK_VALUE_BYTES);
    expect(f.sizes[1]).toBeLessThan(f.sizes[0]);
    const restarted = fixture(f.values);
    const recovered = await restarted.run();
    expect(recovered.acknowledged?.snapshot.description).toBe(
      large.description,
    );
    expect(recovered.acknowledged?.quiz.version).toBe(1);
    expect(restarted.post).not.toHaveBeenCalled();
  });
  it("recovers a legacy large pending receipt after process restart without storage amplification", async () => {
    const f = cappedFixture();
    const large = { ...snapshot, description: "x".repeat(2 * 1024 * 1024) };
    const frozen = prepareQuizForSubmission(large);
    f.values.set(quizCreateKey("owner"), {
      schemaVersion: 1,
      owner: "owner",
      requestId,
      state: "pending",
      snapshot: large,
      payload: frozen,
    });
    await f.run();
    expect(f.newId).not.toHaveBeenCalled();
    expect(f.sizes).toHaveLength(1);
    expect(f.sizes[0]).toBeLessThan(3 * 1024 * 1024);
    expect((await loadQuizCreate({ ...f.store }, "owner"))?.state).toBe(
      "created",
    );
  });
  it("permits an exact8MiB pending record and blocks cap+1 before any write or POST", async () => {
    const large = structuredClone(snapshot);
    const frozen = prepareQuizForSubmission(large);
    const base = {
      schemaVersion: 2,
      owner: "owner",
      requestId,
      state: "pending",
      snapshot: large,
      payload: frozen,
    };
    const extra = MAX_CHUNK_VALUE_BYTES - storedValueBytes(base);
    large.description = "x".repeat(Math.floor(extra / 2));
    frozen.description = "x".repeat(extra - large.description.length);
    expect(storedValueBytes(base)).toBe(MAX_CHUNK_VALUE_BYTES);
    const f = cappedFixture();
    await f.run({ snapshot: large, payload: frozen });
    expect(f.sizes[0]).toBe(MAX_CHUNK_VALUE_BYTES);
    expect(f.sizes[1]).toBeLessThan(MAX_CHUNK_VALUE_BYTES);
    const g = fixture();
    await expect(
      g.run({
        snapshot: large,
        payload: { ...frozen, description: frozen.description + "x" },
      }),
    ).rejects.toMatchObject({ reason: "size" });
    expect(g.store.write).not.toHaveBeenCalled();
    expect(g.post).not.toHaveBeenCalled();
  });
  it("checks a future PATCH acknowledgement before sending when later edits exceed local capacity", async () => {
    const f = fixture();
    const created = await f.run();
    const before = structuredClone(f.values.get(quizCreateKey("owner")));
    const oversized = {
      ...adoptCreatedDraft(snapshot, response),
      description: "x".repeat(MAX_CHUNK_VALUE_BYTES),
    };
    expect(() => assertQuizCreateAckFits(created, oversized)).toThrowError(
      expect.objectContaining({ reason: "size" }),
    );
    expect(f.values.get(quizCreateKey("owner"))).toEqual(before);
    expect(() =>
      assertQuizCreateAckFits(created, adoptCreatedDraft(snapshot, response)),
    ).not.toThrow();
  });
  it("stores a large acknowledgement atomically through the actual Android chunk adapter", async () => {
    const values = new Map<string, string>();
    const raw: AtomicAndroidStorage = {
      getItem: async (key) => values.get(key) ?? null,
      multiGet: async (keys) =>
        keys.map((key) => [key, values.get(key) ?? null] as const),
      multiSet: async (pairs) => {
        for (const [key, value] of pairs) values.set(key, value);
      },
      multiRemove: async (keys) => {
        for (const key of keys) values.delete(key);
      },
      getAllKeys: async () => [...values.keys()],
    };
    const android = createAndroidChunkStorage(raw, async (value) =>
      createHash("sha256").update(value).digest("hex"),
    );
    const store: CreateStorage = {
      readStrict: async <T>(key: string, fallback: T) => {
        const json = await android.getItem(`testownik.v1.${key}`);
        return json === null ? fallback : (JSON.parse(json) as T);
      },
      write: (key, value) =>
        android.setItem(`testownik.v1.${key}`, JSON.stringify(value)),
      remove: (key) => android.removeItem(`testownik.v1.${key}`),
    };
    const large = { ...snapshot, description: "ą😀".repeat(350000) };
    await createQuiz({
      store,
      owner: "owner",
      snapshot: large,
      payload: prepareQuizForSubmission(large),
      newId: () => requestId,
      post: async () => response,
    });
    expect(
      (await loadQuizCreate({ ...store }, "owner"))?.acknowledged?.snapshot
        .description,
    ).toBe(large.description);
    expect(values.size).toBeGreaterThan(2);
  });
});

it.each(["rejected", "access-lost", "deleted"] as const)(
  "transitions a cap-sized pending record to known %s without enlarging it",
  async (state) => {
    const f = fixture();
    const large = structuredClone(snapshot);
    const frozen = prepareQuizForSubmission(large);
    const base = {
      schemaVersion: 2,
      owner: "owner",
      requestId,
      state: "pending",
      snapshot: large,
      payload: frozen,
    };
    const extra = MAX_CHUNK_VALUE_BYTES - storedValueBytes(base);
    large.description = "x".repeat(Math.floor(extra / 2));
    frozen.description = "x".repeat(extra - large.description.length);
    f.post.mockRejectedValueOnce(
      state === "rejected"
        ? new ApiError(400, "Rejected", {
            request_id: requestId,
            status: "rejected",
            code: "validation_failed",
          })
        : state === "access-lost"
          ? new ApiError(403, "Lost", {
              request_id: requestId,
              code: "create_access_lost",
            })
          : new ApiError(410, "Deleted", {
              ...response,
              status: "deleted",
              quiz_id: quizId,
            }),
    );
    await expect(
      f.run({ snapshot: large, payload: frozen }),
    ).rejects.toMatchObject({ reason: state });
    const persisted = f.values.get(quizCreateKey("owner"));
    expect(storedValueBytes(persisted)).toBeLessThan(MAX_CHUNK_VALUE_BYTES);
    expect(await loadQuizCreate({ ...f.store }, "owner")).toMatchObject({
      state,
    });
  },
);
it.each([1, 10, 100, 1000])(
  "real prepared image-only bank with%s questions has bounded compact ACK overhead",
  async (count) => {
    const qMap: Record<string, string> = {},
      aMap: Record<string, string> = {};
    const empty: EditorDraft = {
      schemaVersion: 1,
      title: "Images",
      description: "",
      questions: Array.from({ length: count }, (_, i) => {
        const q = `10000000-0000-4000-8000-${i.toString().padStart(12, "0")}`,
          a = `20000000-0000-4000-8000-${i.toString().padStart(12, "0")}`;
        qMap[q] = q;
        aMap[a] = a;
        return {
          id: q,
          order: i,
          text: "",
          multiple: false,
          image_upload: quizId,
          answers: [
            {
              id: a,
              order: 0,
              text: "",
              is_correct: true,
              image_upload: quizId,
            },
          ],
        };
      }),
    };
    const f = fixture();
    let pendingSize = 0;
    f.post.mockImplementation(async () => {
      pendingSize = storedValueBytes(f.values.get(quizCreateKey("owner")));
      return { ...response, id_map: { questions: qMap, answers: aMap } };
    });
    await f.run({ snapshot: empty, payload: prepareQuizForSubmission(empty) });
    expect(storedValueBytes(f.values.get(quizCreateKey("owner")))).toBeLessThan(
      pendingSize + 512,
    );
  },
);
it("repeating a known unchanged PATCH acknowledgement is stable across restarts", async () => {
  const f = fixture();
  await f.run();
  const draft = adoptCreatedDraft(snapshot, response);
  await acknowledgeQuizCreate(f.store, "owner", requestId, draft, {
    id: quizId,
    version: 2,
  });
  const before = structuredClone(f.values.get(quizCreateKey("owner")));
  await acknowledgeQuizCreate(
    { ...f.store },
    "owner",
    requestId,
    { ...draft, baseVersion: 2 },
    { id: quizId, version: 2 },
  );
  expect(f.values.get(quizCreateKey("owner"))).toEqual(before);
});

it("allows PATCH preflight from a legacy receipt containing extra server envelope fields", async () => {
  const f = fixture();
  f.values.set(quizCreateKey("owner"), {
    schemaVersion: 1,
    owner: "owner",
    requestId,
    state: "created",
    snapshot,
    payload,
    result: {
      ...response,
      extra: "future server field",
      id_map: { ...response.id_map, metadata: { revision: 1 } },
    },
    acknowledged: {
      snapshot: adoptCreatedDraft(snapshot, response),
      quiz: response.quiz,
    },
  });
  const recovered = await loadQuizCreate(f.store, "owner");
  expect(() =>
    assertQuizCreateAckFits(recovered!, {
      ...adoptCreatedDraft(snapshot, response),
      title: "Later",
    }),
  ).not.toThrow();
  expect(recovered!.result).not.toHaveProperty("extra");
  expect(recovered!.result!.id_map).not.toHaveProperty("metadata");
});
it("retains a changed legacy PATCH acknowledgement when loading before schema2 upgrade", async () => {
  const f = fixture();
  const edited = {
    ...adoptCreatedDraft(snapshot, response),
    title: "Prior PATCH",
    baseVersion: 2,
  };
  f.values.set(quizCreateKey("owner"), {
    schemaVersion: 1,
    owner: "owner",
    requestId,
    state: "created",
    snapshot,
    payload,
    result: response,
    acknowledged: {
      snapshot: edited,
      quiz: { ...response.quiz, version: 2, title: edited.title },
    },
  });
  const loaded = await loadQuizCreate(f.store, "owner");
  expect(loaded!.acknowledged!.snapshot).toEqual(edited);
  expect(() => assertQuizCreateAckFits(loaded!, edited)).not.toThrow();
  await acknowledgeQuizCreate(f.store, "owner", requestId, edited, {
    id: quizId,
    version: 2,
  });
  expect(
    (await loadQuizCreate({ ...f.store }, "owner"))!.acknowledged!.snapshot,
  ).toEqual(edited);
});
it("recovers mixed original and newly added question IDs after a changed ACK", async () => {
  const f = fixture();
  await f.run();
  const adopted = adoptCreatedDraft(snapshot, response);
  const edited = {
    ...adopted,
    questions: [
      ...adopted.questions,
      {
        ...snapshot.questions[0],
        id: nextId,
        answers: [{ ...snapshot.questions[0].answers[0], id: requestId }],
      },
    ],
  };
  await acknowledgeQuizCreate(f.store, "owner", requestId, edited, {
    id: quizId,
    version: 2,
  });
  const loaded = await loadQuizCreate({ ...f.store }, "owner");
  const recovered = adoptCreatedDraft(loaded!.snapshot, loaded!.result!);
  expect(recovered.questions.map((q) => q.id)).toEqual([
    serverQuestion,
    nextId,
  ]);
  expect(recovered.questions[1].answers[0].id).toBe(requestId);
  expect(recovered.baseVersion).toBe(2);
});
it("serializes overlapping creates to one POST and one immutable receipt", async () => {
  const f = fixture();
  const [a, b] = await Promise.all([
    f.run(),
    f.run({
      snapshot: { ...snapshot, title: "Later" },
      payload: { ...payload, title: "Later" },
    }),
  ]);
  expect(f.post).toHaveBeenCalledOnce();
  expect(a).toEqual(b);
  expect(f.newId).toHaveBeenCalledOnce();
});
it("serializes acknowledge and clear without resurrecting a cleared receipt", async () => {
  const f = fixture();
  await f.run();
  await Promise.all([
    acknowledgeQuizCreate(
      f.store,
      "owner",
      requestId,
      adoptCreatedDraft(snapshot, response),
      { id: quizId, version: 2 },
    ),
    clearQuizCreate(f.store, "owner", requestId),
  ]);
  expect(await loadQuizCreate(f.store, "owner")).toBeNull();
});
it("retains pending after an ACK write is refused without an error, then replays safely", async () => {
  const f = fixture();
  const write = f.store.write;
  let writes = 0;
  f.store.write = async (key, value) => {
    if (++writes === 2) return;
    await write(key, value);
  };
  await expect(f.run()).rejects.toMatchObject({ reason: "local" });
  expect((await loadQuizCreate(f.store, "owner"))!.state).toBe("pending");
  const restarted = fixture(f.values);
  await restarted.run();
  expect(restarted.newId).not.toHaveBeenCalled();
  expect(restarted.post).toHaveBeenCalledWith({
    request_id: requestId,
    quiz: payload,
  });
});
it("preflights a changed acknowledgement at the exact cap and rejects one extra byte", async () => {
  const f = fixture();
  const created = await f.run();
  const edited = {
    ...adoptCreatedDraft(snapshot, response),
    title: "Changed at cap",
    description: "",
    baseVersion: Number.MAX_SAFE_INTEGER,
  };
  const candidate = {
    schemaVersion: 2,
    owner: "owner",
    requestId,
    state: "created",
    result: created.result,
    mapped: { questions: 1, answers: 1 },
    acknowledged: {
      snapshot: edited,
      quiz: { id: quizId, version: Number.MAX_SAFE_INTEGER },
    },
  };
  edited.description = "x".repeat(
    MAX_CHUNK_VALUE_BYTES - storedValueBytes(candidate),
  );
  expect(storedValueBytes(candidate)).toBe(MAX_CHUNK_VALUE_BYTES);
  expect(() => assertQuizCreateAckFits(created, edited)).not.toThrow();
  expect(() =>
    assertQuizCreateAckFits(created, {
      ...edited,
      description: edited.description + "x",
    }),
  ).toThrowError(expect.objectContaining({ reason: "size" }));
  await acknowledgeQuizCreate(f.store, "owner", requestId, edited, {
    id: quizId,
    version: Number.MAX_SAFE_INTEGER,
  });
  expect(storedValueBytes(f.values.get(quizCreateKey("owner")))).toBe(
    MAX_CHUNK_VALUE_BYTES,
  );
  expect(
    (await loadQuizCreate({ ...f.store }, "owner"))!.acknowledged!.snapshot
      .baseVersion,
  ).toBe(Number.MAX_SAFE_INTEGER);
});
it("persists an exact8MiB UTF8 pending value through real Android chunks and rejects cap+1 safely", async () => {
  const values = new Map<string, string>();
  const raw: AtomicAndroidStorage = {
    getItem: async (key) => values.get(key) ?? null,
    multiGet: async (keys) =>
      keys.map((key) => [key, values.get(key) ?? null] as const),
    multiSet: async (pairs) => {
      for (const [key, value] of pairs) values.set(key, value);
    },
    multiRemove: async (keys) => {
      for (const key of keys) values.delete(key);
    },
    getAllKeys: async () => [...values.keys()],
  };
  const android = createAndroidChunkStorage(raw, async (value) =>
    createHash("sha256").update(value).digest("hex"),
  );
  const store: CreateStorage = {
    readStrict: async <T>(key: string, fallback: T) => {
      const json = await android.getItem(`testownik.v1.${key}`);
      return json === null ? fallback : (JSON.parse(json) as T);
    },
    write: (key, value) =>
      android.setItem(`testownik.v1.${key}`, JSON.stringify(value)),
    remove: (key) => android.removeItem(`testownik.v1.${key}`),
  };
  const large = structuredClone(snapshot),
    frozen = prepareQuizForSubmission(large);
  const pending = {
    schemaVersion: 2,
    owner: "owner",
    requestId,
    state: "pending",
    snapshot: large,
    payload: frozen,
  };
  const extra = MAX_CHUNK_VALUE_BYTES - storedValueBytes(pending);
  large.description = "😀".repeat(Math.floor(extra / 8));
  frozen.description =
    large.description + "x".repeat(extra - (large.description.length / 2) * 8);
  expect(Buffer.byteLength(JSON.stringify(pending), "utf8")).toBe(
    MAX_CHUNK_VALUE_BYTES,
  );
  const post = vi.fn(async () => {
    expect(
      Buffer.byteLength(
        JSON.stringify(await loadQuizCreate({ ...store }, "owner")),
        "utf8",
      ),
    ).toBe(MAX_CHUNK_VALUE_BYTES);
    return response;
  });
  await createQuiz({
    store,
    owner: "owner",
    snapshot: large,
    payload: frozen,
    newId: () => requestId,
    post,
  });
  const ack = await loadQuizCreate({ ...store }, "owner");
  expect(ack!.state).toBe("created");
  expect(ack!.acknowledged!.snapshot.description).toBe(large.description);
  await expect(
    android.setItem(
      `testownik.v1.${quizCreateKey("owner")}`,
      JSON.stringify({
        ...pending,
        payload: { ...frozen, description: frozen.description + "x" },
      }),
    ),
  ).rejects.toThrow();
  expect(await loadQuizCreate({ ...store }, "owner")).toEqual(ack);
});

function coordinatedFixtures() {
  const values = new Map<string, unknown>();
  const first = fixture(values),
    second = fixture(values);
  let queue = Promise.resolve<unknown>(undefined),
    depth = 0;
  const transaction = <T>(
    _owner: string,
    run: () => Promise<T>,
  ): Promise<T> => {
    const result = queue.then(async () => {
      depth++;
      try {
        return await run();
      } finally {
        depth--;
      }
    });
    queue = result.catch(() => undefined);
    return result;
  };
  first.store.withCreateTransaction = second.store.withCreateTransaction =
    transaction;
  return { first, second, values, depth: () => depth };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
describe("durable create across independent storage contexts", () => {
  it("claims one immutable ID while both POSTs can run without holding the shared lock", async () => {
    const { first, second, depth } = coordinatedFixtures();
    const started = deferred<void>(),
      released = deferred<void>();
    first.post.mockImplementation(async () => {
      expect(depth()).toBe(0);
      started.resolve();
      await released.promise;
      throw new ApiError(0, "Lost ACK");
    });
    second.post.mockImplementation(async () => {
      expect(depth()).toBe(0);
      released.resolve();
      return response;
    });
    const a = first.run();
    const failed = expect(a).rejects.toThrow("Lost ACK");
    await started.promise;
    const b = await second.run({
      snapshot: { ...snapshot, title: "Later local edit" },
      newId: () => nextId,
    });
    await failed;
    expect(b.state).toBe("created");
    expect(second.post.mock.calls[0][0]).toEqual(first.post.mock.calls[0][0]);
    expect(second.newId).not.toHaveBeenCalled();
    expect(await loadQuizCreate(second.store, "owner")).toMatchObject({
      requestId,
      state: "created",
      snapshot: { title: "Original" },
    });
  });
  it("does not let a late created response replace a newer known PATCH acknowledgement", async () => {
    const { first, second } = coordinatedFixtures();
    const started = deferred<void>(),
      reply = deferred<CreateResult>();
    first.post.mockImplementation(async () => {
      started.resolve();
      return reply.promise;
    });
    const a = first.run();
    await started.promise;
    await second.run();
    const edited = {
      ...adoptCreatedDraft(snapshot, response),
      title: "Saved newer edit",
    };
    await acknowledgeQuizCreate(second.store, "owner", requestId, edited, {
      id: quizId,
      version: 3,
    });
    reply.resolve(response);
    expect(await a).toMatchObject({
      acknowledged: {
        quiz: { version: 3 },
        snapshot: { title: "Saved newer edit" },
      },
    });
    expect(await loadQuizCreate(first.store, "owner")).toMatchObject({
      acknowledged: { quiz: { version: 3 } },
    });
  });
  it("does not resurrect an operation removed during the network request", async () => {
    const { first, values } = coordinatedFixtures();
    const started = deferred<void>(),
      reply = deferred<CreateResult>();
    first.post.mockImplementation(async () => {
      started.resolve();
      return reply.promise;
    });
    const run = first.run(),
      failed = expect(run).rejects.toMatchObject({ reason: "superseded" });
    await started.promise;
    values.delete(quizCreateKey("owner"));
    reply.resolve(response);
    await failed;
    expect(values.has(quizCreateKey("owner"))).toBe(false);
  });
  it("preserves a new claim when an older response and cleanup arrive after the first receipt was cleared", async () => {
    const { first, second } = coordinatedFixtures();
    const started = deferred<void>(),
      reply = deferred<CreateResult>();
    first.post.mockImplementation(async () => {
      started.resolve();
      return reply.promise;
    });
    const run = first.run(),
      failed = expect(run).rejects.toMatchObject({ reason: "superseded" });
    await started.promise;
    await second.run();
    await clearQuizCreate(second.store, "owner", requestId);
    await expect(
      second.run({
        newId: () => nextId,
        post: async () => {
          throw new Error("New request lost ACK");
        },
      }),
    ).rejects.toThrow();
    reply.resolve(response);
    await failed;
    await clearQuizCreate(first.store, "owner", requestId);
    expect(await loadQuizCreate(second.store, "owner")).toMatchObject({
      requestId: nextId,
      state: "pending",
    });
  });
  it("rejects an older acknowledgement after another context saved a newer version", async () => {
    const { first, second } = coordinatedFixtures();
    await first.run();
    const edited = adoptCreatedDraft(snapshot, response);
    const outcomes = await Promise.allSettled([
      acknowledgeQuizCreate(
        first.store,
        "owner",
        requestId,
        { ...edited, title: "Version three" },
        { id: quizId, version: 3 },
      ),
      acknowledgeQuizCreate(
        second.store,
        "owner",
        requestId,
        { ...edited, title: "Version two" },
        { id: quizId, version: 2 },
      ),
    ]);
    expect(outcomes.map((result) => result.status)).toEqual([
      "fulfilled",
      "rejected",
    ]);
    expect(await loadQuizCreate(first.store, "owner")).toMatchObject({
      acknowledged: {
        quiz: { version: 3 },
        snapshot: { title: "Version three" },
      },
    });
  });
  it("preserves a terminal access-loss receipt over a late creation response", async () => {
    const { first, second } = coordinatedFixtures();
    const started = deferred<void>(),
      reply = deferred<CreateResult>();
    first.post.mockImplementation(async () => {
      started.resolve();
      return reply.promise;
    });
    const run = first.run(),
      failed = expect(run).rejects.toMatchObject({ reason: "access-lost" });
    await started.promise;
    await expect(
      second.run({
        post: async () => {
          throw new ApiError(403, "Gone", {
            request_id: requestId,
            code: "create_access_lost",
          });
        },
      }),
    ).rejects.toMatchObject({ reason: "access-lost" });
    reply.resolve(response);
    await failed;
    expect(await loadQuizCreate(first.store, "owner")).toMatchObject({
      state: "access-lost",
    });
  });
  it("refuses a claim without POST or journal mutation when coordination fails", async () => {
    const f = fixture();
    const failure = new Error("Lock unavailable");
    f.store.withCreateTransaction = async () => {
      throw failure;
    };
    await expect(f.run()).rejects.toBe(failure);
    expect(f.post).not.toHaveBeenCalled();
    expect(f.store.write).not.toHaveBeenCalled();
    expect(await loadQuizCreate(f.store, "owner")).toBeNull();
  });
});

it.each([403, 410])(
  "retains the draft on late HTTP%s proof after another replay settled the initial create",
  async (status) => {
    const { first, second } = coordinatedFixtures();
    const started = deferred<void>(),
      reply = deferred<void>();
    const body =
      status === 403
        ? { request_id: requestId, code: "create_access_lost" }
        : {
            request_id: requestId,
            status: "deleted",
            quiz_id: quizId,
            created_version: 1,
            id_map: response.id_map,
          };
    first.post.mockImplementation(async () => {
      started.resolve();
      await reply.promise;
      throw new ApiError(status, "Unavailable", body);
    });
    const run = first.run(),
      failed = expect(run).rejects.toMatchObject({
        reason: status === 403 ? "access-lost" : "deleted",
      });
    await started.promise;
    await second.run();
    reply.resolve();
    await failed;
    expect(await loadQuizCreate(first.store, "owner")).toMatchObject({
      state: status === 403 ? "access-lost" : "deleted",
      snapshot: { title: snapshot.title },
    });
  },
);

it.each([403, 410])(
  "does not replace a later PATCH acknowledgement with late HTTP%s create proof",
  async (status) => {
    const { first, second } = coordinatedFixtures();
    const started = deferred<void>(),
      reply = deferred<void>();
    const body =
      status === 403
        ? { request_id: requestId, code: "create_access_lost" }
        : {
            request_id: requestId,
            status: "deleted",
            quiz_id: quizId,
            created_version: 1,
            id_map: response.id_map,
          };
    first.post.mockImplementation(async () => {
      started.resolve();
      await reply.promise;
      throw new ApiError(status, "Unavailable", body);
    });
    const run = first.run();
    await started.promise;
    await second.run();
    await acknowledgeQuizCreate(
      second.store,
      "owner",
      requestId,
      { ...adoptCreatedDraft(snapshot, response), title: "Newer PATCH" },
      { id: quizId, version: 3 },
    );
    reply.resolve();
    expect(await run).toMatchObject({
      state: "created",
      acknowledged: { quiz: { version: 3 } },
    });
    expect(await loadQuizCreate(first.store, "owner")).toMatchObject({
      state: "created",
      acknowledged: {
        quiz: { version: 3 },
        snapshot: { title: "Newer PATCH" },
      },
    });
  },
);
