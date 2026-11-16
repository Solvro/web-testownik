import { UserFacingError } from "./user-error";

async function withBrowserLock<T>(
  name: string,
  run: () => Promise<T>,
): Promise<T> {
  let locks: LockManager | undefined;
  try {
    locks = globalThis.navigator?.locks;
  } catch {
    /* Access denied. */
  }
  if (!locks) throw new UserFacingError("browserStorageLock");
  const controller = new AbortController();
  let granted = false;
  const deadline = setTimeout(() => controller.abort(), 8000);
  try {
    return await locks.request(
      name,
      { signal: controller.signal },
      async () => {
        granted = true;
        // The signal only cancels acquisition. Never release a granted lock while
        // an outstanding storage operation can still commit afterwards.
        clearTimeout(deadline);
        return run();
      },
    );
  } catch (error) {
    if (controller.signal.aborted)
      throw new UserFacingError("browserStorageCoordination");
    if (!granted) throw new UserFacingError("browserStorageLock");
    throw error;
  } finally {
    clearTimeout(deadline);
  }
}

/** Leaf lock only: never await an app queue while holding this browser lock. */
export function withAccountDataLock<T>(run: () => Promise<T>): Promise<T> {
  return withBrowserLock("testownik.account-data.v1", run);
}

/** Enter after the local offline queue, before any account-data leaf lock. */
export function withOfflineDataLock<T>(run: () => Promise<T>): Promise<T> {
  return withBrowserLock("testownik.offline-data.v1", run);
}

/** Short journal claim/settlement only; never hold this lock across a network request. */
export function withQuizCreateLock<T>(
  owner: string,
  run: () => Promise<T>,
): Promise<T> {
  return withBrowserLock(`testownik.quiz-create.v1.${owner}`, run);
}
