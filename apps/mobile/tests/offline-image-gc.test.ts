import type { QuizWithUserProgress } from "@testownik/core/quiz/types";
import { beforeEach, expect, it, vi } from "vitest";
import { imageCacheName } from "../src/lib/image-cache-key";
import * as images from "../src/lib/offline-images";

const data = vi.hoisted(() => ({
  files: new Set<string>(),
  values: new Map<string, string>(),
  reads: 0,
  keyReads: 0,
  advertised: [] as string[],
  holdRead: null as Promise<void> | null,
  failDelete: null as string | null,
  ignoreDelete: null as string | null,
  downloadGate: null as Promise<void> | null,
  signals: [] as AbortSignal[],
  downloaded: [] as string[],
  ignoreAbort: false,
  directoryUnreadable: false,
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("../src/lib/api", () => ({ API_URL: "https://fixture.invalid/api" }));
vi.mock("../src/lib/storage", () => ({
  storage: {
    keys: async () => {
      data.keyReads++;
      return [...data.values.keys(), ...data.advertised];
    },
    readStrict: async <T>(key: string, fallback: T): Promise<T> => {
      data.reads++;
      const value = data.values.has(key)
        ? JSON.parse(data.values.get(key)!)
        : fallback;
      if (data.holdRead) await data.holdRead;
      return value;
    },
  },
}));
vi.mock("expo-file-system", () => {
  class File {
    uri: string;
    constructor(parent: string | { uri: string }, name?: string) {
      this.uri = typeof parent === "string" ? parent : `${parent.uri}/${name}`;
    }
    get exists() {
      return data.files.has(this.uri);
    }
    delete() {
      if (data.failDelete === this.uri)
        throw new Error("Cannot delete fixture");
      if (data.ignoreDelete !== this.uri) data.files.delete(this.uri);
    }
    moveSync(destination: { uri: string }) {
      data.files.delete(this.uri);
      data.files.add(destination.uri);
      this.uri = destination.uri;
    }
    static async downloadFileAsync(
      url: string,
      file: { uri: string },
      options: { signal: AbortSignal },
    ) {
      data.downloaded.push(url);
      data.signals.push(options.signal);
      data.files.add(file.uri);
      if (data.downloadGate)
        await new Promise<void>((resolve, reject) => {
          if (options.signal.aborted && !data.ignoreAbort) {
            reject(new Error("Aborted"));
            return;
          }
          const abort = () => {
            if (!data.ignoreAbort) reject(new Error("Aborted"));
          };
          options.signal.addEventListener("abort", abort, { once: true });
          data
            .downloadGate!.then(resolve, reject)
            .finally(() => options.signal.removeEventListener("abort", abort));
        });
    }
  }
  class Directory {
    uri: string;
    constructor(...paths: string[]) {
      this.uri = paths.join("/");
    }
    get exists() {
      return !data.directoryUnreadable;
    }
    create() {
      if (data.directoryUnreadable)
        throw new Error("Image directory inaccessible");
    }
    list() {
      if (data.directoryUnreadable)
        throw new Error("Image directory inaccessible");
      return [...data.files]
        .filter(
          (uri) =>
            uri.startsWith(`${this.uri}/`) &&
            !uri.slice(this.uri.length + 1).includes("/"),
        )
        .map((uri) => new File(uri));
    }
  }
  return { File, Directory, Paths: { document: "file:///documents" } };
});
const root = "file:///documents/offline-images/";
const first = "https://fixture.invalid/media/8938b037.png";
const second = "https://fixture.invalid/media/09c84b1e.png";
const third = "https://fixture.invalid/media/retained.png";
const strong = (url: string) => root + imageCacheName(url);
const legacy = root + "f000b6a3-42.png";
const quiz = (id: string, url: string): QuizWithUserProgress => ({
  id,
  title: id,
  version: 1,
  description: "",
  visibility: 0,
  allow_anonymous: false,
  is_anonymous: false,
  questions: [
    {
      id: `${id}-question`,
      text: "Question",
      order: 1,
      multiple: false,
      image: url,
      answers: [],
    },
  ],
});
function saved(owner: string, q: QuizWithUserProgress) {
  const raw = JSON.stringify({
    quizzes: { [q.id]: q },
    queue: [
      {
        request_id: "must-keep-exactly",
        quiz_id: q.id,
        session_id: "session",
        version: 1,
        question_id: q.questions[0].id,
        selected_answers: [],
        elapsed_seconds: 1,
        next_question: null,
        local: {
          id: "must-keep-exactly",
          question: q.questions[0].id,
          answered_at: "2026-10-12T00:00:00Z",
          selected_answers: [],
          was_correct: false,
        },
      },
    ],
    errors: { [q.id]: "keep-conflict" },
  });
  data.values.set(`offline.${owner}`, raw);
  return raw;
}
async function collect() {
  const collector = (
    images as unknown as { collectOfflineImages?: () => Promise<void> }
  ).collectOfflineImages;
  expect(
    collector,
    "Crash recovery requires a persisted-reference collector",
  ).toBeTypeOf("function");
  await collector!();
}
beforeEach(() => {
  data.files.clear();
  data.values.clear();
  data.reads = 0;
  data.keyReads = 0;
  data.advertised = [];
  data.holdRead = null;
  data.failDelete = null;
  data.ignoreDelete = null;
  data.downloadGate = null;
  data.signals = [];
  data.downloaded = [];
  data.ignoreAbort = false;
  data.directoryUnreadable = false;
});

it("reclaims owned orphan files after a crash between account purge and per-quiz cleanup", async () => {
  saved("deleted-owner", quiz("removed", first));
  const retained = saved("other-owner", quiz("retained", second));
  for (const uri of [
    strong(first),
    strong(second),
    legacy,
    root + "unknown.png",
    "file:///documents/" + imageCacheName(first),
    root + "nested/" + imageCacheName(first),
  ])
    data.files.add(uri);
  // Simulate the durable storage purge succeeding before a process stops.
  data.values.delete("offline.deleted-owner");
  expect(images.offlineImage(first)).not.toBeNull();
  await collect();
  expect(data.files.has(strong(first))).toBe(false);
  expect(data.files.has(strong(second))).toBe(true);
  expect(data.files.has(legacy)).toBe(true);
  expect(data.files.has(root + "unknown.png")).toBe(true);
  expect(data.files.has("file:///documents/" + imageCacheName(first))).toBe(
    true,
  );
  expect(data.files.has(root + "nested/" + imageCacheName(first))).toBe(true);
  expect(data.values.get("offline.other-owner")).toBe(retained);
});

it("reclaims replaced URLs while preserving current quiz media and exact saved-answer bytes", async () => {
  saved("owner", quiz("updated", first));
  data.files.add(strong(first));
  data.files.add(strong(third));
  data.files.add(legacy);
  const raw = saved("owner", quiz("updated", third));
  await collect();
  expect(data.files.has(strong(first))).toBe(false);
  expect(data.files.has(legacy)).toBe(false);
  expect(data.files.has(strong(third))).toBe(true);
  expect(data.values.get("offline.owner")).toBe(raw);
});

it.each([
  '{"quizzes":',
  "null",
  '{"quizzes":null}',
  '{"quizzes":{"broken":null}}',
])("retains every file when an owner record is unreadable: %s", async (raw) => {
  data.values.set("offline.broken", raw);
  data.files.add(strong(first));
  data.files.add(legacy);
  await expect(collect()).rejects.toBeDefined();
  expect(data.files.size).toBe(2);
  expect(data.values.get("offline.broken")).toBe(raw);
});

it("fails closed for an advertised owner key with a missing logical header", async () => {
  data.advertised.push("offline.headerless");
  data.files.add(strong(first));
  await expect(collect()).rejects.toBeDefined();
  expect(data.files.has(strong(first))).toBe(true);
});

it("keeps saved media after host policy changes and handles original extension case", async () => {
  const external = "https://previous-host.invalid/saved.PNG";
  saved("retained", quiz("old-host", external));
  data.files.add(strong(external));
  const orphan = strong("https://fixture.invalid/orphan.JpG");
  data.files.add(orphan);
  await collect();
  expect(data.files.has(strong(external))).toBe(true);
  expect(data.files.has(orphan)).toBe(false);
});

it("reclaims stale partials but preserves a retained download's live partial", async () => {
  const q = quiz("live", first);
  saved("owner", q);
  const stale = strong(first) + ".999.partial";
  data.files.add(stale);
  let release!: () => void;
  data.downloadGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const saving = images.saveQuizImages(q);
  await vi.waitFor(() => expect(data.downloaded).toEqual([first]));
  const live = [...data.files].find(
    (uri) => uri.endsWith(".partial") && uri !== stale,
  )!;
  await collect();
  expect(data.files.has(stale)).toBe(false);
  expect(data.files.has(live)).toBe(true);
  expect(data.signals[0].aborted).toBe(false);
  release();
  await saving;
  expect(data.files.has(strong(first))).toBe(true);
});

it("aborts and joins an unreferenced transfer before acknowledging cleanup", async () => {
  const q = quiz("removed-live", first);
  saved("owner", q);
  data.downloadGate = new Promise<void>(() => {});
  const saving = images.saveQuizImages(q);
  await vi.waitFor(() => expect(data.downloaded).toEqual([first]));
  data.values.delete("offline.owner");
  await collect();
  await saving;
  expect(data.signals[0].aborted).toBe(true);
  expect(data.files.size).toBe(0);
});

it("revokes later batch images while another owner keeps the held first URL", async () => {
  const q = quiz("two-images", first);
  q.questions[0].text = `![Later](${third})`;
  saved("removed", q);
  saved("retained", quiz("other-owner", first));
  let release!: () => void;
  data.downloadGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const saving = images.saveQuizImages(q);
  await vi.waitFor(() => expect(data.downloaded).toEqual([first]));
  data.values.delete("offline.removed");
  await collect();
  expect(data.signals[0].aborted).toBe(false);
  release();
  await saving;
  expect(data.downloaded).toEqual([first]);
  expect(data.files.has(strong(first))).toBe(true);
  expect(data.files.has(strong(third))).toBe(false);
});

it("drains many orphans in at most64 deletions per fresh-reference pulse", async () => {
  for (let i = 0; i < 130; i++)
    data.files.add(strong(`https://fixture.invalid/orphan-${i}.png`));
  await collect();
  expect(data.files.size).toBe(0);
  expect(data.keyReads).toBe(3);
});

it("fails without an endless retry when a known orphan cannot be deleted", async () => {
  const uri = strong(first);
  data.files.add(uri);
  data.failDelete = uri;
  await expect(collect()).rejects.toThrow("Cannot delete");
  expect(data.files.has(uri)).toBe(true);
  expect(data.keyReads).toBe(1);
  data.failDelete = null;
  await collect();
  expect(data.files.size).toBe(0);
});

it("a request joining a held older snapshot forces a fresh pulse before resolving", async () => {
  saved("removed", quiz("snapshot", first));
  data.files.add(strong(first));
  let release!: () => void;
  data.holdRead = new Promise<void>((resolve) => {
    release = resolve;
  });
  const earlier = collect();
  await vi.waitFor(() => expect(data.reads).toBe(1));
  data.values.delete("offline.removed");
  const afterPurge = collect();
  data.holdRead = null;
  release();
  await Promise.all([earlier, afterPurge]);
  expect(data.files.size).toBe(0);
  expect(data.keyReads).toBeGreaterThanOrEqual(2);
});

it("rejects an unresponsive cancelled transfer after30s and never falsely acknowledges cleanup", async () => {
  const q = quiz("stalled-native", first);
  saved("owner", q);
  let release!: () => void;
  data.downloadGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  data.ignoreAbort = true;
  const saving = images.saveQuizImages(q);
  await vi.waitFor(() => expect(data.downloaded).toEqual([first]));
  data.values.delete("offline.owner");
  vi.useFakeTimers();
  try {
    const result = collect();
    const rejected = expect(result).rejects.toMatchObject({
      code: "operation",
    });
    await vi.advanceTimersByTimeAsync(30001);
    await rejected;
    expect(data.signals[0].aborted).toBe(true);
    expect([...data.files].some((uri) => uri.endsWith(".partial"))).toBe(true);
    release();
    await saving;
    expect(data.files.size).toBe(0);
    await collect();
  } finally {
    vi.useRealTimers();
  }
});

it("reclaims later orphans when one file fails, and reports the unresolved cleanup", async () => {
  const retained = saved("retained", quiz("keep", third));
  data.files.add(strong(first));
  data.files.add(strong(second));
  data.files.add(strong(third));
  data.failDelete = strong(first);
  await expect(collect()).rejects.toThrow("Cannot delete");
  expect(data.files.has(strong(first))).toBe(true);
  expect(data.files.has(strong(second))).toBe(false);
  expect(data.files.has(strong(third))).toBe(true);
  expect(data.values.get("offline.retained")).toBe(retained);
  data.failDelete = null;
  await collect();
});

it("rejects a silent native delete no-op instead of acknowledging cleanup", async () => {
  const uri = strong(first);
  data.files.add(uri);
  data.ignoreDelete = uri;
  await expect(collect()).rejects.toBeDefined();
  expect(data.files.has(uri)).toBe(true);
  data.ignoreDelete = null;
  await collect();
  expect(data.files.has(uri)).toBe(false);
});

it("rejects inaccessible image directory rather than falsely acknowledging no media", async () => {
  const retained = saved("retained", quiz("keep", third));
  data.files.add(strong(first));
  data.files.add(strong(third));
  data.directoryUnreadable = true;
  await expect(collect()).rejects.toThrow("Image directory inaccessible");
  expect(data.files.has(strong(first))).toBe(true);
  expect(data.files.has(strong(third))).toBe(true);
  expect(data.values.get("offline.retained")).toBe(retained);
  data.directoryUnreadable = false;
  await collect();
  expect(data.files.has(strong(first))).toBe(false);
  expect(data.files.has(strong(third))).toBe(true);
});
