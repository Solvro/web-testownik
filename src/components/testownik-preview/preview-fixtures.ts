import type { AnswerHint } from "@/components/ai/ai-explain-card";
import type { AnswerRecord, Question, Quiz, QuizMetadata } from "@/types/quiz";
import type {
  HardestQuestion,
  HourlyEntry,
  QuizStats,
  SessionEntry,
  TimelineEntry,
} from "@/types/quiz-stats";

/**
 * Fixtures for the landing-page device screens.
 *
 * These exist so the marketing surfaces can mount the *real* Testownik
 * components — `QuestionCard`, the stats charts, the grades table — instead of
 * lookalikes. Everything here is shaped exactly like the API responses, so the
 * components take their normal render path with no network and no auth.
 */

export const PREVIEW_QUIZ_ID = "landing-preview-quiz";

/** Fixed instant so SSR and the client agree, and so charts never drift. */
export const PREVIEW_NOW = new Date("2026-01-15T18:30:00.000Z");

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

/** Shown on the phone so the AI hint UI appears in its real form. */
export const PREVIEW_ANSWER_HINTS: AnswerHint[] = [
  {
    answerIndex: 2,
    hint: "Najwięcej zapamiętujesz, gdy próbujesz **wydobyć wiedzę z pamięci** i wracasz do niej w odstępach.",
  },
];

export const PREVIEW_ANSWERS: AnswerRecord[] = [
  {
    id: "r-1",
    question: "q-83",
    answered_at: day(2),
    selected_answers: ["a-1"],
    was_correct: false,
  },
  {
    id: "r-2",
    question: "q-83",
    answered_at: day(1),
    selected_answers: ["a-3"],
    was_correct: true,
  },
];

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
  questions: [PREVIEW_QUESTION],
};

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
