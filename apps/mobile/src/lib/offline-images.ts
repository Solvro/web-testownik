import type { Quiz } from "@testownik/core/quiz/types";
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

import { API_URL } from "./api";
import { isTrustedImage } from "./image-policy";

// Question and answer images of quizzes saved offline, keyed by their URL so a
// quiz stays readable without a connection. Only trusted hosts are fetched;
// external images keep their per-host approval and are never downloaded.
const supported = Platform.OS === "ios" || Platform.OS === "android";
const folder = () => new Directory(Paths.document, "offline-images");

function fileFor(url: string) {
  // A stable, filesystem-safe name: FNV-1a hash plus the original extension.
  let hash = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    hash ^= url.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const extension =
    /\.(png|jpe?g|gif|webp|avif|heic)(?:$|[?#])/i.exec(url)?.[1] ?? "img";
  return new File(folder(), `${hash.toString(16)}-${url.length}.${extension}`);
}

function imagesOf(quiz: Pick<Quiz, "questions">) {
  const urls = new Set<string>();
  for (const question of quiz.questions) {
    if (question.image) urls.add(question.image);
    for (const answer of question.answers ?? [])
      if (answer.image) urls.add(answer.image);
  }
  return [...urls].filter((url) => isTrustedImage(url, API_URL));
}

/** The downloaded copy of an image, if there is one. */
export function offlineImage(url: string): string | null {
  if (!supported) return null;
  try {
    const file = fileFor(url);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

/** Downloads a saved quiz's images in the background; failures are retried next time. */
export async function saveQuizImages(quiz: Pick<Quiz, "questions">) {
  if (!supported) return;
  const pending = imagesOf(quiz).filter((url) => !offlineImage(url));
  if (!pending.length) return;
  const directory = folder();
  if (!directory.exists) directory.create({ intermediates: true });
  for (const url of pending) {
    try {
      await File.downloadFileAsync(url, fileFor(url));
    } catch {
      // Offline or a transient error: the image loads from the network meanwhile.
    }
  }
}

/** Removes a quiz's downloaded images when its local copy is removed. */
export function removeQuizImages(quiz: Pick<Quiz, "questions">) {
  if (!supported) return;
  for (const url of imagesOf(quiz)) {
    try {
      const file = fileFor(url);
      if (file.exists) file.delete();
    } catch {
      // Already gone.
    }
  }
}
