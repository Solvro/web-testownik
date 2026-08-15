import { buildCourseView } from "@/app/grades/components/grade-utils";
import type { CourseView } from "@/app/grades/components/grade-utils";
import type { Course, GradeReport } from "@/types/user";

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
  ["Psychologia uczenia się", "PU", 5, 4],
  ["Sztuczna inteligencja", "SI", 5, 4.5],
  ["Rozpoznawanie i przetwarzanie obrazów", "RPO", 4.5, 5],
  ["Programowanie interfejsów webowych", "PIW", 5, 5],
  ["Układy cyfrowe i systemy wbudowane 2", "UCSW", 4, 3.5],
  ["Projekt zespołowy", "PZ", 6, 4.5],
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
  average: 4.397,
  averageDelta: 0.184,
  previousTermName: "2024/25 zima",
  passedCount: PREVIEW_COURSE_VIEWS.length,
  courseCount: PREVIEW_COURSE_VIEWS.length,
  ectsEarned: 29.5,
  ectsTotal: 30,
};
