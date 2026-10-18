import { DEFAULT_USER_SETTINGS } from "@testownik/core/user/types";
import { describe, expect, it } from "vitest";

import {
  PREVIEW_PROGRESS,
  PREVIEW_QUESTIONS,
  PREVIEW_SESSION_ANSWERS,
} from "./preview-fixtures";
import {
  createQuizPreviewState,
  pickNextPreviewQuestion,
  quizPreviewReducer,
  selectQuizPreviewView,
} from "./preview-quiz-machine";
import type {
  QuizPreviewAction,
  QuizPreviewState,
} from "./preview-quiz-machine";

const settings = DEFAULT_USER_SETTINGS;

function run(
  state: QuizPreviewState,
  ...actions: QuizPreviewAction[]
): QuizPreviewState {
  return actions.reduce(
    (current, action) => quizPreviewReducer(current, action),
    state,
  );
}

const next: QuizPreviewAction = { type: "next", settings };

describe("quiz preview machine", () => {
  it("opens on the fixture progress", () => {
    const view = selectQuizPreviewView(createQuizPreviewState(), settings);

    expect(view.question?.id).toBe("q-83");
    expect(view.masteredCount).toBe(PREVIEW_PROGRESS.mastered);
    expect(view.correctAnswersCount).toBe(PREVIEW_PROGRESS.correct);
    expect(view.wrongAnswersCount).toBe(PREVIEW_PROGRESS.wrong);
    expect(view.totalQuestions).toBe(PREVIEW_PROGRESS.total);
    expect(view.canGoBack).toBe(true);
    expect(view.isHistoryQuestion).toBe(false);
  });

  it("keeps a single answer on single-choice questions", () => {
    const state = run(
      createQuizPreviewState(),
      { type: "select", answers: ["a-1"] },
      { type: "select", answers: ["a-1", "a-3"] },
    );
    expect(state.selectedAnswers).toEqual(["a-3"]);
  });

  it("keeps every answer on multiple-choice questions", () => {
    const state = run(createQuizPreviewState({ currentQuestionId: "q-27" }), {
      type: "select",
      answers: ["q-27-a1", "q-27-a2"],
    });
    expect(state.selectedAnswers).toEqual(["q-27-a1", "q-27-a2"]);
  });

  it("checks the answer, records it and moves the counters", () => {
    const initial = createQuizPreviewState();
    const checked = run(initial, { type: "select", answers: ["a-3"] }, next);
    const view = selectQuizPreviewView(checked, settings);

    expect(checked.questionChecked).toBe(true);
    expect(checked.answers).toHaveLength(PREVIEW_SESSION_ANSWERS.length + 1);
    expect(checked.answers[0]).toMatchObject({
      question: "q-83",
      selected_answers: ["a-3"],
      was_correct: true,
    });
    expect(view.correctAnswersCount).toBe(PREVIEW_PROGRESS.correct + 1);
    // wrong, correct, correct with one repetition and +1 per mistake.
    expect(view.masteredCount).toBe(PREVIEW_PROGRESS.mastered + 1);
    // Selection is frozen once checked.
    expect(
      quizPreviewReducer(checked, { type: "select", answers: ["a-1"] }),
    ).toBe(checked);
  });

  it("records a wrong answer when nothing is selected", () => {
    const checked = run(createQuizPreviewState(), next);
    expect(checked.answers[0]?.was_correct).toBe(false);
    expect(selectQuizPreviewView(checked, settings).wrongAnswersCount).toBe(
      PREVIEW_PROGRESS.wrong + 1,
    );
  });

  it("moves on to the next question that still needs practice", () => {
    const advanced = run(
      createQuizPreviewState(),
      { type: "select", answers: ["a-3"] },
      next,
      next,
    );
    expect(advanced.currentQuestionId).toBe("q-97");
    expect(advanced.selectedAnswers).toEqual([]);
    expect(advanced.questionChecked).toBe(false);

    // q-12 and q-27 are already mastered in the fixture history.
    expect(
      pickNextPreviewQuestion(
        PREVIEW_QUESTIONS,
        "q-104",
        PREVIEW_SESSION_ANSWERS,
        settings,
      ).id,
    ).toBe("q-41");
  });

  it("follows the settings when deciding what is mastered", () => {
    const strict = { ...settings, initial_reoccurrences: 3 };
    const view = selectQuizPreviewView(createQuizPreviewState(), strict);
    expect(view.masteredCount).toBe(PREVIEW_PROGRESS.mastered - 2);
    expect(
      pickNextPreviewQuestion(
        PREVIEW_QUESTIONS,
        "q-104",
        PREVIEW_SESSION_ANSWERS,
        strict,
      ).id,
    ).toBe("q-12");
  });

  it("never finishes, even when every sample question is mastered", () => {
    const allMastered = PREVIEW_QUESTIONS.map((question, index) => ({
      id: `m-${index.toString()}`,
      question: question.id,
      answered_at: new Date(2026, 0, 1, 0, index).toISOString(),
      selected_answers: [],
      was_correct: true,
    }));
    expect(
      pickNextPreviewQuestion(PREVIEW_QUESTIONS, "q-104", allMastered, settings)
        .id,
    ).toBe("q-12");
  });

  it("shows the previous answer and returns from it", () => {
    const back = run(createQuizPreviewState(), { type: "back" });
    const view = selectQuizPreviewView(back, settings);

    expect(view.isHistoryQuestion).toBe(true);
    expect(view.question?.id).toBe("q-41");
    expect(view.selectedAnswers).toEqual(["q-41-a2"]);
    expect(view.questionChecked).toBe(true);
    // Answering is paused while looking back.
    expect(quizPreviewReducer(back, next)).toBe(back);
    expect(
      quizPreviewReducer(back, { type: "select", answers: ["q-41-a1"] }),
    ).toBe(back);

    const returned = quizPreviewReducer(back, { type: "back" });
    expect(selectQuizPreviewView(returned, settings).question?.id).toBe("q-83");
  });

  it("does not go back without history or after checking", () => {
    const empty = createQuizPreviewState({ answers: [] });
    expect(quizPreviewReducer(empty, { type: "back" })).toBe(empty);
    expect(selectQuizPreviewView(empty, settings).canGoBack).toBe(false);

    const checked = run(createQuizPreviewState(), next);
    expect(quizPreviewReducer(checked, { type: "back" })).toBe(checked);
  });

  it("resets the session to zero like the app", () => {
    const reset = run(
      createQuizPreviewState(),
      { type: "select", answers: ["a-3"] },
      next,
      { type: "reset" },
    );
    const view = selectQuizPreviewView(reset, settings);

    expect(reset.answers).toEqual([]);
    expect(reset.questionChecked).toBe(false);
    expect(view.masteredCount).toBe(0);
    expect(view.correctAnswersCount).toBe(0);
    expect(view.wrongAnswersCount).toBe(0);
    expect(view.canGoBack).toBe(false);
    expect(view.progress).toBe(0);
  });

  it("toggles focus mode", () => {
    const on = run(createQuizPreviewState(), {
      type: "setFocusMode",
      active: true,
    });
    expect(on.focusMode).toBe(true);
    expect(
      quizPreviewReducer(on, { type: "setFocusMode", active: false }).focusMode,
    ).toBe(false);
  });
});
