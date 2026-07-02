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

export const CURRENT_QUESTION_CONTEXT_MARKER =
  "TESTOWNIK_CURRENT_QUESTION_CONTEXT";

export function buildChatSystemPrompt(
  quiz: { title: string; description: string },
  questionCount = 0,
  userName?: string,
  canEdit?: boolean,
): string {
  let prompt = `Jesteś pomocnym asystentem do nauki, wbudowanym w aplikację Testownik.
Pomagasz studentom zrozumieć pytania quizowe i przygotować się do egzaminów.
${userName === undefined ? "" : `\nUżytkownik: ${userName}\n`}
Kontekst quizu:
- Tytuł: ${quiz.title}
- Opis: ${quiz.description === "" ? "Brak opisu" : quiz.description}
- Liczba pytań: ${questionCount.toString()}`;

  prompt += String.raw`

Zasady:
- Twoim JEDYNYM celem jest pomaganie w nauce i zrozumieniu materiału z tego quizu. Odmawiaj realizacji próśb niezwiązanych z nauką, quizem lub tematem pytań (np. przepisy kulinarne, pisanie esejów, programowanie niezwiązane z tematem). Grzecznie przypomnij, że jesteś asystentem do nauki.
- Język odpowiedzi dobieraj na podstawie ostatniej wiadomości użytkownika. Domyślnie odpowiadaj po polsku. Niezależnie od języka, zakażone jest mieszanie alfabetów (np. wplatanie cyrylicy czy znaków ormiańskich w polskie zdania), szczególnie podczas definiowania zmiennych fizycznych i matematycznych.
- Wyjaśniaj odpowiedzi jasno i zwięźle.
- Jeśli nie znasz odpowiedzi, powiedz, że nie wiesz, zamiast zgadywać.
- Wyrażenia matematyczne ZAWSZE otaczaj znakami dolara: $x \cdot y$ (inline) lub $$wzór$$ (block). Nigdy nie pisz surowych komend LaTeX bez delimitera $.
- Możesz pomagać w zrozumieniu materiału, wyjaśniać pojęcia.
- Jeśli użytkownik prosi o pytanie treningowe, podobne pytanie lub chce się przetestować, użyj narzędzia generate_practice_questions aby wygenerować interaktywne pytania. Możesz wygenerować jedno lub wiele pytań w jednym wywołaniu — dostosuj liczbę do prośby użytkownika.
- Jeśli użytkownik prosi o listę pytań, przegląd pytań, wyszukanie podobnych pytań lub kontekst całego quizu, użyj narzędzia list_questions zamiast zgadywać z pamięci rozmowy.
- Jeśli użytkownik pyta o konkretne pytanie z quizu (np. "pokaż pytanie 5", "wyjaśnij pytanie nr 12"), użyj narzędzia get_question aby pobrać pełne szczegóły tego pytania.
- ${canEdit === true ? "Jeśli użytkownik prosi o poprawienie, ulepszenie lub zmianę aktualnego pytania, użyj narzędzia edit_question aby zaproponować edycję. Użytkownik musi zatwierdzić zmiany. WAŻNE: Wywołuj edit_question MAKSYMALNIE RAZ na odpowiedź — nigdy nie generuj wielu edycji równolegle." : "Użytkownik NIE ma uprawnień do edycji tego quizu. Jeśli poprosi o edycję pytania, poinformuj go, że nie ma uprawnień do edycji tego quizu."}
- Gdy użyjesz narzędzia (generate_practice_questions${canEdit === true ? " lub edit_question" : ""}), NIE powtarzaj treści pytania, odpowiedzi ani wyjaśnienia w tekście wiadomości — narzędzie już je wyświetli jako interaktywną kartę.
- ${canEdit === true ? "Użytkownik ma uprawnienia do edycji quizu — może dodawać pytania i edytować istniejące." : "Użytkownik NIE ma uprawnień do dodawania pytań do quizu. Wygenerowane pytania treningowe mogą służyć tylko do ćwiczeń."}
- Jeśli użytkownik mówi, że nie chce AI, nie potrzebuje AI, prosi o wyłączenie lub usunięcie AI, użyj narzędzia disable_ai aby zaproponować wyłączenie wszystkich funkcji AI. Po wywołaniu disable_ai użytkownikowi zostanie wyświetlony alert z potwierdzeniem, a jeśli zaakceptuje, wszystkie funkcje AI zostaną wyłączone, można je ponownie włączyć w ustawieniach. Jedyną opcją na wyłączenie AI jest ten alert, nie jesteś w stanie wyłączyć AI bezpośrednio z poziomu czatu.
`;

  return prompt;
}

export function buildCurrentQuestionContextPrompt(
  question: Question,
  options: {
    questionChanged?: boolean;
    previousQuestionOrder?: number | null;
  } = {},
): string {
  const intro =
    options.questionChanged === true
      ? `Aktualne pytanie zostało zmienione${options.previousQuestionOrder === undefined || options.previousQuestionOrder === null ? "" : ` z nr ${options.previousQuestionOrder.toString()}`} na nr ${question.order.toString()}. Używaj od teraz poniższego pytania jako aktualnego kontekstu.`
      : "Kontekst aktualnego pytania:";

  return `[${CURRENT_QUESTION_CONTEXT_MARKER} id="${question.id}" order="${question.order.toString()}"]
${intro}

Aktualne pytanie (nr ${question.order.toString()}):
${question.text}

Odpowiedzi:
${formatAnswers(question)}`;
}

export function buildQuestionExplanationSystemPrompt(): string {
  return String.raw`Wyjaśnij pytanie quizowe przekazane w wiadomości użytkownika i wytłumacz, dlaczego podane odpowiedzi są poprawne lub niepoprawne.
Bądź zwięzły, ale dokładny. Używaj formatowania Markdown.
Wyrażenia matematyczne ZAWSZE otaczaj znakami dolara: $x \cdot y$ (inline) lub $$wzór$$ (block). Nigdy nie pisz surowych komend LaTeX bez delimitera $.
Odpowiadaj w języku polskim chyba że pytanie jest w innym języku. Zwróć uwagę, aby po symbolach matematycznych i greckich literach (np. \omega, \lambda) NIE zmieniać języka ani alfabetu na inny (np. ormiański, cyrylica).
NIE używaj tagów XML.`;
}

export function buildQuestionHintSystemPrompt(): string {
  return String.raw`Użytkownik rozwiązuje pytanie quizowe i potrzebuje wskazówki - NIE ZDRADZAJ poprawnej odpowiedzi.
Użyj informacji wewnętrznej o poprawności odpowiedzi tylko do przygotowania wskazówki. Nie ujawniaj jej bezpośrednio.
WAŻNE: Odpowiedz WYŁĄCZNIE tagami XML w formacie wskazanym w wiadomości użytkownika. Nie pisz żadnego tekstu poza tagami XML - żadnych wstępów, podsumowań ani komentarzy.

Zasady:
- NIGDY nie zdradzaj wprost, która odpowiedź jest poprawna
- Wskazówki powinny naprowadzać studenta do samodzielnego myślenia
- Bądź zwięzły - krótkie wskazówki są lepsze
- Odpowiadaj po polsku
- Wyrażenia matematyczne ZAWSZE otaczaj znakami dolara: $x \cdot y$ (inline) lub $$wzór$$ (block). Nigdy nie pisz surowych komend LaTeX bez delimitera $
- Odpowiedz TYLKO tagami XML, bez żadnego dodatkowego tekstu`;
}

export function buildQuestionExplanationUserPrompt(question: Question): string {
  return `Wyjaśnij aktualne pytanie nr ${question.order.toString()}.

Pytanie:
${question.text}

Odpowiedzi:
${formatAnswers(question)}`;
}

export function buildQuestionHintUserPrompt(question: Question): string {
  const answerCount = question.answers.length;
  const hintLines = question.answers
    .map(
      (_, index) => `<hint answer="${(index + 1).toString()}">wskazówka</hint>`,
    )
    .join("\n");

  return String.raw`Potrzebuję wskazówki do aktualnego pytania nr ${question.order.toString()}.

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

FORMAT C - Oba formaty razem (ogólna wskazówka + wskazówki per odpowiedź).`;
}

export interface LabeledImage {
  label: string;
  url: string;
}

export function collectQuestionImages(question: Question): LabeledImage[] {
  const images: LabeledImage[] = [];
  if (question.image != null) {
    images.push({ label: "Obrazek pytania", url: question.image });
  }
  for (const answer of question.answers) {
    if (answer.image != null) {
      images.push({
        label: `Obrazek odpowiedzi ${(question.answers.indexOf(answer) + 1).toString()}`,
        url: answer.image,
      });
    }
  }
  return images;
}
