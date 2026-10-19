"use client";

import type { UIMessage } from "ai";
import { createContext, use } from "react";

import type { PreviewQuizSession } from "@/components/testownik-preview/preview-session";

export interface ShowcaseSession {
  quiz: PreviewQuizSession;
  /** The AI demo's conversation, kept while another demo is open. */
  chatMessages: UIMessage[];
  saveChatMessages: (messages: UIMessage[]) => void;
}

export const ShowcaseSessionContext = createContext<ShowcaseSession | null>(
  null,
);

/** The showcase's shared quiz session; see `ShowcaseSessionProvider`. */
export function useShowcaseSession(): ShowcaseSession {
  const session = use(ShowcaseSessionContext);
  if (session === null) {
    throw new Error(
      "useShowcaseSession must be used within ShowcaseSessionProvider",
    );
  }
  return session;
}
