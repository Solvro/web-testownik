"use client";

import { useQuery } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { UserSettings } from "@testownik/core/user/types";
import { DEFAULT_USER_SETTINGS } from "@testownik/core/user/types";
import { useReducer, useRef } from "react";

import { useStudyTimer } from "@/components/quiz/hooks/use-study-timer";
import { createPreviewClient } from "@/components/testownik-preview/preview-client";
import {
  createQuizPreviewState,
  quizPreviewReducer,
  selectQuizPreviewView,
} from "@/components/testownik-preview/preview-quiz-machine";
import type { PreviewQuizSession } from "@/components/testownik-preview/preview-session";
import { userSettingsQueryKey } from "@/hooks/use-user-settings";

/** Study time the previews open on, matching the tablet's stats. */
const PREVIEW_STUDY_TIME_SECONDS = 4836;

/**
 * The quiz session behind the device previews (see `preview-quiz-machine`).
 * The desktop stage shares one session between the laptop and the iPhone, so
 * an answer on either shows on both; the mobile hero owns its own for the CSS
 * phone.
 */
export function useQuizPreviewState(): PreviewQuizSession {
  const [state, dispatch] = useReducer(
    quizPreviewReducer,
    // The fixture opens with a wrong answer picked, ready to be checked.
    { selectedAnswers: ["a-4"] },
    createQuizPreviewState,
  );
  const clientReference = useRef<QueryClient | null>(null);
  clientReference.current ??= createPreviewClient();
  const client = clientReference.current;
  // Edited by the real settings dialog in either screen; never persisted.
  const { data: settings = DEFAULT_USER_SETTINGS } = useQuery<UserSettings>(
    {
      queryKey: userSettingsQueryKey,
      queryFn: () => DEFAULT_USER_SETTINGS,
    },
    client,
  );
  const timer = useStudyTimer(false, PREVIEW_STUDY_TIME_SECONDS);

  return {
    state,
    view: selectQuizPreviewView(state, settings),
    select: (answers) => {
      dispatch({ type: "select", answers });
    },
    next: () => {
      dispatch({ type: "next", settings });
    },
    back: () => {
      dispatch({ type: "back" });
    },
    reset: () => {
      dispatch({ type: "reset" });
      timer.setFromLoaded(0);
    },
    setFocusMode: (active) => {
      dispatch({ type: "setFocusMode", active });
    },
    timer: timer.store,
    client,
  };
}
