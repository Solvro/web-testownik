import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const COURSE_ROWS = [
  { key: "c1", title: "w-4/5", code: "w-28", expanded: true },
  { key: "c2", title: "w-3/5", code: "w-20" },
  { key: "c3", title: "w-11/12", code: "w-24" },
  { key: "c4", title: "w-2/3", code: "w-18" },
  { key: "c5", title: "w-5/6", code: "w-28" },
];

const SIMULATOR_ROWS = [
  { key: "s1", title: "w-4/5" },
  { key: "s2", title: "w-2/3" },
  { key: "s3", title: "w-11/12" },
];

const GRADE_OPTIONS = ["g1", "g2", "g3", "g4", "g5", "g6"];
const CHART_BARS = [
  "h-[34%]",
  "h-[56%]",
  "h-[82%]",
  "h-[68%]",
  "h-[42%]",
  "h-[24%]",
];

function StatTileSkeleton() {
  return (
    <div className="bg-card rounded-xl border px-3 py-2.5 sm:p-4 sm:px-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 sm:block">
        <Skeleton className="h-4 w-28" />
        <div className="col-start-2 row-span-2 row-start-1 mt-0 flex shrink-0 items-baseline gap-2.5 sm:mt-1">
          <Skeleton className="h-7 w-16 sm:h-9.25 sm:w-20" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
        <Skeleton className="col-start-1 row-start-2 mt-1 h-3 w-32 sm:h-4" />
      </div>
    </div>
  );
}

function GradeBadgeSkeleton() {
  return (
    <div className="flex w-16 shrink-0 justify-end sm:w-23">
      <Skeleton className="h-7 min-w-11 rounded-lg sm:h-8 sm:min-w-12" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="border-border/70 flex h-23 items-end gap-2 rounded-md border border-dashed px-4 py-3">
      {CHART_BARS.map((height, index) => (
        <Skeleton
          key={`${height}-${String(index)}`}
          className={`flex-1 rounded-t-sm rounded-b-none ${height}`}
        />
      ))}
    </div>
  );
}

function CourseRowSkeleton({
  title,
  code,
  expanded = false,
}: {
  title: string;
  code: string;
  expanded?: boolean;
}) {
  return (
    <div
      className="data-[expanded=true]:bg-primary/5 mb-0.5 rounded-xl"
      data-expanded={expanded}
    >
      <div className="flex items-center gap-1 px-2 py-2 sm:gap-3 sm:px-3 sm:py-3">
        <div className="min-w-0 flex-1">
          <Skeleton className={cn("h-4", title)} />
          <Skeleton className={cn("mt-1.5 h-3", code)} />
        </div>
        <Skeleton className="h-5 w-8 shrink-0 sm:w-16" />
        <GradeBadgeSkeleton />
        <Skeleton className="hidden size-4 shrink-0 rounded sm:block" />
      </div>

      {expanded ? (
        <div className="pt-1.5 pr-2 pb-4 pl-3 sm:pr-3.5 sm:pl-6">
          <div className="grid grid-cols-1 items-end gap-5 py-3.5 md:grid-cols-[1.35fr_1fr]">
            <div>
              <div className="mb-2 flex justify-between">
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-3 w-16" />
              </div>
              <ChartSkeleton />
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="flex justify-between gap-4">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3.5 w-12" />
              </div>
              <div className="flex justify-between gap-4">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3.5 w-10" />
              </div>
              <div className="flex justify-between gap-4">
                <Skeleton className="h-3.5 w-18" />
                <Skeleton className="h-3.5 w-28" />
              </div>
              <Skeleton className="h-6 w-36 rounded-full" />
            </div>
          </div>
          <div className="border-border mt-3 border-t border-dashed pt-3">
            <Skeleton className="mb-2 h-3 w-28" />
            <div className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="mt-1.5 h-3 w-28" />
              </div>
              <Skeleton className="hidden h-7.5 w-30 rounded-md sm:block" />
              <Skeleton className="h-7 min-w-11 rounded-lg" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SimulatorRowSkeleton({ title }: { title: string }) {
  return (
    <div className="border-b px-1 py-2.5">
      <div className="mb-2 flex items-baseline justify-between gap-2.5 py-0.75">
        <Skeleton className={cn("h-3.5", title)} />
        <Skeleton className="h-3 w-12" />
      </div>
      <div className="bg-secondary flex gap-1 rounded-lg p-1">
        {GRADE_OPTIONS.map((key) => (
          <Skeleton key={key} className="h-7 flex-1 rounded-md" />
        ))}
      </div>
    </div>
  );
}

export function GradesSkeleton() {
  return (
    <div className="pb-4" role="status" aria-label="Ładowanie ocen">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h1 className="text-2xl leading-tight font-extrabold tracking-tight sm:mt-1.5 sm:text-3xl">
          Twoje oceny i średnia
        </h1>
        <Skeleton className="h-10 w-60 max-w-full rounded-md" />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:mt-6 sm:grid-cols-3 sm:gap-3.5">
        <StatTileSkeleton />
        <div className="hidden sm:block">
          <StatTileSkeleton />
        </div>
        <div className="hidden sm:block">
          <StatTileSkeleton />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 items-start gap-4 sm:mt-5 lg:grid-cols-[1.55fr_1fr] lg:gap-5">
        <div className="bg-card rounded-2xl border">
          <div className="text-muted-foreground flex items-center gap-1 px-4 pt-4 pb-2 text-xs tracking-wide uppercase sm:gap-3 sm:px-6 sm:pt-4.5">
            <div className="flex-1">Przedmiot</div>
            <div className="w-8 text-center sm:w-16">ECTS</div>
            <div className="w-16 text-right sm:w-23">Ocena</div>
            <div className="hidden sm:block sm:w-6" />
          </div>
          <div className="px-2 pb-3 sm:px-3">
            {COURSE_ROWS.map((row) => (
              <CourseRowSkeleton
                key={row.key}
                title={row.title}
                code={row.code}
                expanded={row.expanded}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Tabs defaultValue="simulator" className="gap-3">
            <TabsList className="w-full">
              <TabsTrigger value="simulator">Symulator</TabsTrigger>
              <TabsTrigger value="terms">Wiele semestrów</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="bg-card overflow-hidden rounded-2xl border">
            <div className="flex items-start justify-between gap-3.5 border-b px-5 py-4.5">
              <div>
                <div className="text-base font-bold">Symulator średniej</div>
                <Skeleton className="mt-2 h-3 w-44" />
                <Skeleton className="mt-1.5 h-3 w-36" />
              </div>
              <div className="text-right">
                <div className="text-muted-foreground text-xs">Prognoza</div>
                <Skeleton className="mt-1 h-7.5 w-16" />
                <Skeleton className="mt-1 h-3 w-12" />
              </div>
            </div>
            <div className="px-3.5 pt-1.5 pb-2">
              {SIMULATOR_ROWS.map((row) => (
                <SimulatorRowSkeleton key={row.key} title={row.title} />
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-8 w-18 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
