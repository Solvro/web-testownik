import {
  buildCourseView,
  totalEcts,
  weightedAverage,
} from "@testownik/core/grades/utils";
import type { CourseView } from "@testownik/core/grades/utils";
import type { Course, GradeReport } from "@testownik/core/user/types";

/**
 * Grades fixtures, fed through the app's own `buildCourseView` so the landing
 * page renders whatever the real grades screen would render for this data.
 */

function report(value: number, typeDescription: string): GradeReport {
  return {
    id: `${typeDescription}-${value.toString()}`,
    type_id: null,
    type_description: typeDescription,
    scope: "course",
    class_type_id: null,
    class_type: null,
    course_unit: null,
    grades_distribution: [],
    grades: [
      {
        value,
        value_symbol: value.toFixed(1).replace(".", ","),
        counts_into_average: true,
        passes: value >= 3,
      },
    ],
  };
}

const COURSES: Course[] = [
  ["Psychologia uczenia się", "PU", 7, 4],
  ["Sztuczna inteligencja", "SI", 8, 4.5],
  ["Rozpoznawanie i przetwarzanie obrazów", "RPO", 9, 5],
  ["Programowanie interfejsów webowych", "PIW", 6, 5],
].map(([name, code, ects, grade]) => ({
  course_id: code as string,
  course_name: name as string,
  ects: ects as number,
  term_id: "2025L",
  passing_status: "passed",
  reports: [report(grade as number, "Ocena końcowa")],
}));

export const PREVIEW_COURSE_VIEWS: CourseView[] = COURSES.map((course) =>
  buildCourseView(course),
);

export const PREVIEW_GRADE_SUMMARY = {
  average: weightedAverage(PREVIEW_COURSE_VIEWS),
  averageDelta: 0.184,
  previousTermName: "2024/25 zima",
  passedCount: PREVIEW_COURSE_VIEWS.length,
  courseCount: PREVIEW_COURSE_VIEWS.length,
  ectsEarned: totalEcts(PREVIEW_COURSE_VIEWS),
  ectsTotal: totalEcts(PREVIEW_COURSE_VIEWS),
};
