export const computeAnswerVariant = (
  isSelected: boolean,
  isResult: boolean,
  isCorrect: boolean,
) => {
  if (isResult) {
    if (isCorrect && isSelected) {
      return "border-green-500 bg-green-500/15 text-green-600 dark:text-green-400";
    } // Correct & chosen
    if (isCorrect && !isSelected) {
      return "border-yellow-500 bg-yellow-500/15 text-yellow-600 dark:text-yellow-400";
    } // Missed correct answer
    if (!isCorrect && isSelected) {
      return "border-red-500 bg-red-500/15 text-red-600 dark:text-red-400";
    } // Chosen but incorrect
    return "opacity-50"; // Not selected & incorrect (distractor)
  }
  // Idle (selecting answers) phase
  return isSelected
    ? "bg-primary/10 border-primary"
    : "hover:bg-accent border-border";
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
