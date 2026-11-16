import type { UserSettings } from "@testownik/core/user/types";

const SAVE_DELAY = 600;
const empty = { draft: null, error: null, busy: false };
export interface SettingsSaveState {
  draft: UserSettings | null;
  error: unknown;
  busy: boolean;
}
interface Ports {
  save(value: UserSettings): Promise<UserSettings>;
  cancel(): Promise<void>;
  commit(value: UserSettings): void;
  report(error: unknown): void;
}

/** One save chain per login, retained when the Settings screen is reopened. */
export function createSettingsSaver(session: AbortSignal, ports: Ports) {
  let currentPorts = ports;
  let state: SettingsSaveState = empty;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sending: UserSettings | null = null;
  let queued = false;
  let running: Promise<void> | null = null;
  const publish = (next: SettingsSaveState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  const clearTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  session.addEventListener(
    "abort",
    () => {
      clearTimer();
      queued = false;
      publish(empty);
    },
    { once: true },
  );

  function flush(): Promise<void> {
    clearTimer();
    if (session.aborted || !state.draft || state.error)
      return Promise.resolve();
    if (running) {
      // Closing a screen must not queue its already-sending snapshot again.
      if (state.draft !== sending) queued = true;
      return running;
    }
    sending = state.draft;
    queued = false;
    // Defer the work until `running` is assigned, including synchronous failures.
    running = Promise.resolve()
      .then(async () => {
        while (sending && !session.aborted) {
          const snapshot = sending;
          try {
            await currentPorts.cancel();
            if (session.aborted) break;
            const saved = await currentPorts.save(snapshot);
            if (session.aborted) break;
            // The server has acknowledged this snapshot. Cache work must never
            // turn its success into a false save failure or cross a logout.
            try {
              await currentPorts.cancel();
            } catch {
              /* Best effort after ACK. */
            }
            if (session.aborted) break;
            try {
              currentPorts.commit(saved);
            } catch {
              /* Server success still stands. */
            }
            publish({
              draft: state.draft === snapshot ? null : state.draft,
              error: null,
              busy: true,
            });
          } catch (error) {
            if (session.aborted) break;
            // A newer full snapshot supersedes the failed one and has its own save.
            if (state.draft === snapshot) publish({ ...state, error });
          }
          if (!queued || !state.draft || state.draft === snapshot) break;
          queued = false;
          sending = state.draft;
        }
      })
      .finally(() => {
        running = null;
        sending = null;
        if (session.aborted) return;
        publish({ ...state, busy: false });
        if (state.error && !listeners.size) {
          try {
            currentPorts.report(state.error);
          } catch {
            /* Keep the retryable draft even if the alert fails. */
          }
        }
      });
    publish({ ...state, error: null, busy: true });
    return running;
  }
  return {
    configure(next: Ports) {
      currentPorts = next;
    },
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update(base: UserSettings | undefined, patch: Partial<UserSettings>) {
      if (session.aborted) return;
      const previous = state.draft ?? base;
      if (!previous) return;
      publish({ ...state, draft: { ...previous, ...patch }, error: null });
      clearTimer();
      timer = setTimeout(() => {
        void flush();
      }, SAVE_DELAY);
    },
    flush,
    retry() {
      if (session.aborted) return Promise.resolve();
      publish({ ...state, error: null });
      return flush();
    },
  };
}

export type SettingsSaver = ReturnType<typeof createSettingsSaver>;
const sessions = new WeakMap<AbortSignal, SettingsSaver>();
export function settingsSaver(
  session: AbortSignal,
  ports: Ports,
): SettingsSaver {
  let saver = sessions.get(session);
  if (!saver) {
    saver = createSettingsSaver(session, ports);
    sessions.set(session, saver);
  }
  return saver;
}
