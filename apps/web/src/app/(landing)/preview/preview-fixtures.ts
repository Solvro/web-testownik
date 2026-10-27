import type {
  HardestQuestion,
  HourlyEntry,
  QuizStats,
  SessionEntry,
  TimelineEntry,
} from "@testownik/core/quiz/stats";
import type {
  AnswerRecord,
  Question,
  Quiz,
  QuizMetadata,
} from "@testownik/core/quiz/types";
import { ACCOUNT_LEVEL } from "@testownik/core/user/types";
import type { Group, Term, User } from "@testownik/core/user/types";

/**
 * Fixtures for the landing-page device screens.
 *
 * These exist so the marketing surfaces can mount the *real* Testownik
 * components — `QuestionCard`, the stats charts, the grades table — instead of
 * lookalikes. Everything here is shaped exactly like the API responses, so the
 * components take their normal render path with no network and no auth.
 */

export const PREVIEW_QUIZ_ID = "landing-preview-quiz";

/**
 * The preview's clock: today at a fixed hour (UTC), so the server and the
 * client agree on the day while the charts always cover the last days.
 */
export const PREVIEW_NOW = new Date();
PREVIEW_NOW.setUTCHours(18, 30, 0, 0);

const day = (offset: number): string =>
  new Date(PREVIEW_NOW.getTime() - offset * 86_400_000).toISOString();

export const PREVIEW_QUESTION: Question = {
  id: "q-83",
  order: 83,
  text: "Która strategia najlepiej pomaga trwale zapamiętać materiał przed egzaminem?",
  multiple: false,
  answers: [
    {
      id: "a-1",
      order: 1,
      text: "wielokrotne czytanie tych samych notatek",
      is_correct: false,
    },
    {
      id: "a-2",
      order: 2,
      text: "jedna długa sesja tuż przed egzaminem",
      is_correct: false,
    },
    {
      id: "a-3",
      order: 3,
      text: "aktywne przypominanie i powtórki w odstępach",
      is_correct: true,
    },
    {
      id: "a-4",
      order: 4,
      text: "podkreślanie całego materiału podczas czytania",
      is_correct: false,
    },
    {
      id: "a-5",
      order: 5,
      text: "uczenie się wyłącznie poprawnych odpowiedzi",
      is_correct: false,
    },
  ],
  explanation:
    "Aktywne odtwarzanie wiedzy wzmacnia ślady pamięciowe, a rozłożenie powtórek w czasie pomaga wracać do materiału tuż przed jego zapomnieniem.",
};

const answers = (
  questionId: string,
  entries: [text: string, isCorrect: boolean][],
): Question["answers"] =>
  entries.map(([text, isCorrect], index) => ({
    id: `${questionId}-a${(index + 1).toString()}`,
    order: index + 1,
    text,
    is_correct: isCorrect,
  }));

/**
 * The sample of the quiz the previews cycle through, in quiz order. The rest
 * of its 119 questions only exist as numbers (`PREVIEW_PROGRESS`).
 */
export const PREVIEW_QUESTIONS: Question[] = [
  {
    id: "q-12",
    order: 12,
    text: "Jak długa powinna być krótka przerwa po 25 minutach nauki w technice Pomodoro?",
    multiple: false,
    answers: answers("q-12", [
      ["około 5 minut", true],
      ["co najmniej pół godziny", false],
      ["godzina, żeby odpocząć na zapas", false],
      ["przerwa nie jest potrzebna", false],
    ]),
  },
  {
    id: "q-27",
    order: 27,
    text: "Które z poniższych metod to aktywne przypominanie?",
    multiple: true,
    answers: answers("q-27", [
      ["fiszki rozwiązywane bez zaglądania na odwrót", true],
      ["tłumaczenie tematu koledze z pamięci", true],
      ["ponowne czytanie tych samych notatek", false],
      ["rozwiązywanie zadań z poprzednich egzaminów", true],
      ["oglądanie nagrania wykładu w przyspieszeniu", false],
    ]),
  },
  {
    id: "q-41",
    order: 41,
    text: "Na czym polega efekt rozłożenia nauki w czasie?",
    multiple: false,
    answers: answers("q-41", [
      ["kilka krótszych sesji daje trwalszą wiedzę niż jedna długa", true],
      ["im dłuższa jednorazowa sesja, tym lepiej", false],
      ["materiał trzeba powtarzać codziennie o tej samej porze", false],
      ["najlepiej uczyć się kilku przedmiotów naraz", false],
    ]),
  },
  {
    id: "q-56",
    order: 56,
    text: "Co pomaga wykryć iluzję znajomości materiału?",
    multiple: true,
    answers: answers("q-56", [
      ["test z pamięci bez notatek", true],
      ["wyjaśnienie zagadnienia własnymi słowami", true],
      ["podkreślanie najważniejszych zdań", false],
      ["przepisanie notatek na czysto", false],
    ]),
    explanation:
      "Znajomy tekst łatwo pomylić z opanowanym materiałem. Dopiero próba odtworzenia go **bez podglądu** pokazuje, co naprawdę pamiętasz.",
  },
  PREVIEW_QUESTION,
  {
    id: "q-97",
    order: 97,
    text: "Kiedy najlepiej zaplanować pierwszą powtórkę nowego materiału?",
    multiple: false,
    answers: answers("q-97", [
      ["tego samego lub następnego dnia", true],
      ["tydzień przed egzaminem", false],
      ["dopiero po przerobieniu całego materiału", false],
      ["dopiero gdy pojawią się trudności", false],
    ]),
  },
  {
    id: "q-104",
    order: 104,
    text: "Co warto zrobić z pytaniem, na które odpowiedziałeś błędnie?",
    multiple: true,
    answers: answers("q-104", [
      ["przeczytać wyjaśnienie i poprawną odpowiedź", true],
      ["wrócić do niego w kolejnej sesji", true],
      ["pomijać je, żeby nie psuło statystyk", false],
      ["zapamiętać tylko, która to była opcja", false],
    ]),
  },
];

/** The AI hint the laptop's side panel shows for each sample question. */
export const PREVIEW_AI_HINTS: Record<string, string> = {
  "q-12":
    "Krótka przerwa ma dać odpocząć, ale **nie wybić z rytmu**. Wystarczy kilka minut.",
  "q-27":
    "Szukaj metod, w których musisz **wydobyć wiedzę z pamięci**, a nie tylko ją zobaczyć.",
  "q-41": "Pomyśl o tym, co dzieje się z pamięcią **między sesjami** nauki.",
  "q-56":
    "Iluzja znajomości znika, gdy materiał trzeba **odtworzyć**, a nie rozpoznać.",
  "q-83":
    "Najwięcej zapamiętujesz, gdy próbujesz **wydobyć wiedzę z pamięci** i wracasz do niej w odstępach.",
  "q-97": "Krzywa zapominania jest najbardziej stroma **zaraz po nauce**.",
  "q-104":
    "Błąd to najlepsza wskazówka, **do czego wrócić** przy następnej powtórce.",
};

/** The question every preview opens on. */
export const PREVIEW_START_QUESTION_ID = PREVIEW_QUESTION.id;

/**
 * This session's answer history, newest first like
 * `current_session.answers`. It feeds the per-question counters, the back
 * button and the history dialog.
 */
export const PREVIEW_SESSION_ANSWERS: AnswerRecord[] = [
  ["r-5", "q-41", 0.02, ["q-41-a2"], false],
  ["r-4", "q-27", 0.04, ["q-27-a1", "q-27-a2", "q-27-a4"], true],
  ["r-3", "q-12", 0.06, ["q-12-a1"], true],
  ["r-2", "q-83", 1, ["a-3"], true],
  ["r-1", "q-83", 2, ["a-1"], false],
].map(([id, question, offset, selected, correct]) => ({
  id: id as string,
  question: question as string,
  answered_at: day(offset as number),
  selected_answers: selected as string[],
  was_correct: correct as boolean,
}));

/**
 * Progress over the whole quiz as the previews open, matching the stats on
 * the tablet. The sample questions move these numbers as they are answered.
 */
export const PREVIEW_PROGRESS = {
  mastered: 71,
  correct: 336,
  wrong: 88,
  total: 119,
};

export const PREVIEW_QUIZ: Quiz = {
  id: PREVIEW_QUIZ_ID,
  title: "Jak uczyć się skuteczniej?",
  description:
    "Praktyczny quiz o zapamiętywaniu, powtórkach i przygotowaniu do egzaminu.",
  visibility: 2,
  allow_anonymous: true,
  is_anonymous: false,
  version: 3,
  can_edit: true,
  questions: PREVIEW_QUESTIONS,
};

/** Generated portraits, so the dialog shows faces without real people. */
function avatar(name: string): string {
  return `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

/** People the quiz is already shared with. */
export const PREVIEW_SHARED_WITH: User[] = [
  {
    id: "u-1",
    full_name: "Ola Nowak",
    photo: avatar("Ola Nowak"),
    student_number: "276431",
    account_level: ACCOUNT_LEVEL.GOLD,
  },
  {
    id: "u-2",
    full_name: "Kuba Wiśniewski",
    photo: avatar("Kuba Wiśniewski"),
    student_number: "281907",
  },
];

/** What the share dialog's search finds. */
export const PREVIEW_DIRECTORY: User[] = [
  ...PREVIEW_SHARED_WITH,
  {
    id: "u-3",
    full_name: "Maja Kowalczyk",
    photo: avatar("Maja Kowalczyk"),
    student_number: "279015",
    account_level: ACCOUNT_LEVEL.SILVER,
  },
  {
    id: "u-4",
    full_name: "Michał Zieliński",
    photo: avatar("Michał Zieliński"),
    student_number: "283344",
  },
  {
    id: "u-5",
    full_name: "Zuzanna Lewandowska",
    photo: avatar("Zuzanna Lewandowska"),
    student_number: "274862",
    account_level: ACCOUNT_LEVEL.GOLD,
  },
  {
    id: "u-6",
    full_name: "Bartek Kamiński",
    photo: avatar("Bartek Kamiński"),
    student_number: "285120",
  },
  {
    id: "u-7",
    full_name: "Natalia Wójcik",
    photo: avatar("Natalia Wójcik"),
    student_number: "277708",
    account_level: ACCOUNT_LEVEL.BASIC,
  },
  {
    id: "u-8",
    full_name: "Filip Dąbrowski",
    photo: avatar("Filip Dąbrowski"),
    student_number: "282563",
  },
  {
    id: "u-9",
    full_name: "Hania Mazur",
    photo: avatar("Hania Mazur"),
    student_number: "280391",
  },
  {
    id: "u-10",
    full_name: "Szymon Krawczyk",
    photo: avatar("Szymon Krawczyk"),
    student_number: "275947",
    account_level: ACCOUNT_LEVEL.SILVER,
  },
  {
    id: "u-11",
    full_name: "Julia Piotrowska",
    photo: avatar("Julia Piotrowska"),
    student_number: "284216",
  },
  {
    id: "u-12",
    full_name: "Marcel Grabowski",
    photo: avatar("Marcel Grabowski"),
    student_number: "278633",
  },
  {
    id: "u-13",
    full_name: "Lena Pawlak",
    photo: avatar("Lena Pawlak"),
    student_number: "286075",
    account_level: ACCOUNT_LEVEL.BASIC,
  },
  {
    id: "u-14",
    full_name: "Igor Michalski",
    photo: avatar("Igor Michalski"),
    student_number: "273598",
  },
];

const CURRENT_TERM: Term = {
  id: "2026/27-Z",
  name: "Semestr zimowy 2026/2027",
  start_date: "2026-10-01",
  end_date: "2027-02-28",
  finish_date: "2027-02-28",
  is_current: true,
};

const PREVIOUS_TERM: Term = {
  id: "2025/26-L",
  name: "Semestr letni 2025/2026",
  start_date: "2026-02-23",
  end_date: "2026-09-30",
  finish_date: "2026-09-30",
  is_current: false,
};

/** Study groups the share dialog offers; it gives them its own avatars. */
export const PREVIEW_GROUPS: Group[] = [
  {
    id: "g-1",
    name: "Techniki uczenia się, gr. 3",
    term: CURRENT_TERM,
    photo: "",
  },
  {
    id: "g-2",
    name: "Psychologia poznawcza, wykład",
    term: CURRENT_TERM,
    photo: "",
  },
  {
    id: "g-3",
    name: "Metodyka pracy umysłowej, gr. 1",
    term: CURRENT_TERM,
    photo: "",
  },
  {
    id: "g-4",
    name: "Statystyka dla psychologów, gr. 2",
    term: PREVIOUS_TERM,
    photo: "",
  },
];

export const PREVIEW_QUIZ_METADATA: QuizMetadata = {
  ...PREVIEW_QUIZ,
  created_at: day(126),
  updated_at: day(4),
  last_used_at: day(1),
  question_count: 119,
};

export const PREVIEW_STATS: Record<"me" | "all", QuizStats> = {
  me: {
    quiz_id: PREVIEW_QUIZ_ID,
    total_answers: 424,
    correct_answers: 336,
    wrong_answers: 88,
    accuracy: 0.792,
    first_answer_accuracy: 0.63,
    study_time_seconds: 4836,
    total_study_time_seconds: 29_016,
    average_study_time_seconds: 4836,
    sessions_count: 6,
    unique_users_count: null,
    last_activity_at: day(1),
  },
  all: {
    quiz_id: PREVIEW_QUIZ_ID,
    total_answers: 2066,
    correct_answers: 1728,
    wrong_answers: 338,
    accuracy: 0.836,
    first_answer_accuracy: 0.66,
    study_time_seconds: null,
    total_study_time_seconds: 148_920,
    average_study_time_seconds: 2996,
    sessions_count: 33,
    unique_users_count: 10,
    last_activity_at: day(0),
  },
};

const TIMELINE_SHAPE = [
  [9, 42, 26],
  [0, 0, 0],
  [14, 63, 44],
  [22, 88, 65],
  [7, 31, 21],
  [0, 0, 0],
  [18, 74, 55],
  [26, 104, 82],
  [11, 47, 33],
  [31, 121, 99],
  [16, 68, 52],
  [0, 0, 0],
  [24, 96, 78],
  [38, 142, 118],
];

export const PREVIEW_TIMELINE: TimelineEntry[] = TIMELINE_SHAPE.map(
  ([sessions, total, correct], index) => ({
    date: day(TIMELINE_SHAPE.length - 1 - index).slice(0, 10),
    sessions_count: sessions,
    total_answers: total,
    correct_answers: correct,
    total_study_time_seconds: total * 42,
  }),
);

export const PREVIEW_SESSIONS: SessionEntry[] = [
  [1, 2712, 96, 74],
  [3, 1980, 71, 52],
  [6, 3420, 118, 97],
  [9, 1260, 48, 31],
  [13, 4836, 142, 118],
].map(([offset, time, total, correct]) => ({
  session_id: `s-${offset.toString()}`,
  started_at: day(offset),
  ended_at: day(offset),
  study_time_seconds: time,
  total_answers: total,
  correct_answers: correct,
  // Session charts use percentage points on a 0–100 axis.
  accuracy: (correct / total) * 100,
}));

export const PREVIEW_HARDEST: HardestQuestion[] = [
  ["Co najlepiej wzmacnia pamięć długotrwałą?", 61, 84],
  ["Kiedy warto zaplanować kolejną powtórkę?", 54, 79],
  ["Jak wykorzystać błędną odpowiedź w nauce?", 47, 88],
  ["Co zrobić po przeczytaniu rozdziału?", 38, 71],
  ["Jak ograniczyć iluzję znajomości materiału?", 24, 66],
].map(([text, wrong, total], index) => ({
  question_id: `hq-${index.toString()}`,
  question_text: text as string,
  wrong_answers: wrong as number,
  total_answers: total as number,
}));

export const PREVIEW_HOURLY: HourlyEntry[] = Array.from(
  { length: 24 },
  (_, hour) => ({
    hour,
    sessions_count: [
      0, 0, 0, 0, 0, 0, 1, 2, 3, 2, 1, 2, 4, 3, 2, 3, 5, 7, 9, 12, 14, 11, 6, 2,
    ][hour],
  }),
);
