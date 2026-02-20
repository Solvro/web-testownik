import { useEffect } from "react";

interface Options {
  nextAction: () => void;
  skipQuestion: () => void;
  isHistoryQuestion: boolean;
}

export function useKeyShortcuts({
  nextAction,
  skipQuestion,
  isHistoryQuestion,
}: Options) {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName.toLowerCase() === "input" &&
        (target as HTMLInputElement).type !== "checkbox"
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      switch (key) {
        case "enter": {
          if (target.tagName.toLowerCase() !== "button") {
            nextAction();
          }
          break;
        }
        case "s": {
          if (
            document.querySelectorAll("div[role=dialog]").length > 0 ||
            isHistoryQuestion
          ) {
            break;
          }
          skipQuestion();
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
  }, [nextAction, skipQuestion, isHistoryQuestion]);
}
