import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  createAndroidChunkStorage,
  storedValueBytes,
  type AtomicAndroidStorage,
} from "../src/lib/android-chunk-storage";
import { ApiError, ApiClient } from "../src/lib/client";
import {
  beginImport,
  clearImport,
  importCreateKey,
  loadImport,
  MAX_IMPORT_RECORD_BYTES,
  preflightImport,
  postImport,
  importPreview,
  resumeImport,
  type ImportPayload,
} from "../src/lib/import-create";
import type { CreateStorage } from "../src/lib/quiz-create";
const owner = "owner";
const requestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const quizId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const q = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const a = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const payload: ImportPayload = {
  title: "Imported",
  description: "",
  visibility: 0,
  questions: [
    {
      id: q,
      text: "Question",
      order: 1,
      multiple: true,
      answers: [{ id: a, text: "Yes", order: 1, is_correct: true }],
    },
  ],
};
const response = {
  request_id: requestId,
  status: "created",
  created_version: 1,
  quiz: { ...payload, id: quizId, version: 1 },
  id_map: { questions: { [q]: q }, answers: { [a]: a } },
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
  const post = vi.fn(async (_body: unknown): Promise<unknown> => response);
  const common = { store, owner, post };
  const begin = (overrides: Partial<Parameters<typeof beginImport>[0]> = {}) =>
    beginImport({ ...common, payload, newId: () => requestId, ...overrides });
  const resume = () => resumeImport(common);
  return { values, store, post, begin, resume };
}
describe("durable import recovery", () => {
  it("persists once before sending and keeps a compact known acknowledgement", async () => {
    const f = fixture();
    f.post.mockImplementation(async () => {
      expect(await loadImport({ ...f.store }, owner)).toMatchObject({
        state: "pending",
        payload,
      });
      return response;
    });
    const result = await f.begin();
    expect(result).toMatchObject({
      state: "created",
      created: { id: quizId, version: 1 },
    });
    expect(result).not.toHaveProperty("payload");
    expect(JSON.stringify(result).length).toBeLessThan(
      JSON.stringify(f.post.mock.calls[0][0]).length + 300,
    );
    await f.resume();
    expect(f.post).toHaveBeenCalledTimes(1);
  });
  it("replays immutable IDs and upload references after a lost response and controller restart", async () => {
    const f = fixture();
    const image = {
      ...structuredClone(payload),
      questions: [{ ...payload.questions[0], image_upload: quizId }],
    };
    f.post.mockRejectedValueOnce(new ApiError(0, "Network"));
    await expect(f.begin({ payload: image })).rejects.toThrow();
    image.questions[0].text = "Changed source";
    const result = await resumeImport({
      store: { ...f.store },
      owner,
      post: f.post,
    });
    expect(result.state).toBe("created");
    expect(f.post.mock.calls[1][0]).toEqual(f.post.mock.calls[0][0]);
    expect(f.post.mock.calls[1][0]).toMatchObject({
      quiz: { questions: [{ text: "Question", image_upload: quizId }] },
    });
  });
  it("refuses replacement of pending or acknowledged imports, including concurrent begin", async () => {
    const f = fixture();
    const results = await Promise.allSettled([f.begin(), f.begin()]);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
    expect(f.post).toHaveBeenCalledTimes(1);
    await expect(f.begin()).rejects.toMatchObject({ reason: "occupied" });
    const g = fixture();
    g.post.mockRejectedValue(new Error("offline"));
    await expect(g.begin()).rejects.toThrow();
    await expect(g.begin()).rejects.toMatchObject({ reason: "occupied" });
    await expect(clearImport(g.store, owner, requestId)).rejects.toMatchObject({
      reason: "occupied",
    });
  });
  it("cannot send before verified journal storage or after the session ends", async () => {
    for (const throws of [true, false]) {
      const f = fixture();
      f.store.write = async () => {
        if (throws) throw new Error("full");
      };
      await expect(f.begin()).rejects.toThrow();
      expect(f.post).not.toHaveBeenCalled();
    }
    const f = fixture();
    await expect(f.begin({ isCurrent: () => false })).rejects.toThrow();
    expect(f.post).not.toHaveBeenCalled();
    expect(f.values.size).toBe(0);
  });
  it("retains pending state if acknowledgement storage fails, then replays instead of creating again", async () => {
    const f = fixture();
    const original = f.store.write;
    f.store.write = async (key, value) => {
      if ((value as { state: string }).state === "created")
        throw new Error("full");
      await original(key, value);
    };
    await expect(f.begin()).rejects.toMatchObject({ reason: "local" });
    expect(await loadImport(f.store, owner)).toMatchObject({
      state: "pending",
    });
    f.store.write = original;
    await f.resume();
    expect(f.post.mock.calls[1][0]).toEqual(f.post.mock.calls[0][0]);
  });
  it.each(["rejected", "deleted", "access-lost"] as const)(
    "persists only matching %s outcomes and allows explicit clearing",
    async (state) => {
      const f = fixture();
      const status =
        state === "rejected" ? 400 : state === "deleted" ? 410 : 403;
      const body =
        state === "rejected"
          ? { status: "rejected", code: "validation_failed" }
          : state === "deleted"
            ? {
                status: "deleted",
                quiz_id: quizId,
                created_version: 1,
                id_map: response.id_map,
              }
            : { code: "create_access_lost" };
      f.post.mockRejectedValue(
        new ApiError(status, "failure", { request_id: requestId, ...body }),
      );
      const result = await f.begin();
      expect(result).toMatchObject({ state });
      expect(result).not.toHaveProperty("payload");
      await f.resume();
      expect(f.post).toHaveBeenCalledTimes(1);
      await expect(clearImport(f.store, owner, quizId)).rejects.toThrow();
      await clearImport(f.store, owner, requestId);
      expect(await loadImport(f.store, owner)).toBeNull();
    },
  );
  it("retains the pending import for unmatched receipts, denied scopes, and changing server snapshots", async () => {
    for (const body of [
      { request_id: quizId, status: "rejected", code: "validation_failed" },
      { code: "permanent_account_required" },
      { request_id: requestId, code: "quiz_changed" },
    ]) {
      const f = fixture();
      f.post.mockRejectedValue(new ApiError(409, "failure", body));
      await expect(f.begin()).rejects.toThrow();
      expect(await loadImport(f.store, owner)).toMatchObject({
        state: "pending",
      });
    }
  });
  it("refuses damaged or different-owner records and never replaces them", async () => {
    const f = fixture();
    f.values.set(importCreateKey(owner), { owner: "other", state: "pending" });
    await expect(loadImport(f.store, owner)).rejects.toMatchObject({
      reason: "local",
    });
    await expect(f.begin()).rejects.toThrow();
    expect(f.post).not.toHaveBeenCalled();
    expect(f.values.get(importCreateKey(owner))).toEqual({
      owner: "other",
      state: "pending",
    });
  });
  it("verifies clear and preserves the separate editor journal", async () => {
    const f = fixture();
    const editor = { state: "pending", requestId: quizId };
    f.values.set(`quiz-create.${owner}.new`, editor);
    await f.begin();
    const remove = f.store.remove;
    f.store.remove = async () => undefined;
    await expect(clearImport(f.store, owner, requestId)).rejects.toThrow();
    expect(await loadImport(f.store, owner)).toMatchObject({
      state: "created",
    });
    f.store.remove = remove;
    await clearImport(f.store, owner, requestId);
    expect(f.values.get(`quiz-create.${owner}.new`)).toEqual(editor);
  });
  it("rejects oversized text before upload but excludes source image bytes in preflight", async () => {
    const huge = {
      ...structuredClone(payload),
      description: "x".repeat(MAX_IMPORT_RECORD_BYTES),
    };
    expect(() => preflightImport(huge)).toThrow();
    const f = fixture();
    await expect(f.begin({ payload: huge })).rejects.toMatchObject({
      reason: "size",
    });
    expect(f.post).not.toHaveBeenCalled();
    huge.description = "";
    huge.questions[0].image_url = `data:image/png;base64,${"x".repeat(MAX_IMPORT_RECORD_BYTES)}`;
    expect(() => preflightImport(huge)).not.toThrow();
  });
  it("acknowledges a near-cap import without duplicating its large payload", async () => {
    const f = fixture();
    const big = {
      ...structuredClone(payload),
      description: "ą".repeat(
        Math.floor((MAX_IMPORT_RECORD_BYTES - 10000) / 2),
      ),
    };
    await f.begin({ payload: big });
    const saved = await loadImport(f.store, owner);
    expect(saved?.state).toBe("created");
    expect(JSON.stringify(saved).length).toBeLessThan(1500);
  });
  it("acknowledges matching creation without requiring editor ID maps", async () => {
    const f = fixture();
    f.post.mockResolvedValue({
      ...response,
      id_map: { questions: {}, answers: {} },
    });
    expect((await f.begin()).state).toBe("created");
  });
});

describe("import receipt liveness boundaries", () => {
  it("accepts a replay whose quiz was renamed to 150 astral characters", async () => {
    const f = fixture();
    f.post.mockRejectedValueOnce(new ApiError(0, "lost"));
    await expect(f.begin()).rejects.toThrow();
    f.post.mockResolvedValue({
      ...response,
      quiz: { ...response.quiz, title: "😀".repeat(150) },
    });
    expect((await f.resume()).state).toBe("created");
    expect(await loadImport(f.store, owner)).not.toHaveProperty(
      "created.title",
    );
  });
  it("keeps wrong request IDs pending, and avoids sending after a session change", async () => {
    const f = fixture();
    f.post.mockResolvedValue({ ...response, request_id: quizId });
    await expect(f.begin()).rejects.toMatchObject({ reason: "response" });
    const previous = await loadImport(f.store, owner);
    await expect(
      resumeImport({
        store: f.store,
        owner,
        post: f.post,
        isCurrent: () => false,
      }),
    ).rejects.toThrow();
    expect(f.post).toHaveBeenCalledTimes(1);
    expect(await loadImport(f.store, owner)).toEqual(previous);
  });
  it.each([
    [403, { code: "permanent_account_required" }],
    [409, { request_id: requestId, code: "request_id_reused" }],
    [413, "Request Entity Too Large"],
  ])(
    "retains immutable pending import on HTTP%s without a matching terminal receipt",
    async (status, body) => {
      const f = fixture();
      f.post.mockRejectedValue(new ApiError(status as number, "failure", body));
      await expect(f.begin()).rejects.toThrow();
      expect(await loadImport(f.store, owner)).toMatchObject({
        state: "pending",
        payload,
      });
    },
  );
  it("allows a large JSON request and response to take longer than the default30seconds", async () => {
    vi.useFakeTimers();
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockImplementation((ms) => {
        const controller = new AbortController();
        setTimeout(
          () => controller.abort(new DOMException("deadline", "TimeoutError")),
          ms,
        );
        return controller.signal;
      });
    try {
      const session = new AbortController();
      const client = new ApiClient(
        "https://fixture.invalid/api",
        {
          session: () => session.signal,
          get: async () => ({ access: "fixture", refresh: "fixture" }),
          set: async () => undefined,
        },
        async (_url, options) => {
          await new Promise((resolve) => setTimeout(resolve, 31000));
          options?.signal?.throwIfAborted();
          return new Response(JSON.stringify(response), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          });
        },
      );
      const result = postImport(client, {
        request_id: requestId,
        quiz: payload,
      });
      await vi.advanceTimersByTimeAsync(31000);
      await expect(result).resolves.toMatchObject({ request_id: requestId });
      expect(timeout).toHaveBeenCalledWith(120000);
    } finally {
      timeout.mockRestore();
      vi.useRealTimers();
    }
  });
  it.each(["ą", "€", "😀"])(
    "preflight and storage agree at the exact UTF8boundary with %s",
    async (char) => {
      const owner = requestId;
      const frozen = structuredClone(payload);
      const base = {
        schemaVersion: 1,
        scope: "import",
        owner,
        requestId,
        state: "pending",
        preview: importPreview(frozen),
        payload: frozen,
      };
      const overhead = storedValueBytes(base);
      const prefix = char.repeat(100);
      frozen.description =
        prefix +
        "x".repeat(
          MAX_IMPORT_RECORD_BYTES - overhead - Buffer.byteLength(prefix),
        );
      expect(storedValueBytes(base)).toBe(MAX_IMPORT_RECORD_BYTES);
      expect(() => preflightImport(frozen)).not.toThrow();
      const f = fixture();
      expect((await f.begin({ owner, payload: frozen })).state).toBe("created");
      const g = fixture();
      frozen.description += "x";
      expect(storedValueBytes(base)).toBe(MAX_IMPORT_RECORD_BYTES + 1);
      expect(() => preflightImport(frozen)).toThrow();
      await expect(g.begin({ owner, payload: frozen })).rejects.toMatchObject({
        reason: "size",
      });
      expect(g.post).not.toHaveBeenCalled();
    },
  );
  it("commits an exact-cap pending journal and its compact acknowledgement through Android chunks", async () => {
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
        const raw = await android.getItem(`testownik.v1.${key}`);
        return raw === null ? fallback : (JSON.parse(raw) as T);
      },
      write: (key, value) =>
        android.setItem(`testownik.v1.${key}`, JSON.stringify(value)),
      remove: (key) => android.removeItem(`testownik.v1.${key}`),
    };
    const frozen = structuredClone(payload);
    const base = {
      schemaVersion: 1,
      scope: "import",
      owner: requestId,
      requestId,
      state: "pending",
      preview: importPreview(frozen),
      payload: frozen,
    };
    frozen.description = "x".repeat(
      MAX_IMPORT_RECORD_BYTES - storedValueBytes(base),
    );
    const post = vi.fn(async () => {
      expect(storedValueBytes(await loadImport({ ...store }, requestId))).toBe(
        MAX_IMPORT_RECORD_BYTES,
      );
      return response;
    });
    expect(
      (
        await beginImport({
          store,
          owner: requestId,
          payload: frozen,
          newId: () => requestId,
          post,
        })
      ).state,
    ).toBe("created");
    expect(await loadImport(store, requestId)).toMatchObject({
      state: "created",
      created: { id: quizId },
    });
  });
});

function coordinatedImports() {
  const values = new Map<string, unknown>(),
    first = fixture(values),
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
describe("import journal across independent contexts", () => {
  it("keeps a second chosen import occupied while the first network request is still pending", async () => {
    const { first, second, depth } = coordinatedImports();
    const started = deferred<void>(),
      reply = deferred<void>();
    first.post.mockImplementation(async () => {
      expect(depth()).toBe(0);
      started.resolve();
      await reply.promise;
      throw new Error("Lost ACK");
    });
    const run = first.begin(),
      failed = expect(run).rejects.toThrow("Lost ACK");
    await started.promise;
    await expect(
      second.begin({
        newId: () => quizId,
        payload: { ...payload, title: "Different import" },
      }),
    ).rejects.toMatchObject({ reason: "occupied" });
    expect(second.post).not.toHaveBeenCalled();
    reply.resolve();
    await failed;
    expect(await loadImport(second.store, owner)).toMatchObject({
      requestId,
      state: "pending",
      payload: { title: "Imported" },
    });
  });
  it("replays one ID concurrently without a network lock and retains the newer settled metadata", async () => {
    const { first, second, depth } = coordinatedImports();
    const started = deferred<void>(),
      reply = deferred<unknown>();
    first.post.mockImplementation(async () => {
      expect(depth()).toBe(0);
      started.resolve();
      return reply.promise;
    });
    const run = first.begin();
    await started.promise;
    second.post.mockImplementation(async () => {
      expect(depth()).toBe(0);
      return { ...response, quiz: { ...response.quiz, version: 3 } };
    });
    expect(await second.resume()).toMatchObject({
      state: "created",
      created: { version: 3 },
    });
    reply.resolve(response);
    expect(await run).toMatchObject({ created: { version: 3 } });
    expect(second.post.mock.calls[0][0]).toEqual(first.post.mock.calls[0][0]);
  });
  it("does not resurrect a journal removed while import POST was in flight", async () => {
    const { first, values } = coordinatedImports();
    const started = deferred<void>(),
      reply = deferred<unknown>();
    first.post.mockImplementation(async () => {
      started.resolve();
      return reply.promise;
    });
    const run = first.begin(),
      failed = expect(run).rejects.toMatchObject({ reason: "local" });
    await started.promise;
    values.delete(importCreateKey(owner));
    reply.resolve(response);
    await failed;
    expect(values.has(importCreateKey(owner))).toBe(false);
  });
  it("does not overwrite a different pending import after an older receipt was cleared", async () => {
    const { first, second } = coordinatedImports();
    const started = deferred<void>(),
      reply = deferred<unknown>();
    first.post.mockImplementation(async () => {
      started.resolve();
      return reply.promise;
    });
    const run = first.begin(),
      failed = expect(run).rejects.toMatchObject({ reason: "local" });
    await started.promise;
    await second.resume();
    await clearImport(second.store, owner, requestId);
    second.post.mockRejectedValue(new Error("New ACK lost"));
    await expect(
      second.begin({
        newId: () => quizId,
        payload: { ...payload, title: "New import" },
      }),
    ).rejects.toThrow();
    reply.resolve(response);
    await failed;
    await expect(
      clearImport(first.store, owner, requestId),
    ).rejects.toMatchObject({ reason: "occupied" });
    expect(await loadImport(second.store, owner)).toMatchObject({
      requestId: quizId,
      state: "pending",
      payload: { title: "New import" },
    });
  });
  it("preserves a terminal receipt when an old created response finally arrives", async () => {
    const { first, second } = coordinatedImports();
    const started = deferred<void>(),
      reply = deferred<unknown>();
    first.post.mockImplementation(async () => {
      started.resolve();
      return reply.promise;
    });
    const run = first.begin();
    await started.promise;
    second.post.mockRejectedValue(
      new ApiError(403, "Access lost", {
        request_id: requestId,
        code: "create_access_lost",
      }),
    );
    expect(await second.resume()).toMatchObject({ state: "access-lost" });
    reply.resolve(response);
    expect(await run).toMatchObject({ state: "access-lost" });
    expect(await loadImport(first.store, owner)).toMatchObject({
      state: "access-lost",
    });
  });
  it("does not POST or mutate a new import when its claim lock fails", async () => {
    const f = fixture(),
      failure = new Error("Coordination failed");
    f.store.withCreateTransaction = async () => {
      throw failure;
    };
    await expect(f.begin()).rejects.toBe(failure);
    expect(f.post).not.toHaveBeenCalled();
    expect(f.store.write).not.toHaveBeenCalled();
    expect(await loadImport(f.store, owner)).toBeNull();
  });
});

it.each([403, 410])(
  "import preserves late HTTP%s proof over an initial created receipt",
  async (status) => {
    const { first, second } = coordinatedImports();
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
    const run = first.begin();
    await started.promise;
    await second.resume();
    reply.resolve();
    expect(await run).toMatchObject({
      state: status === 403 ? "access-lost" : "deleted",
    });
    expect(await loadImport(first.store, owner)).toMatchObject({
      state: status === 403 ? "access-lost" : "deleted",
    });
  },
);
