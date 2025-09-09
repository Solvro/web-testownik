export interface User {
  id: string;
  full_name: string;
  photo: string;
  student_number: string;
}

export interface UserData extends User {
  email: string;
  photo_url: string;
  overriden_photo_url: string | null;
  is_superuser: boolean;
  is_staff: boolean;
  hide_profile: boolean;
}

export interface UserSettings {
  sync_progress: boolean;
  initial_reoccurrences: number;
  wrong_answer_reoccurrences: number;
}

export const DEFAULT_USER_SETTINGS: UserSettings = Object.freeze({
  sync_progress: false,
  initial_reoccurrences: 1,
  wrong_answer_reoccurrences: 1,
});

export interface Term {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  finish_date: string;
  is_current: boolean;
}

export interface Group {
  id: string;
  name: string;
  term: Term;
  photo: string;
}

export interface GradesData {
  courses: Course[];
  terms: Term[];
}

export interface Course {
  course_id: string;
  course_name: string;
  ects: number;
  grades: Grade[];
  term_id: string;
  passing_status: "passed" | "failed" | "not_yet_passed";
}

export interface Grade {
  value: number;
  value_symbol: string;
  counts_into_average: boolean;
}
