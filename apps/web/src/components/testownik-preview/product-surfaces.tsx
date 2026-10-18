"use client";

import {
  ArrowLeftIcon,
  BarChart3Icon,
  CircleHelpIcon,
  EyeOffIcon,
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
import type { ReactNode } from "react";
import { toast } from "sonner";

import { AppContext } from "@/app-context";
import type { AppContextType } from "@/app-context-type";
import { GradesList } from "@/app/grades/components/grades-list";
import { SummaryStats } from "@/app/grades/components/summary-stats";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { FocusModeOnboardingDialog } from "@/components/quiz/focus-mode-onboarding-dialog";
import { formatStudyTime } from "@/components/quiz/helpers/study-time";
import { useStudyTimeValue } from "@/components/quiz/hooks/use-study-timer";
import { QuestionCard } from "@/components/quiz/question-card";
import { QuizHistoryDialog } from "@/components/quiz/quiz-history-dialog";
import { QuizInfoCard } from "@/components/quiz/quiz-info-card";
import { QuizSettingsDialog } from "@/components/quiz/quiz-settings-dialog";
import { ShareQuizDialog } from "@/components/quiz/share-quiz-dialog/share-quiz-dialog";
import { HardestQuestionsChart } from "@/components/quiz/stats/hardest-questions-chart";
import { HourlyChart } from "@/components/quiz/stats/hourly-chart";
import { ScoreChart } from "@/components/quiz/stats/score-chart";
import { SessionsChart } from "@/components/quiz/stats/sessions-chart";
import { StatsCardErrorBoundaryGroup } from "@/components/quiz/stats/stats-card-error-boundary";
import { StatsInfoCard } from "@/components/quiz/stats/stats-info-card";
import { StatsTable } from "@/components/quiz/stats/stats-table";
import { StudyTimeChart } from "@/components/quiz/stats/study-time-chart";
import { Badge } from "@/components/ui/badge";
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
  PREVIEW_AI_HINTS,
  PREVIEW_QUIZ,
  PREVIEW_QUIZ_ID,
  PREVIEW_QUIZ_METADATA,
  PREVIEW_STATS,
} from "./preview-fixtures";
import { PREVIEW_COURSE_VIEWS, PREVIEW_GRADE_SUMMARY } from "./preview-grades";
import { PreviewRuntime, PreviewSandbox } from "./preview-provider";
import type { PreviewQuizSession } from "./preview-session";

/**
 * Every surface below mounts the component the app itself renders. Nothing here
 * re-implements product UI: the quiz is `QuestionCard` and `QuizInfoCard`, the
 * menus open the app's own settings, history, share and focus-mode dialogs,
 * the stats view is the stats page's cards, and the grades run through the
 * real `buildCourseView`. What this module supplies is the state those
 * components would normally get from the API (a `PreviewQuizSession`, the
 * preview services in `PreviewRuntime`), the in-screen navigation, and a
 * container and type scale for the device screens.
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
    "flex flex-1 flex-col text-[0.62em]",
    // One card at least as tall as the screen, with the answer controls
    // pinned to its bottom; longer content (an explanation) scrolls.
    "[&_[data-slot=card]]:flex [&_[data-slot=card]]:flex-1 [&_[data-slot=card]]:flex-col [&_[data-slot=card]]:gap-3 [&_[data-slot=card]]:rounded-[0.85rem] [&_[data-slot=card]]:py-[0.85rem]",
    "[&_[data-slot=card-header]]:px-3 [&_[data-slot=card-content]]:px-3",
    "[&_[data-slot=card-content]]:flex [&_[data-slot=card-content]]:flex-1 [&_[data-slot=card-content]]:flex-col",
    "[&_[data-slot=card-content]>:nth-child(3)]:mt-auto",
  ),
};

/** Where `QuizInfoCard`'s links point, mapped to the screen's own views. */
type ScreenView = "quiz" | "stats";

/**
 * Menus, dialogs and views of one screen. The quiz itself lives in the
 * shared session; this is what each screen keeps to itself.
 */
function usePreviewScreen(session: PreviewQuizSession) {
  const toasterId = useId();
  const [view, setView] = useState<ScreenView>("quiz");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  // The app remembers this in localStorage; a preview forgets on reload.
  const [hideOnboarding, setHideOnboarding] = useState(false);

  const notify = (message: string): void => {
    toast(message, { toasterId });
  };

  return {
    toasterId,
    view,
    showQuiz: () => {
      setView("quiz");
    },
    showStats: () => {
      setView("stats");
    },
    /** Links are cancelled by the sandbox; the ones with a view open it. */
    navigate: (href: string) => {
      if (href.endsWith("/stats")) {
        setView("stats");
      } else if (href.startsWith("/search-in-quiz/")) {
        notify("To tylko podgląd — wyszukiwarka pytań działa w aplikacji.");
      } else if (href.startsWith(`/quiz/`)) {
        setView("quiz");
      }
    },
    notify,
    settings: { open: isSettingsOpen, onOpenChange: setIsSettingsOpen },
    history: {
      open: isHistoryOpen,
      toggle: () => {
        setIsHistoryOpen((open) => !open);
      },
    },
    share: { open: isShareOpen, onOpenChange: setIsShareOpen },
    // Only the switch and the onboarding: the app's inactivity and
    // left-the-tab alarms would fire on the landing page itself.
    toggleFocusMode: () => {
      if (session.state.focusMode) {
        session.setFocusMode(false);
      } else if (hideOnboarding) {
        session.setFocusMode(true);
      } else {
        setIsOnboardingOpen(true);
      }
    },
    onboarding: {
      open: isOnboardingOpen,
      onCancel: () => {
        setIsOnboardingOpen(false);
      },
      onConfirm: () => {
        setIsOnboardingOpen(false);
        session.setFocusMode(true);
      },
      onConfirmAndHide: () => {
        setIsOnboardingOpen(false);
        setHideOnboarding(true);
        session.setFocusMode(true);
      },
    },
  };
}

type PreviewScreen = ReturnType<typeof usePreviewScreen>;

/**
 * A device screen: the sandbox, the preview runtime (query cache, services,
 * toaster) and the app context, plus the dialogs every screen can open.
 */
function PreviewScreenShell({
  session,
  screen,
  className,
  children,
}: {
  session: PreviewQuizSession;
  screen: PreviewScreen;
  className?: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <AppContext.Provider value={PREVIEW_APP_CONTEXT}>
      <PreviewSandbox className={className} onNavigate={screen.navigate}>
        <PreviewRuntime client={session.client} toasterId={screen.toasterId}>
          {children}
          <QuizHistoryDialog
            quiz={PREVIEW_QUIZ}
            answers={session.view.answers}
            showHistory={screen.history.open}
            toggleHistory={screen.history.toggle}
          />
          <FocusModeOnboardingDialog {...screen.onboarding} />
        </PreviewRuntime>
      </PreviewSandbox>
    </AppContext.Provider>
  );
}

export function QuizPreviewSurface({
  session,
  density = "full",
  className,
}: PreviewSurfaceProps & {
  session: PreviewQuizSession;
}): React.JSX.Element {
  const { view } = session;
  // QuestionCard names a ViewTransition after the quiz id. Several previews are
  // mounted at once on this page, so each needs its own id to stay unique.
  const instanceId = useId();

  return (
    <div className={cn(SURFACE, QUIZ_DENSITY[density], className)}>
      <QuestionCard
        quizId={`${PREVIEW_QUIZ_ID}${instanceId}`}
        question={view.question}
        selectedAnswers={view.selectedAnswers}
        setSelectedAnswers={session.select}
        answers={view.answers}
        questionChecked={view.questionChecked}
        nextAction={session.next}
        isQuizFinished={false}
        togglePreviousQuestion={session.back}
        canGoBack={view.canGoBack}
        isHistoryQuestion={view.isHistoryQuestion}
      />
    </div>
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

function PreviewAiHintPanel({
  questionId,
}: {
  questionId: string | undefined;
}): React.JSX.Element {
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
          {(questionId === undefined
            ? undefined
            : PREVIEW_AI_HINTS[questionId]) ??
            "Zastanów się, co pomaga **wydobyć wiedzę z pamięci**."}
        </MarkdownRenderer>
      </CardContent>
    </Card>
  );
}

/**
 * The quiz stats page's cards, laid out for a screen: the page itself picks
 * its columns from the viewport, which says nothing about the device. Its
 * back link would leave the screen, so this has its own button.
 */
function PreviewStatsView({
  columns,
  onBack,
}: {
  columns: 1 | 2;
  onBack: () => void;
}): React.JSX.Element {
  const resetKeys = [PREVIEW_QUIZ_ID];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onBack}
          aria-label={`Powrót do quizu ${PREVIEW_QUIZ.title}`}
        >
          <ArrowLeftIcon />
        </Button>
        <h2 className="min-w-0 truncate text-base font-bold">
          Statystyki: {PREVIEW_QUIZ.title}
        </h2>
      </div>
      <div className={cn("grid gap-3", columns === 2 && "grid-cols-2")}>
        <StatsCardErrorBoundaryGroup resetKeys={resetKeys}>
          <StatsInfoCard
            quiz={PREVIEW_QUIZ_METADATA}
            lastActivityAt={PREVIEW_STATS.me.last_activity_at}
          />
          <StatsTable quizId={PREVIEW_QUIZ_ID} canViewAll />
          <SessionsChart quizId={PREVIEW_QUIZ_ID} canViewAll />
          <HourlyChart quizId={PREVIEW_QUIZ_ID} canViewAll />
          <ScoreChart quizId={PREVIEW_QUIZ_ID} canViewAll />
          <StudyTimeChart quizId={PREVIEW_QUIZ_ID} canViewAll />
        </StatsCardErrorBoundaryGroup>
      </div>
      <StatsCardErrorBoundaryGroup resetKeys={resetKeys}>
        <HardestQuestionsChart quizId={PREVIEW_QUIZ_ID} canViewAll />
      </StatsCardErrorBoundaryGroup>
    </div>
  );
}

function QuizPageSurface({
  session,
  screen,
}: {
  session: PreviewQuizSession;
  screen: PreviewScreen;
}): React.JSX.Element {
  const { view } = session;

  return (
    <div className="grid h-full grid-cols-[minmax(0,1.9fr)_minmax(15rem,0.92fr)] content-start gap-3">
      <div className="min-w-0">
        <QuizPreviewSurface session={session} />
      </div>
      <div className="flex h-fit min-w-0 flex-col gap-3">
        <QuizInfoCard
          quiz={PREVIEW_QUIZ}
          correctAnswersCount={view.correctAnswersCount}
          wrongAnswersCount={view.wrongAnswersCount}
          masteredCount={view.masteredCount}
          totalQuestions={view.totalQuestions}
          timerStore={session.timer}
          resetProgress={session.reset}
          isFocusModeActive={session.state.focusMode}
          toggleFocusMode={screen.toggleFocusMode}
          onToggleHistory={screen.history.toggle}
          isContinuityDisconnected={false}
          onReconnectContinuity={() => {
            // Continuity needs a second device of the visitor's.
          }}
          isSettingsOpen={screen.settings.open}
          onSettingsOpenChange={screen.settings.onOpenChange}
        />
        <PreviewAiHintPanel questionId={view.question?.id} />
      </div>
    </div>
  );
}

/** iOS status bar, laid out around the Dynamic Island like the real one. */
function PhoneStatusBar(): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="grid h-[54px] flex-none grid-cols-[1fr_126px_1fr] items-center text-[15px] leading-none font-semibold tracking-[-0.01em]"
    >
      <span className="justify-self-center pl-2">9:41</span>
      <span />
      <div className="inline-flex items-center gap-[6px] justify-self-center pr-2 [&>svg]:block [&>svg]:h-[11px] [&>svg]:w-[17px] [&>svg]:fill-current">
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
        <span className="relative inline-flex h-[12px] w-[24px] items-center rounded-[4px] border border-current p-[1.5px] opacity-[0.92] after:absolute after:top-1/2 after:right-[-3px] after:h-[5px] after:w-[1.5px] after:-translate-y-1/2 after:rounded-full after:bg-current after:content-['']">
          <span className="h-full w-[78%] rounded-[2px] bg-current" />
        </span>
      </div>
    </div>
  );
}

function PhoneStudyTime({
  session,
}: {
  session: PreviewQuizSession;
}): React.JSX.Element {
  const seconds = useStudyTimeValue(session.timer);
  return <>{formatStudyTime(seconds)}</>;
}

/** The phone's compact quiz header; its menu holds `QuizInfoCard`'s actions. */
function PhoneQuizHeader({
  session,
  screen,
}: {
  session: PreviewQuizSession;
  screen: PreviewScreen;
}): React.JSX.Element {
  const { view } = session;
  const isFocusModeActive = session.state.focusMode;
  const FocusModeIcon = isFocusModeActive ? ScanEyeIcon : EyeOffIcon;
  const progress = Math.round(view.progress);

  return (
    <div className="border-border bg-card mx-1 mb-2 rounded-[0.9rem] border px-3 py-3 shadow-xs">
      <div className="flex items-center gap-[0.55rem]">
        <strong className="min-w-0 flex-1 truncate text-[0.75rem] tracking-[-0.015em]">
          {PREVIEW_QUIZ.title}
        </strong>
        <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-[0.59rem] font-medium tabular-nums">
          <TimerIcon className="size-[0.75rem]" />
          <PhoneStudyTime session={session} />
        </span>
        <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-[0.59rem] font-medium tabular-nums">
          <CircleHelpIcon className="size-[0.78rem]" />
          {view.masteredCount}/{view.totalQuestions}
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
            <DropdownMenuItem
              onClick={() => {
                screen.navigate(`/search-in-quiz/${PREVIEW_QUIZ_ID}`);
              }}
            >
              <SearchIcon />
              Wyszukaj w quizie
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                screen.share.onOpenChange(true);
              }}
            >
              <Share2Icon />
              Udostępnij quiz
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                screen.settings.onOpenChange(true);
              }}
            >
              <SettingsIcon />
              Ustawienia
            </DropdownMenuItem>
            <DropdownMenuItem onClick={screen.history.toggle}>
              <HistoryIcon />
              Historia odpowiedzi
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={screen.showStats}>
              <BarChart3Icon />
              Statystyki
            </DropdownMenuItem>
            <DropdownMenuItem onClick={screen.toggleFocusMode}>
              <FocusModeIcon />
              {isFocusModeActive ? "Wyłącz tryb skupienia" : "Tryb skupienia"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={session.reset}>
              <RotateCcwIcon />
              Resetuj postęp
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {isFocusModeActive ? (
        <Badge className="mt-2 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <ScanEyeIcon />
          Tryb skupienia
        </Badge>
      ) : null}
      <Progress
        value={view.progress}
        aria-label={`Postęp quizu: ${progress.toString()}%`}
        className="mt-2.5 h-1.5"
      />
      <QuizSettingsDialog
        open={screen.settings.open}
        onOpenChange={screen.settings.onOpenChange}
        quizId={PREVIEW_QUIZ_ID}
      />
      <ShareQuizDialog
        open={screen.share.open}
        onOpenChange={screen.share.onOpenChange}
        quiz={PREVIEW_QUIZ}
      />
    </div>
  );
}

/**
 * The iPhone screen. Below the status bar it is an ordinary scrolling list
 * (header, question, answers, explanation) with the browser's default scroll
 * chaining, so once it reaches the end the page keeps scrolling.
 */
export function PhoneQuizSurface({
  session,
}: {
  session: PreviewQuizSession;
}): React.JSX.Element {
  const screen = usePreviewScreen(session);

  return (
    <PreviewScreenShell session={session} screen={screen}>
      <div className="bg-background text-foreground flex size-full flex-col">
        <PhoneStatusBar />
        <div
          data-preview-scroll=""
          // The bottom inset keeps the card's corners clear of the screen's.
          className="min-h-0 flex-1 overflow-y-auto px-[0.55rem] pt-1 pb-4 [scrollbar-width:none]"
        >
          <div className="flex min-h-full flex-col">
            {screen.view === "stats" ? (
              <div className="px-1 text-[0.8em]">
                <PreviewStatsView columns={1} onBack={screen.showQuiz} />
              </div>
            ) : (
              <>
                <PhoneQuizHeader session={session} screen={screen} />
                <QuizPreviewSurface session={session} density="phone" />
              </>
            )}
          </div>
        </div>
      </div>
    </PreviewScreenShell>
  );
}

export function ProductAppChrome({
  session,
  className,
}: {
  session: PreviewQuizSession;
  className?: string;
}): React.JSX.Element {
  const screen = usePreviewScreen(session);

  return (
    <PreviewScreenShell
      session={session}
      screen={screen}
      className={cn("bg-background text-foreground", className)}
    >
      <section
        aria-label="Ekran podglądu Testownika"
        className={cn(
          "size-full min-h-0 p-4",
          screen.view === "stats" ? "overflow-y-auto" : "overflow-hidden",
        )}
      >
        {screen.view === "stats" ? (
          <PreviewStatsView columns={2} onBack={screen.showQuiz} />
        ) : (
          <QuizPageSurface session={session} screen={screen} />
        )}
      </section>
    </PreviewScreenShell>
  );
}
