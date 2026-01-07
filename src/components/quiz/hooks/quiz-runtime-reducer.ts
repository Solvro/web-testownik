import type { Question, Reoccurrence } from "@/types/quiz.ts";

export interface RuntimeState {
  currentQuestion: Question | null;
  selectedAnswers: number[];
  questionChecked: boolean;
  correctAnswersCount: number;
  wrongAnswersCount: number;
  reoccurrences: Reoccurrence[];
  isQuizFinished: boolean;
  isPreviousQuestion: boolean;
  showBrainrot: boolean;
}

export type Action =
  | { type: "SET_SELECTED_ANSWERS"; payload: number[] }
  | { type: "SET_CURRENT_QUESTION"; payload: { question: Question | null } }
  | { type: "MARK_FINISHED" }
  | { type: "SET_IS_PREVIOUS_QUESTION"; payload: { state: boolean } }
  | { type: "INIT_REOCCURRENCES"; payload: { reoccurrences: Reoccurrence[] } }
  | {
      type: "APPLY_LOADED_PROGRESS";
      payload: {
        reoccurrences: Reoccurrence[];
        question: Question | null;
        correct: number;
        wrong: number;
        finished: boolean;
      };
    }
  | {
      type: "CHECK_ANSWER";
      payload: { selectedAnswers: number[]; wrongAnswerReoccurrences: number };
    }
  | {
      type: "RESET_PROGRESS";
      payload: { reoccurrences: Reoccurrence[]; question: Question | null };
    }
  | { type: "TOGGLE_BRAINROT" };

export const initialRuntime: RuntimeState = {
  currentQuestion: null,
  selectedAnswers: [],
  questionChecked: false,
  correctAnswersCount: 0,
  wrongAnswersCount: 0,
  reoccurrences: [],
  isQuizFinished: false,
  isPreviousQuestion: false,
  showBrainrot: false,
};

export function computeFinished(
  reo: Reoccurrence[],
  q: Question | null,
): boolean {
  return q == null && !reo.some((r) => r.reoccurrences > 0);
}

export function runtimeReducer(
  state: RuntimeState,
  action: Action,
): RuntimeState {
  switch (action.type) {
    case "SET_SELECTED_ANSWERS": {
      return { ...state, selectedAnswers: action.payload };
    }
    case "SET_CURRENT_QUESTION": {
      const isFinished = computeFinished(
        state.reoccurrences,
        action.payload.question,
      );
      return {
        ...state,
        currentQuestion: action.payload.question,
        selectedAnswers: [],
        questionChecked: false,
        isQuizFinished: isFinished,
      };
    }
    case "MARK_FINISHED": {
      return { ...state, isQuizFinished: true, currentQuestion: null };
    }
    case "SET_IS_PREVIOUS_QUESTION": {
      return { ...state, isPreviousQuestion: action.payload.state };
    }
    case "INIT_REOCCURRENCES": {
      return { ...state, reoccurrences: action.payload.reoccurrences };
    }
    case "APPLY_LOADED_PROGRESS": {
      return {
        ...state,
        reoccurrences: action.payload.reoccurrences,
        currentQuestion: action.payload.question,
        correctAnswersCount: action.payload.correct,
        wrongAnswersCount: action.payload.wrong,
        questionChecked: false,
        isQuizFinished: action.payload.finished,
      };
    }
    case "CHECK_ANSWER": {
      if (state.questionChecked || state.currentQuestion == null) {
        return state;
      }
      const correctIndexes = state.currentQuestion.answers
        .map((a, index) => (a.correct ? index : -1))
        .filter((index) => index !== -1);
      const isCorrect =
        correctIndexes.length === action.payload.selectedAnswers.length &&
        correctIndexes.every((ci) =>
          action.payload.selectedAnswers.includes(ci),
        );
      const updatedReo = state.reoccurrences.map((r) =>
        r.id === state.currentQuestion?.id
          ? isCorrect
            ? { ...r, reoccurrences: Math.max(r.reoccurrences - 1, 0) }
            : {
                ...r,
                reoccurrences:
                  r.reoccurrences + action.payload.wrongAnswerReoccurrences,
              }
          : r,
      );
      return {
        ...state,
        questionChecked: true,
        correctAnswersCount: state.correctAnswersCount + (isCorrect ? 1 : 0),
        wrongAnswersCount: state.wrongAnswersCount + (isCorrect ? 0 : 1),
        reoccurrences: updatedReo,
      };
    }
    case "RESET_PROGRESS": {
      return {
        ...initialRuntime,
        reoccurrences: action.payload.reoccurrences,
        currentQuestion: action.payload.question,
        isPreviousQuestion: false,
        isQuizFinished: computeFinished(
          action.payload.reoccurrences,
          action.payload.question,
        ),
      };
    }
    case "TOGGLE_BRAINROT": {
      return { ...state, showBrainrot: !state.showBrainrot };
    }
    default: {
      return state;
    }
  }
}
