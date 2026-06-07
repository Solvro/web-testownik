import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3Icon,
  CopyIcon,
  EyeOffIcon,
  HistoryIcon,
  Link2Icon,
  Loader2Icon,
  MenuIcon,
  RotateCcwIcon,
  ScanEyeIcon,
  SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { useContext } from "react";
import { toast } from "sonner";

import { AppContext } from "@/app-context";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PermissionAction } from "@/lib/auth/permissions";
import { getQuizService } from "@/services";
import type { Quiz } from "@/types/quiz";

import type { TimerStore } from "./hooks/use-study-timer";
import { useStudyTimeValue } from "./hooks/use-study-timer";

interface QuizInfoCardProps {
  quiz: Quiz | null;
  correctAnswersCount: number;
  wrongAnswersCount: number;
  masteredCount: number;
  totalQuestions: number;
  timerStore: TimerStore;
  resetProgress: () => void;
  isFocusModeActive: boolean;
  toggleFocusMode: () => void;
  onToggleHistory: () => void;
}

const getProgressColor = (percentage: number): string => {
  const clampedPercentage = Math.max(0, Math.min(100, percentage));
  const colorStops: [number, [number, number, number]][] = [
    [0, [220, 53, 69]],
    [25, [255, 193, 7]],
    [50, [23, 162, 184]],
    [75, [13, 110, 253]],
    [100, [25, 135, 84]],
  ];
  for (let index = 0; index < colorStops.length - 1; index++) {
    const [startPercent, startColor] = colorStops[index];
    const [endPercent, endColor] = colorStops[index + 1];
    if (clampedPercentage >= startPercent && clampedPercentage <= endPercent) {
      const ratio =
        (clampedPercentage - startPercent) / (endPercent - startPercent);
      const r = Math.round(
        startColor[0] + (endColor[0] - startColor[0]) * ratio,
      );
      const g = Math.round(
        startColor[1] + (endColor[1] - startColor[1]) * ratio,
      );
      const b = Math.round(
        startColor[2] + (endColor[2] - startColor[2]) * ratio,
      );
      return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
    }
  }
  return "rgb(25, 135, 84)";
};

const formatStudyTime = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");

  if (hours === 0) {
    return `${paddedMinutes}:${paddedSeconds}`;
  }

  return `${String(hours)}:${paddedMinutes}:${paddedSeconds}`;
};

function StudyTimeDisplay({ timerStore }: { timerStore: TimerStore }) {
  const studyTime = useStudyTimeValue(timerStore);

  return (
    <span className="font-medium text-emerald-600 dark:text-emerald-400">
      {formatStudyTime(studyTime)}
    </span>
  );
}

export function QuizInfoCard({
  quiz,
  correctAnswersCount,
  wrongAnswersCount,
  masteredCount,
  totalQuestions,
  timerStore,
  resetProgress,
  isFocusModeActive,
  toggleFocusMode,
  onToggleHistory,
}: QuizInfoCardProps): React.JSX.Element | null {
  const { checkPermission } = useContext(AppContext);
  const canShare = checkPermission(PermissionAction.SHARE_QUIZZES);
  const canSearchInQuiz = checkPermission(PermissionAction.SEARCH_IN_QUIZ);
  const canViewStats = checkPermission(PermissionAction.VIEW_QUIZ_STATS);
  const queryClient = useQueryClient();
  const FocusModeIcon = isFocusModeActive ? ScanEyeIcon : EyeOffIcon;

  const { mutate: copyQuiz, isPending: isCopying } = useMutation({
    mutationFn: async (quizId: string) => getQuizService().copyQuiz(quizId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["user-quizzes"] }),
        queryClient.invalidateQueries({ queryKey: ["last-used-quizzes"] }),
      ]);
      toast.success("Quiz został skopiowany do Twojej biblioteki");
    },
    onError: (error) => {
      console.error("Failed to copy quiz", error);
      toast.error("Nie udało się skopiować quizu", {
        description: error instanceof Error ? error.message : undefined,
      });
    },
  });
  if (quiz === null) {
    return null;
  }

  const canEditQuiz = quiz.can_edit === true;

  const progressPercentage =
    totalQuestions > 0 ? (masteredCount / totalQuestions) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{quiz.title}</CardTitle>
        {quiz.creator == null ? null : (
          <CardDescription>by {quiz.creator.full_name}</CardDescription>
        )}
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Więcej opcji quizu"
                >
                  <MenuIcon />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-full">
              {canViewStats ? (
                <DropdownMenuItem
                  render={(props) => (
                    <Link {...props} href={`/quiz/${quiz.id}/stats`}>
                      <BarChart3Icon />
                      Statystyki
                    </Link>
                  )}
                />
              ) : null}
              <DropdownMenuItem onClick={onToggleHistory}>
                <HistoryIcon />
                Historia odpowiedzi
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleFocusMode}>
                <FocusModeIcon />
                {isFocusModeActive ? "Wyłącz tryb skupienia" : "Tryb skupienia"}
              </DropdownMenuItem>
              {canEditQuiz ? null : (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={isCopying}
                    onClick={() => {
                      copyQuiz(quiz.id);
                    }}
                  >
                    {isCopying ? (
                      <Loader2Icon className="animate-spin" />
                    ) : (
                      <CopyIcon />
                    )}
                    {isCopying ? "Kopiowanie..." : "Kopiuj do siebie"}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Udzielone odpowiedzi</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {correctAnswersCount + wrongAnswersCount}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Opanowane pytania</span>
            <span className="text-muted-foreground">{masteredCount}</span>
          </div>
          <div className="flex justify-between">
            <span>Liczba pytań</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {totalQuestions}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Czas nauki</span>
            <StudyTimeDisplay timerStore={timerStore} />
          </div>
        </div>
        <Progress
          value={progressPercentage}
          style={{
            ["--bar-color" as never]: getProgressColor(progressPercentage),
          }}
          aria-label={`Postęp: ${Math.round(progressPercentage).toString()}% opanowanych pytań`}
          className="**:data-[slot=progress-indicator]:bg-(--bar-color)"
        />
        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-2">
            {canSearchInQuiz ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <ButtonLink
                      size="icon-sm"
                      variant="outline"
                      href={`/search-in-quiz/${quiz.id}`}
                      aria-label="Wyszukaj w quizie"
                    >
                      <SearchIcon />
                    </ButtonLink>
                  }
                ></TooltipTrigger>
                <TooltipContent>Wyszukaj w quizie</TooltipContent>
              </Tooltip>
            ) : null}
            {canShare ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="icon-sm"
                      variant="outline"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(window.location.href)
                          .then(() => {
                            toast.success("Skopiowano link do quizu");
                          });
                      }}
                      aria-label="Skopiuj link do quizu"
                    >
                      <Link2Icon />
                    </Button>
                  }
                ></TooltipTrigger>
                <TooltipContent>Kopiuj link do quizu</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={resetProgress}
                  disabled={totalQuestions === 0}
                  aria-label="Resetuj postęp"
                >
                  <RotateCcwIcon /> Reset
                </Button>
              }
            ></TooltipTrigger>
            <TooltipContent>Resetuj postęp</TooltipContent>
          </Tooltip>
        </div>
      </CardContent>
    </Card>
  );
}
