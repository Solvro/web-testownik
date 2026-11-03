"use client";

import { useSyncExternalStore } from "react";

const MINUTE_MS = 60_000;

/** Notifies on every minute boundary, starting with the next one. */
function subscribeToMinutes(onMinute: () => void): () => void {
  let interval: ReturnType<typeof setInterval> | undefined;
  const timeout = setTimeout(
    () => {
      onMinute();
      interval = setInterval(onMinute, MINUTE_MS);
    },
    MINUTE_MS - (Date.now() % MINUTE_MS),
  );
  return () => {
    clearTimeout(timeout);
    clearInterval(interval);
  };
}

function getCurrentMinute(): number {
  return Math.floor(Date.now() / MINUTE_MS);
}

function getServerMinute(): null {
  return null;
}

/** Null on the server and during hydration, so clocks can render a stand-in. */
export function useCurrentMinute(): Date | null {
  const minute = useSyncExternalStore(
    subscribeToMinutes,
    getCurrentMinute,
    getServerMinute,
  );
  return minute === null ? null : new Date(minute * MINUTE_MS);
}
