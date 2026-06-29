import { fmtNumber, fmtSigned, gradeColor } from "./grade-utils";

function StatTile({
  label,
  children,
  note,
}: {
  label: string;
  children: React.ReactNode;
  note?: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-xl border px-3 py-2.5 sm:p-4 sm:px-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 sm:block">
        <div className="text-muted-foreground text-xs tracking-wide uppercase">
          {label}
        </div>
        <div className="col-start-2 row-span-2 row-start-1 mt-0 shrink-0 sm:mt-1">
          {children}
        </div>
        {note != null && (
          <div className="text-muted-foreground col-start-1 row-start-2 mt-0 text-xs sm:mt-1">
            {note}
          </div>
        )}
      </div>
    </div>
  );
}

export function SummaryStats({
  average,
  averageDelta,
  previousTermName,
  passedCount,
  courseCount,
  ectsEarned,
  ectsTotal,
}: {
  average: number | null;
  averageDelta: number | null;
  previousTermName: string | null;
  passedCount: number;
  courseCount: number;
  ectsEarned: number;
  ectsTotal: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3.5">
      <StatTile
        label="Średnia ważona"
        note={
          previousTermName != null && averageDelta != null ? (
            <>względem {previousTermName}</>
          ) : undefined
        }
      >
        <div className="flex items-baseline gap-2.5">
          <span
            className="text-2xl leading-none font-extrabold tabular-nums sm:text-4xl"
            style={{ color: gradeColor(average).fg }}
          >
            {fmtNumber(average, 3)}
          </span>
          {averageDelta != null && (
            <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 text-xs font-bold tabular-nums">
              {fmtSigned(averageDelta)}
            </span>
          )}
        </div>
      </StatTile>

      <div className="hidden sm:block">
        <StatTile label="Zaliczone" note="przedmiotów w semestrze">
          <div className="text-2xl leading-none font-extrabold tabular-nums sm:text-4xl">
            {passedCount}
            <span className="text-muted-foreground text-sm font-semibold sm:text-base">
              /{courseCount}
            </span>
          </div>
        </StatTile>
      </div>

      <div className="hidden sm:block">
        <StatTile label="Punkty ECTS" note="zdobyte z dostępnych">
          <div className="text-2xl leading-none font-extrabold tabular-nums sm:text-4xl">
            {ectsEarned}
            <span className="text-muted-foreground text-sm font-semibold sm:text-base">
              /{ectsTotal}
            </span>
          </div>
        </StatTile>
      </div>
    </div>
  );
}
