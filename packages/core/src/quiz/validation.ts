export function formatValidationError(
  path: (string | number | symbol)[],
  defaultMessage: string,
): string {
  if (path.length === 0) {
    return defaultMessage;
  }

  const parts: string[] = [];

  const questionIndex = path.indexOf("questions");
  if (questionIndex !== -1 && path.length > questionIndex + 1) {
    const index = path[questionIndex + 1];
    if (typeof index === "number") {
      parts.push(`Pytanie ${String(index + 1)}`);
    }
  }

  const answerIndex = path.indexOf("answers");
  if (answerIndex !== -1 && path.length > answerIndex + 1) {
    const index = path[answerIndex + 1];
    if (typeof index === "number") {
      parts.push(`Odpowiedź ${String(index + 1)}`);
    }
  }

  if (parts.length > 0) {
    return `${parts.join(", ")}: ${defaultMessage}`;
  }

  return defaultMessage;
}
