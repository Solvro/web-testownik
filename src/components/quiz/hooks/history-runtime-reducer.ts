import type {
  HistoryEntry,
  QuizHistory,
} from "@/components/quiz/hooks/use-quiz-history.ts";
import type { Question } from "@/types/quiz.ts";

export interface RuntimeState {
  history: QuizHistory;
  canGoBack: boolean;
}

type Action =
  | { type: "SET_CAN_GO_BACK"; payload: { state: boolean } }
  | {
      type: "ADD_ENTRY";
      payload: { question: Question; selectedAnswers: string[] };
    }
  | {
      type: "SET_CURRENT_QUESTION";
      payload: { question: Question };
    }
  | {
      type: "INIT";
      payload: {
        id: string;
        currentQuestion: Question;
        entries: HistoryEntry[];
      };
    }
  | { type: "RESET"; payload: { id: string } };

export const initialRuntime: RuntimeState = {
  history: {
    id: "",
    currentQuestion: null,
    entries: [],
  } as QuizHistory,
  canGoBack: false,
};

export function runtimeReducer(
  state: RuntimeState,
  action: Action,
): RuntimeState {
  switch (action.type) {
    case "SET_CAN_GO_BACK": {
      return { ...state, canGoBack: action.payload.state };
    }

    case "ADD_ENTRY": {
      // Max 50 history entries
      const newHistory: HistoryEntry[] = [
        {
          entryId: crypto.randomUUID(),
          question: action.payload.question,
          selectedAnswers: action.payload.selectedAnswers,
        } as HistoryEntry,
        ...state.history.entries,
      ].slice(0, 50);

      return {
        ...state,
        history: {
          ...state.history,
          entries: newHistory,
        },
      };
    }

    case "SET_CURRENT_QUESTION": {
      return {
        ...state,
        history: {
          ...state.history,
          currentQuestion: action.payload.question,
        },
      };
    }

    case "INIT": {
      return {
        ...state,
        history: {
          id: action.payload.id,
          currentQuestion: action.payload.currentQuestion,
          entries: action.payload.entries,
        },
      };
    }

    case "RESET": {
      return {
        ...initialRuntime,
        history: {
          ...initialRuntime.history,
          id: action.payload.id,
        },
      };
    }

    default: {
      return state;
    }
  }
}
