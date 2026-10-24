"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";

import { PREVIEW_QUIZ } from "@/app/(landing)/preview/preview-fixtures";
import { ChatRuntime } from "@/components/ai/chat-runtime";

import { useQuizPreviewState } from "../../hooks/use-quiz-preview-state";
import { SUGGESTIONS, createShowcaseChatTransport } from "./showcase-chat";
import type { Failure } from "./showcase-chat";
import { SHOWCASE_QUIZ, SHOWCASE_STUDY_TIME_SECONDS } from "./showcase-quiz";
import { ShowcaseSessionContext } from "./showcase-session-context";

/**
 * One quiz session for the whole showcase. Only the open demo is mounted, so
 * the quiz session and chat runtime live above them. What the visitor answers
 * in the quiz demo is the assistant's context, and the questions the assistant
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
  const [chatFailure, setChatFailure] = useState<Failure | null>(null);
  const transport = createShowcaseChatTransport(setChatFailure);

  return (
    <QueryClientProvider client={quiz.client}>
      <ChatRuntime
        quizId={PREVIEW_QUIZ.id}
        quiz={PREVIEW_QUIZ}
        question={quiz.view.question}
        questions={quiz.state.questions}
        canEdit
        transport={transport}
        suggestions={SUGGESTIONS}
      >
        {(chatRuntime) => (
          <ShowcaseSessionContext
            value={{
              quiz,
              chatRuntime,
              chatFailure,
              newConversation: () => {
                chatRuntime.clearError();
                chatRuntime.setMessages([]);
                setChatFailure(null);
              },
            }}
          >
            {children}
          </ShowcaseSessionContext>
        )}
      </ChatRuntime>
    </QueryClientProvider>
  );
}
