export const computeAnswerVariant = (
  isSelected: boolean,
  isResult: boolean,
  isCorrect: boolean,
) => {
  if (isResult) {
    if (isCorrect && isSelected) {
      return "border-green-500! bg-green-500/15! [&_p]:text-green-600 [&_p]:dark:text-green-400";
    } // Correct & chosen
    if (isCorrect && !isSelected) {
      return "border-yellow-500! bg-yellow-500/15! [&_p]:text-yellow-600 [&_p]:dark:text-yellow-400";
    } // Missed correct answer
    if (!isCorrect && isSelected) {
      return "border-red-500! bg-red-500/15! [&_p]:text-red-600 [&_p]:dark:text-red-400";
    } // Chosen but incorrect
    return "opacity-50"; // Not selected & incorrect (distractor)
  }
  // Idle (selecting answers) phase
  return isSelected
    ? "bg-primary/10 border-primary dark:bg-input/70 dark:border-ring"
    : "hover:bg-accent-input border-border dark:hover:bg-accent/60";
};

export const computeAnswerVariantText = (
  isSelected: boolean,
  isResult: boolean,
  isCorrect: boolean,
) => {
  if (isResult) {
    if (isCorrect && isSelected) {
      return "text-green-600 dark:text-green-400";
    } // Correct & chosen
    if (isCorrect && !isSelected) {
      return "text-yellow-600 dark:text-yellow-400";
    } // Missed correct answer
    if (!isCorrect && isSelected) {
      return "text-red-600 dark:text-red-400";
    } // Chosen but incorrect
    return "opacity-50"; // Not selected & incorrect (distractor)
  }
  // Idle (selecting answers) phase
  return isSelected ? "bg-primary/10" : "hover:bg-accent";
};
