export const ACCOUNT_TYPE = {
  GUEST: "guest",
  EMAIL: "email",
  STUDENT: "student",
  LECTURER: "lecturer",
} as const;

export type AccountType = (typeof ACCOUNT_TYPE)[keyof typeof ACCOUNT_TYPE];

export const ACCOUNT_LEVEL = {
  BASIC: "basic",
  SILVER: "silver",
  GOLD: "gold",
} as const;

export type AccountLevel = (typeof ACCOUNT_LEVEL)[keyof typeof ACCOUNT_LEVEL];

export interface User {
  id: string;
  full_name: string;
  photo: string;
  student_number: string;
  account_type?: AccountType;
  account_level?: AccountLevel;
}

export interface UserData extends User {
  email: string | null;
  photo_url: string;
  overriden_photo_url: string | null;
  is_superuser: boolean;
  is_staff: boolean;
  hide_profile: boolean;
  account_type: AccountType;
  account_level: AccountLevel;
}

export interface UserSettings {
  initial_reoccurrences: number;
  wrong_answer_reoccurrences: number;
  max_question_reoccurrences: number | null;
  ai_disabled: boolean;
  default_ai_model: string | null;
  notify_quiz_shared: boolean;
  notify_bug_reported: boolean;
  notify_marketing: boolean;
}

export interface AuthorizedApp {
  client_id: string;
  oauth_application_id: string;
  client_name: string;
  client_uri: string;
  logo_uri: string;
  created: string;
  scopes: string;
}

export interface SettingsFormProps {
  settings: UserSettings;
  disabled?: boolean;
  onSettingChange: <K extends keyof UserSettings>(
    name: K,
    value: UserSettings[K],
  ) => void;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  initial_reoccurrences: 1,
  wrong_answer_reoccurrences: 1,
  max_question_reoccurrences: 5,
  ai_disabled: false,
  default_ai_model: null,
  notify_quiz_shared: true,
  notify_bug_reported: true,
  notify_marketing: false,
};

export interface Term {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  finish_date: string;
  is_current: boolean;
  weighted_average?: number | null;
  weighted_ects?: number;
  weighted_points?: number;
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
  class_types?: CourseClassType[];
  grades?: Grade[];
  reports?: GradeReport[];
  term_id: string;
  weighted_average?: number | null;
  passing_status: "passed" | "failed" | "not_yet_passed";
}

export interface Grade {
  value: number | null;
  value_symbol: string | null;
  counts_into_average: boolean;
  passes?: boolean;
  exam_id?: string | number | null;
  exam_session_number?: string | number | null;
  report_type_id?: string | null;
  report_type_description?: string | null;
  scope?: string;
  course_unit_id?: string | null;
  class_type_id?: string | null;
  class_type?: CourseClassType | null;
  date_modified?: string | null;
  modification_author?: GradeIssuer | null;
}

export interface GradeIssuer {
  id?: string | number | null;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | Record<string, string | null> | null;
  [key: string]: unknown;
}

export interface GradeReport {
  id: string | number | null;
  type_id: string | null;
  type_description: string | null;
  scope: string;
  class_type_id: string | null;
  class_type: CourseClassType | null;
  course_unit: CourseUnit | null;
  grades_distribution: GradeDistributionItem[];
  grades: Grade[];
}

export interface CourseUnit {
  id: string | null;
  course_id: string | null;
  course_name?: Record<string, string | null> | null;
  term_id: string | null;
  classtype_id: string | null;
}

export interface CourseClassType {
  id: string;
  name_pl: string | null;
  name_en: string | null;
}

export interface GradeDistributionItem {
  grade_symbol: string | null;
  percentage: number | null;
}
