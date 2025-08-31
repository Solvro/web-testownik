import React, { useContext } from "react";
import {
  ClipboardCopyIcon,
  MessageSquareWarningIcon,
  PencilLineIcon,
  SkullIcon,
} from "lucide-react";
import { SiOpenai } from "@icons-pack/react-simple-icons";
import AppContext from "../../AppContext.tsx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QuizActionButtonsProps {
  onCopy: () => void;
  onOpenChatGPT: () => void;
  onReportIssue: () => void;
  onEditQuestion: () => void;
  toggleBrainrot: () => void;
  isMaintainer: boolean;
  disabled?: boolean;
}

const QuizActionButtons: React.FC<QuizActionButtonsProps> = ({
  onCopy,
  onOpenChatGPT,
  onReportIssue,
  onEditQuestion,
  toggleBrainrot,
  isMaintainer,
  disabled = false,
}) => {
  const appContext = useContext(AppContext);

  return (
    <Card className="py-4">
      <CardContent className="flex justify-around">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={onCopy}
              disabled={disabled}
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
              onClick={onOpenChatGPT}
              disabled={disabled}
            >
              <SiOpenai />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Otwórz w ChatGPT</TooltipContent>
        </Tooltip>
        {!isMaintainer && appContext.isAuthenticated && !appContext.isGuest && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onReportIssue}
                disabled={disabled}
              >
                <MessageSquareWarningIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zgłoś problem z pytaniem</TooltipContent>
          </Tooltip>
        )}
        {isMaintainer && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onEditQuestion}
                disabled={disabled}
              >
                <PencilLineIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edytuj pytanie</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={toggleBrainrot}>
              <SkullIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Brainrot mode</TooltipContent>
        </Tooltip>
      </CardContent>
    </Card>
  );
};

export default QuizActionButtons;
