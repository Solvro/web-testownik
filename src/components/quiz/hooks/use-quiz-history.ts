import { useCallback, useEffect, useReducer } from "react";

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
  id: string;
  question: Question;
  answers: number[];
}

export type QuizHistoryStorage = Record<string, QuizHistory[]>;

export function useQuizHistory({
  quizId,
}: UseQuizHistoryLogicParameters): UseQuizHistoryLogicResult {
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

  const [runtime, dispatch] = useReducer(
    runtimeReducer,
    initialRuntime,
    () => ({
      history: readStorage(),
      canGoBack: false,
    }),
  );
  const { history, canGoBack } = runtime;

  const writeStorage = useCallback(() => {
    try {
      const raw = sessionStorage.getItem("quiz_history");
      const parsed: QuizHistoryStorage =
        raw == null ? {} : (JSON.parse(raw) as QuizHistoryStorage);

      parsed[quizId satisfies string] = history.slice(1);
      sessionStorage.setItem("quiz_history", JSON.stringify(parsed));
    } catch {}
  }, [history, quizId]);

  useEffect(() => {
    writeStorage();
    dispatch({
      type: "SET_CAN_GO_BACK",
      payload: history.length >= 2,
    });
  }, [history, writeStorage]);

  const addHistoryEntry = useCallback(
    (question: Question, answers: number[]) => {
      dispatch({
        type: "ADD_ENTRY",
        payload: { question, answers },
      });
    },
    [],
  );

  const updateHistoryEntry = useCallback((answers: number[]) => {
    dispatch({
      type: "UPDATE_ENTRY",
      payload: { answers },
    });
  }, []);

  const clearHistory = useCallback(() => {
    dispatch({
      type: "RESET",
    });
  }, []);

  return {
    history,
    state: {
      canGoBack,
    },
    actions: {
      addHistoryEntry,
      updateHistoryEntry,
      clearHistory,
    },
  };
}
