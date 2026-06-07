import {
  ClipboardCopyIcon,
  HistoryIcon,
  MessageSquareWarningIcon,
  PencilLineIcon,
  SkullIcon,
  SparklesIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext, useState } from "react";
import { toast } from "sonner";

import { AppContext } from "@/app-context";
import { QuickEditQuestionDialog } from "@/components/quiz/quick-edit-question-dialog";
import { ReportQuestionIssueDialog } from "@/components/quiz/report-question-issue-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PermissionAction } from "@/lib/auth/permissions";
import type { Question, Quiz } from "@/types/quiz";

interface QuizActionButtonsProps {
  quiz: Quiz;
  question: Question | null;
  onToggleHistory: () => void;
  onToggleBrainrot: () => void;
  onExplain: () => void;
  disabled?: boolean;
  isExplainOpen?: boolean;
  aiDisabled?: boolean;
}

export function QuizActionButtons({
  quiz,
  question,
  onToggleHistory,
  onToggleBrainrot,
  onExplain,
  disabled = false,
  isExplainOpen = false,
  aiDisabled = false,
}: QuizActionButtonsProps) {
  const { checkPermission, user } = useContext(AppContext);
  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const isCreator =
    (quiz.can_edit ?? false) || quiz.creator?.id === user?.user_id;

  const canUseQuestion = !disabled && question != null;

  const handleCopy = () => {
    if (question == null) {
      toast.error("Nie można skopiować pytania: brak pytania");
      return;
    }
    const answersText = question.answers
      .map((a, index) => `Odpowiedź ${(index + 1).toString()}: ${a.text}`)
      .join("\n");
    const full = `${question.text}\n\n${answersText}`;
    void navigator.clipboard
      .writeText(full)
      .then(() => toast.info("Pytanie skopiowane do schowka!"));
  };

  const handleEdit = () => {
    if (question == null) {
      router.push(`/edit-quiz/${quiz.id}`);
      return;
    }
    setIsEditOpen(true);
  };

  return (
    <Card className="py-4">
      <CardContent className="flex justify-around">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                disabled={!canUseQuestion}
                aria-label="Kopiuj pytanie i odpowiedzi"
              >
                <ClipboardCopyIcon />
              </Button>
            }
          ></TooltipTrigger>
          <TooltipContent>Kopiuj pytanie i odpowiedzi</TooltipContent>
        </Tooltip>
        {!aiDisabled && checkPermission(PermissionAction.AI_FEATURES) ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onExplain}
                  disabled={!canUseQuestion || isExplainOpen}
                  aria-label="Wyjaśnij pytanie (AI)"
                >
                  <SparklesIcon />
                </Button>
              }
            ></TooltipTrigger>
            <TooltipContent>Wyjaśnij pytanie (AI)</TooltipContent>
          </Tooltip>
        ) : null}
        {!isCreator && checkPermission(PermissionAction.REPORT_QUIZ_ISSUES) ? (
          <Tooltip>
            <ReportQuestionIssueDialog
              quizId={quiz.id}
              questionId={question?.id}
            >
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={!canUseQuestion}
                    aria-label="Zgłoś problem z pytaniem"
                  >
                    <MessageSquareWarningIcon />
                  </Button>
                }
              ></TooltipTrigger>
            </ReportQuestionIssueDialog>
            <TooltipContent>Zgłoś problem z pytaniem</TooltipContent>
          </Tooltip>
        ) : null}
        {isCreator ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleEdit}
                  aria-label="Edytuj pytanie"
                >
                  <PencilLineIcon />
                </Button>
              }
            ></TooltipTrigger>
            <TooltipContent>
              {question == null ? "Edytuj quiz" : "Edytuj pytanie"}
            </TooltipContent>
          </Tooltip>
        ) : null}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                onClick={onToggleHistory}
                aria-label="Historia odpowiedzi"
              >
                <HistoryIcon />
              </Button>
            }
          ></TooltipTrigger>
          <TooltipContent>Historia odpowiedzi</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                onClick={onToggleBrainrot}
                aria-label="Brainrot mode"
              >
                <SkullIcon />
              </Button>
            }
          ></TooltipTrigger>
          <TooltipContent>Brainrot mode</TooltipContent>
        </Tooltip>
      </CardContent>
      {question == null ? null : (
        <QuickEditQuestionDialog
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          question={question}
          quizId={quiz.id}
          key={question.id}
        />
      )}
    </Card>
  );
}
