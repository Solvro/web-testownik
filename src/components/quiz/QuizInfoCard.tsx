import { Quiz, Reoccurrence } from "./types.ts";
import { useContext } from "react";
import AppContext from "../../AppContext.tsx";
import { useNavigate } from "react-router";
import { Link2Icon, RotateCcwIcon, SearchIcon } from "lucide-react";
import { toast } from "react-toastify";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QuizInfoCardProps {
  quiz: Quiz | null;
  correctAnswersCount: number;
  wrongAnswersCount: number;
  reoccurrences: Reoccurrence[];
  studyTime: number; // in seconds
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
  for (let i = 0; i < colorStops.length - 1; i++) {
    const [startPercent, startColor] = colorStops[i];
    const [endPercent, endColor] = colorStops[i + 1];
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
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  return "rgb(25, 135, 84)";
};

const QuizInfoCard: React.FC<QuizInfoCardProps> = ({
  quiz,
  correctAnswersCount,
  wrongAnswersCount,
  reoccurrences,
  studyTime,
  resetProgress,
}) => {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  if (!quiz) return null;

  const openSearchInQuiz = () => navigate(`/search-in-quiz/${quiz.id}`);
  const progressPercentage =
    (reoccurrences.filter((q) => q.reoccurrences === 0).length /
      quiz.questions.length) *
    100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{quiz.title}</CardTitle>
        {quiz.maintainer && (
          <CardDescription>by {quiz.maintainer.full_name}</CardDescription>
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
            <span className="text-muted-foreground">
              {reoccurrences.filter((q) => q.reoccurrences === 0).length}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Liczba pytań</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {quiz.questions.length}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Czas nauki</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {new Date(studyTime * 1000).toISOString().slice(11, 19)}
            </span>
          </div>
        </div>
        <Progress
          value={progressPercentage}
          style={{
            ["--bar-color" as never]: getProgressColor(progressPercentage),
          }}
          className="[&_[data-slot=progress-indicator]]:bg-[var(--bar-color)]"
        />
        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  onClick={openSearchInQuiz}
                  disabled={!appContext.isAuthenticated}
                >
                  <SearchIcon className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {appContext.isAuthenticated
                  ? "Wyszukaj w quizie"
                  : "Zaloguj się, aby użyć tej funkcji"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  onClick={() => {
                    navigator.clipboard
                      .writeText(window.location.href)
                      .then(() => {
                        toast.success("Skopiowano link do quizu");
                      });
                  }}
                >
                  <Link2Icon className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Kopiuj link do quizu</TooltipContent>
            </Tooltip>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="destructive" size="sm" onClick={resetProgress}>
                <RotateCcwIcon className="size-4" /> Reset
              </Button>
            </TooltipTrigger>
            <TooltipContent>Resetuj postęp</TooltipContent>
          </Tooltip>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuizInfoCard;
