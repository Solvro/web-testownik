import type { QuizWithUserProgress } from "@testownik/core/quiz/types";
import { beforeEach, expect, it, vi } from "vitest";
import type { ApiClient } from "../src/lib/client";
import { File } from "expo-file-system";

import { OfflineLibrary } from "../src/lib/offline";
import {
  offlineImage,
  offlineImageData,
  removeQuizImages,
  saveQuizImages as downloadQuizImages,
} from "../src/lib/offline-images";
import { richHtml } from "../src/lib/rich-html";
import { storage } from "../src/lib/storage";

const state = vi.hoisted(() => ({
  files: new Set<string>(),
  values: new Map<string, string>(),
  directoryExists: true,
  directoryFailure: false,
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("../src/lib/api", () => ({ API_URL: "https://fixture.invalid/api" }));
vi.mock("../src/lib/storage", () => ({
  storage: {
    keys: async () => [...state.values.keys()],
    read: async <T>(key: string, fallback: T): Promise<T> =>
      state.values.has(key) ? JSON.parse(state.values.get(key)!) : fallback,
    readStrict: async <T>(key: string, fallback: T): Promise<T> =>
      state.values.has(key) ? JSON.parse(state.values.get(key)!) : fallback,
    write: async (key: string, value: unknown) => {
      state.values.set(key, JSON.stringify(value));
    },
  },
}));
vi.mock("expo-file-system", () => ({
  Paths: { document: "file:///documents" },
  Directory: class {
    uri: string;
    get exists() {
      return state.directoryExists;
    }
    constructor(...paths: string[]) {
      this.uri = paths.join("/");
    }
    create() {
      if (state.directoryFailure) throw new Error("Disk full");
      state.directoryExists = true;
    }
  },
  File: class {
    uri: string;
    get type() {
      return this.uri.endsWith(".png") ? "image/png" : "";
    }
    constructor(dir: { uri: string } | string, name?: string) {
      this.uri = typeof dir === "string" ? dir : `${dir.uri}/${name}`;
    }
    get exists() {
      return state.files.has(this.uri);
    }
    delete() {
      state.files.delete(this.uri);
    }
    moveSync(destination: { uri: string }) {
      state.files.delete(this.uri);
      state.files.add(destination.uri);
      this.uri = destination.uri;
    }
    base64Sync() {
      return "AA==";
    }
    static async downloadFileAsync(_url: string, file: { uri: string }) {
      state.files.add(file.uri);
    }
  },
}));

const url = "https://fixture.invalid/media/shared.png";
const quiz = (id: string, image = url): QuizWithUserProgress => ({
  id,
  title: id,
  description: "",
  visibility: 0,
  allow_anonymous: false,
  is_anonymous: false,
  version: 1,
  questions: [
    {
      id: `${id}-question`,
      order: 1,
      multiple: false,
      text: "Question",
      image,
      answers: [],
    },
  ],
});
const library = (account = "A") =>
  new OfflineLibrary(account, storage, {} as ApiClient);
// Production calls download only quizzes already present in OfflineLibrary.
async function saveQuizImages(q: QuizWithUserProgress) {
  await library().cache(q);
  await downloadQuizImages(q);
}
beforeEach(() => {
  state.files.clear();
  state.values.clear();
  state.directoryExists = true;
  state.directoryFailure = false;
  vi.restoreAllMocks();
});

it("keeps shared images until the last downloaded quiz is removed", async () => {
  const saved = library();
  const first = quiz("one"),
    second = quiz("two");
  await saved.cache(first);
  await saved.cache(second);
  await saveQuizImages(first);
  await saveQuizImages(second);
  await saved.discard(first.id);
  await removeQuizImages(first);
  expect(offlineImage(url)).not.toBeNull();
  await saved.discard(second.id);
  await removeQuizImages(second);
  expect(offlineImage(url)).toBeNull();
});

it("finds references from another account after restarting the cache module", async () => {
  const first = quiz("one"),
    second = quiz("two");
  await library("A").cache(first);
  await library("B").cache(second);
  await saveQuizImages(first);
  await library("A").discard(first.id);
  vi.resetModules();
  const restarted = await import("../src/lib/offline-images");
  await restarted.removeQuizImages(first);
  expect(restarted.offlineImage(url)).not.toBeNull();
});

it("downloads trusted Markdown images in questions, answers and explanations and renders cached bytes", async () => {
  const q = {
    ...quiz("markdown"),
    questions: [
      {
        ...quiz("markdown").questions[0],
        text: `![Circuit diagram](${url}) ![Tracking](https://unapproved.test/a.png)`,
        image: null,
        explanation: "![Explanation](https://fixture.invalid/explanation.png)",
        answers: [
          {
            id: "markdown-answer",
            order: 1,
            is_correct: true,
            text: "![Answer](https://fixture.invalid/answer.png)",
          },
        ],
      },
    ],
  } satisfies QuizWithUserProgress;
  await library().cache(q);
  await saveQuizImages(q);
  expect(state.files.size).toBe(3);
  expect(offlineImage("https://unapproved.test/a.png")).toBeNull();
  const html = richHtml(
    q.questions[0].text,
    "#fff",
    true,
    1,
    17,
    "Hidden",
    offlineImageData,
  );
  expect(html).toContain(
    'alt="Circuit diagram" src="data:image/png;base64,AA=="',
  );
  expect(html).not.toContain(`src="${url}"`);
});

it("a Markdown reference protects an image also used in a dedicated field", async () => {
  const first = quiz("one");
  const second = {
    ...quiz("two"),
    questions: [
      {
        ...quiz("two").questions[0],
        image: null,
        text: `![Diagram](${url})`,
        answers: [],
      },
    ],
  } satisfies QuizWithUserProgress;
  await library().cache(first);
  await library().cache(second);
  await saveQuizImages(first);
  await library().discard(first.id);
  await removeQuizImages(first);
  expect(offlineImage(url)).not.toBeNull();
});

it("retains the SVG media type when the saved filename has a generic extension", async () => {
  const svg = "https://fixture.invalid/diagram.svg?download=1";
  await saveQuizImages(quiz("svg", svg));
  expect(offlineImageData(svg)).toBe("data:image/svg+xml;base64,AA==");
});

it("does not delete images when saved references cannot be read", async () => {
  const first = quiz("one");
  await saveQuizImages(first);
  vi.spyOn(storage, "keys").mockRejectedValueOnce(
    new Error("storage unavailable"),
  );
  await expect(removeQuizImages(first)).resolves.toBeUndefined();
  expect(offlineImage(url)).not.toBeNull();
});
it("does not delete another quiz’s image when its persisted record contains broken JSON", async () => {
  await saveQuizImages(quiz("one"));
  state.values.set("offline.other", '{"quizzes":');
  await expect(removeQuizImages(quiz("one"))).resolves.toBeUndefined();
  expect(offlineImage(url)).not.toBeNull();
  expect(state.values.get("offline.other")).toBe('{"quizzes":');
});

it("retries failed Android downloads without rendering their partial bytes", async () => {
  const download = vi
    .spyOn(File, "downloadFileAsync")
    .mockImplementationOnce(async (_url, file) => {
      state.files.add(file.uri);
      throw new Error("Interrupted download");
    });
  await saveQuizImages(quiz("interrupted"));
  expect(offlineImage(url)).toBeNull();
  expect(offlineImageData(url)).toBeNull();
  await saveQuizImages(quiz("retry"));
  expect(download).toHaveBeenCalledTimes(2);
  expect(offlineImage(url)).not.toBeNull();
  expect([...state.files].some((path) => path.endsWith(".partial"))).toBe(
    false,
  );
});

it("deduplicates concurrent downloads of a shared image", async () => {
  const download = vi.spyOn(File, "downloadFileAsync");
  await Promise.all([saveQuizImages(quiz("one")), saveQuizImages(quiz("two"))]);
  expect(download).toHaveBeenCalledTimes(1);
  expect(offlineImage(url)).not.toBeNull();
});

it("a directory creation failure stays recoverable and does not reject background work", async () => {
  state.directoryExists = false;
  state.directoryFailure = true;
  await expect(saveQuizImages(quiz("disk-full"))).resolves.toBeUndefined();
  expect(offlineImage(url)).toBeNull();
  state.directoryFailure = false;
  await saveQuizImages(quiz("retry"));
  expect(offlineImage(url)).not.toBeNull();
});

// Distinct same-length trusted URLs with a verified FNV-1a32 collision.
const collidingFirst = "https://fixture.invalid/media/8938b037.png";
const collidingSecond = "https://fixture.invalid/media/09c84b1e.png";
it("downloads distinct images even when their old filename hashes are colliding", async () => {
  const download = vi.spyOn(File, "downloadFileAsync");
  await saveQuizImages(quiz("collision-first", collidingFirst));
  await saveQuizImages(quiz("collision-second", collidingSecond));
  expect(download).toHaveBeenCalledTimes(2);
  expect(offlineImage(collidingFirst)).not.toBe(offlineImage(collidingSecond));
});
it("keeps a retained quiz image when another quiz's old filename hashes are colliding", async () => {
  const first = quiz("collision-first", collidingFirst);
  const second = quiz("collision-second", collidingSecond);
  const saved = library();
  await saved.cache(first);
  await saved.cache(second);
  await saveQuizImages(first);
  await saveQuizImages(second);
  await saved.discard(first.id);
  await removeQuizImages(first);
  expect(offlineImage(collidingSecond)).not.toBeNull();
});

it("does not republish an image after its last saved quiz is removed during download", async () => {
  const saved = library();
  const q = quiz("removed-during-image-download");
  await saved.cache(q);
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const original = File.downloadFileAsync;
  const download = vi
    .spyOn(File, "downloadFileAsync")
    .mockImplementation(async (...args) => {
      await gate;
      return original(...args);
    });
  const saving = saveQuizImages(q);
  await vi.waitFor(() => expect(download).toHaveBeenCalledTimes(1));
  await saved.discard(q.id);
  await removeQuizImages(q);
  finish();
  await saving;
  expect(offlineImage(url)).toBeNull();
});

it("never renders ambiguous legacy bytes and redownloads without removing them", async () => {
  const legacy = "file:///documents/offline-images/f000b6a3-42.png";
  state.files.add(legacy);
  expect(offlineImage(collidingFirst)).toBeNull();
  expect(offlineImageData(collidingFirst)).toBeNull();
  const download = vi.spyOn(File, "downloadFileAsync");
  await saveQuizImages(quiz("legacy-upgrade", collidingFirst));
  expect(download).toHaveBeenCalledOnce();
  expect(offlineImage(collidingFirst)).not.toBeNull();
  expect(state.files.has(legacy)).toBe(true);
});

it("retains a colliding legacy file across owners until the last possible reference is removed", async () => {
  const legacy = "file:///documents/offline-images/f000b6a3-42.png";
  const unrelated = "file:///documents/offline-images/unknown.png";
  const outside = "file:///documents/f000b6a3-42.png";
  state.files.add(legacy);
  state.files.add(unrelated);
  state.files.add(outside);
  const first = quiz("legacy-first", collidingFirst);
  const second = quiz("legacy-second", collidingSecond);
  await library("A").cache(first);
  await library("B").cache(second);
  await library("A").discard(first.id);
  await removeQuizImages(first);
  expect(state.files.has(legacy)).toBe(true);
  await library("B").discard(second.id);
  await removeQuizImages(second);
  expect(state.files.has(legacy)).toBe(false);
  expect(state.files.has(unrelated)).toBe(true);
  expect(state.files.has(outside)).toBe(true);
});

it("does not hash, download or render a data URL as an offline file", async () => {
  const data = "data:image/png;base64,AA==";
  const download = vi.spyOn(File, "downloadFileAsync");
  await saveQuizImages(quiz("data-url", data));
  expect(download).not.toHaveBeenCalled();
  expect(offlineImage(data)).toBeNull();
  expect(offlineImageData(data)).toBeNull();
});

it("allows a held download retained by another owner to finish", async () => {
  const first = quiz("first-held"),
    second = quiz("other-owner-held");
  await library("A").cache(first);
  await library("B").cache(second);
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const original = File.downloadFileAsync;
  const download = vi
    .spyOn(File, "downloadFileAsync")
    .mockImplementation(async (...args) => {
      await gate;
      return original(...args);
    });
  const saving = saveQuizImages(first);
  await vi.waitFor(() => expect(download).toHaveBeenCalledOnce());
  await library("A").discard(first.id);
  await removeQuizImages(first);
  finish();
  await saving;
  expect(offlineImage(url)).not.toBeNull();
});

it("a canceled old download cannot replace or remove a newly saved copy", async () => {
  const q = quiz("save-again");
  await library().cache(q);
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const original = File.downloadFileAsync;
  const download = vi
    .spyOn(File, "downloadFileAsync")
    .mockImplementationOnce(async (...args) => {
      await gate;
      return original(...args);
    });
  const oldSaving = saveQuizImages(q);
  await vi.waitFor(() => expect(download).toHaveBeenCalledOnce());
  await library().discard(q.id);
  await removeQuizImages(q);
  await library().cache(q);
  await saveQuizImages(q);
  const copy = offlineImage(url);
  expect(copy).not.toBeNull();
  finish();
  await oldSaving;
  expect(offlineImage(url)).toBe(copy);
  expect([...state.files].some((path) => path.endsWith(".partial"))).toBe(
    false,
  );
  expect(download).toHaveBeenCalledTimes(2);
});

it("does not start later images from an old batch after its saved quiz is removed", async () => {
  const q = quiz("multi-image-removed");
  q.questions[0].text =
    "![Second image](https://fixture.invalid/second-batch.png)";
  await library().cache(q);
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const original = File.downloadFileAsync;
  const download = vi
    .spyOn(File, "downloadFileAsync")
    .mockImplementationOnce(async (...args) => {
      await gate;
      return original(...args);
    });
  const saving = saveQuizImages(q);
  await vi.waitFor(() => expect(download).toHaveBeenCalledOnce());
  await library().discard(q.id);
  await removeQuizImages(q);
  finish();
  await saving;
  expect(offlineImage(url)).toBeNull();
  expect(offlineImage("https://fixture.invalid/second-batch.png")).toBeNull();
});

it("does not recreate files when a stale saved quiz starts downloading after purge", async () => {
  const q = quiz("already-purged");
  await library().cache(q);
  await library().discard(q.id);
  await removeQuizImages(q);
  const download = vi.spyOn(File, "downloadFileAsync");
  await downloadQuizImages(q);
  expect(download).not.toHaveBeenCalled();
  expect(offlineImage(url)).toBeNull();
});
