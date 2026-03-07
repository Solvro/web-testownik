import { useEffect } from "react";

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
      const isInput =
        (target.tagName.toLowerCase() === "input" ||
          target.tagName.toLowerCase() === "textarea") &&
        (target as HTMLInputElement).type !== "checkbox";

      const isModalOpen = Boolean(document.querySelector('[role="dialog"]'));

      if (isInput || isModalOpen) {
        return;
      }

      const key = event.key.toLowerCase();

      switch (key) {
        case "enter": {
          if (target.tagName.toLowerCase() !== "button") {
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
        default: {
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
