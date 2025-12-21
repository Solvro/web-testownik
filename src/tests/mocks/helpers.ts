import type { Course } from "./grade-mock";

export const calculateAverage = (courses: Course[]) => {
  const { total, ects } = courses.reduce(
    (accumulator, course) => {
      const grade = course.grades.find((g) => g.counts_into_average);
      if (grade != null) {
        accumulator.total += grade.value * course.ects;
        accumulator.ects += course.ects;
      }
      return accumulator;
    },
    { total: 0, ects: 0 },
  );

  if (ects === 0) {
    return "0.00";
  }

  return (total / ects).toFixed(2);
};
