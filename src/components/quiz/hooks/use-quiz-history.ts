import { useCallback, useEffect, useReducer } from "react";

import {
  initialRuntime,
  runtimeReducer,
} from "@/components/quiz/hooks/history-runtime-reducer.ts";
import type {
  UseHistoryLogicParameters,
  UseHistoryLogicResult,
} from "@/components/quiz/hooks/types.ts";
import type { Question } from "@/types/quiz.ts";

export interface HistoryEntry {
  entryId: string;
  question: Question;
  selectedAnswers: string[];
}

export interface QuizHistory {
  id: string;
  currentQuestion: Question | null;
  entries: HistoryEntry[];
}

export type QuizHistoryStorage = Record<string, QuizHistory>;

export function useQuizHistory({
  quizId,
}: UseHistoryLogicParameters): UseHistoryLogicResult {
  const readStorage = useCallback((): QuizHistory => {
    try {
      const raw = sessionStorage.getItem("quiz_history");
      if (raw == null) {
        return { id: quizId, currentQuestion: null, entries: [] };
      }

      const parsed = JSON.parse(raw) as QuizHistoryStorage;
      const parsedHistory = parsed[quizId];

      return {
        id: quizId,
        currentQuestion: null,
        entries: parsedHistory.entries,
      };
    } catch {
      return { id: quizId, currentQuestion: null, entries: [] };
    }
  }, [quizId]);

  const [runtime, dispatch] = useReducer(
    runtimeReducer,
    initialRuntime,
    () => ({
      id: quizId,
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

      // TODO fix - jak się odswierzy na poprzednim pytaniu to zostaje
      // TODO fix - na poprzednim pytaniu restart psuje quiz

      parsed[quizId satisfies string] = history;
      sessionStorage.setItem("quiz_history", JSON.stringify(parsed));
    } catch {}
  }, [history, quizId]);

  useEffect(() => {
    writeStorage();
    dispatch({
      type: "SET_CAN_GO_BACK",
      payload: { state: history.entries.length > 0 },
    });
  }, [history, writeStorage]);

  const addHistoryEntry = useCallback(
    (question: Question, selectedAnswers: string[]) => {
      dispatch({
        type: "ADD_ENTRY",
        payload: { question, selectedAnswers },
      });
    },
    [],
  );

  const setCurrentHistoryQuestion = useCallback((question: Question) => {
    dispatch({
      type: "SET_CURRENT_QUESTION",
      payload: { question },
    });
  }, []);

  const clearHistory = useCallback(() => {
    dispatch({
      type: "RESET",
      payload: {
        id: quizId,
      },
    });
  }, [quizId]);

  return {
    history,
    state: {
      canGoBack,
    },
    actions: {
      addHistoryEntry,
      setCurrentHistoryQuestion,
      clearHistory,
    },
  };
}
