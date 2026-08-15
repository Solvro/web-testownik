"use client";

import { useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

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
import type { QuizMetadata } from "@/types/quiz";
import { AccessLevel } from "@/types/quiz";
import type {
  HardestQuestion,
  HourlyEntry,
  QuizStats,
  SessionEntry,
  StatsScope,
  TimelineEntry,
} from "@/types/quiz-stats";
import { ACCOUNT_LEVEL, ACCOUNT_TYPE } from "@/types/user";

const QUIZ_ID = "landing-product-quiz";
const QUIZ_TITLE = "Jak uczyć się skuteczniej?";

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

const METADATA: QuizMetadata = {
  id: QUIZ_ID,
  title: QUIZ_TITLE,
  description: "Praktyczny zestaw do samodzielnej nauki",
  creator: {
    id: "landing-creator",
    full_name: "Antoni Czaplicki",
    photo: "https://github.com/Antoni-Czaplicki.png",
    student_number: "268431",
    account_type: ACCOUNT_TYPE.STUDENT,
    account_level: ACCOUNT_LEVEL.GOLD,
  },
  visibility: AccessLevel.UNLISTED,
  allow_anonymous: true,
  is_anonymous: false,
  version: 1,
  can_edit: true,
  created_at: "2026-02-12T14:18:00.000Z",
  updated_at: "2026-06-21T09:05:00.000Z",
  last_used_at: "2026-06-28T19:42:00.000Z",
  question_count: 3,
};

const ALL_STATS: QuizStats = {
  quiz_id: QUIZ_ID,
  total_answers: 4827,
  correct_answers: 3909,
  wrong_answers: 918,
  accuracy: 81,
  first_answer_accuracy: 68.4,
  study_time_seconds: null,
  total_study_time_seconds: 262_800,
  average_study_time_seconds: 2796,
  sessions_count: 94,
  unique_users_count: 37,
  last_activity_at: "2026-06-28T19:42:00.000Z",
};

const MY_STATS: QuizStats = {
  quiz_id: QUIZ_ID,
  total_answers: 186,
  correct_answers: 142,
  wrong_answers: 44,
  accuracy: 76.3,
  first_answer_accuracy: 61.2,
  study_time_seconds: 11_040,
  total_study_time_seconds: 11_040,
  average_study_time_seconds: 1380,
  sessions_count: 8,
  unique_users_count: null,
  last_activity_at: "2026-06-28T19:42:00.000Z",
};

function buildTimeline(
  seed: readonly number[],
  answersPerSession: number,
  accuracy: number,
  minutesPerSession: number,
): TimelineEntry[] {
  const today = new Date("2026-06-28T12:00:00.000Z");
  return seed.map((sessions_count, offsetFromEnd) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (seed.length - 1 - offsetFromEnd));
    const total_answers = sessions_count * answersPerSession;
    const correct_answers = Math.round((total_answers * accuracy) / 100);
    return {
      date: date.toISOString().slice(0, 10),
      sessions_count,
      total_answers,
      correct_answers,
      total_study_time_seconds: sessions_count * minutesPerSession * 60,
    };
  });
}

const TIMELINE_ALL = buildTimeline([1, 2, 3, 2, 4, 5, 4, 6, 5, 7], 48, 81, 42);
const TIMELINE_ME = buildTimeline([0, 1, 1, 0, 1, 1, 1, 0, 1, 1], 23, 76, 23);

const SESSIONS: SessionEntry[] = [
  {
    session_id: "s1",
    started_at: "2026-06-10T18:10:00.000Z",
    ended_at: "2026-06-10T18:34:00.000Z",
    study_time_seconds: 1440,
    total_answers: 24,
    correct_answers: 16,
    accuracy: 66.7,
  },
  {
    session_id: "s2",
    started_at: "2026-06-15T17:40:00.000Z",
    ended_at: "2026-06-15T18:05:00.000Z",
    study_time_seconds: 1500,
    total_answers: 22,
    correct_answers: 17,
    accuracy: 77.3,
  },
  {
    session_id: "s3",
    started_at: "2026-06-21T16:08:00.000Z",
    ended_at: "2026-06-21T16:29:00.000Z",
    study_time_seconds: 1260,
    total_answers: 20,
    correct_answers: 16,
    accuracy: 80,
  },
  {
    session_id: "s4",
    started_at: "2026-06-26T18:22:00.000Z",
    ended_at: "2026-06-26T18:48:00.000Z",
    study_time_seconds: 1560,
    total_answers: 25,
    correct_answers: 20,
    accuracy: 80,
  },
  {
    session_id: "s5",
    started_at: "2026-06-28T19:12:00.000Z",
    ended_at: "2026-06-28T19:42:00.000Z",
    study_time_seconds: 1800,
    total_answers: 17,
    correct_answers: 13,
    accuracy: 76.5,
  },
];

const HOURLY_ALL: HourlyEntry[] = [
  2, 1, 0, 0, 0, 1, 3, 8, 16, 24, 31, 38, 46, 42, 37, 45, 58, 72, 86, 100, 91,
  67, 39, 14,
].map((sessions_count, hour) => ({ hour, sessions_count }));

const HOURLY_ME: HourlyEntry[] = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 1, 2, 3, 4, 5, 3, 2, 1, 0,
].map((sessions_count, hour) => ({ hour, sessions_count }));

const HARDEST_ALL: HardestQuestion[] = [
  {
    question_id: "landing-q-1",
    question_text: "Która technika najskuteczniej sprawdza pamięć?",
    wrong_answers: 28,
    total_answers: 41,
  },
  {
    question_id: "landing-q-2",
    question_text: "Jak zaplanować powtórki po błędnej sesji?",
    wrong_answers: 19,
    total_answers: 36,
  },
  {
    question_id: "landing-q-3",
    question_text: "Co robić przy wyniku 72% przed kolejną próbą?",
    wrong_answers: 14,
    total_answers: 33,
  },
];

const HARDEST_ME: HardestQuestion[] = [
  {
    question_id: "landing-q-1",
    question_text: "Która technika najskuteczniej sprawdza pamięć?",
    wrong_answers: 4,
    total_answers: 8,
  },
  {
    question_id: "landing-q-2",
    question_text: "Jak zaplanować powtórki po błędnej sesji?",
    wrong_answers: 3,
    total_answers: 8,
  },
  {
    question_id: "landing-q-3",
    question_text: "Co robić przy wyniku 72% przed kolejną próbą?",
    wrong_answers: 2,
    total_answers: 7,
  },
];

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

  queryClient.setQueryData(quizStatsKeys.metadata(QUIZ_ID), METADATA);
  queryClient.setQueryData(quizStatsKeys.aggregated(QUIZ_ID, "me"), MY_STATS);
  queryClient.setQueryData(quizStatsKeys.aggregated(QUIZ_ID, "all"), ALL_STATS);
  queryClient.setQueryData(
    quizStatsKeys.timeline(QUIZ_ID, "me", 30),
    TIMELINE_ME,
  );
  queryClient.setQueryData(
    quizStatsKeys.timeline(QUIZ_ID, "all", 30),
    TIMELINE_ALL,
  );
  queryClient.setQueryData(quizStatsKeys.sessions(QUIZ_ID, "me", 30), SESSIONS);
  queryClient.setQueryData(
    quizStatsKeys.hardest(QUIZ_ID, "me", 10),
    HARDEST_ME,
  );
  queryClient.setQueryData(
    quizStatsKeys.hardest(QUIZ_ID, "all", 10),
    HARDEST_ALL,
  );
  queryClient.setQueryData(quizStatsKeys.hourly(QUIZ_ID, "me"), HOURLY_ME);
  queryClient.setQueryData(quizStatsKeys.hourly(QUIZ_ID, "all"), HOURLY_ALL);
}

/** Lightweight stand-in — avoids pulling the pie-chart chunk into HMR. */
function HardestQuestionsPreview(): React.JSX.Element {
  const [scope, setScope] = useState<StatsScope>("all");
  const data = scope === "all" ? HARDEST_ALL : HARDEST_ME;
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

export function StatsDemo(): React.JSX.Element {
  const queryClient = useQueryClient();
  seedLandingStats(queryClient);

  const [chartsReady, setChartsReady] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setChartsReady(true);
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="bg-background text-foreground flex h-full min-h-[35rem] min-w-0 flex-col overflow-hidden rounded-[1rem] border shadow-xl shadow-black/5">
      <header className="border-border bg-card border-b px-4 py-4 sm:px-5">
        <strong className="block truncate text-sm sm:text-base">
          Statystyki: {QUIZ_TITLE}
        </strong>
        <span className="text-muted-foreground mt-0.5 block text-xs">
          Te same widoki, które masz w aplikacji
        </span>
      </header>

      <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto p-3 sm:p-5 [&_[data-slot=card]]:min-w-0 [&_[data-slot=chart]]:max-w-full">
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
          <StatsInfoCard
            quiz={METADATA}
            lastActivityAt={MY_STATS.last_activity_at}
          />
          <StatsTable quizId={QUIZ_ID} canViewAll />
        </div>

        {chartsReady ? (
          <>
            <div className="grid min-w-0 grid-cols-1 gap-4 *:min-w-0 lg:grid-cols-2">
              <SessionsChart quizId={QUIZ_ID} canViewAll animated={false} />
              <HourlyChart quizId={QUIZ_ID} canViewAll animated={false} />
              <ScoreChart quizId={QUIZ_ID} canViewAll animated={false} />
              <StudyTimeChart quizId={QUIZ_ID} canViewAll animated={false} />
            </div>
            <HardestQuestionsPreview />
          </>
        ) : (
          <div className="bg-muted/40 min-h-48 animate-pulse rounded-xl" />
        )}
      </div>
    </div>
  );
}
