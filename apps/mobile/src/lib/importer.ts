import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import { File } from "expo-file-system";
import JSZip from "jszip";
import { Platform } from "react-native";
import { z } from "zod";

import { api } from "./api";
import { parseQuestion } from "./legacy-parser";

const image = z.string().nullable().optional();
const answer = z.object({
  text: z.string().optional(),
  answer: z.string().optional(),
  is_correct: z.boolean().optional(),
  correct: z.boolean().optional(),
  image,
  image_url: image,
});
const question = z.object({
  text: z.string().optional(),
  question: z.string().optional(),
  explanation: z.string().optional(),
  multiple: z.boolean().optional(),
  image,
  image_url: image,
  answers: z.array(answer).max(100),
});
const input = z.object({
  title: z.string().default("Importowany quiz"),
  description: z.string().default(""),
  questions: z.array(question).min(1).max(10000),
});
export function normalizeImport(
  raw: unknown,
  fallbackTitle = "Importowany quiz",
) {
  const data = input
    .extend({ title: z.string().default(fallbackTitle) })
    .parse(raw);
  return {
    ...data,
    questions: data.questions.map((q, i) => ({
      id: Crypto.randomUUID(),
      order: i + 1,
      text: q.text ?? q.question ?? "",
      explanation: q.explanation ?? "",
      multiple:
        q.answers.filter((a) => a.is_correct ?? a.correct ?? false).length > 1,
      image_url: q.image_url ?? q.image ?? null,
      answers: q.answers.map((a, j) => ({
        id: Crypto.randomUUID(),
        order: j + 1,
        text: a.text ?? a.answer ?? "",
        is_correct: a.is_correct ?? a.correct ?? false,
        image_url: a.image_url ?? a.image ?? null,
      })),
    })),
  };
}
type Translate = (pl: string, en: string) => string;
export async function readArchive(
  bytes: ArrayBuffer,
  title: string,
  t: Translate = (pl) => pl,
) {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new Error(
      t(
        "Nie można odczytać archiwum ZIP. Sprawdź, czy plik nie jest uszkodzony ani zabezpieczony hasłem.",
        "Cannot read this ZIP archive. Check that the file is not damaged or password-protected.",
      ),
    );
  }
  const files = Object.values(zip.files).filter((f) => !f.dir);
  if (files.length > 12000)
    throw new Error(
      t(
        "Archiwum zawiera zbyt wiele plików.",
        "The archive contains too many files.",
      ),
    );
  const json = files.find((f) => f.name.toLowerCase().endsWith(".json"));
  if (json) {
    const contents = await json.async("string");
    if (contents.length > 20_000_000)
      throw new Error(t("Quiz jest zbyt duży.", "The quiz is too large."));
    return JSON.parse(contents.replace(/^\uFEFF/, ""));
  }
  const questions = [];
  let total = 0;
  for (const file of files
    .filter((f) => f.name.toLowerCase().endsWith(".txt"))
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    )) {
    const text = await file.async("string");
    total += text.length;
    if (total > 20_000_000)
      throw new Error(t("Quiz jest zbyt duży.", "The quiz is too large."));
    const q = parseQuestion(
      text.replace(/^\uFEFF/, "").split(/\r?\n/),
      file.name,
      questions.length + 1,
    );
    if (!q)
      throw new Error(
        t(
          `Nieprawidłowe pytanie: ${file.name}`,
          `Invalid question: ${file.name}`,
        ),
      );
    questions.push(q);
  }
  if (!questions.length)
    throw new Error(
      t("Archiwum nie zawiera pytań.", "The archive contains no questions."),
    );
  const images = new Map<string, string>();
  for (const f of files.filter((f) =>
    /\.(png|jpe?g|gif|webp)$/i.test(f.name),
  )) {
    const base64 = await f.async("base64");
    total += base64.length;
    if (total > 30_000_000)
      throw new Error(
        t(
          "Obrazy w archiwum są zbyt duże.",
          "The archive images are too large.",
        ),
      );
    const ext = f.name.split(".").at(-1)?.toLowerCase();
    images.set(
      f.name.split("/").at(-1)!,
      `data:image/${ext === "jpg" ? "jpeg" : ext};base64,${base64}`,
    );
  }
  for (const q of questions) {
    for (const target of [q, ...q.answers]) {
      const match = /\[img\]([^[]+)\[\/img\]/i.exec(target.text);
      if (match) {
        const filename = match[1].split(/[\\/]/).at(-1)!;
        const data = images.get(filename);
        if (!data)
          throw new Error(
            t(`Brak obrazu: ${filename}`, `Missing image: ${filename}`),
          );
        target.image_url = data;
        target.text = target.text.replace(match[0], "").trim();
      }
    }
  }
  return { title: title.replace(/\.zip$/i, ""), description: "", questions };
}
export async function uploadImportedImages<
  T extends {
    questions: {
      image_url?: string | null;
      image_upload?: string | null;
      answers: { image_url?: string | null; image_upload?: string | null }[];
    }[];
  },
>(
  quiz: T,
  uploaded = new Map<string, string>(),
  t: Translate = (pl) => pl,
): Promise<T> {
  const copy = JSON.parse(JSON.stringify(quiz)) as T;
  for (const q of copy.questions) {
    for (const item of [q, ...q.answers]) {
      if (!item.image_url?.startsWith("data:image/")) continue;
      const source = item.image_url;
      if (uploaded.has(source)) {
        item.image_upload = uploaded.get(source);
        item.image_url = null;
        continue;
      }
      const match =
        /^data:(image\/(png|jpeg|gif|webp));base64,([a-z0-9+/=\s]+)$/i.exec(
          item.image_url,
        );
      if (!match)
        throw new Error(
          t("Nieobsługiwany obraz w pliku.", "Unsupported image in the file."),
        );
      const body = new FormData();
      let temporary: string | undefined;
      if (Platform.OS === "web") {
        body.append(
          "image",
          await fetch(item.image_url).then((r) => r.blob()),
          `image.${match[2]}`,
        );
      } else {
        temporary = `${FileSystem.cacheDirectory}${Crypto.randomUUID()}.${match[2]}`;
        await FileSystem.writeAsStringAsync(temporary, match[3], {
          encoding: FileSystem.EncodingType.Base64,
        });
        body.append("image", new File(temporary));
      }
      try {
        const result = await api.request<{ id: string }>("upload/", {
          method: "POST",
          body,
        });
        uploaded.set(source, result.id);
        item.image_upload = result.id;
        item.image_url = null;
      } finally {
        if (temporary)
          await FileSystem.deleteAsync(temporary, { idempotent: true });
      }
    }
  }
  return copy;
}
