"use client";

import { createContext, use } from "react";

import type { PreviewQuizSession } from "@/app/(landing)/preview/preview-session";
import type { ChatRuntimeValue } from "@/components/ai/chat-runtime";

import type { Failure } from "./showcase-chat";

export interface ShowcaseSession {
  quiz: PreviewQuizSession;
  /** Owned above the tabs, so hidden chat views keep receiving the stream. */
  chatRuntime: ChatRuntimeValue;
  chatFailure: Failure | null;
  newConversation: () => void;
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
