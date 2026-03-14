import { useEffect } from "react";

import { isInputElement, isModalOpen } from "@/components/quiz/helpers/dom";

interface Options {
  nextAction: () => void;
  skipQuestion: () => void;
  isHistoryQuestion: boolean;
  togglePreviousQuestion: () => void;
}

export function useKeyShortcuts({
  nextAction,
  skipQuestion,
  isHistoryQuestion,
  togglePreviousQuestion,
}: Options) {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (isInputElement(target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const isHandledKey = key === "enter" || key === "s";

      if (!isHandledKey || isModalOpen()) {
        return;
      }

      const tagName = target.tagName.toLowerCase();

      switch (key) {
        case "enter": {
          if (tagName !== "button") {
            if (isHistoryQuestion) {
              togglePreviousQuestion();
            } else {
              nextAction();
            }
          }
          break;
        }
        case "s": {
          if (!isHistoryQuestion) {
            skipQuestion();
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [nextAction, skipQuestion, isHistoryQuestion, togglePreviousQuestion]);
}
