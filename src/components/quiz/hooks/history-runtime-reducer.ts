import type { QuizHistory } from "@/components/quiz/hooks/use-quiz-history.ts";
import type { Question } from "@/types/quiz.ts";

export interface RuntimeState {
  currentQuestion: Question | null;
  history: QuizHistory[];
  canGoBack: boolean;
}

type Action =
  | { type: "SET_CAN_GO_BACK"; payload: boolean }
  | { type: "ADD_ENTRY"; payload: { question: Question; answers: string[] } }
  | { type: "UPDATE_ENTRY"; payload: { answers: string[] } }
  | { type: "INIT"; payload: QuizHistory[] }
  | { type: "RESET" };

export const initialRuntime: RuntimeState = {
  currentQuestion: null,
  history: [],
  canGoBack: false,
};

export function runtimeReducer(
  state: RuntimeState,
  action: Action,
): RuntimeState {
  switch (action.type) {
    case "SET_CAN_GO_BACK": {
      return { ...state, canGoBack: action.payload };
    }
    case "ADD_ENTRY": {
      const { question, answers } = action.payload;

      // Max 50 history entries
      const newHistory = [
        { id: crypto.randomUUID(), question, answers },
        ...state.history,
      ].slice(0, 50);

      return {
        ...state,
        history: newHistory,
      };
    }
    case "UPDATE_ENTRY": {
      const { answers } = action.payload;

      return {
        ...state,
        history: state.history.map((h, index) =>
          index === 0 ? { ...h, answers } : h,
        ),
      };
    }
    case "INIT": {
      return { ...state, history: action.payload };
    }
    case "RESET": {
      return initialRuntime;
    }
    default: {
      return state;
    }
  }
}
