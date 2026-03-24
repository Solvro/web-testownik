import {
  ClipboardCopyIcon,
  HistoryIcon,
  MessageSquareWarningIcon,
  PencilLineIcon,
  SkullIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext, useState } from "react";
import { SiOpenai } from "react-icons/si";
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
  disabled?: boolean;
}

export function QuizActionButtons({
  quiz,
  question,
  onToggleHistory,
  onToggleBrainrot,
  disabled = false,
}: QuizActionButtonsProps) {
  const { checkPermission, user } = useContext(AppContext);
  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const isMaintainer =
    (quiz.can_edit ?? false) || quiz.maintainer?.id === user?.user_id;

  const canUseQuestion = !disabled && question != null;

  const handleCopy = () => {
    if (question == null) {
      toast.error("Nie można skopiować pytania: brak pytania");
      return;
    }
    const answersText = question.answers
      .map(
        (a, index) =>
          `Odpowiedź ${(index + 1).toString()}: ${a.text} (Poprawna: ${a.is_correct ? "Tak" : "Nie"})`,
      )
      .join("\n");
    const full = `${question.text}\n\n${answersText}`;
    void navigator.clipboard
      .writeText(full)
      .then(() => toast.info("Pytanie skopiowane do schowka!"));
  };

  const handleOpenChatGPT = () => {
    if (question == null) {
      toast.error("Nie można otworzyć ChatGPT: brak pytania");
      return;
    }
    const answersText = question.answers
      .map(
        (a, index) =>
          `Odpowiedź ${(index + 1).toString()}: ${a.text} (Poprawna: ${a.is_correct ? "Tak" : "Nie"})`,
      )
      .join("\n");
    const fullText = `Wyjaśnij to pytanie i jak dojść do odpowiedzi: ${question.text}\n\nOdpowiedzi:\n${answersText}`;
    window.open(
      `https://chat.openai.com/?q=${encodeURIComponent(fullText)}`,
      "_blank",
    );
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
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              disabled={!canUseQuestion}
              aria-label="Kopiuj pytanie i odpowiedzi"
            >
              <ClipboardCopyIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Kopiuj pytanie i odpowiedzi</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleOpenChatGPT}
              disabled={!canUseQuestion}
              aria-label="Otwórz w ChatGPT"
            >
              <SiOpenai />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Otwórz w ChatGPT</TooltipContent>
        </Tooltip>
        {!isMaintainer &&
        checkPermission(PermissionAction.REPORT_QUIZ_ISSUES) ? (
          <Tooltip>
            <ReportQuestionIssueDialog
              quizId={quiz.id}
              questionId={question?.id}
            >
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={!canUseQuestion}
                  aria-label="Zgłoś problem z pytaniem"
                >
                  <MessageSquareWarningIcon />
                </Button>
              </TooltipTrigger>
            </ReportQuestionIssueDialog>
            <TooltipContent>Zgłoś problem z pytaniem</TooltipContent>
          </Tooltip>
        ) : null}
        {isMaintainer ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={handleEdit}
                aria-label="Edytuj pytanie"
              >
                <PencilLineIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {question == null ? "Edytuj quiz" : "Edytuj pytanie"}
            </TooltipContent>
          </Tooltip>
        ) : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={onToggleHistory}
              aria-label="Historia odpowiedzi"
            >
              <HistoryIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Historia odpowiedzi</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={onToggleBrainrot}
              aria-label="Brainrot mode"
            >
              <SkullIcon />
            </Button>
          </TooltipTrigger>
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
