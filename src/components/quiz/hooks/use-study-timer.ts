import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Creates a timer store that can be subscribed to without causing parent re-renders.
 * Uses useSyncExternalStore to isolate timer updates to only subscribing components.
 */
function createTimerStore(initial: number) {
  let studyTime = initial;
  let startTime = Date.now() - initial * 1000;
  const listeners = new Set<() => void>();

  const notifyListeners = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return studyTime;
    },
    getStartTime() {
      return startTime;
    },
    setStartTime(time: number) {
      startTime = time;
    },
    tick() {
      const newTime = Math.floor((Date.now() - startTime) / 1000);
      if (newTime !== studyTime) {
        studyTime = newTime;
        notifyListeners();
      }
    },
    setFromLoaded(time: number, newStartTime?: number) {
      studyTime = time;
      startTime = newStartTime ?? Date.now() - time * 1000;
      notifyListeners();
    },
    reset(time: number, newStartTime: number) {
      studyTime = time;
      startTime = newStartTime;
      notifyListeners();
    },
  };
}

export type TimerStore = ReturnType<typeof createTimerStore>;

export function useStudyTimer(isFinished: boolean, initial = 0) {
  const storeRef = useRef<TimerStore | null>(null);
  storeRef.current ??= createTimerStore(initial);
  const store = storeRef.current;

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isFinished && timerRef.current === null) {
      timerRef.current = window.setInterval(() => {
        store.tick();
      }, 1000);
    }
    if (isFinished && timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current != null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isFinished, store]);

  const setFromLoaded = (time: number, startTime?: number) => {
    store.setFromLoaded(time, startTime);
  };

  const getStartTime = () => store.getStartTime();

  return {
    store,
    setFromLoaded,
    getStartTime,
  } as const;
}

/**
 * Hook to subscribe to the study time value.
 * Only components using this hook will re-render when the timer updates.
 */
export function useStudyTimeValue(store: TimerStore): number {
  return useSyncExternalStore(
    (callback) => store.subscribe(callback),
    () => store.getSnapshot(),
    () => store.getSnapshot(),
  );
}
