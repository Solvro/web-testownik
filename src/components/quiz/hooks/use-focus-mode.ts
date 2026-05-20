import { useCallback, useEffect, useRef, useState } from "react";

import type { TimerStore } from "./use-study-timer";

export type FocusAlertState = {
  isOpen: boolean;
  title: string;
  message: string;
} | null;

export function useFocusMode(timerStore: TimerStore) {
  const [isFocusModeActive, setIsFocusModeActive] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("focusMode") === "true";
    }
    return false;
  });
  const [focusAlert, setFocusAlert] = useState<FocusAlertState>(null);

  useEffect(() => {
    localStorage.setItem("focusMode", String(isFocusModeActive));
  }, [isFocusModeActive]);

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startInactivityCountdown = useCallback(() => {
    if (inactivityTimerRef.current !== null) {
      clearTimeout(inactivityTimerRef.current);
    }

    inactivityTimerRef.current = setTimeout(
      () => {
        timerStore.pause();
        const audio = new Audio("/sounds/quiz/metal-pipe.mp3");
        audio.play().catch(console.error);
        setFocusAlert({
          isOpen: true,
          title: "Brak aktywności",
          message:
            "Minęło 5 minut bez żadnej akcji. Timer został zatrzymany - wróć do nauki!",
        });
      },
      5 * 60 * 1000,
    );
  }, [timerStore]);

  const resetInactivityTimer = useCallback(() => {
    if (!isFocusModeActive) {
      return;
    }
    timerStore.resume();
    startInactivityCountdown();
  }, [isFocusModeActive, timerStore, startInactivityCountdown]);

  const toggleFocusMode = () => {
    const nextState = !isFocusModeActive;
    setIsFocusModeActive(nextState);
    if (nextState) {
      timerStore.resume();
    }
  };

  const closeFocusAlert = useCallback(() => {
    setFocusAlert(null);
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  useEffect(() => {
    if (!isFocusModeActive) {
      if (inactivityTimerRef.current !== null) {
        clearTimeout(inactivityTimerRef.current);
      }
      return;
    }

    startInactivityCountdown();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        timerStore.pause();
        const audio = new Audio("/sounds/quiz/metal-pipe.mp3");
        audio.play().catch(console.error);
        setFocusAlert({
          isOpen: true,
          title: "Opuszczono kartę z quizem.",
          message: "Timer został zatrzymany - skup się na nauce!",
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (inactivityTimerRef.current !== null) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [isFocusModeActive, startInactivityCountdown, timerStore]);

  return {
    isFocusModeActive,
    toggleFocusMode,
    resetInactivityTimer,
    focusAlert,
    closeFocusAlert,
  };
}
