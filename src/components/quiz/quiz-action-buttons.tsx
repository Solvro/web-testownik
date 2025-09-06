import { SiOpenai } from "@icons-pack/react-simple-icons";
import {
  ClipboardCopyIcon,
  MessageSquareWarningIcon,
  PencilLineIcon,
  SkullIcon,
} from "lucide-react";
import { useContext } from "react";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";

import { AppContext } from "@/app-context.tsx";
import { ReportQuestionIssueDialog } from "@/components/quiz/report-question-issue-dialog";
import type { Question, Quiz } from "@/components/quiz/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QuizActionButtonsProps {
  quiz: Quiz;
  question: Question | null;
  onToggleBrainrot: () => void;
  disabled?: boolean;
}

export function QuizActionButtons({
  quiz,
  question,
  onToggleBrainrot,
  disabled = false,
}: QuizActionButtonsProps) {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();

  const isMaintainer =
    (quiz.can_edit ?? false) ||
    quiz.maintainer?.id === localStorage.getItem("user_id");
  const canUseQuestion = !disabled && question != null;

  const handleCopy = () => {
    if (question == null) {
      toast.error("Nie można skopiować pytania: brak pytania");
      return;
    }
    const answersText = question.answers
      .map(
        (a, index) =>
          `Odpowiedź ${(index + 1).toString()}: ${a.answer} (Poprawna: ${a.correct ? "Tak" : "Nie"})`,
      )
      .join("\n");
    const full = `${question.question}\n\n${answersText}`;
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
          `Odpowiedź ${(index + 1).toString()}: ${a.answer} (Poprawna: ${a.correct ? "Tak" : "Nie"})`,
      )
      .join("\n");
    const fullText = `Wyjaśnij to pytanie i jak dojść do odpowiedzi: ${question.question}\n\nOdpowiedzi:\n${answersText}`;
    window.open(
      `https://chat.openai.com/?q=${encodeURIComponent(fullText)}`,
      "_blank",
    );
  };

  const handleEdit = async () => {
    if (question == null) {
      toast.error("Nie można edytować pytania: brak pytania");
      return;
    }
    await navigate(`/edit-quiz/${quiz.id}#question-${question.id.toString()}`);
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
            >
              <SiOpenai />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Otwórz w ChatGPT</TooltipContent>
        </Tooltip>
        {!isMaintainer && appContext.isAuthenticated && !appContext.isGuest ? (
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
                disabled={!canUseQuestion}
              >
                <PencilLineIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edytuj pytanie</TooltipContent>
          </Tooltip>
        ) : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={onToggleBrainrot}>
              <SkullIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Brainrot mode</TooltipContent>
        </Tooltip>
      </CardContent>
    </Card>
  );
}
