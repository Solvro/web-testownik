import { useQuery } from "@tanstack/react-query";
import { useContext } from "react";

import { AppContext } from "@/app-context";

export function useUserQuizzes(isGuest: boolean) {
  const appContext = useContext(AppContext);

  return useQuery({
    queryKey: ["user-quizzes", isGuest],
    queryFn: async () => {
      return appContext.services.quiz.getQuizzes();
    },
    refetchOnWindowFocus: false,
    retry: isGuest ? 0 : 1,
  });
}

export function useSharedQuizzes(isGuest: boolean) {
  const appContext = useContext(AppContext);

  return useQuery({
    queryKey: ["shared-quizzes", isGuest],
    queryFn: async () => {
      return appContext.services.quiz.getSharedQuizzes();
    },
    refetchOnWindowFocus: false,
    retry: isGuest ? 0 : 1,
    enabled: !isGuest,
  });
}
