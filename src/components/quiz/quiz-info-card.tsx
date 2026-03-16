import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Copy,
  Link2Icon,
  Loader2,
  RotateCcwIcon,
  SearchIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext } from "react";
import { toast } from "sonner";

import { AppContext } from "@/app-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PermissionAction } from "@/lib/auth/permissions";
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

function StudyTimeDisplay({ timerStore }: { timerStore: TimerStore }) {
  const studyTime = useStudyTimeValue(timerStore);
  const date = new Date(0);
  date.setHours(0, 0, studyTime);

  return (
    <span className="font-medium text-emerald-600 dark:text-emerald-400">
      {format(date, "HH:mm:ss")}
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
}: QuizInfoCardProps): React.JSX.Element | null {
  const { checkPermission, services } = useContext(AppContext);
  const canShare = checkPermission(PermissionAction.SHARE_QUIZZES);
  const canSearchInQuiz = checkPermission(PermissionAction.SEARCH_IN_QUIZ);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { mutate: copyQuiz, isPending: isCopying } = useMutation({
    mutationFn: async (quizId: string) => services.quiz.copyQuiz(quizId),
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

  const openSearchInQuiz = () => {
    router.push(`/search-in-quiz/${quiz.id}`);
  };
  const progressPercentage =
    totalQuestions > 0 ? (masteredCount / totalQuestions) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{quiz.title}</CardTitle>
        {quiz.creator == null ? null : (
          <CardDescription>by {quiz.creator.full_name}</CardDescription>
        )}
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
          className="[&_[data-slot=progress-indicator]]:bg-[var(--bar-color)]"
        />
        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-2">
            {canSearchInQuiz ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="outline"
                    onClick={openSearchInQuiz}
                    aria-label="Wyszukaj w quizie"
                  >
                    <SearchIcon className="size-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Wyszukaj w quizie</TooltipContent>
              </Tooltip>
            ) : null}
            {canShare ? (
              <Tooltip>
                <TooltipTrigger asChild>
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
                    <Link2Icon className="size-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Kopiuj link do quizu</TooltipContent>
              </Tooltip>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="outline"
                  disabled={isCopying}
                  onClick={() => {
                    copyQuiz(quiz.id);
                  }}
                  aria-label={isCopying ? "Kopiowanie quizu" : "Kopiuj quiz"}
                >
                  {isCopying ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Copy className="size-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isCopying ? "Kopiowanie..." : "Kopiuj quiz"}
              </TooltipContent>
            </Tooltip>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                onClick={resetProgress}
                disabled={totalQuestions === 0}
                aria-label="Resetuj postęp"
              >
                <RotateCcwIcon className="size-4" /> Reset
              </Button>
            </TooltipTrigger>
            <TooltipContent>Resetuj postęp</TooltipContent>
          </Tooltip>
        </div>
      </CardContent>
    </Card>
  );
}
