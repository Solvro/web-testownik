"use client";

import {
  BarChart3Icon,
  CircleHelpIcon,
  HistoryIcon,
  MenuIcon,
  RotateCcwIcon,
  ScanEyeIcon,
  SearchIcon,
  SettingsIcon,
  Share2Icon,
  SparklesIcon,
  TimerIcon,
} from "lucide-react";
import { useId, useState } from "react";

import { AppContext } from "@/app-context";
import type { AppContextType } from "@/app-context-type";
import { GradesList } from "@/app/grades/components/grades-list";
import { SummaryStats } from "@/app/grades/components/summary-stats";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { useStudyTimer } from "@/components/quiz/hooks/use-study-timer";
import { QuestionCard } from "@/components/quiz/question-card";
import { QuizInfoCard } from "@/components/quiz/quiz-info-card";
import { HourlyChart } from "@/components/quiz/stats/hourly-chart";
import { ScoreChart } from "@/components/quiz/stats/score-chart";
import { SessionsChart } from "@/components/quiz/stats/sessions-chart";
import { StatsInfoCard } from "@/components/quiz/stats/stats-info-card";
import { StatsTable } from "@/components/quiz/stats/stats-table";
import { StudyTimeChart } from "@/components/quiz/stats/study-time-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import {
  PREVIEW_ANSWERS,
  PREVIEW_ANSWER_HINTS,
  PREVIEW_QUESTION,
  PREVIEW_QUIZ,
  PREVIEW_QUIZ_ID,
  PREVIEW_QUIZ_METADATA,
} from "./preview-fixtures";
import { PREVIEW_COURSE_VIEWS, PREVIEW_GRADE_SUMMARY } from "./preview-grades";
import { PreviewDataProvider } from "./preview-provider";

/**
 * Every surface below mounts the component the app itself renders. Nothing here
 * re-implements product UI: the quiz is `QuestionCard`, the stats use the real
 * cards reading a seeded query cache, the grades run through the real
 * `buildCourseView`. What this module supplies is only the state and fixtures
 * those components would normally get from the API — plus a container and a
 * type scale, since the same components have to fit a 940px laptop panel, a
 * 720px tablet and a 390px phone.
 */

/**
 * How tightly a surface is packed. The smaller screens scale the root font size
 * rather than transforming, which would blur the text.
 */
type Density = "full" | "compact" | "phone";

interface PreviewSurfaceProps {
  density?: Density;
  className?: string;
}

export interface PreviewQuizControls {
  selectedAnswers?: string[];
  onSelectedAnswersChange?: (answers: string[]) => void;
  questionChecked?: boolean;
  onQuestionCheckedChange?: (checked: boolean) => void;
}

const PREVIEW_APP_CONTEXT = {
  isAuthenticated: true,
  user: null,
  checkPermission: () => true,
} satisfies AppContextType;

const SURFACE = "bg-background text-foreground w-full min-w-0";

const QUIZ_DENSITY: Record<Density, string> = {
  full: "",
  compact: "text-[0.86em]",
  phone: cn(
    "h-full text-[0.62em]",
    // The phone shows one card filling the screen, with the answer controls
    // pinned to the bottom.
    "[&_[data-slot=card]]:flex [&_[data-slot=card]]:h-full [&_[data-slot=card]]:flex-col [&_[data-slot=card]]:gap-3 [&_[data-slot=card]]:rounded-[0.85rem] [&_[data-slot=card]]:py-[0.85rem]",
    "[&_[data-slot=card-header]]:px-3 [&_[data-slot=card-content]]:px-3",
    "[&_[data-slot=card-content]]:flex [&_[data-slot=card-content]]:min-h-0 [&_[data-slot=card-content]]:flex-1 [&_[data-slot=card-content]]:flex-col",
    "[&_[data-slot=card-content]>:nth-child(3)]:mt-auto",
  ),
};

export function QuizPreviewSurface({
  density = "full",
  className,
  withHint = false,
  selectedAnswers: controlledSelectedAnswers,
  onSelectedAnswersChange,
  questionChecked: controlledQuestionChecked,
  onQuestionCheckedChange,
}: PreviewSurfaceProps &
  PreviewQuizControls & { withHint?: boolean }): React.JSX.Element {
  const [localSelectedAnswers, setLocalSelectedAnswers] = useState<string[]>(
    [],
  );
  const [localQuestionChecked, setLocalQuestionChecked] = useState(false);
  const selectedAnswers = controlledSelectedAnswers ?? localSelectedAnswers;
  const questionChecked = controlledQuestionChecked ?? localQuestionChecked;
  const setSelectedAnswers = onSelectedAnswersChange ?? setLocalSelectedAnswers;
  const setQuestionChecked = onQuestionCheckedChange ?? setLocalQuestionChecked;
  // QuestionCard names a ViewTransition after the quiz id. Several previews are
  // mounted at once on this page, so each needs its own id to stay unique.
  const instanceId = useId();

  return (
    <div className={cn(SURFACE, QUIZ_DENSITY[density], className)}>
      <QuestionCard
        quizId={`${PREVIEW_QUIZ_ID}${instanceId}`}
        question={PREVIEW_QUESTION}
        selectedAnswers={selectedAnswers}
        setSelectedAnswers={setSelectedAnswers}
        answers={PREVIEW_ANSWERS}
        questionChecked={questionChecked}
        nextAction={() => {
          if (questionChecked) {
            setQuestionChecked(false);
            setSelectedAnswers([]);
          } else {
            setQuestionChecked(true);
          }
        }}
        isQuizFinished={false}
        togglePreviousQuestion={() => {
          // The preview holds a single question, so there is nowhere to go.
        }}
        canGoBack={false}
        isHistoryQuestion={false}
        answerHints={withHint ? PREVIEW_ANSWER_HINTS : []}
      />
    </div>
  );
}

export function StatsPreviewSurface({
  density = "full",
  className,
}: PreviewSurfaceProps): React.JSX.Element {
  const isCompact = density === "compact";

  if (isCompact) {
    return (
      <PreviewDataProvider>
        <div
          className={cn(
            SURFACE,
            "grid size-full grid-cols-2 grid-rows-2 gap-2 overflow-hidden p-2 text-[0.68em]",
            "[&_[data-slot=card]]:h-full [&_[data-slot=card]]:min-h-0 [&_[data-slot=card]]:gap-1.5 [&_[data-slot=card]]:overflow-hidden [&_[data-slot=card]]:py-2.5",
            "[&_[data-slot=card-action]]:hidden [&_[data-slot=card-description]]:hidden",
            "[&_[data-slot=card-content]]:flex [&_[data-slot=card-content]]:min-h-0 [&_[data-slot=card-content]]:flex-1 [&_[data-slot=card-content]]:px-2.5 [&_[data-slot=card-header]]:px-2.5",
            "[&_[data-slot=card-content]>div]:size-full [&_[data-slot=card-content]>div>div]:size-full",
            "[&_[data-slot=chart]]:aspect-auto! [&_[data-slot=chart]]:h-full! [&_[data-slot=chart]]:min-h-0! [&_[data-slot=chart]]:w-full!",
            className,
          )}
        >
          <SessionsChart
            quizId={PREVIEW_QUIZ_ID}
            canViewAll={false}
            animated={false}
          />
          <ScoreChart
            quizId={PREVIEW_QUIZ_ID}
            canViewAll={false}
            animated={false}
          />
          <StudyTimeChart
            quizId={PREVIEW_QUIZ_ID}
            canViewAll={false}
            animated={false}
          />
          <HourlyChart
            quizId={PREVIEW_QUIZ_ID}
            canViewAll={false}
            animated={false}
          />
        </div>
      </PreviewDataProvider>
    );
  }

  return (
    <PreviewDataProvider>
      <div className={cn(SURFACE, "grid gap-3", className)}>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-3">
          <StatsInfoCard
            quiz={PREVIEW_QUIZ_METADATA}
            lastActivityAt={PREVIEW_QUIZ_METADATA.last_used_at}
          />
          <StatsTable quizId={PREVIEW_QUIZ_ID} canViewAll />
        </div>
      </div>
    </PreviewDataProvider>
  );
}

export function GradesPreviewSurface({
  density = "full",
  className,
}: PreviewSurfaceProps): React.JSX.Element {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div
      className={cn(
        SURFACE,
        "grid gap-3",
        density === "compact" && "text-[0.82em]",
        className,
      )}
    >
      <SummaryStats {...PREVIEW_GRADE_SUMMARY} />
      <GradesList
        courses={PREVIEW_COURSE_VIEWS}
        expanded={expanded}
        onToggle={(id, open) => {
          setExpanded((current) => ({ ...current, [id]: open }));
        }}
      />
    </div>
  );
}

function PreviewAiHintPanel(): React.JSX.Element {
  return (
    <Card
      size="sm"
      className="border-primary/20 from-primary/8 gap-2 bg-linear-to-br to-transparent"
    >
      <CardHeader className="pb-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="bg-primary/12 grid size-7 place-items-center rounded-full">
            <SparklesIcon className="text-primary size-3.5" />
          </span>
          Wskazówka AI
        </div>
      </CardHeader>
      <CardContent>
        <MarkdownRenderer className="text-muted-foreground text-xs leading-relaxed">
          {PREVIEW_ANSWER_HINTS[0]?.hint ??
            "Zwróć uwagę na brak gwarancji optymalności."}
        </MarkdownRenderer>
      </CardContent>
    </Card>
  );
}

function QuizPageSurface({
  selectedAnswers,
  onSelectedAnswersChange,
  questionChecked,
  onQuestionCheckedChange,
}: PreviewQuizControls): React.JSX.Element {
  const timer = useStudyTimer(false, 4836);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="grid h-full grid-cols-[minmax(0,1.9fr)_minmax(15rem,0.92fr)] content-start gap-3">
      <div className="min-w-0">
        <QuizPreviewSurface
          selectedAnswers={selectedAnswers}
          onSelectedAnswersChange={onSelectedAnswersChange}
          questionChecked={questionChecked}
          onQuestionCheckedChange={onQuestionCheckedChange}
        />
      </div>
      <div className="flex h-fit min-w-0 flex-col gap-3">
        <QuizInfoCard
          quiz={PREVIEW_QUIZ}
          correctAnswersCount={336}
          wrongAnswersCount={88}
          masteredCount={71}
          totalQuestions={119}
          timerStore={timer.store}
          resetProgress={() => {
            // Nothing to reset in a preview.
          }}
          isFocusModeActive={false}
          toggleFocusMode={() => {
            // Focus mode has no meaning outside the app shell.
          }}
          onToggleHistory={() => {
            // History needs a session; not part of the preview.
          }}
          isContinuityDisconnected={false}
          onReconnectContinuity={() => {
            // Continuity needs a peer; not part of the preview.
          }}
          isSettingsOpen={isSettingsOpen}
          onSettingsOpenChange={setIsSettingsOpen}
        />
        <PreviewAiHintPanel />
      </div>
    </div>
  );
}

/** iOS status bar, so the phone reads as a phone rather than a floating card. */
function PhoneStatusBar(): React.JSX.Element {
  return (
    <div className="flex h-12 flex-none items-center justify-between px-[0.95rem] pt-[0.15rem] text-[0.68rem] leading-none font-[650] tracking-[-0.015em]">
      <span>9:41</span>
      <div
        aria-hidden="true"
        className="inline-flex items-center gap-[0.42rem] [&>svg]:block [&>svg]:h-[0.72rem] [&>svg]:w-4 [&>svg]:fill-current"
      >
        <svg viewBox="0 0 18 12">
          <path d="M1 11h2V8H1zm4 0h2V6H5zm4 0h2V3H9zm4 0h2V0h-2z" />
        </svg>
        <svg viewBox="0 0 16 12">
          <path
            d="M1 4.2a10.5 10.5 0 0 1 14 0M3.7 7a6.4 6.4 0 0 1 8.6 0M6.6 9.8a2.2 2.2 0 0 1 2.8 0"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
        <span className="relative inline-flex h-[0.68rem] w-[1.38rem] items-center rounded-[0.2rem] border border-current p-[0.08rem] opacity-[0.92] after:absolute after:top-1/2 after:right-[-0.18rem] after:h-[0.3rem] after:w-[0.1rem] after:-translate-y-1/2 after:rounded-full after:bg-current after:content-['']">
          <span className="h-full w-[78%] rounded-[0.08rem] bg-current" />
        </span>
      </div>
    </div>
  );
}

function PhoneQuizHeader(): React.JSX.Element {
  return (
    <div className="border-border bg-card mx-1 mb-2 rounded-[0.9rem] border px-3 py-3 shadow-xs">
      <div className="flex items-center gap-[0.55rem]">
        <strong className="min-w-0 flex-1 truncate text-[0.75rem] tracking-[-0.015em]">
          {PREVIEW_QUIZ.title}
        </strong>
        <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-[0.59rem] font-medium">
          <TimerIcon className="size-[0.75rem]" />
          01:29
        </span>
        <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-[0.59rem] font-medium">
          <CircleHelpIcon className="size-[0.78rem]" />
          71/119
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon-xs"
                aria-label="Więcej opcji quizu"
                className="size-7 shrink-0 rounded-[0.45rem]"
              >
                <MenuIcon />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem>
              <SearchIcon />
              Wyszukaj w quizie
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Share2Icon />
              Udostępnij quiz
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <SettingsIcon />
              Ustawienia
            </DropdownMenuItem>
            <DropdownMenuItem>
              <HistoryIcon />
              Historia odpowiedzi
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <BarChart3Icon />
              Statystyki
            </DropdownMenuItem>
            <DropdownMenuItem>
              <ScanEyeIcon />
              Tryb skupienia
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <RotateCcwIcon />
              Resetuj postęp
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Progress
        value={60}
        aria-label="Postęp quizu: 60%"
        className="mt-2.5 h-1.5"
      />
    </div>
  );
}

/** The phone and laptop share the same selected answer and checked state. */
export function PhoneQuizSurface({
  selectedAnswers,
  onSelectedAnswersChange,
  questionChecked,
  onQuestionCheckedChange,
}: PreviewQuizControls): React.JSX.Element {
  return (
    <div className="bg-background text-foreground flex size-full flex-col overflow-hidden px-[0.55rem] pb-[0.55rem]">
      <PhoneStatusBar />
      <PhoneQuizHeader />
      <QuizPreviewSurface
        density="phone"
        selectedAnswers={selectedAnswers}
        onSelectedAnswersChange={onSelectedAnswersChange}
        questionChecked={questionChecked}
        onQuestionCheckedChange={onQuestionCheckedChange}
        className="min-h-0 flex-1 overflow-hidden"
      />
    </div>
  );
}

export function ProductAppChrome({
  className,
  selectedAnswers,
  onSelectedAnswersChange,
  questionChecked,
  onQuestionCheckedChange,
}: {
  className?: string;
} & PreviewQuizControls): React.JSX.Element {
  return (
    <AppContext.Provider value={PREVIEW_APP_CONTEXT}>
      <div
        className={cn(
          "bg-background text-foreground size-full overflow-hidden",
          className,
        )}
      >
        <section
          aria-label="Ekran podglądu Testownika"
          className="size-full min-h-0 overflow-hidden p-4"
        >
          <QuizPageSurface
            selectedAnswers={selectedAnswers}
            onSelectedAnswersChange={onSelectedAnswersChange}
            questionChecked={questionChecked}
            onQuestionCheckedChange={onQuestionCheckedChange}
          />
        </section>
      </div>
    </AppContext.Provider>
  );
}
