/**
 * Shape of the data returned by `GET /api/wrapped/`.
 */

export interface WrappedSeason {
  /** e.g. "Semestr zimowy 2025/2026" */
  label: string;
  /** e.g. "1 paź — 28 lut · 88 dni nauki" */
  date_range: string;
  /** Short label for the header pill / outro, e.g. "25/26" */
  year_label: string;
}

export interface WrappedStudyTime {
  /** Total minutes studied; formatted client-side as "X godz Y min". */
  total_minutes: number;
}

export interface WrappedVolume {
  total_answers: number;
  sessions: number;
  answers_per_session: number;
}

export interface WrappedAccuracy {
  percent: number;
  correct: number;
  wrong: number;
  first_attempt_percent: number;
}

export interface WrappedPersona {
  name: string;
  description: string;
}

export interface WrappedRhythm {
  /** 24 weights (0–100), one per hour: all answers given that hour. */
  hours: number[];
  /** 24 weights (0–100), one per hour: correct answers given that hour (≤ hours). */
  correct_hours: number[];
  peak_hour: number;
}

export interface WrappedTopQuiz {
  rank: number;
  name: string;
  /** Relative weight used to size the bar. */
  value: number;
}

export interface WrappedHardestQuestion {
  question_number: number;
  quiz_name: string;
  text: string;
  wrong_count: number;
  /** How many times the user eventually answered it correctly. */
  correct_count: number;
  /** Optional image attached to the question (rare). */
  image?: string | null;
}

export interface WrappedCreatorImpact {
  people: number;
  answers: number;
  hours: number;
}

export interface WrappedRank {
  top_percent: number;
  /** Where the marker sits on the percentile bar (0–100). */
  percentile_fill: number;
}

export interface WrappedData {
  is_empty: boolean;
  /** True for the platform-wide (global) Wrapped. */
  is_global?: boolean;
  season: WrappedSeason | null;
  /** Present only when `is_empty` is false. */
  study_time?: WrappedStudyTime;
  volume?: WrappedVolume;
  accuracy?: WrappedAccuracy;
  rhythm?: WrappedRhythm;
  top_quizzes?: WrappedTopQuiz[];
  hardest_question?: WrappedHardestQuestion | null;
  creator_impact?: WrappedCreatorImpact | null;
  rank?: WrappedRank;
  /** Optional first-name personalisation. */
  name?: string;
}

/** Narrowed variant where the story fields are guaranteed present. */
export interface WrappedStoryData extends WrappedData {
  is_empty: false;
  season: WrappedSeason;
  study_time: WrappedStudyTime;
  volume: WrappedVolume;
  accuracy: WrappedAccuracy;
  rhythm: WrappedRhythm;
  top_quizzes: WrappedTopQuiz[];
  rank: WrappedRank;
}

export function isWrappedStoryData(
  data: WrappedData,
): data is WrappedStoryData {
  return (
    !data.is_empty &&
    data.season !== null &&
    data.study_time !== undefined &&
    data.volume !== undefined &&
    data.accuracy !== undefined &&
    data.rhythm !== undefined &&
    data.top_quizzes !== undefined &&
    data.rank !== undefined
  );
}
