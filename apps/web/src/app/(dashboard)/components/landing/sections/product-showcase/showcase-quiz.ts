import type { Question } from "@testownik/core/quiz/types";

import type { AnswerHint } from "@/components/ai/ai-explain-card";
import {
  PREVIEW_AI_HINTS,
  PREVIEW_QUESTION,
  PREVIEW_QUESTIONS,
  PREVIEW_SESSION_ANSWERS,
} from "@/components/testownik-preview/preview-fixtures";
import type { createQuizPreviewState } from "@/components/testownik-preview/preview-quiz-machine";

/**
 * The quiz behind the showcase's quiz and AI demos: the previews' sample
 * questions as a quiz of their own, numbered from 1, so what the assistant
 * adds grows a count the visitor can follow (7, then 9). One session (see
 * `ShowcaseSessionProvider`) serves both demos.
 *
 * The question it opens on carries a deliberate typo, for the assistant's
 * "fix the typos" suggestion to find.
 */

const SHOWCASE_START_TEXT = PREVIEW_QUESTION.text.replace(
  "zapamiętać",
  "zapamientać",
);

export const SHOWCASE_QUESTIONS: Question[] = PREVIEW_QUESTIONS.map(
  (question, index) => ({
    ...question,
    order: index + 1,
    text:
      question.id === PREVIEW_QUESTION.id ? SHOWCASE_START_TEXT : question.text,
  }),
);

export const SHOWCASE_QUIZ: Parameters<typeof createQuizPreviewState>[0] = {
  questions: SHOWCASE_QUESTIONS,
  answers: PREVIEW_SESSION_ANSWERS,
  currentQuestionId: PREVIEW_QUESTION.id,
  progress: null,
};

/** The quiz timer's starting point, as the demo has always shown it. */
export const SHOWCASE_STUDY_TIME_SECONDS = 4 * 60 + 36;

interface StaticAi {
  hint: { generalHint: string; answerHints: AnswerHint[] };
  explanation: string;
}

function staticAi(
  questionId: string,
  answerHints: string[],
  explanation: string,
): [string, StaticAi] {
  return [
    questionId,
    {
      hint: {
        generalHint: PREVIEW_AI_HINTS[questionId] ?? "",
        answerHints: answerHints.map((hint, answerIndex) => ({
          answerIndex,
          hint,
        })),
      },
      explanation,
    },
  ];
}

/**
 * Hints and explanations shaped like `/ai/hint` and `/ai/explain` output, so
 * the quiz demo's AI button works without an account. Module constants: the
 * hint card restarts whenever its payload changes identity.
 */
const STATIC_AI = new Map<string, StaticAi>([
  staticAi(
    "q-12",
    [
      "Kilka minut wystarczy, żeby odpocząć i **nie wypaść z rytmu**.",
      "Pół godziny to już długa przerwa, po której trudno wrócić do pracy.",
      "Godzina przerwy po 25 minutach nauki rozbija całą sesję.",
      "Bez przerw koncentracja spada z każdym kolejnym blokiem.",
    ],
    "W technice Pomodoro po 25 minutach skupionej pracy robisz **około 5 minut** przerwy, a dłuższą (od 15 do 30 minut) dopiero po czterech blokach. Krótka przerwa pozwala odpocząć, ale nie wybija z rytmu.",
  ),
  staticAi(
    "q-27",
    [
      "Fiszki bez podglądu wymagają **wydobycia odpowiedzi z pamięci**.",
      "Tłumacząc komuś temat, musisz go samodzielnie odtworzyć.",
      "Ponowne czytanie to rozpoznawanie, a nie przypominanie.",
      "Stare zadania egzaminacyjne sprawdzają, czy umiesz to zrobić sam.",
      "Przyspieszone nagranie to wciąż bierne oglądanie.",
    ],
    "Aktywne przypominanie to każda metoda, w której **odtwarzasz wiedzę bez podpowiedzi**: fiszki, tłumaczenie tematu z pamięci, rozwiązywanie zadań. Czytanie notatek i oglądanie nagrań dają tylko poczucie znajomości materiału.",
  ),
  staticAi(
    "q-41",
    [
      "Przerwy między sesjami zmuszają pamięć do **odświeżania śladów**.",
      "Długa sesja męczy i słabiej utrwala niż kilka krótszych.",
      "Stała pora może pomagać w nawyku, ale to nie jest ten efekt.",
      "Mieszanie przedmiotów to inna technika (przeplatanie).",
    ],
    "Efekt rozłożenia nauki w czasie (spacing) polega na tym, że **kilka krótszych sesji** w odstępach daje trwalszą wiedzę niż jedna długa. Każdy powrót po przerwie wzmacnia ślad pamięciowy.",
  ),
  staticAi(
    "q-56",
    [
      "Test bez notatek pokazuje, **co naprawdę pamiętasz**.",
      "Wyjaśnienie własnymi słowami szybko ujawnia luki.",
      "Podkreślanie łatwo pomylić z nauką, a to wciąż czytanie.",
      "Przepisywanie porządkuje notatki, ale nie sprawdza pamięci.",
    ],
    "Iluzję znajomości wykrywa tylko próba **odtworzenia materiału bez podglądu**: test z pamięci albo wyjaśnienie tematu własnymi słowami. Podkreślanie i przepisywanie dają złudzenie, że materiał jest opanowany.",
  ),
  staticAi(
    PREVIEW_QUESTION.id,
    [
      "Czytanie jest bierne: rozpoznajesz tekst, ale nie sprawdzasz pamięci.",
      "Jedna sesja przed egzaminem szybko wyparowuje.",
      "Tu musisz **samodzielnie przypominać** i wracać w odstępach.",
      "Podkreślanie zaznacza fragmenty, ale słabo utrwala.",
      "Same poprawne odpowiedzi nie uczą, dlaczego inne są błędne.",
    ],
    PREVIEW_QUESTION.explanation ?? "",
  ),
  staticAi(
    "q-97",
    [
      "Zapominanie jest najszybsze **zaraz po nauce**, więc wtedy warto wrócić.",
      "Tydzień przed egzaminem większość materiału już ulotni się z pamięci.",
      "Czekanie do końca materiału oznacza powtórkę po długiej przerwie.",
      "Trudności pojawiają się dopiero, gdy jest już za późno.",
    ],
    "Pierwszą powtórkę najlepiej zrobić **tego samego lub następnego dnia**: krzywa zapominania jest najbardziej stroma zaraz po nauce. Kolejne powtórki możesz stopniowo rozsuwać.",
  ),
  staticAi(
    "q-104",
    [
      "Wyjaśnienie pokazuje, **gdzie jest luka**.",
      "Powrót w kolejnej sesji sprawdza, czy luka się zamknęła.",
      "Pomijanie błędów poprawia statystyki, ale nie wiedzę.",
      "Zapamiętanie litery odpowiedzi nie przenosi się na egzamin.",
    ],
    "Błędna odpowiedź to najcenniejsza wskazówka: **przeczytaj wyjaśnienie** i wróć do pytania w kolejnej sesji. Testownik sam częściej pokazuje pytania, na które odpowiadasz źle.",
  ),
]);

const FALLBACK_HINT = {
  generalHint:
    "Zastanów się, którą odpowiedź umiesz **uzasadnić bez zaglądania** do notatek.",
  answerHints: [],
};

/** The quiz demo's AI hint for a question; added questions get a generic one. */
export function getShowcaseHint(question: Question): StaticAi["hint"] {
  return STATIC_AI.get(question.id)?.hint ?? FALLBACK_HINT;
}

/** An explanation for a question, from the question itself when it has one. */
export function getShowcaseExplanation(question: Question): string {
  const own = question.explanation?.trim() ?? "";
  return own === ""
    ? (STATIC_AI.get(question.id)?.explanation ??
        "To pytanie nie ma jeszcze wyjaśnienia. W Testowniku asystent przygotuje je na podstawie treści i odpowiedzi.")
    : own;
}
