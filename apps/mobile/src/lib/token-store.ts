import { ApiError, type Tokens, type TokenStore } from "./client";

/** A login owns a signal; token rotation keeps it, account changes abort it. */
export function createTokenStore(persistence: {
  read(): Promise<Tokens | null>;
  write(tokens: Tokens | null): Promise<void>;
  changed?(): void;
}): TokenStore {
  let current: Tokens | null | undefined;
  let session = new AbortController();
  let writes: Promise<void> = Promise.resolve();
  const ended = () =>
    new ApiError(401, "Sesja została zakończona.", undefined, "signedOut");
  return {
    session: () => session.signal,
    async get() {
      const original = session.signal;
      await writes;
      if (current !== undefined) return current;
      const saved = await persistence.read();
      if (original !== session.signal) return this.get();
      current ??= saved;
      return current;
    },
    async set(tokens, expectedSession) {
      if (expectedSession && expectedSession !== session.signal) throw ended();
      if (!expectedSession || !tokens) {
        session.abort();
        session = new AbortController();
        current = null;
      }
      const original = session.signal;
      const write = writes.then(async () => {
        if (original !== session.signal) throw ended();
        try {
          await persistence.write(tokens);
        } catch (error) {
          // A failed sign-out must not make memory claim the secure entry was
          // removed. Re-read persistence on retry without reviving old work.
          if ((!expectedSession || !tokens) && original === session.signal)
            current = undefined;
          throw error;
        }
        if (original !== session.signal) throw ended();
        current = tokens;
        persistence.changed?.();
      });
      writes = write.catch(() => undefined);
      return write;
    },
  };
}
