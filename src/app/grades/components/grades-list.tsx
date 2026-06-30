import { Card, CardContent } from "@/components/ui/card";

import { CourseRow } from "./course-row";
import type { CourseView } from "./grade-utils";

export function GradesList({
  courses,
  expanded,
  onToggle,
}: {
  courses: CourseView[];
  expanded: Record<string, boolean>;
  onToggle: (id: string, open: boolean) => void;
}) {
  return (
    <Card
      className="p-0 md:overflow-visible"
      role="region"
      aria-label="Lista przedmiotów"
    >
      <CardContent className="p-0">
        <div className="text-muted-foreground flex items-center gap-1 px-4 pt-4 pb-2 text-xs tracking-wide uppercase sm:gap-3 sm:px-6 sm:pt-4.5">
          <div className="flex-1">Przedmiot</div>
          <div className="w-8 text-center sm:w-16">ECTS</div>
          <div className="w-16 text-right sm:w-23">Ocena</div>
          <div className="hidden sm:block sm:w-6" />
        </div>
        <div className="px-2 pb-3 sm:px-3">
          {courses.length === 0 ? (
            <div className="text-muted-foreground px-3 py-10 text-center text-sm">
              Brak przedmiotów w tym semestrze.
            </div>
          ) : (
            courses.map((course) => (
              <CourseRow
                key={course.id}
                course={course}
                expanded={expanded[course.id] ?? false}
                onOpenChange={(open) => {
                  onToggle(course.id, open);
                }}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
