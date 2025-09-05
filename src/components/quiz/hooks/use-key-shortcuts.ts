import { useCallback, useEffect } from "react";

interface Options {
  nextAction: () => void;
  nextQuestion: () => void;
}

export function useKeyShortcuts({ nextAction, nextQuestion }: Options) {
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
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
          nextQuestion();
          break;
        }
        default: {
          break;
        }
      }
    },
    [nextAction, nextQuestion],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [handleKeyPress]);
}
