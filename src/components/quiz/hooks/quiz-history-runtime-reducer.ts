// quiz-history-runtime.ts
export interface QuizHistoryRuntime {
  canGoBack: boolean;
}

export const initialRuntime: QuizHistoryRuntime = {
  canGoBack: false,
};

type Action = { type: "SET_CAN_GO_BACK"; payload: boolean } | { type: "RESET" };

export function runtimeReducer(
  state: QuizHistoryRuntime,
  action: Action,
): QuizHistoryRuntime {
  switch (action.type) {
    case "SET_CAN_GO_BACK": {
      return { ...state, canGoBack: action.payload };
    }

    case "RESET": {
      return initialRuntime;
    }

    default: {
      return state;
    }
  }
}
