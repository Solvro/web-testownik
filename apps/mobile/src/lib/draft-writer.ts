interface DraftStorage {
  write<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

const writes = new WeakMap<DraftStorage, Map<string, Promise<void>>>();

/** Await a previous screen's exit flush before reading the same draft. */
export function waitForDraftWrites(storage: DraftStorage, key: string) {
  // The originating action reports failure. Readers still need to recover the
  // retained draft instead of inheriting an earlier cleanup error.
  return (
    writes
      .get(storage)
      ?.get(key)
      ?.catch(() => undefined) ?? Promise.resolve()
  );
}
function track(storage: DraftStorage, key: string, pending: Promise<void>) {
  let queue = writes.get(storage);
  if (!queue) {
    queue = new Map();
    writes.set(storage, queue);
  }
  queue.set(key, pending);
  const clear = () => {
    if (queue.get(key) === pending) queue.delete(key);
  };
  void pending.then(clear, clear);
}

/** Debounce edits, but flush when leaving; deletion follows any pending write. */
export class DraftWriter<T> {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private latest: T | undefined;
  private pending = Promise.resolve();
  private writeResult = Promise.resolve();
  private discarded = false;
  constructor(
    private key: string,
    private storage: DraftStorage,
    private onError: (error: unknown) => void,
  ) {}

  schedule(value: T) {
    if (this.discarded) return;
    this.latest = value;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush();
    }, 400);
  }

  flush() {
    clearTimeout(this.timer);
    const value = this.latest;
    this.latest = undefined;
    if (!this.discarded && value !== undefined) {
      this.writeResult = waitForDraftWrites(this.storage, this.key)
        .catch(() => undefined)
        .then(() => {
          if (!this.discarded) return this.storage.write(this.key, value);
        });
      this.pending = this.writeResult.catch(this.onError);
      track(this.storage, this.key, this.pending);
    }
    return this.pending;
  }

  /** Navigation that promises to retain a draft must observe write failure. */
  flushOrThrow() {
    void this.flush();
    return this.writeResult;
  }

  /** Stop a superseded editor without deleting another context's saved draft. */
  retire() {
    this.discarded = true;
    clearTimeout(this.timer);
    this.latest = undefined;
  }

  async discard() {
    this.retire();
    this.pending = waitForDraftWrites(this.storage, this.key)
      .catch(() => undefined)
      .then(() => this.storage.remove(this.key));
    track(this.storage, this.key, this.pending);
    await this.pending;
  }

  /** A known committed save may finish after exit. Only clear its own snapshot. */
  discardIfUnchanged(
    read: () => Promise<T | null>,
    matches: (saved: T | null) => boolean,
  ): Promise<boolean> {
    this.retire();
    const operation = waitForDraftWrites(this.storage, this.key)
      .catch(() => undefined)
      .then(async () => {
        // Queue read and remove together. A reopened writer waits for both,
        // so a newer queued edit cannot be erased between these operations.
        if (!matches(await read())) return false;
        await this.storage.remove(this.key);
        return true;
      });
    this.pending = operation.then(() => undefined);
    track(this.storage, this.key, this.pending);
    return operation;
  }
}
