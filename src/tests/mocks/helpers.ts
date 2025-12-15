import { Course } from "./GradesMock";

export const calculateAverage = (courses: Course[]) => {
  const { total, ects } = courses.reduce(
    (acc, course) => {
      const grade = course.grades.find((g) => g.counts_into_average);
      if (grade) {
        acc.total += grade.value * course.ects;
        acc.ects += course.ects;
      }
      return acc;
    },
    { total: 0, ects: 0 }
  );

  if (ects === 0) return "0.00";

  return (total / ects).toFixed(2);
};
