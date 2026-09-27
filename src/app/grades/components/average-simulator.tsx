import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import type { CourseView } from "./grade-utils";
import { fmtNumber, fmtSigned, gradeColor } from "./grade-utils";

function courseMeta(course: CourseView) {
  return [
    ...course.courseTypeSymbols,
    `${course.ects.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} ECTS`,
  ].join(" · ");
}

export function AverageSimulator({
  courses,
  grades,
  whatIf,
  realAverage,
  projected,
  projectedDelta,
  onSetGrade,
  onReset,
}: {
  courses: CourseView[];
  grades: number[];
  whatIf: Record<string, number>;
  realAverage: number | null;
  projected: number | null;
  projectedDelta: number | null;
  onSetGrade: (courseId: string, value: number | null) => void;
  onReset: () => void;
}) {
  const overrideOf = (id: string): number | undefined => whatIf[id];
  return (
    <Card className="p-0" role="region" aria-label="Symulator średniej">
      <CardContent className="p-0">
        <div className="flex items-start justify-between gap-3.5 border-b px-5 py-4.5">
          <div>
            <div className="text-base font-bold">Symulator średniej</div>
            <p className="text-muted-foreground mt-1 max-w-50 text-xs leading-snug">
              Oceny nie zmienią się w USOSie, kliknij dwukrotnie żeby zresetować
            </p>
          </div>
          <div className="text-right">
            <div className="text-muted-foreground text-xs">Prognoza</div>
            <div
              className="text-3xl leading-none font-extrabold tabular-nums"
              style={{ color: gradeColor(projected).fg }}
            >
              {fmtNumber(projected, 3)}
            </div>
            <div className="text-primary mt-1 text-xs font-bold tabular-nums">
              {projectedDelta == null || Math.abs(projectedDelta) < 1e-9
                ? "±0,000"
                : fmtSigned(projectedDelta, 3)}
            </div>
          </div>
        </div>
        <div className="px-3.5 pt-1.5 pb-2 sm:max-h-72 sm:overflow-y-auto">
          {courses.map((course) => {
            const current = overrideOf(course.id) ?? course.mainValue;
            return (
              <div key={course.id} className="border-b px-1 py-2.5">
                <div className="mb-2 flex items-baseline justify-between gap-2.5">
                  <div className="truncate text-sm font-semibold">
                    {course.name}
                  </div>
                  <div
                    className="text-muted-foreground text-xs whitespace-nowrap tabular-nums"
                    title={
                      course.courseTypeNames.length > 0
                        ? course.courseTypeNames.join(" · ")
                        : undefined
                    }
                  >
                    {courseMeta(course)}
                  </div>
                </div>
                <div className="bg-secondary flex gap-1 rounded-lg p-1">
                  {grades.map((option) => {
                    const active =
                      current != null && Math.abs(current - option) < 1e-6;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          onSetGrade(course.id, active ? null : option);
                        }}
                        className="flex-1 cursor-pointer rounded-md py-1.5 text-center text-xs font-bold tabular-nums transition-colors"
                        style={{
                          background: active
                            ? `color-mix(in oklab, ${gradeColor(option).fg} 90%, transparent)`
                            : "transparent",
                          color: active ? "#fff" : "var(--muted-foreground)",
                        }}
                      >
                        {option.toLocaleString("pl-PL", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
          <span className="text-muted-foreground text-xs">
            realna średnia{" "}
            <b className="text-foreground tabular-nums">
              {fmtNumber(realAverage, 3)}
            </b>
          </span>
          <Button variant="outline" size="sm" onClick={onReset}>
            Resetuj
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
