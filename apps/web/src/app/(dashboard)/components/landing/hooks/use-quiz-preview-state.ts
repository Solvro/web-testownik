"use client";

import { hashKey, useQuery } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { UserSettings } from "@testownik/core/user/types";
import { DEFAULT_USER_SETTINGS } from "@testownik/core/user/types";
import { useEffect, useReducer, useRef } from "react";

import { useStudyTimer } from "@/components/quiz/hooks/use-study-timer";
import { createPreviewClient } from "@/components/testownik-preview/preview-client";
import {
  createQuizPreviewState,
  selectQuizPreviewView,
} from "@/components/testownik-preview/preview-quiz-machine";
import type { QuizPreviewAction } from "@/components/testownik-preview/preview-quiz-machine";
import {
  createSyncedQuizState,
  openQuizSyncChannel,
  respondToQuizSyncMessage,
  syncedQuizReducer,
} from "@/components/testownik-preview/preview-quiz-sync";
import type {
  QuizSyncChannel,
  SyncedQuizState,
} from "@/components/testownik-preview/preview-quiz-sync";
import type { PreviewQuizSession } from "@/components/testownik-preview/preview-session";
import { userSettingsQueryKey } from "@/hooks/use-user-settings";

/** Study time the previews open on, matching the tablet's stats. */
const PREVIEW_STUDY_TIME_SECONDS = 4836;

const SETTINGS_HASH = hashKey(userSettingsQueryKey);

type QuizPreviewOptions = Parameters<typeof createQuizPreviewState>[0];

/**
 * The quiz session behind the device previews (see `preview-quiz-machine`).
 *
 * The mobile hero's CSS phone owns one on its own. On the desktop stage the
 * laptop and the iPhone are separate iframes, each with its own session; give
 * both the same `syncChannel` and every action and settings change is
 * forwarded to the other (see `preview-quiz-sync`), so an answer on either
 * shows on both.
 *
 * Question writes through the session's services (the assistant saving or
 * editing a question) become actions too, so they reach the quiz and, with a
 * `syncChannel`, the other screen.
 */
export function useQuizPreviewState({
  syncChannel,
  // The fixture opens with a wrong answer picked, ready to be checked.
  quiz = { selectedAnswers: ["a-4"] },
  studyTimeSeconds = PREVIEW_STUDY_TIME_SECONDS,
}: {
  syncChannel?: string;
  /** The quiz the session opens on; read once. */
  quiz?: QuizPreviewOptions;
  studyTimeSeconds?: number;
} = {}): PreviewQuizSession {
  const [synced, dispatch] = useReducer(syncedQuizReducer, quiz, (options) =>
    createSyncedQuizState(createQuizPreviewState(options)),
  );
  const { state } = synced;
  // What the services read and write. Kept ahead of the state so two writes
  // before a render still number their questions apart.
  const questionsReference = useRef(state.questions);
  const actReference = useRef<(action: QuizPreviewAction) => void>(() => {
    // Replaced once mounted.
  });
  const clientReference = useRef<QueryClient | null>(null);
  clientReference.current ??= createPreviewClient({
    questions: () => questionsReference.current,
    add: (questions) => {
      questionsReference.current = [
        ...questionsReference.current,
        ...questions,
      ];
      actReference.current({ type: "addQuestions", questions });
    },
    update: (question) => {
      questionsReference.current = questionsReference.current.map((current) =>
        current.id === question.id ? question : current,
      );
      actReference.current({ type: "updateQuestion", question });
    },
  });
  const client = clientReference.current;
  // Edited by the real settings dialog in either screen; never persisted.
  const { data: settings = DEFAULT_USER_SETTINGS } = useQuery<UserSettings>(
    {
      queryKey: userSettingsQueryKey,
      queryFn: () => DEFAULT_USER_SETTINGS,
    },
    client,
  );
  const timer = useStudyTimer(false, studyTimeSeconds);
  const timerStore = timer.store;

  const channelReference = useRef<QuizSyncChannel | null>(null);
  // Read by the channel handler, which answers late joiners with a snapshot.
  const syncedReference = useRef<SyncedQuizState>(synced);
  useEffect(() => {
    syncedReference.current = synced;
  }, [synced]);

  useEffect(() => {
    if (syncChannel === undefined) {
      return;
    }
    // The settings last sent or received, so an applied update is not
    // echoed back to the screen it came from.
    let lastSettings = JSON.stringify(
      client.getQueryData<UserSettings>(userSettingsQueryKey),
    );
    const applySettings = (next: UserSettings | undefined): void => {
      if (next === undefined) {
        return;
      }
      const serialized = JSON.stringify(next);
      if (serialized !== lastSettings) {
        lastSettings = serialized;
        client.setQueryData(userSettingsQueryKey, next);
      }
    };

    const channel = openQuizSyncChannel(syncChannel, (message) => {
      if (channel === null) {
        return;
      }
      const response = respondToQuizSyncMessage(message, {
        id: channel.id,
        synced: syncedReference.current,
        settings: client.getQueryData<UserSettings>(userSettingsQueryKey),
      });
      if (response.event !== undefined) {
        dispatch(response.event);
      }
      if (response.resetTimer === true) {
        timerStore.setFromLoaded(0);
      }
      applySettings(response.settings);
      if (response.reply !== undefined) {
        channel.post(response.reply);
      }
    });
    if (channel === null) {
      return;
    }
    channelReference.current = channel;

    const unsubscribe = client.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.query.queryHash !== SETTINGS_HASH) {
        return;
      }
      const next = event.query.state.data as UserSettings | undefined;
      const serialized = JSON.stringify(next);
      if (next !== undefined && serialized !== lastSettings) {
        lastSettings = serialized;
        channel.post({ kind: "settings", settings: next });
      }
    });
    channel.post({ kind: "hello" });

    return () => {
      unsubscribe();
      channel.close();
      channelReference.current = null;
    };
  }, [client, syncChannel, timerStore]);

  const act = (action: QuizPreviewAction): void => {
    dispatch({ type: "action", action });
    channelReference.current?.post({ kind: "action", action });
  };

  useEffect(() => {
    actReference.current = act;
  });
  // Snapshots from the other screen replace the questions too.
  useEffect(() => {
    questionsReference.current = state.questions;
  }, [state.questions]);

  return {
    state,
    view: selectQuizPreviewView(state, settings),
    select: (answers) => {
      act({ type: "select", answers });
    },
    next: () => {
      act({ type: "next", settings });
    },
    back: () => {
      act({ type: "back" });
    },
    reset: () => {
      act({ type: "reset" });
      timer.setFromLoaded(0);
    },
    setFocusMode: (active) => {
      act({ type: "setFocusMode", active });
    },
    goTo: (questionId) => {
      act({ type: "goTo", questionId });
    },
    timer: timer.store,
    client,
  };
}
