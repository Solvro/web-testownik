import { beforeEach, expect, it, vi } from "vitest";
import JSZip from "jszip";
import {
  normalizeImport,
  readArchive,
  uploadImportedImages,
} from "../src/lib/importer";
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  write: vi.fn(),
  remove: vi.fn(),
  platform: { OS: "ios" },
}));
vi.mock("expo-crypto", () => ({ randomUUID: () => "fixture-id" }));
vi.mock("react-native", () => ({ Platform: mocks.platform }));
vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///fixture/",
  EncodingType: { Base64: "base64" },
  writeAsStringAsync: mocks.write,
  deleteAsync: mocks.remove,
}));
vi.mock("expo-file-system", () => ({
  File: class File {
    constructor(public uri: string) {}
    bytes() {
      return new Uint8Array();
    }
  },
}));
vi.mock("../src/lib/api", () => ({
  api: {
    request: mocks.request,
    forSession: () => ({ request: mocks.request }),
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
});
it("explains an unreadable archive in the selected language", async () => {
  await expect(
    readArchive(new ArrayBuffer(0), "broken.zip", (_pl, en) => en),
  ).rejects.toThrow("Cannot read this ZIP archive");
  await expect(readArchive(new ArrayBuffer(0), "broken.zip")).rejects.toThrow(
    "Nie można odczytać archiwum ZIP",
  );
});
it("reads uppercase JSON filenames and a UTF-8 BOM inside archives", async () => {
  const zip = new JSZip();
  zip.file("quiz.JSON", '\uFEFF{"title":"Archive quiz","questions":[]}');
  const bytes = await zip.generateAsync({ type: "arraybuffer" });
  expect(await readArchive(bytes, "quiz.zip")).toEqual({
    title: "Archive quiz",
    questions: [],
  });
});
it("ignores Finder metadata and parses numbered questions inside a folder", async () => {
  const zip = new JSZip();
  zip.file("__MACOSX/._quiz.json", "not quiz JSON");
  zip.file("__MACOSX/Quiz/._001.txt", "AppleDouble metadata");
  zip.file("Quiz/._002.txt", "AppleDouble metadata");
  zip.file("Quiz/.DS_Store", "Finder preferences");
  zip.file("Quiz/001.txt", "X10\n1. First question\nYes\nNo\n");
  const bytes = await zip.generateAsync({ type: "arraybuffer" });
  const result = normalizeImport(await readArchive(bytes, "Quiz.zip"));
  expect(result.questions).toHaveLength(1);
  expect(result.questions[0].text).toBe("First question");
  expect(result.questions[0].answers.map((a) => a.is_correct)).toEqual([
    true,
    false,
  ]);
});
it("rejects oversized decompressed JSON before parsing it", async () => {
  const zip = new JSZip();
  zip.file("quiz.json", " ".repeat(20_000_001));
  const bytes = await zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
  });
  await expect(
    readArchive(bytes, "large.zip", (_pl, en) => en),
  ).rejects.toThrow("The quiz is too large.");
});
it("reads legacy questions and archive images without Intl.Segmenter", async () => {
  const zip = new JSZip();
  zip.file("001.txt", "X10\nŻółć [img]picture.png[/img]\nTak\nNie\n");
  zip.file("002.txt", "QQ01\n2.\tSecond question\n(a) No\n(b) Yes\n");
  zip.file("picture.png", "YQ==", { base64: true });
  const bytes = await zip.generateAsync({ type: "arraybuffer" });
  vi.stubGlobal("Intl", { ...Intl, Segmenter: undefined });
  try {
    const result = normalizeImport(await readArchive(bytes, "Legacy.zip"));
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0]).toMatchObject({
      text: "Żółć",
      image_url: "data:image/png;base64,YQ==",
      multiple: false,
    });
    expect(result.questions[1].answers.map((a) => a.is_correct)).toEqual([
      false,
      true,
    ]);
  } finally {
    vi.unstubAllGlobals();
  }
});
it("normalizes legacy answers and derives multiple-choice from correct answers", () => {
  const quiz = normalizeImport(
    {
      questions: [
        {
          question: "Which?",
          answers: [
            { answer: "A", correct: true },
            { answer: "B", correct: true },
          ],
        },
      ],
    },
    "Imported quiz",
  );
  expect(quiz.title).toBe("Imported quiz");
  expect(quiz.questions[0].multiple).toBe(true);
  expect(quiz.questions[0].answers.map((a) => a.text)).toEqual(["A", "B"]);
});
it("native imported images use File multipart and reuse committed uploads on retry", async () => {
  const image = "data:image/png;base64,YQ==",
    other = "data:image/png;base64,Yg==";
  const quiz = {
    questions: [
      {
        image_url: image,
        answers: [{ image_url: image }, { image_url: other }],
      },
    ],
  };
  const uploaded = new Map<string, string>();
  const append = vi.fn();
  vi.stubGlobal(
    "FormData",
    class {
      append = append;
    },
  );
  try {
    mocks.request
      .mockResolvedValueOnce({ id: "first-upload" })
      .mockRejectedValueOnce(new Error("offline"));
    await expect(uploadImportedImages(quiz, uploaded)).rejects.toThrow(
      "offline",
    );
    expect(uploaded.get(image)).toBe("first-upload");
    expect(append.mock.calls[0][1]).toHaveProperty("bytes");
    expect(mocks.remove).toHaveBeenCalledTimes(2);
    mocks.request.mockResolvedValueOnce({ id: "second-upload" });
    const result = await uploadImportedImages(quiz, uploaded);
    expect(mocks.request).toHaveBeenCalledTimes(3);
    expect(result.questions[0].image_url).toBeNull();
    expect(result.questions[0].answers[0]).toMatchObject({
      image_upload: "first-upload",
      image_url: null,
    });
    expect(quiz.questions[0].image_url).toBe(image);
  } finally {
    vi.unstubAllGlobals();
  }
});

it("preserves explicitly imported multiple-choice mode with a single correct answer", () => {
  const imported = normalizeImport({
    title: "Multiple mode",
    questions: [
      {
        text: "Choose all applicable",
        multiple: true,
        answers: [
          { text: "Currently correct", is_correct: true },
          { text: "Currently wrong", is_correct: false },
        ],
      },
    ],
  });
  expect(imported.questions[0].multiple).toBe(true);
});

it("uploads through the client captured for the importing account", async () => {
  const request = vi.fn(async (..._args: unknown[]) => ({
    id: "bound-upload",
  }));
  const image = "data:image/png;base64,YQ==";
  await uploadImportedImages(
    { questions: [{ image_url: image, answers: [] }] },
    new Map(),
    (_pl, en) => en,
    { request: async <T>(...args: unknown[]) => (await request(...args)) as T },
  );
  expect(request).toHaveBeenCalledTimes(1);
  expect(mocks.request).not.toHaveBeenCalled();
});
