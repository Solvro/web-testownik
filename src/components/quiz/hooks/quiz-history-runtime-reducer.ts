import type { QuizHistory } from "@/components/quiz/hooks/use-quiz-history.ts";
import type { Question } from "@/types/quiz.ts";

export interface QuizHistoryRuntime {
  history: QuizHistory[];
  canGoBack: boolean;
}

export const initialRuntime: QuizHistoryRuntime = {
  history: [],
  canGoBack: false,
};

type Action =
  | { type: "SET_CAN_GO_BACK"; payload: boolean }
  | { type: "ADD_ENTRY"; payload: { question: Question; answers: number[] } }
  | { type: "INIT"; payload: QuizHistory[] }
  | { type: "RESET" };

export function runtimeReducer(
  state: QuizHistoryRuntime,
  action: Action,
): QuizHistoryRuntime {
  switch (action.type) {
    case "SET_CAN_GO_BACK": {
      return { ...state, canGoBack: action.payload };
    }

    case "ADD_ENTRY": {
      const { question, answers } = action.payload;

      const index = state.history.findIndex(
        (h) => h.question.id === question.id,
      );

      if (index !== -1) {
        const nextHistory = state.history.map((h, index_) =>
          index_ === index ? { ...h, answers } : h,
        );

        return {
          ...state,
          history: nextHistory,
        };
      }

      return {
        ...state,
        history: [{ question, answers }, ...state.history],
      };
    }

    case "INIT": {
      return {
        ...state,
        history: action.payload,
      };
    }

    case "RESET": {
      return initialRuntime;
    }

    default: {
      return state;
    }
  }
}
