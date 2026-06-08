import { useEffect, useRef, useState } from "react";

import type { TimerStore } from "./use-study-timer";

const FOCUS_ALERT_SOUND_SRC = "/sounds/quiz/metal-pipe.mp3";

const FOCUS_ALERT_CONTENT = {
  inactivity: {
    title: "Brak aktywności",
    message:
      "Minęło 5 minut bez żadnej akcji. Timer został zatrzymany - wróć do nauki!",
  },
  tabLeft: {
    title: "Opuszczono kartę z quizem.",
    message: "Timer został zatrzymany - skup się na nauce!",
  },
} as const;

export type FocusAlertType = keyof typeof FOCUS_ALERT_CONTENT;

function clearInactivityCountdown(inactivityTimerRef: {
  current: NodeJS.Timeout | null;
}) {
  if (inactivityTimerRef.current !== null) {
    clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = null;
  }
}

function getFocusAlertAudio(audioRef: { current: HTMLAudioElement | null }) {
  audioRef.current ??= new Audio(FOCUS_ALERT_SOUND_SRC);
  audioRef.current.preload = "auto";
  return audioRef.current;
}

function unlockFocusAlertSound(audioRef: { current: HTMLAudioElement | null }) {
  // Prime playback during a user gesture.
  const audio = getFocusAlertAudio(audioRef);
  audio.muted = true;
  audio.currentTime = 0;

  void audio
    .play()
    .then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
    })
    .catch(() => {
      audio.muted = false;
    });
}

function playFocusAlertSound(audioRef: { current: HTMLAudioElement | null }) {
  const audio = getFocusAlertAudio(audioRef);
  audio.muted = false;
  audio.pause();
  audio.currentTime = 0;
  void audio.play().catch(console.error);
}

function startInactivityCountdown(
  timerStore: TimerStore,
  inactivityTimerRef: { current: NodeJS.Timeout | null },
  isAlertOpenRef: { current: boolean },
  audioRef: { current: HTMLAudioElement | null },
  showFocusAlert: (type: FocusAlertType) => void,
) {
  clearInactivityCountdown(inactivityTimerRef);

  inactivityTimerRef.current = setTimeout(
    () => {
      if (isAlertOpenRef.current) {
        return;
      }
      isAlertOpenRef.current = true;
      timerStore.pause();
      playFocusAlertSound(audioRef);
      showFocusAlert("inactivity");
    },
    5 * 60 * 1000,
  );
}

export function useFocusMode(timerStore: TimerStore) {
  const [isFocusModeActive, setIsFocusModeActive] = useState(false);
  const [focusAlertType, setFocusAlertType] =
    useState<FocusAlertType>("inactivity");
  const [isFocusAlertOpen, setIsFocusAlertOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isAlertOpenRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const showFocusAlert = (type: FocusAlertType) => {
    setFocusAlertType(type);
    setIsFocusAlertOpen(true);
  };

  const resetInactivityTimer = () => {
    if (!isFocusModeActive) {
      return;
    }
    timerStore.resume();
    startInactivityCountdown(
      timerStore,
      inactivityTimerRef,
      isAlertOpenRef,
      audioRef,
      showFocusAlert,
    );
  };

  const executeToggle = () => {
    const nextState = !isFocusModeActive;
    setIsFocusModeActive(nextState);
    if (nextState) {
      unlockFocusAlertSound(audioRef);
      timerStore.resume();
    }
  };

  const toggleFocusMode = () => {
    if (!isFocusModeActive) {
      const hasSeenOnboarding =
        localStorage.getItem("focusModeOnboarding") === "true";
      if (!hasSeenOnboarding) {
        setShowOnboarding(true);
        return;
      }
    }
    executeToggle();
  };

  const confirmOnboarding = () => {
    setShowOnboarding(false);
    executeToggle();
  };

  const confirmOnboardingAndHide = () => {
    localStorage.setItem("focusModeOnboarding", "true");
    setShowOnboarding(false);
    executeToggle();
  };

  const cancelOnboarding = () => {
    setShowOnboarding(false);
  };

  const closeFocusAlert = () => {
    setIsFocusAlertOpen(false);
    isAlertOpenRef.current = false;
    resetInactivityTimer();
  };

  const turnOffFocusModeFromAlert = () => {
    setIsFocusAlertOpen(false);
    isAlertOpenRef.current = false;
    setIsFocusModeActive(false);
    clearInactivityCountdown(inactivityTimerRef);
    timerStore.resume();
  };

  useEffect(() => {
    if (!isFocusModeActive) {
      clearInactivityCountdown(inactivityTimerRef);
      return;
    }

    startInactivityCountdown(
      timerStore,
      inactivityTimerRef,
      isAlertOpenRef,
      audioRef,
      showFocusAlert,
    );

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (isAlertOpenRef.current) {
          return;
        }
        isAlertOpenRef.current = true;
        timerStore.pause();
        playFocusAlertSound(audioRef);
        showFocusAlert("tabLeft");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInactivityCountdown(inactivityTimerRef);
    };
  }, [isFocusModeActive, timerStore]);

  useEffect(() => {
    return () => {
      if (audioRef.current != null) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return {
    isFocusModeActive,
    toggleFocusMode,
    resetInactivityTimer,
    isFocusAlertOpen,
    focusAlert: FOCUS_ALERT_CONTENT[focusAlertType],
    closeFocusAlert,
    turnOffFocusModeFromAlert,
    showOnboarding,
    confirmOnboarding,
    confirmOnboardingAndHide,
    cancelOnboarding,
  };
}
