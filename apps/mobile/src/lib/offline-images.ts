import type { Quiz } from "@testownik/core/quiz/types";
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

import { API_URL } from "./api";
import { imageCacheName } from "./image-cache-key";
import { isTrustedImage, markdownImages } from "./image-policy";
import { offlineTransaction, validState, type OfflineState } from "./offline";
import { UserFacingError } from "./user-error";
import { ownedImageName } from "./image-cache-policy";
import { storage } from "./storage";

// Question and answer images of quizzes saved offline, keyed by their URL so a
// quiz stays readable without a connection. Only trusted hosts are fetched;
// external images keep their per-host approval and are never downloaded.
const supported = Platform.OS === "ios" || Platform.OS === "android";
const folder = () => new Directory(Paths.document, "offline-images");
interface Download {
  cancelled: boolean;
  url: string;
  controller: AbortController;
  promise: Promise<void>;
}
const downloads = new Map<string, Download>();
const activeDownloads = new Set<Download>();
const livePartials = new Set<string>();
const batches = new Set<{ pending: string[]; revoked: Set<string> }>();
let nextPartial = 0;
const remoteImage = (url: string) =>
  /^https?:\/\//i.test(url) && isTrustedImage(url, API_URL);

function fileFor(url: string) {
  return new File(folder(), imageCacheName(url));
}

// Older files have no original-URL metadata, so their ownership is ambiguous.
// Never render them; only clean up after the last possible reference is gone.
function legacyFileFor(url: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    hash ^= url.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const extension =
    /\.(png|jpe?g|gif|webp|avif|heic)(?:$|[?#])/i.exec(url)?.[1] ?? "img";
  return new File(folder(), `${hash.toString(16)}-${url.length}.${extension}`);
}

function imagesOf(quiz: Pick<Quiz, "questions">, trustedOnly = true) {
  const urls = new Set<string>();
  for (const question of quiz.questions) {
    if (question.image) urls.add(question.image);
    for (const url of markdownImages(question.text)) urls.add(url);
    if (question.explanation)
      for (const url of markdownImages(question.explanation)) urls.add(url);
    for (const answer of question.answers ?? []) {
      if (answer.image) urls.add(answer.image);
      for (const url of markdownImages(answer.text)) urls.add(url);
    }
  }
  return [...urls].filter(
    (url) => /^https?:\/\//i.test(url) && (!trustedOnly || remoteImage(url)),
  );
}

async function retainedImages() {
  const retained = new Set<string>();
  const keys = (await storage.keys()).filter((key) =>
    key.startsWith("offline."),
  );
  for (const key of keys) {
    const state = await storage.readStrict<OfflineState | null>(key, null);
    if (!validState(state)) throw new UserFacingError("localData");
    for (const saved of Object.values(state.quizzes))
      for (const url of imagesOf(saved, false)) retained.add(url);
  }
  return retained;
}

/** Inline cached bytes: a WebView HTML document cannot reliably read file URLs. */
export function offlineImageData(url: string): string | null {
  if (!supported || !remoteImage(url)) return null;
  try {
    const file = fileFor(url);
    if (!file.exists) return null;
    // Legacy SVG downloads have an .img filename. Browsers require the SVG
    // media type rather than inferring it from generic binary data.
    const type = /\.svg(?:$|[?#])/i.test(url)
      ? "image/svg+xml"
      : file.type || "application/octet-stream";
    return `data:${type};base64,${file.base64Sync()}`;
  } catch {
    return null;
  }
}

/** The downloaded copy of an image, if there is one. */
export function offlineImage(url: string): string | null {
  if (!supported || !remoteImage(url)) return null;
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
  const revoked = new Set<string>();
  const batch = { pending, revoked };
  batches.add(batch);
  try {
    // Admit only persisted references. Stale Home/Study effects after account
    // deletion must not recreate files from their old in-memory quiz.
    const retained = await offlineTransaction(storage, retainedImages);
    const directory = folder();
    if (!directory.exists) directory.create({ intermediates: true });
    for (const url of pending) {
      if (!retained.has(url) || revoked.has(url) || offlineImage(url)) continue;
      let download = downloads.get(url);
      if (!download) {
        const entry: Download = {
          cancelled: false,
          url,
          controller: new AbortController(),
          promise: Promise.resolve(),
        };
        activeDownloads.add(entry);
        entry.promise = (async () => {
          let partial: File | null = null;
          const controller = entry.controller;
          const timer = setTimeout(() => controller.abort(), 30000);
          let partialUri: string | null = null;
          try {
            const destination = fileFor(url);
            partial = new File(`${destination.uri}.${++nextPartial}.partial`);
            partialUri = partial.uri;
            livePartials.add(partialUri);
            await File.downloadFileAsync(url, partial, {
              idempotent: true,
              signal: controller.signal,
            });
            if (entry.cancelled) {
              if (partial.exists) partial.delete();
              return;
            }
            // The cancellation check and synchronous publish share one JS turn.
            // This in-flight download cannot publish after its reference cleanup.
            partial.moveSync(destination);
          } catch {
            try {
              if (partial?.exists) partial.delete();
            } catch {
              // Temporary bytes are never rendered; background work can retry.
            }
          } finally {
            clearTimeout(timer);
            if (partialUri) livePartials.delete(partialUri);
          }
        })().finally(() => {
          activeDownloads.delete(entry);
          if (downloads.get(url) === entry) downloads.delete(url);
        });
        download = entry;
        downloads.set(url, entry);
      }
      await download.promise;
    }
  } catch {
    // Failed reference reads or disk access leave background work recoverable.
  } finally {
    batches.delete(batch);
  }
}

/** Removes a quiz's downloaded images when its local copy is removed. */
export async function removeQuizImages(quiz: Pick<Quiz, "questions">) {
  if (!supported) return;
  // Derive references from persisted quizzes, including other accounts and
  // downloads made by older app versions. No separate manifest can drift.
  await offlineTransaction(storage, async () => {
    const retained = await retainedImages();
    const retainedLegacy = new Set(
      [...retained].map((url) => legacyFileFor(url).uri),
    );
    for (const url of imagesOf(quiz)) {
      if (retained.has(url)) continue;
      for (const batch of batches) batch.revoked.add(url);
      const download = downloads.get(url);
      if (download) {
        download.cancelled = true;
        download.controller.abort();
        downloads.delete(url);
      }
      try {
        const legacy = legacyFileFor(url);
        if (!retainedLegacy.has(legacy.uri) && legacy.exists) legacy.delete();
      } catch {
        // A failed legacy deletion must not suppress current-file cleanup.
      }
      try {
        const file = fileFor(url);
        if (file.exists) file.delete();
      } catch {
        // Already gone.
      }
    }
  }).catch(() => {
    // The quiz was already removed. If references cannot be read, retain the
    // files rather than deleting another quiz's media or reporting a false failure.
  });
}

let collection: Promise<void> | null = null;
let requestedCollection = 0;
let completedCollection = 0;

async function collectPulse() {
  const retained = await retainedImages();
  const names = new Set<string>();
  for (const url of retained) {
    names.add(imageCacheName(url).toLowerCase());
    names.add(legacyFileFor(url).uri.split("/").pop()!.toLowerCase());
  }
  for (const batch of batches)
    for (const url of batch.pending)
      if (!retained.has(url)) batch.revoked.add(url);
  const cancelled: Promise<void>[] = [];
  for (const entry of activeDownloads) {
    if (retained.has(entry.url)) continue;
    entry.cancelled = true;
    entry.controller.abort();
    if (downloads.get(entry.url) === entry) downloads.delete(entry.url);
    cancelled.push(entry.promise);
  }
  // Everything after the strict snapshot is synchronous within the lock.
  const directory = folder();
  // Native exists is also false when the directory is inaccessible. Create
  // idempotently and enumerate so unavailable media cannot be acknowledged as gone.
  directory.create({ intermediates: true, idempotent: true });
  const prefix = directory.uri.replace(/\/$/, "") + "/";
  let attempted = 0;
  let failure: { error: unknown } | undefined;
  for (const entry of directory.list()) {
    if (!(entry instanceof File) || !entry.uri.startsWith(prefix)) continue;
    const name = entry.uri.slice(prefix.length);
    if (name.includes("/")) continue;
    const owned = ownedImageName(name);
    if (!owned || livePartials.has(entry.uri)) continue;
    if (!owned.partial && names.has(owned.base)) continue;
    try {
      if (entry.exists) {
        attempted++;
        entry.delete();
        if (entry.exists) throw new UserFacingError("operation");
      }
    } catch (error) {
      // One inaccessible file must not retain every later orphan. Report the
      // unresolved cleanup after this bounded pulse instead of claiming success.
      failure ??= { error };
    }
    if (attempted === 64) return { more: true, cancelled, failure };
  }
  return { more: false, cancelled, failure };
}

async function waitForCancelled(entries: Promise<void>[]) {
  if (!entries.length) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.allSettled(entries),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new UserFacingError("operation")),
          30000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function runCollection() {
  while (completedCollection < requestedCollection) {
    const target = requestedCollection;
    const pulse = await offlineTransaction(storage, collectPulse);
    // A cancelled native transfer must settle before explicit deletion can
    // acknowledge cleanup. Never hold the answer lock while waiting for it.
    await waitForCancelled(pulse.cancelled);
    if (pulse.failure) throw pulse.failure.error;
    if (!pulse.more && !pulse.cancelled.length) completedCollection = target;
    if (completedCollection < requestedCollection)
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

/** Crash recovery for known, unreferenced media; never changes saved quiz data. */
export async function collectOfflineImages(): Promise<void> {
  if (!supported) return;
  const target = ++requestedCollection;
  while (completedCollection < target) {
    if (!collection) {
      const task = runCollection().finally(() => {
        if (collection === task) collection = null;
      });
      collection = task;
    }
    await collection;
  }
}
