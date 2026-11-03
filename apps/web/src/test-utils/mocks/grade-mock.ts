export interface Term {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  finish_date: string;
}

export interface Course {
  course_id: string;
  course_name: string;
  ects: number;
  class_types?: {
    id: string;
    name_pl: string | null;
    name_en: string | null;
  }[];
  term_id: Term["id"];
  passing_status: "passed" | "not_yet_passed" | "failed";
  grades: {
    value: number;
    value_symbol: string;
    counts_into_average: boolean;
    date_modified?: string | null;
  }[];
}

export const mockTerms: Term[] = [
  {
    id: "term1",
    name: "Semestr zimowy 2024/25",
    start_date: "2024-10-01",
    end_date: "2025-01-31",
    finish_date: "2025-02-15",
  },
  {
    id: "term2",
    name: "Semestr letni 2024/25",
    start_date: "2025-03-01",
    end_date: "2025-06-30",
    finish_date: "2025-07-15",
  },
];

export const mockCourses: Course[] = [
  {
    course_id: "math101",
    course_name: "Matematyka",
    ects: 5,
    class_types: [{ id: "W", name_pl: "Wykład", name_en: "Lecture" }],
    term_id: mockTerms[0].id,
    passing_status: "passed" as const,
    grades: [
      {
        value: 4,
        value_symbol: "4.0",
        counts_into_average: true,
        date_modified: "2025-01-20T10:15:00",
      },
    ],
  },
  {
    course_id: "cs101",
    course_name: "Informatyka",
    ects: 6,
    class_types: [{ id: "C", name_pl: "Ćwiczenia", name_en: "Classes" }],
    term_id: mockTerms[0].id,
    passing_status: "not_yet_passed" as const,
    grades: [
      {
        value: 5,
        value_symbol: "5.0",
        counts_into_average: true,
        date_modified: "2025-01-22T12:00:00",
      },
    ],
  },
  {
    course_id: "hist101",
    course_name: "Historia",
    ects: 4,
    class_types: [{ id: "L", name_pl: "Laboratorium", name_en: "Laboratory" }],
    term_id: mockTerms[1].id,
    passing_status: "failed" as const,
    grades: [
      {
        value: 2,
        value_symbol: "2.0",
        counts_into_average: true,
        date_modified: "2025-06-10T09:30:00",
      },
    ],
  },
];

export const emptyCourse = {
  course_id: "empty",
  course_name: "empty course",
  ects: 5,
  grades: [],
  term_id: mockTerms[0].id,
  passing_status: "not_yet_passed",
};
