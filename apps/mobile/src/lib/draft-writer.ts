interface DraftStorage {
  write<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

const writes = new WeakMap<DraftStorage, Map<string, Promise<void>>>();

/** Await a previous screen's exit flush before reading the same draft. */
export function waitForDraftWrites(storage: DraftStorage, key: string) {
  return writes.get(storage)?.get(key) ?? Promise.resolve();
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
      this.pending = waitForDraftWrites(this.storage, this.key)
        .then(() => this.storage.write(this.key, value))
        .catch(this.onError);
      track(this.storage, this.key, this.pending);
    }
    return this.pending;
  }

  async discard() {
    this.discarded = true;
    clearTimeout(this.timer);
    this.latest = undefined;
    this.pending = waitForDraftWrites(this.storage, this.key).then(() =>
      this.storage.remove(this.key),
    );
    track(this.storage, this.key, this.pending);
    await this.pending;
  }
}
