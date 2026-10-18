import {
  checkAnswerCorrectness,
  getAnswerCounts,
  getMasteredCount,
  getRemainingAttempts,
} from "@testownik/core/quiz/session";
import type { AnswerRecord, Question } from "@testownik/core/quiz/types";
import type { UserSettings } from "@testownik/core/user/types";
import { DEFAULT_USER_SETTINGS } from "@testownik/core/user/types";

import {
  PREVIEW_NOW,
  PREVIEW_PROGRESS,
  PREVIEW_QUESTIONS,
  PREVIEW_SESSION_ANSWERS,
  PREVIEW_START_QUESTION_ID,
} from "./preview-fixtures";

/**
 * The quiz session behind the landing-page previews, as a pure reducer.
 *
 * It mirrors what `useQuizLogic` does in the app — select, check, move on,
 * look back at the previous answer, reset — with the session held in memory
 * instead of the API. Progress is computed with the same `core/quiz/session`
 * helpers the app uses, so the per-question counters and mastered count react
 * to the (preview-local) settings exactly as they would in Testownik.
 *
 * Unlike the app it is deterministic: the next question is the next one in
 * quiz order that still needs practice, record ids and timestamps come from a
 * counter, and the quiz never finishes (the finished screen loads a remote
 * animation). Two screens can therefore share one state and render the same
 * thing, and the reducer is trivially testable.
 */

/** Progress outside the sample questions. A reset zeroes it, as in the app. */
export interface PreviewProgressBaseline {
  mastered: number;
  correct: number;
  wrong: number;
}

export interface QuizPreviewState {
  questions: Question[];
  currentQuestionId: string;
  selectedAnswers: string[];
  questionChecked: boolean;
  /** This session's answers, newest first like `current_session.answers`. */
  answers: AnswerRecord[];
  /** Set while the back button shows the previously answered question. */
  historyQuestionId: string | null;
  baseline: PreviewProgressBaseline;
  focusMode: boolean;
  /** Answers recorded so far; drives ids and timestamps. */
  recorded: number;
}

export type QuizPreviewAction =
  | { type: "select"; answers: string[] }
  | { type: "next"; settings: UserSettings }
  | { type: "back" }
  | { type: "reset" }
  | { type: "setFocusMode"; active: boolean };

export function createQuizPreviewState({
  questions = PREVIEW_QUESTIONS,
  answers = PREVIEW_SESSION_ANSWERS,
  currentQuestionId = PREVIEW_START_QUESTION_ID,
  selectedAnswers = [],
  progress = PREVIEW_PROGRESS,
}: {
  questions?: Question[];
  answers?: AnswerRecord[];
  currentQuestionId?: string;
  selectedAnswers?: string[];
  progress?: PreviewProgressBaseline;
} = {}): QuizPreviewState {
  // The fixture totals already include what the sample history contributes,
  // so that part is taken out of the baseline and recomputed live.
  const counts = getAnswerCounts(answers);
  return {
    questions,
    currentQuestionId,
    selectedAnswers,
    questionChecked: false,
    answers,
    historyQuestionId: null,
    baseline: {
      mastered:
        progress.mastered -
        getMasteredCount(questions, answers, DEFAULT_USER_SETTINGS),
      correct: progress.correct - counts.correct,
      wrong: progress.wrong - counts.wrong,
    },
    focusMode: false,
    recorded: 0,
  };
}

function findQuestion(
  state: QuizPreviewState,
  id: string | null,
): Question | null {
  return id === null
    ? null
    : (state.questions.find((question) => question.id === id) ?? null);
}

/**
 * The next question in quiz order after the current one that still has
 * attempts left. When everything is mastered it simply moves on, so the
 * preview keeps going.
 */
export function pickNextPreviewQuestion(
  questions: Question[],
  currentQuestionId: string,
  answers: AnswerRecord[],
  settings: UserSettings,
): Question {
  const start = questions.findIndex(({ id }) => id === currentQuestionId);
  const ordered = questions.map(
    (_, offset) => questions[(start + 1 + offset) % questions.length],
  );
  return (
    ordered.find(
      (question) =>
        question.id !== currentQuestionId &&
        getRemainingAttempts(question.id, answers, settings) > 0,
    ) ?? ordered[0]
  );
}

function recordAnswer(state: QuizPreviewState): QuizPreviewState {
  const question = findQuestion(state, state.currentQuestionId);
  if (question === null) {
    return state;
  }
  const recorded = state.recorded + 1;
  const answer: AnswerRecord = {
    id: `preview-answer-${recorded.toString()}`,
    question: question.id,
    // After every fixture answer, a minute apart.
    answered_at: new Date(
      PREVIEW_NOW.getTime() + recorded * 60_000,
    ).toISOString(),
    selected_answers: state.selectedAnswers,
    was_correct: checkAnswerCorrectness(question, state.selectedAnswers),
  };
  return {
    ...state,
    answers: [answer, ...state.answers],
    questionChecked: true,
    recorded,
  };
}

export function quizPreviewReducer(
  state: QuizPreviewState,
  action: QuizPreviewAction,
): QuizPreviewState {
  switch (action.type) {
    case "select": {
      if (state.questionChecked || state.historyQuestionId !== null) {
        return state;
      }
      const question = findQuestion(state, state.currentQuestionId);
      // As on the quiz page: a single-choice question keeps one answer.
      const selectedAnswers =
        question?.multiple === false
          ? action.answers.slice(-1)
          : action.answers;
      return { ...state, selectedAnswers };
    }
    case "next": {
      if (state.historyQuestionId !== null) {
        return state;
      }
      if (!state.questionChecked) {
        return recordAnswer(state);
      }
      return {
        ...state,
        currentQuestionId: pickNextPreviewQuestion(
          state.questions,
          state.currentQuestionId,
          state.answers,
          action.settings,
        ).id,
        selectedAnswers: [],
        questionChecked: false,
      };
    }
    case "back": {
      if (state.historyQuestionId !== null) {
        return { ...state, historyQuestionId: null };
      }
      if (state.answers.length === 0 || state.questionChecked) {
        return state;
      }
      return { ...state, historyQuestionId: state.answers[0].question };
    }
    case "reset": {
      return {
        ...state,
        selectedAnswers: [],
        questionChecked: false,
        answers: [],
        historyQuestionId: null,
        baseline: { mastered: 0, correct: 0, wrong: 0 },
      };
    }
    case "setFocusMode": {
      return { ...state, focusMode: action.active };
    }
  }
}

/** What a screen renders for a given state, in `QuestionCard` / `QuizInfoCard` terms. */
export interface QuizPreviewView {
  question: Question | null;
  selectedAnswers: string[];
  questionChecked: boolean;
  isHistoryQuestion: boolean;
  canGoBack: boolean;
  answers: AnswerRecord[];
  correctAnswersCount: number;
  wrongAnswersCount: number;
  masteredCount: number;
  totalQuestions: number;
  /** Mastered share of the whole quiz, 0–100. */
  progress: number;
}

export function selectQuizPreviewView(
  state: QuizPreviewState,
  settings: UserSettings,
  totalQuestions = PREVIEW_PROGRESS.total,
): QuizPreviewView {
  const historyQuestion = findQuestion(state, state.historyQuestionId);
  const counts = getAnswerCounts(state.answers);
  const masteredCount = Math.min(
    totalQuestions,
    state.baseline.mastered +
      getMasteredCount(state.questions, state.answers, settings),
  );

  return {
    question: historyQuestion ?? findQuestion(state, state.currentQuestionId),
    // The app shows the answer given back then, already checked.
    selectedAnswers:
      historyQuestion === null
        ? state.selectedAnswers
        : (state.answers.find(
            (answer) => answer.question === historyQuestion.id,
          )?.selected_answers ?? []),
    questionChecked: historyQuestion === null ? state.questionChecked : true,
    isHistoryQuestion: historyQuestion !== null,
    canGoBack: state.answers.length > 0,
    answers: state.answers,
    correctAnswersCount: state.baseline.correct + counts.correct,
    wrongAnswersCount: state.baseline.wrong + counts.wrong,
    masteredCount,
    totalQuestions,
    progress: totalQuestions > 0 ? (masteredCount / totalQuestions) * 100 : 0,
  };
}
