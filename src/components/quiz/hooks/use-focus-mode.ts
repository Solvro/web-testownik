import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { TimerStore } from "./use-study-timer";

export type FocusAlertState = {
  isOpen: boolean;
  title: string;
  message: string;
} | null;

const subscribeToFocusMode = (listener: () => void) => {
  window.addEventListener("focusModeChange", listener);
  return () => {
    window.removeEventListener("focusModeChange", listener);
  };
};

const getSnapshot = () => {
  return sessionStorage.getItem("focusMode") === "true";
};

const getServerSnapshot = () => {
  return false;
};

export function useFocusMode(timerStore: TimerStore) {
  const isFocusModeActive = useSyncExternalStore(
    subscribeToFocusMode,
    getSnapshot,
    getServerSnapshot,
  );
  const [focusAlert, setFocusAlert] = useState<FocusAlertState>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isAlertOpenRef = useRef(false);

  const startInactivityCountdown = useCallback(() => {
    if (inactivityTimerRef.current !== null) {
      clearTimeout(inactivityTimerRef.current);
    }

    inactivityTimerRef.current = setTimeout(
      () => {
        if (isAlertOpenRef.current) {
          return;
        }
        isAlertOpenRef.current = true;
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

  const executeToggle = useCallback(() => {
    const nextState = !isFocusModeActive;
    sessionStorage.setItem("focusMode", String(nextState));
    window.dispatchEvent(new Event("focusModeChange"));
    if (nextState) {
      timerStore.resume();
    }
  }, [isFocusModeActive, timerStore]);

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
    localStorage.setItem("focusModeOnboarding", "true");
    setShowOnboarding(false);
    executeToggle();
  };

  const cancelOnboarding = () => {
    setShowOnboarding(false);
  };

  const closeFocusAlert = useCallback(() => {
    setFocusAlert(null);
    isAlertOpenRef.current = false;
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
        if (isAlertOpenRef.current) {
          return;
        }
        isAlertOpenRef.current = true;
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
    showOnboarding,
    confirmOnboarding,
    cancelOnboarding,
  };
}
