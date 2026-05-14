"use client";

import { createContext, useContext } from "react";

interface AiChatContextValue {
  quizId: string;
  questionId: string | null;
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
