"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { StatsScope } from "@testownik/core/quiz/stats";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";

import {
  PREVIEW_HARDEST,
  PREVIEW_HARDEST_ALL,
  PREVIEW_HOURLY,
  PREVIEW_HOURLY_ALL,
  PREVIEW_QUIZ,
  PREVIEW_QUIZ_ID,
  PREVIEW_SESSIONS,
  PREVIEW_STATS,
  PREVIEW_TIMELINE,
  PREVIEW_TIMELINE_ALL,
} from "@/app/(landing)/preview/preview-fixtures";
import { ScopeToggle } from "@/components/quiz/stats/scope-toggle";
import { StatsInfoCard } from "@/components/quiz/stats/stats-info-card";
import { StatsTable } from "@/components/quiz/stats/stats-table";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { quizStatsKeys } from "@/hooks/use-quiz-stats";

import { SHOWCASE_QUIZ_METADATA } from "./showcase-quiz";

const QUIZ_ID = PREVIEW_QUIZ_ID;

const SessionsChart = dynamic(
  async () =>
    import("@/components/quiz/stats/sessions-chart").then(
      (module) => module.SessionsChart,
    ),
  { ssr: false },
);
const HourlyChart = dynamic(
  async () =>
    import("@/components/quiz/stats/hourly-chart").then(
      (module) => module.HourlyChart,
    ),
  { ssr: false },
);
const ScoreChart = dynamic(
  async () =>
    import("@/components/quiz/stats/score-chart").then(
      (module) => module.ScoreChart,
    ),
  { ssr: false },
);
const StudyTimeChart = dynamic(
  async () =>
    import("@/components/quiz/stats/study-time-chart").then(
      (module) => module.StudyTimeChart,
    ),
  { ssr: false },
);

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

let seededForClient: ReturnType<typeof useQueryClient> | null = null;

function seedLandingStats(
  queryClient: ReturnType<typeof useQueryClient>,
): void {
  if (seededForClient === queryClient) {
    return;
  }
  seededForClient = queryClient;

  queryClient.setQueryDefaults(["quiz-stats", QUIZ_ID], {
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  queryClient.setQueryData(
    quizStatsKeys.metadata(QUIZ_ID),
    SHOWCASE_QUIZ_METADATA,
  );
  queryClient.setQueryData(
    quizStatsKeys.aggregated(QUIZ_ID, "me"),
    PREVIEW_STATS.me,
  );
  queryClient.setQueryData(
    quizStatsKeys.aggregated(QUIZ_ID, "all"),
    PREVIEW_STATS.all,
  );
  queryClient.setQueryData(
    quizStatsKeys.timeline(QUIZ_ID, "me", 30),
    PREVIEW_TIMELINE,
  );
  queryClient.setQueryData(
    quizStatsKeys.timeline(QUIZ_ID, "all", 30),
    PREVIEW_TIMELINE_ALL,
  );
  queryClient.setQueryData(
    quizStatsKeys.sessions(QUIZ_ID, "me", 30),
    PREVIEW_SESSIONS,
  );
  queryClient.setQueryData(
    quizStatsKeys.hardest(QUIZ_ID, "me", 10),
    PREVIEW_HARDEST,
  );
  queryClient.setQueryData(
    quizStatsKeys.hardest(QUIZ_ID, "all", 10),
    PREVIEW_HARDEST_ALL,
  );
  queryClient.setQueryData(quizStatsKeys.hourly(QUIZ_ID, "me"), PREVIEW_HOURLY);
  queryClient.setQueryData(
    quizStatsKeys.hourly(QUIZ_ID, "all"),
    PREVIEW_HOURLY_ALL,
  );
}

/** Lightweight stand-in — avoids pulling the pie-chart chunk into HMR. */
function HardestQuestionsPreview(): React.JSX.Element {
  const [scope, setScope] = useState<StatsScope>("all");
  const data = scope === "all" ? PREVIEW_HARDEST_ALL : PREVIEW_HARDEST;
  const totalWrong = data.reduce((sum, item) => sum + item.wrong_answers, 0);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div>
          <CardTitle>Najtrudniejsze pytania</CardTitle>
          <CardDescription>
            Top pytania z największą liczbą błędnych odpowiedzi
          </CardDescription>
        </div>
        <CardAction>
          <ScopeToggle scope={scope} onScopeChange={setScope} />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-xs">
          Razem błędnych:{" "}
          <span className="text-foreground font-semibold tabular-nums">
            {totalWrong.toString()}
          </span>
        </p>
        {data.map((question, index) => (
          <div key={question.question_id} className="flex items-start gap-2">
            <span
              className="mt-1 size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <p className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
              {question.question_text}
            </p>
            <span className="shrink-0 text-sm font-medium tabular-nums">
              {question.wrong_answers.toString()} /{" "}
              {question.total_answers.toString()}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const placeholder = (
  <div className="bg-muted/40 min-h-64 animate-pulse rounded-xl" />
);

/**
 * Mounts `children` once they come within reach of the panel's own scroll
 * area. Four recharts charts plus the table in one frame stalled the panel
 * switch; now only what is on screen renders, the rest as it scrolls up.
 */
function WhenVisible({
  root,
  children,
}: {
  root: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}): React.JSX.Element {
  const slotReference = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const slot = slotReference.current;
    if (slot === null) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { root: root.current, rootMargin: "160px 0px" },
    );
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-adjust-state-on-prop-change -- Visibility changes asynchronously in the observer callback.
    observer.observe(slot);
    return () => {
      observer.disconnect();
    };
  }, [root]);

  return (
    <div ref={slotReference} className="min-w-0">
      {visible ? children : placeholder}
    </div>
  );
}

export function StatsDemo(): React.JSX.Element {
  const queryClient = useQueryClient();
  seedLandingStats(queryClient);
  const scrollReference = useRef<HTMLDivElement>(null);

  return (
    <div className="bg-background text-foreground [&_.recharts-surface:focus-visible]:outline-primary flex h-[min(70svh,32rem)] min-h-80 min-w-0 flex-col overflow-hidden rounded-3xl border shadow-xl shadow-black/5 sm:h-full sm:min-h-140 [&_.recharts-surface:focus-visible]:outline-2 [&_.recharts-surface:focus-visible]:outline-offset-[-2px] [&_.recharts-surface:focus-visible]:outline-solid">
      <header className="border-border bg-card border-b px-4 py-4 sm:px-5">
        <strong className="block truncate text-sm sm:text-base">
          Statystyki: {PREVIEW_QUIZ.title}
        </strong>
      </header>

      <div
        ref={scrollReference}
        className="min-h-0 min-w-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto p-1 sm:p-5 [&_[data-slot=card]]:min-w-0 [&_[data-slot=chart]]:max-w-full"
      >
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
          <StatsInfoCard
            quiz={SHOWCASE_QUIZ_METADATA}
            lastActivityAt={PREVIEW_STATS.me.last_activity_at}
          />
          <StatsTable quizId={QUIZ_ID} canViewAll />
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
          <WhenVisible root={scrollReference}>
            <SessionsChart quizId={QUIZ_ID} canViewAll />
          </WhenVisible>
          <WhenVisible root={scrollReference}>
            <HourlyChart quizId={QUIZ_ID} canViewAll />
          </WhenVisible>
          <WhenVisible root={scrollReference}>
            <ScoreChart quizId={QUIZ_ID} canViewAll />
          </WhenVisible>
          <WhenVisible root={scrollReference}>
            <StudyTimeChart quizId={QUIZ_ID} canViewAll />
          </WhenVisible>
        </div>
        <WhenVisible root={scrollReference}>
          <HardestQuestionsPreview />
        </WhenVisible>
      </div>
    </div>
  );
}
