export interface RuntimeState {
  canGoBack: boolean;
}

export type Action = { type: "MARK_CAN_GO_BACK"; payload: boolean };

export const initialRuntime: RuntimeState = {
  canGoBack: false,
};

export function runtimeReducer(
  state: RuntimeState,
  action: Action,
): RuntimeState {
  switch (action.type) {
    case "MARK_CAN_GO_BACK": {
      return { ...state, canGoBack: action.payload };
    }
    default: {
      return state;
    }
  }
}
