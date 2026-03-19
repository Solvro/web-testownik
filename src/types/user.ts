export const ACCOUNT_TYPE = {
  GUEST: "guest",
  EMAIL: "email",
  STUDENT: "student",
  LECTURER: "lecturer",
} as const;

export type AccountType = (typeof ACCOUNT_TYPE)[keyof typeof ACCOUNT_TYPE];

export interface User {
  id: string;
  full_name: string;
  photo: string;
  student_number: string;
}

export interface UserData extends User {
  email: string | null;
  photo_url: string;
  overriden_photo_url: string | null;
  is_superuser: boolean;
  is_staff: boolean;
  hide_profile: boolean;
  account_type: AccountType;
}

export interface UserSettings {
  initial_reoccurrences: number;
  wrong_answer_reoccurrences: number;
  max_question_reoccurrences: number | null;
  notify_quiz_shared: boolean;
  notify_bug_reported: boolean;
  notify_marketing: boolean;
}

export interface SettingsFormProps {
  settings: UserSettings;
  onSettingChange: (
    name: keyof UserSettings,
    value: UserSettings[keyof UserSettings],
  ) => void;
}

export const DEFAULT_USER_SETTINGS = {
  initial_reoccurrences: 1,
  wrong_answer_reoccurrences: 1,
  max_question_reoccurrences: 5,
  notify_quiz_shared: true,
  notify_bug_reported: true,
  notify_marketing: false,
} as const satisfies UserSettings;

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
