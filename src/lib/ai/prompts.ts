import type { Question } from "@/types/quiz";

function formatAnswers(question: Question): string {
  return question.answers
    .map(
      (a, index) =>
        `${(index + 1).toString()}. ${a.text} (${a.is_correct ? "Poprawna" : "Niepoprawna"})`,
    )
    .join("\n");
}

function formatAnswersWithoutCorrectness(question: Question): string {
  return question.answers
    .map((a, index) => `${(index + 1).toString()}. ${a.text}`)
    .join("\n");
}

function formatQuestionsList(questions: Question[]): string {
  return questions
    .map(
      (q) =>
        `${q.order.toString()}. ${q.text.length > 80 ? `${q.text.slice(0, 80)}…` : q.text}`,
    )
    .join("\n");
}

export function buildChatSystemPrompt(
  quiz: { title: string; description: string },
  question: Question | null,
  questions: Question[] = [],
  userName?: string,
  canEdit?: boolean,
): string {
  let prompt = `Jesteś pomocnym asystentem do nauki, wbudowanym w aplikację Testownik.
Pomagasz studentom zrozumieć pytania quizowe i przygotować się do egzaminów.
${userName === undefined ? "" : `\nUżytkownik: ${userName}\n`}
Kontekst quizu:
- Tytuł: ${quiz.title}
- Opis: ${quiz.description === "" ? "Brak opisu" : quiz.description}
- Liczba pytań: ${questions.length.toString()}`;

  if (question !== null) {
    prompt += `

Aktualne pytanie (nr ${question.order.toString()}):
${question.text}

Odpowiedzi:
${formatAnswers(question)}`;
  }

  if (questions.length > 0) {
    prompt += `

Lista pytań w quizie:
${formatQuestionsList(questions)}`;
  }

  prompt += String.raw`

Zasady:
- Odpowiadaj po polsku, chyba że użytkownik pisze w innym języku.
- Wyjaśniaj odpowiedzi jasno i zwięźle.
- Jeśli nie znasz odpowiedzi, powiedz, że nie wiesz, zamiast zgadywać.
- Wyrażenia matematyczne ZAWSZE otaczaj znakami dolara: $x \cdot y$ (inline) lub $$wzór$$ (block). Nigdy nie pisz surowych komend LaTeX bez delimitera $.
- Możesz pomagać w zrozumieniu materiału, wyjaśniać pojęcia.
- Jeśli użytkownik prosi o pytanie treningowe, podobne pytanie lub chce się przetestować, użyj narzędzia generate_practice_questionss aby wygenerować interaktywne pytania. Możesz wygenerować jedno lub wiele pytań w jednym wywołaniu — dostosuj liczbę do prośby użytkownika.
- Jeśli użytkownik pyta o konkretne pytanie z quizu (np. "pokaż pytanie 5", "wyjaśnij pytanie nr 12"), użyj narzędzia get_question aby pobrać pełne szczegóły tego pytania.
- ${canEdit === true ? "Jeśli użytkownik prosi o poprawienie, ulepszenie lub zmianę aktualnego pytania, użyj narzędzia edit_question aby zaproponować edycję. Użytkownik musi zatwierdzić zmiany. WAŻNE: Wywołuj edit_question MAKSYMALNIE RAZ na odpowiedź — nigdy nie generuj wielu edycji równolegle." : "Użytkownik NIE ma uprawnień do edycji tego quizu. Jeśli poprosi o edycję pytania, poinformuj go, że nie ma uprawnień do edycji tego quizu."}
- Gdy użyjesz narzędzia (generate_practice_questions${canEdit === true ? " lub edit_question" : ""}), NIE powtarzaj treści pytania, odpowiedzi ani wyjaśnienia w tekście wiadomości — narzędzie już je wyświetli jako interaktywną kartę.
- ${canEdit === true ? "Użytkownik ma uprawnienia do edycji quizu — może dodawać pytania i edytować istniejące." : "Użytkownik NIE ma uprawnień do dodawania pytań do quizu. Wygenerowane pytania treningowe mogą służyć tylko do ćwiczeń."}
- Jeśli użytkownik mówi, że nie chce AI, nie potrzebuje AI, prosi o wyłączenie lub usunięcie AI, użyj narzędzia disable_ai aby zaproponować wyłączenie wszystkich funkcji AI. Po wywołaniu disable_ai użytkowikowi zostanie wyświetlony alert z potwierdzeniem, a jeśli zaakceptuje, wszystkie funkcje AI zostaną wyłączone, można je ponownie włączyć w ustawieniach. Jedyną opcją na wyłączenie AI jest ten alert, nie jesteś w stanie wyłączyć AI bezpośrednio z poziomu czatu.
`;

  return prompt;
}

export function buildExplainCheckedPrompt(question: Question): string {
  return String.raw`Wyjaśnij poniższe pytanie quizowe i wytłumacz, dlaczego podane odpowiedzi są poprawne lub niepoprawne.
Bądź zwięzły, ale dokładny. Używaj formatowania Markdown.
Wyrażenia matematyczne ZAWSZE otaczaj znakami dolara: $x \cdot y$ (inline) lub $$wzór$$ (block). Nigdy nie pisz surowych komend LaTeX bez delimitera $.
Odpowiadaj po polsku. NIE używaj tagów XML.

Pytanie:
${question.text}

Odpowiedzi:
${formatAnswers(question)}`;
}

export function buildExplainUncheckedPrompt(question: Question): string {
  const answerCount = question.answers.length;
  const hintLines = question.answers
    .map(
      (_, index) => `<hint answer="${(index + 1).toString()}">wskazówka</hint>`,
    )
    .join("\n");

  return String.raw`Użytkownik rozwiązuje pytanie quizowe i potrzebuje wskazówki - NIE ZDRADZAJ poprawnej odpowiedzi.

Pytanie:
${question.text}

Odpowiedzi:
${formatAnswersWithoutCorrectness(question)}

Informacja wewnętrzna (NIE ujawniaj tego bezpośrednio):
${formatAnswers(question)}

WAŻNE: Odpowiedz WYŁĄCZNIE używając poniższych tagów XML. Nie pisz żadnego tekstu poza tagami XML - żadnych wstępów, podsumowań ani komentarzy.

Wybierz jeden z formatów:

FORMAT A - Ogólna wskazówka (jedna wskazówka do całego pytania):
<general_hint>Treść wskazówki</general_hint>

FORMAT B - Wskazówki per odpowiedź (po jednej krótkiej wskazówce do każdej z ${answerCount.toString()} odpowiedzi):
<answer_hints>
${hintLines}
</answer_hints>

FORMAT C - Oba formaty razem (ogólna wskazówka + wskazówki per odpowiedź).

Zasady:
- NIGDY nie zdradzaj wprost, która odpowiedź jest poprawna
- Wskazówki powinny naprowadzać studenta do samodzielnego myślenia
- Bądź zwięzły - krótkie wskazówki są lepsze
- Odpowiadaj po polsku
- Wyrażenia matematyczne ZAWSZE otaczaj znakami dolara: $x \cdot y$ (inline) lub $$wzór$$ (block). Nigdy nie pisz surowych komend LaTeX bez delimitera $
- Odpowiedz TYLKO tagami XML, bez żadnego dodatkowego tekstu`;
}

export function collectQuestionImageUrls(question: Question): string[] {
  const urls: string[] = [];
  if (question.image != null) {
    urls.push(question.image);
  }
  for (const answer of question.answers) {
    if (answer.image != null) {
      urls.push(answer.image);
    }
  }
  return urls;
}

export function buildExplainCheckedUserMessage(question: Question): string {
  return `Wyjaśnij to pytanie:\n${question.text}\n\nOdpowiedzi:\n${formatAnswers(question)}`;
}

export function buildExplainUncheckedUserMessage(question: Question): string {
  return `Potrzebuję wskazówki do tego pytania:\n${question.text}\n\nOdpowiedzi:\n${formatAnswersWithoutCorrectness(question)}`;
}
