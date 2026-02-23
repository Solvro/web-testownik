import type { ClientState } from "@/components/quiz/hooks/types";

export const INITIAL_CLIENT_STATE: ClientState = {
  selectedAnswers: [],
  questionChecked: false,
  nextQuestionId: null,
};

export function quizDetailQueryKey(quizId: string) {
  return [
    "quiz",
    quizId,
    "details",
    { include: ["user_settings", "current_session"] },
  ] as const;
}
