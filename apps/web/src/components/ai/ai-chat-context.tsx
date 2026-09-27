"use client";

import type { Question } from "@testownik/core/quiz/types";
import { createContext, useContext } from "react";

interface AiChatContextValue {
  quizId: string;
  questionId: string | null;
  question: Question | null;
  canEdit: boolean;
}

const AiChatContext = createContext<AiChatContextValue | null>(null);

export const AiChatProvider = AiChatContext.Provider;

export function useAiChatContext() {
  const context = useContext(AiChatContext);
  if (context === null) {
    throw new Error("useAiChatContext must be used within AiChatProvider");
  }
  return context;
}
