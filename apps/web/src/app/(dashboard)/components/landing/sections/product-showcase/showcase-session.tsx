"use client";

import type { UIMessage } from "ai";
import { useState } from "react";
import type { ReactNode } from "react";

import { useQuizPreviewState } from "../../hooks/use-quiz-preview-state";
import { SHOWCASE_QUIZ, SHOWCASE_STUDY_TIME_SECONDS } from "./showcase-quiz";
import { ShowcaseSessionContext } from "./showcase-session-context";

/**
 * One quiz session for the whole showcase. Only the open demo is mounted, so
 * the session lives above them: what the visitor answers in the quiz demo
 * is the assistant's context in the AI demo, and the questions the assistant
 * adds or edits are in the quiz when the visitor switches back. It is not
 * synced with the hero's devices.
 */
export function ShowcaseSessionProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const quiz = useQuizPreviewState({
    quiz: SHOWCASE_QUIZ,
    studyTimeSeconds: SHOWCASE_STUDY_TIME_SECONDS,
  });
  const [chatMessages, setChatMessages] = useState<UIMessage[]>([]);

  return (
    <ShowcaseSessionContext
      value={{ quiz, chatMessages, saveChatMessages: setChatMessages }}
    >
      {children}
    </ShowcaseSessionContext>
  );
}
