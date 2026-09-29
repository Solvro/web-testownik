import type { CourseView } from "@testownik/core/grades/utils";
import type { Term } from "@testownik/core/user/types";
import type { ReactNode } from "react";

export type TermCourse = CourseView & { termId: string };

/** Everything app/(tabs)/grades/index.tsx computes, for the Android layout. */
export interface GradesContentProps {
  header: ReactNode;
  terms: Term[];
  termId: string;
  termIndex: number;
  chooseTerm: (id: string) => void;
  termAverage: (id: string) => number | null;
  mode: string;
  setMode: (mode: string) => void;
  termCourses: TermCourse[];
  overrides: Record<string, number>;
  choices: number[];
  setGrade: (id: string, value: number | null) => void;
  resetPredictions: () => void;
  average: number | null;
  projected: number | null;
  difference: number | null;
  changedCount: number;
  previous: Term | undefined;
  previousAverage: number | null;
  sheet: "semesters" | "combined" | null;
  setSheet: (sheet: "semesters" | "combined" | null) => void;
  detail: string | null;
  setDetail: (id: string | null) => void;
  selectedTerms: string[];
  toggleTerm: (id: string) => void;
  setSelection: (ids: string[]) => void;
  combinedAverage: number | null;
  combinedEcts: number;
  overallAverage: number | null;
  fmt: (value: number | null, digits?: number) => string;
  signed: (value: number) => string;
  error: unknown;
  refreshing: boolean;
  refresh: () => void;
}
