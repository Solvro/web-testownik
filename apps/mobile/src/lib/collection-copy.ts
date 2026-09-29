export function questionCount(
  count: number | null | undefined,
  language: "pl" | "en",
) {
  if (count == null) return null;
  if (language === "en")
    return `${count} ${count === 1 ? "question" : "questions"}`;
  const mod = count % 100;
  return `${count} ${count === 1 ? "pytanie" : count % 10 >= 2 && count % 10 <= 4 && !(mod >= 12 && mod <= 14) ? "pytania" : "pytań"}`;
}
export function openedDate(
  date: string | null | undefined,
  language: "pl" | "en",
) {
  if (!date || !Number.isFinite(Date.parse(date))) return null;
  return `${language === "pl" ? "Otwarto" : "Opened"} ${new Date(date).toLocaleDateString(language === "pl" ? "pl-PL" : "en-GB", { day: "numeric", month: "short" })}`;
}
