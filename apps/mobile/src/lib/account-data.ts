import type { Quiz } from "@testownik/core/quiz/types";
import {
  emptyState,
  notifyOfflineMediaChanges,
  offlineTransaction,
  type OfflineState,
  type OfflineStorage,
} from "./offline";

const prefixes = [
  "draft",
  "chat",
  "chat-draft",
  "quiz-ai-model",
  "quiz-create",
];
export function isAccountDataKey(key: string, ownerId: string) {
  return (
    key === `offline.${ownerId}` ||
    prefixes.some((prefix) => key.startsWith(`${prefix}.${ownerId}.`))
  );
}

/** Explicit deletion only. Ordinary sign-out keeps these recoverable drafts. */
export async function purgeAccountData(
  store: OfflineStorage & {
    keys(): Promise<string[]>;
    remove(key: string): Promise<void>;
  },
  ownerId: string,
): Promise<Quiz[]> {
  const quizzes = await offlineTransaction(store, async () => {
    let quizzes: Quiz[] = [];
    try {
      const saved = (await (store.readStrict ?? store.read).call(
        store,
        `offline.${ownerId}`,
        emptyState(),
      )) as OfflineState;
      if (
        saved &&
        saved.quizzes &&
        typeof saved.quizzes === "object" &&
        !Array.isArray(saved.quizzes)
      )
        quizzes = Object.values(saved.quizzes);
    } catch {
      // A corrupt owner record can still be explicitly erased. Unknown media
      // stays on disk rather than risking another account's shared images.
    }
    for (const key of await store.keys())
      if (isAccountDataKey(key, ownerId)) await store.remove(key);
    return quizzes;
  });
  notifyOfflineMediaChanges(store);
  return quizzes;
}
