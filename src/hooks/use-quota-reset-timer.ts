import { useEffect, useState } from "react";

interface QuotaClock {
  resetsAt: string | null;
  now: number;
}

export function useQuotaResetTimer(
  resetsAt: string | null,
  onReset: (completedResetAt: string) => void,
) {
  const [clock, setClock] = useState<QuotaClock>(() => ({
    resetsAt,
    now: Date.now(),
  }));
  const now = clock.resetsAt === resetsAt ? clock.now : Date.now();

  useEffect(() => {
    if (resetsAt === null) {
      return;
    }
    const resetTime = new Date(resetsAt).getTime();
    const delay = resetTime - Date.now();
    if (delay <= 0) {
      onReset(resetsAt);
      return;
    }

    const interval = window.setInterval(
      () => {
        setClock({ resetsAt, now: Date.now() });
      },
      delay <= 10 * 60 * 1000 ? 1000 : 60_000,
    );
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      setClock({ resetsAt, now: resetTime });
      onReset(resetsAt);
    }, delay);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [onReset, resetsAt]);

  return now;
}
