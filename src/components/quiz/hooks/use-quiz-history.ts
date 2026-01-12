// useQuizHistory.ts
import { useCallback, useEffect, useReducer, useRef } from "react";

import {
  initialRuntime,
  runtimeReducer,
} from "@/components/quiz/hooks/quiz-history-runtime-reducer.ts";
import type {
  UseQuizHistoryLogicParameters,
  UseQuizHistoryLogicResult,
} from "@/components/quiz/hooks/types.ts";
import type { Question } from "@/types/quiz.ts";

export interface QuizHistory {
  question: Question;
  answers: number[];
}

export type QuizHistoryStorage = Record<string, QuizHistory[]>;

export function useQuizHistory({
  quizId,
}: UseQuizHistoryLogicParameters): UseQuizHistoryLogicResult {
  const historyRef = useRef<QuizHistory[]>([]);
  const initRef = useRef(false);

  const [runtime, dispatch] = useReducer(runtimeReducer, initialRuntime);
  const { canGoBack } = runtime;
  const canGoBackRef = useRef<boolean>(false);

  const readStorage = useCallback((): QuizHistory[] => {
    try {
      const raw = sessionStorage.getItem("quiz_history");
      if (raw == null) {
        return [];
      }
      const parsed = JSON.parse(raw) as QuizHistoryStorage;
      return parsed[quizId] ?? [];
    } catch {
      return [];
    }
  }, [quizId]);

  const writeStorage = useCallback(() => {
    try {
      const raw = sessionStorage.getItem("quiz_history");
      const parsed: QuizHistoryStorage =
        raw == null ? {} : (JSON.parse(raw) as QuizHistoryStorage);
      parsed[quizId] = historyRef.current;
      sessionStorage.setItem("quiz_history", JSON.stringify(parsed));
    } catch {}
  }, [quizId]);

  // init
  useEffect(() => {
    historyRef.current = readStorage();

    dispatch({
      type: "SET_CAN_GO_BACK",
      payload: historyRef.current.length >= 2,
    });

    initRef.current = true;
  }, [readStorage]);

  // effects to keep refs updated
  useEffect(() => {
    canGoBackRef.current = canGoBack;
  }, [canGoBack]);

  const addHistoryEntry = useCallback(
    (question: Question, answers: number[]) => {
      const existing = historyRef.current.find(
        (h) => h.question.id === question.id,
      );

      if (existing == null) {
        historyRef.current.unshift({ question, answers });
      } else {
        existing.answers = answers;
      }

      const nextCanGoBack = historyRef.current.length >= 2;

      dispatch({
        type: "SET_CAN_GO_BACK",
        payload: nextCanGoBack,
      });

      writeStorage();

      return nextCanGoBack;
    },
    [writeStorage],
  );

  const getHistory = useCallback((limit?: number) => {
    return limit == null
      ? historyRef.current
      : historyRef.current.slice(0, limit);
  }, []);

  const clearHistory = useCallback(() => {
    historyRef.current = [];

    dispatch({
      type: "SET_CAN_GO_BACK",
      payload: false,
    });

    writeStorage();
  }, [writeStorage]);

  return {
    state: {
      canGoBack: canGoBackRef.current,
    },
    actions: {
      addHistoryEntry,
      getHistory,
      clearHistory,
    },
  };
}
