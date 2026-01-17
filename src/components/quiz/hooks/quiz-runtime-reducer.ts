import {
  getAnswerCounts,
  isQuizComplete,
  pickNextQuestion,
} from "@/lib/session-utils.ts";
import type { AnswerRecord, Question } from "@/types/quiz.ts";

export interface ProgressSettings {
  initialReoccurrences: number;
  wrongAnswerReoccurrences: number;
}

export interface RuntimeState {
  // Current question state
  currentQuestion: Question | null;
  selectedAnswers: string[];
  questionChecked: boolean;

  // Next question is determined after answer is checked
  nextQuestion: Question | null;

  // Quiz state
  questions: Question[];
  settings: ProgressSettings;
  answers: AnswerRecord[];
  isQuizFinished: boolean;

  // UI state
  showBrainrot: boolean;
}

export type Action =
  | { type: "SET_SELECTED_ANSWERS"; payload: string[] }
  | { type: "SET_CURRENT_QUESTION"; payload: { question: Question | null } }
  | { type: "MARK_FINISHED" }
  | {
      type: "INIT_SESSION";
      payload: {
        questions: Question[];
        settings: ProgressSettings;
        answers?: AnswerRecord[];
        currentQuestionId?: string | null;
      };
    }
  | {
      type: "APPLY_LOADED_PROGRESS";
      payload: {
        answers: AnswerRecord[];
        question: Question | null;
        finished: boolean;
      };
    }
  | {
      type: "RECORD_ANSWER";
      payload: {
        answer: AnswerRecord;
        nextQuestion: Question | null;
      };
    }
  | {
      type: "ADVANCE_QUESTION";
    }
  | {
      type: "RESET_PROGRESS";
    }
  | { type: "TOGGLE_BRAINROT" };

export const initialRuntime: RuntimeState = {
  answers: [],
  currentQuestion: null,
  nextQuestion: null,
  selectedAnswers: [],
  questionChecked: false,
  questions: [],
  settings: { initialReoccurrences: 1, wrongAnswerReoccurrences: 1 },
  isQuizFinished: false,
  showBrainrot: false,
};

/**
 * Create a new answer record for the current question.
 */
export function createAnswerRecord(
  questionId: string,
  selectedAnswers: string[],
  wasCorrect: boolean,
): AnswerRecord {
  return {
    id: crypto.randomUUID(),
    question: questionId,
    answered_at: new Date().toISOString(),
    selected_answers: selectedAnswers,
    was_correct: wasCorrect,
  };
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
      const isFinished =
        action.payload.question === null &&
        isQuizComplete(state.questions, state.answers, state.settings);

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

    case "INIT_SESSION": {
      const { questions, settings, answers, currentQuestionId } =
        action.payload;

      let firstQuestion: Question | null = null;
      if (currentQuestionId !== undefined && currentQuestionId !== null) {
        const savedQuestion = questions.find((q) => q.id === currentQuestionId);
        if (savedQuestion !== undefined) {
          firstQuestion = {
            ...savedQuestion,
            answers: savedQuestion.answers.toSorted(() => Math.random() - 0.5),
          };
        }
      }

      // Fall back to picking next if no saved question found
      firstQuestion ??= pickNextQuestion(
        questions,
        answers ?? [],
        settings,
        null,
      );

      const isFinished =
        firstQuestion === null &&
        isQuizComplete(questions, answers ?? [], settings);

      return {
        ...state,
        questions,
        settings,
        answers: answers ?? [],
        currentQuestion: firstQuestion,
        selectedAnswers: [],
        questionChecked: false,
        isQuizFinished: isFinished,
      };
    }

    case "APPLY_LOADED_PROGRESS": {
      return {
        ...state,
        answers: action.payload.answers,
        currentQuestion: action.payload.question,
        questionChecked: false,
        isQuizFinished: action.payload.finished,
      };
    }

    case "RECORD_ANSWER": {
      if (state.questionChecked || state.currentQuestion === null) {
        return state;
      }

      const { answer, nextQuestion } = action.payload;
      const updatedAnswers = [...state.answers, answer];

      return {
        ...state,
        questionChecked: true,
        answers: updatedAnswers,
        nextQuestion,
      };
    }

    case "ADVANCE_QUESTION": {
      const isFinished =
        state.nextQuestion === null &&
        isQuizComplete(state.questions, state.answers, state.settings);

      return {
        ...state,
        currentQuestion: state.nextQuestion,
        selectedAnswers: [],
        questionChecked: false,
        isQuizFinished: isFinished,
      };
    }

    case "RESET_PROGRESS": {
      const firstQuestion = pickNextQuestion(
        state.questions,
        [],
        state.settings,
        null,
      );

      return {
        ...state,
        answers: [],
        currentQuestion: firstQuestion,
        selectedAnswers: [],
        questionChecked: false,
        isQuizFinished: false,
        nextQuestion: null,
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

/**
 * Selectors to derive computed values from state.
 */
export function selectAnswerCounts(state: RuntimeState): {
  correct: number;
  wrong: number;
} {
  return getAnswerCounts(state.answers);
}
