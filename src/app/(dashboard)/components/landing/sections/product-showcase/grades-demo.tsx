"use client";

import { useMemo, useState } from "react";

import { AverageSimulator } from "@/app/grades/components/average-simulator";
import {
  SIMULATOR_GRADES,
  weightedAverage,
} from "@/app/grades/components/grade-utils";
import { SummaryStats } from "@/app/grades/components/summary-stats";
import {
  PREVIEW_COURSE_VIEWS,
  PREVIEW_GRADE_SUMMARY,
} from "@/components/testownik-preview/preview-grades";

const COURSES = PREVIEW_COURSE_VIEWS.slice(0, 4);

export function GradesDemo(): React.JSX.Element {
  const [whatIf, setWhatIf] = useState<Record<string, number>>({});
  const realAverage = weightedAverage(COURSES);
  const { projected, projectedDelta } = useMemo(() => {
    let sum = 0;
    let weight = 0;

    for (const course of COURSES) {
      const hasOverride = Object.hasOwn(whatIf, course.id);
      const value = hasOverride ? whatIf[course.id] : course.mainValue;
      const counts = hasOverride
        ? true
        : course.counts && course.mainValue !== null;

      if (value !== null && counts) {
        sum += value * course.ects;
        weight += course.ects;
      }
    }

    const nextProjected = weight === 0 ? null : sum / weight;
    return {
      projected: nextProjected,
      projectedDelta:
        nextProjected === null || realAverage === null
          ? null
          : nextProjected - realAverage,
    };
  }, [realAverage, whatIf]);

  return (
    <div className="bg-background text-foreground flex h-full min-h-[35rem] flex-col overflow-hidden rounded-[1rem] border p-3 shadow-xl shadow-black/5 sm:p-5">
      <div className="mx-auto grid w-full max-w-[48rem] flex-none gap-3.5">
        <SummaryStats {...PREVIEW_GRADE_SUMMARY} average={realAverage} />
      </div>
      <div className="mx-auto mt-3.5 min-h-0 w-full max-w-[48rem] flex-1 [&_[role=region]]:flex [&_[role=region]]:h-full [&_[role=region]]:flex-col [&_[role=region]_[data-slot=card-content]]:flex [&_[role=region]_[data-slot=card-content]]:h-full [&_[role=region]_[data-slot=card-content]]:flex-col [&_[role=region]_[data-slot=card-content]>div:nth-child(2)]:max-h-none [&_[role=region]_[data-slot=card-content]>div:nth-child(2)]:min-h-0 [&_[role=region]_[data-slot=card-content]>div:nth-child(2)]:flex-1">
        <AverageSimulator
          courses={COURSES}
          grades={[...SIMULATOR_GRADES]}
          whatIf={whatIf}
          realAverage={realAverage}
          projected={projected}
          projectedDelta={projectedDelta}
          onSetGrade={(courseId, value) => {
            setWhatIf((current) => {
              if (value === null) {
                return Object.fromEntries(
                  Object.entries(current).filter(([id]) => id !== courseId),
                );
              }
              return { ...current, [courseId]: value };
            });
          }}
          onReset={() => {
            setWhatIf({});
          }}
        />
      </div>
    </div>
  );
}
