export const mockTerms = [
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

export const mockCourses = [
  {
    course_id: "math101",
    course_name: "Matematyka",
    ects: 5,
    term_id: mockTerms[0].id,
    passing_status: "passed" as const,
    grades: [{ value: 4.0, value_symbol: "4.0", counts_into_average: true }],
  },
  {
    course_id: "cs101",
    course_name: "Informatyka",
    ects: 6,
    term_id: mockTerms[0].id,
    passing_status: "not_yet_passed" as const,
    grades: [{ value: 5.0, value_symbol: "5.0", counts_into_average: true }],
  },
  {
    course_id: "hist101",
    course_name: "Historia",
    ects: 4,
    term_id: mockTerms[1].id,
    passing_status: "failed" as const,
    grades: [{ value: 2.0, value_symbol: "2.0", counts_into_average: true }],
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
