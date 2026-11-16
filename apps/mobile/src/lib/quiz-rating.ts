import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { api } from "./api";
import { haptics } from "./haptics";
import { useSession } from "./session";
import { tokenStore } from "./storage";

interface Rating {
  id: string;
  score: number;
}

/** The signed-in user's star rating for a quiz. Tapping a star saves it at once. */
export function useQuizRating(id: string) {
  const s = useSession();
  const [session] = useState(() => tokenStore.session());
  const [client] = useState(() => api.forSession(session));
  const cache = useQueryClient();
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const saving = useRef(false);
  const key = ["rating", id, s.user?.id];
  const mine = useQuery({
    queryKey: key,
    networkMode: "always",
    queryFn: ({ signal }) =>
      client.request<Rating[]>(`quiz-ratings/me/?quiz=${id}`, { signal }),
  });
  const current = mine.data?.[0];

  async function rate(score: number) {
    if (saving.current || mine.data === undefined || score === current?.score)
      return;
    saving.current = true;
    haptics.selection();
    const previous = mine.data;
    setState("saving");
    try {
      // An older background GET must not replace the user's new selection.
      await cache.cancelQueries({ queryKey: key, exact: true });
      if (session.aborted) return;
      cache.setQueryData<Rating[]>(key, [
        { id: current?.id ?? "pending", score },
      ]);
      const saved = current
        ? await client.patch<Rating>(`quiz-ratings/${current.id}/`, { score })
        : await client.post<Rating>("quiz-ratings/", { quiz: id, score });
      // Focus/reconnect may start another GET while the write is in flight.
      await cache.cancelQueries({ queryKey: key, exact: true });
      if (session.aborted) return;
      cache.setQueryData(key, [saved]);
      setState("idle");
    } catch {
      if (session.aborted) return;
      await cache.cancelQueries({ queryKey: key, exact: true });
      if (session.aborted) return;
      cache.setQueryData(key, previous ?? []);
      setState("error");
      void cache.invalidateQueries({ queryKey: key, exact: true });
    } finally {
      if (session.aborted) setState("idle");
      saving.current = false;
    }
  }

  return { mine, current, state, rate };
}
