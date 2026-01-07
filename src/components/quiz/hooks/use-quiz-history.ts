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

interface QuizHistory {
  question: Question;
  answers: number[];
}
type QuizHistoryStorage = Record<string, QuizHistory>;

export function useQuizHistory({
  quizId,
}: UseQuizHistoryLogicParameters): UseQuizHistoryLogicResult {
  const initRef = useRef(false);
  const historyRef = useRef<QuizHistory[]>([]);

  const [runtime, dispatch] = useReducer(runtimeReducer, initialRuntime);

  const { canGoBack } = runtime;

  const getStorage = useCallback(() => {
    const storage = sessionStorage.getItem("quiz_history");
    if (storage == null) {
      return;
    }

    try {
      return JSON.parse(storage) as QuizHistoryStorage;
    } catch {}
  }, []);

  const updateStorage = useCallback(() => {
    const json = {
      [quizId]: historyRef.current,
    };
    sessionStorage.setItem("quiz_history", JSON.stringify(json));
  }, [quizId]);

  // Initial load
  useEffect(() => {
    if (initRef.current) {
      return;
    }
    initRef.current = true;

    const jsonStorage = getStorage();
    if (jsonStorage?.[quizId] === undefined) {
      return;
    }

    historyRef.current = jsonStorage[quizId] as unknown as QuizHistory[];
  });

  const addHistoryEntry = useCallback(
    (question: Question, answers: number[]) => {
      const currentHistory = historyRef.current.find(
        (history) => history.question.id === question.id,
      );

      if (currentHistory == null) {
        historyRef.current.unshift({ question, answers });
      } else {
        currentHistory.answers = answers;
      }

      if (historyRef.current.length >= 2) {
        dispatch({
          type: "MARK_CAN_GO_BACK",
          payload: true,
        });
      }

      updateStorage();

      // historyRef.current.push({ question, answers });
      // if (historyRef.current.length === 2) {
      //   // dispatch({
      //   //   type: "MARK_CAN_GO_BACK",
      //   // });
      // }
      // if (historyRef.current.length > 2) {
      //   historyRef.current.shift();
      // }
    },
    [updateStorage],
  );

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
      clearHistory,
    },
  };
}
