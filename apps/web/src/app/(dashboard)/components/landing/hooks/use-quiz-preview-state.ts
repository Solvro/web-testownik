"use client";

import { useState } from "react";

import type { DeviceQuizControls } from "../scene/device-screen-content";

/**
 * The selection and checked state behind a preview quiz. The desktop stage
 * shares one instance between the laptop and the iPhone; the mobile hero owns
 * its own for the CSS phone.
 */
export function useQuizPreviewState(): DeviceQuizControls {
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>(["a-4"]);
  const [questionChecked, setQuestionChecked] = useState(false);

  return {
    selectedAnswers,
    onSelectedAnswersChange: setSelectedAnswers,
    questionChecked,
    onQuestionCheckedChange: setQuestionChecked,
  };
}
