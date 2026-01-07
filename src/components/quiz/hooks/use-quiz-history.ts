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

type QuizHistoryStorage = Record<string, QuizHistory[]>;

export function useQuizHistory({
  quizId,
}: UseQuizHistoryLogicParameters): UseQuizHistoryLogicResult {
  const initRef = useRef(false);
  const historyRef = useRef<QuizHistory[]>([]);

  const getStorage = useCallback(() => {
    const storage = sessionStorage.getItem("quiz_history");
    if (storage == null) {
      return;
    }

    try {
      return JSON.parse(storage) as QuizHistoryStorage;
    } catch {}
  }, []);

  const [runtime, dispatch] = useReducer(runtimeReducer, initialRuntime, () => {
    try {
      const history = getStorage()?.[quizId] ?? [];

      historyRef.current = history;

      return {
        ...initialRuntime,
        canGoBack: history.length >= 2,
      };
    } catch {
      return initialRuntime;
    }
  });

  const { canGoBack } = runtime;

  const updateStorage = useCallback(() => {
    const storage = getStorage() ?? {};
    storage[quizId] = historyRef.current;
    sessionStorage.setItem("quiz_history", JSON.stringify(storage));
  }, [quizId, getStorage]);

  useEffect(() => {
    if (initRef.current) {
      return;
    }
    initRef.current = true;

    const storage = getStorage();
    if (storage?.[quizId] == null) {
      return;
    }

    historyRef.current = storage[quizId];

    dispatch({
      type: "MARK_CAN_GO_BACK",
      payload: historyRef.current.length >= 2,
    });
  }, [getStorage, quizId]);

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

      dispatch({
        type: "MARK_CAN_GO_BACK",
        payload: historyRef.current.length >= 2,
      });

      updateStorage();
    },
    [updateStorage],
  );

  const getHistory = useCallback((length?: number) => {
    return length === undefined
      ? historyRef.current
      : historyRef.current.slice(0, length);
  }, []);

  const clearHistory = useCallback(() => {
    historyRef.current = [];

    dispatch({
      type: "MARK_CAN_GO_BACK",
      payload: false,
    });

    updateStorage();
  }, [updateStorage]);

  return {
    state: {
      canGoBack,
    },
    actions: {
      addHistoryEntry,
      getHistory,
      clearHistory,
    },
  };
}
