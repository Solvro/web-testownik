import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { api } from "./api";
import { haptics } from "./haptics";
import { useSession } from "./session";

interface Rating {
  id: string;
  score: number;
}

/** The signed-in user's star rating for a quiz. Tapping a star saves it at once. */
export function useQuizRating(id: string) {
  const s = useSession();
  const cache = useQueryClient();
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const saving = useRef(false);
  const key = ["rating", id, s.user?.id];
  const mine = useQuery({
    queryKey: key,
    queryFn: () => api.request<Rating[]>(`quiz-ratings/me/?quiz=${id}`),
  });
  const current = mine.data?.[0];

  async function rate(score: number) {
    if (saving.current || mine.isPending || score === current?.score) return;
    saving.current = true;
    haptics.selection();
    const previous = mine.data;
    cache.setQueryData<Rating[]>(key, [
      { id: current?.id ?? "pending", score },
    ]);
    setState("saving");
    try {
      const saved = current
        ? await api.patch<Rating>(`quiz-ratings/${current.id}/`, { score })
        : await api.post<Rating>("quiz-ratings/", { quiz: id, score });
      cache.setQueryData(key, [saved]);
      setState("idle");
    } catch {
      cache.setQueryData(key, previous);
      setState("error");
    } finally {
      saving.current = false;
    }
  }

  return { mine, current, state, rate };
}
