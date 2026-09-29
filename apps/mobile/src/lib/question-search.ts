import type { Question } from "@testownik/core/quiz/types";
export function searchText(text: string): string {
  return text
    .toLocaleLowerCase("pl-PL")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/g, "l")
    .trim();
}
export function indexQuestions(questions: Question[]) {
  return questions.map((question, index) => ({
    question,
    number: index + 1,
    text: searchText(
      [
        question.text,
        question.explanation ?? "",
        ...question.answers.map((answer) => answer.text),
      ].join(" "),
    ),
  }));
}
export function findQuestions(
  index: ReturnType<typeof indexQuestions>,
  query: string,
) {
  const terms = searchText(query).split(/\s+/).filter(Boolean);
  return terms.length
    ? index.filter((entry) => terms.every((term) => entry.text.includes(term)))
    : index;
}
