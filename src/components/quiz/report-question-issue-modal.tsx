import { AxiosError } from "axios";
import React, { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea";

import AppContext from "../../app-context.tsx";

interface ReportQuestionIssueModalProps {
  show: boolean;
  onClose: () => void;
  quizId?: string;
  questionId?: number;
}

const ReportQuestionIssueModal: React.FC<ReportQuestionIssueModalProps> = ({
  show,
  onClose,
  quizId,
  questionId,
}) => {
  const appContext = useContext(AppContext);
  const [issue, setIssue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!quizId) {
      console.error("Quiz ID is not set in ReportQuestionIssueModal");
      onClose();
      return;
    }
    if (!questionId) {
      console.error("Question ID is not set in ReportQuestionIssueModal");
      onClose();
    }
  }, [questionId, quizId, onClose]);

  const handleSubmit = async () => {
    if (!issue.trim()) {
      toast.error("Nie podano opisu błędu, zgłoszenie nie zostało wysłane.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await appContext.axiosInstance.post(
        "/report-question-issue/",
        {
          quiz_id: quizId,
          question_id: questionId,
          issue,
        },
      );

      if (response.status === 201) {
        toast.success(
          "Zgłoszenie zostało wysłane do właściciela quizu. Dziękujemy!",
        );
        setIssue("");
      } else {
        toast.error(
          `Wystąpił błąd podczas wysyłania zgłoszenia. Spróbuj ponownie później. \n${
            response.data
          }`,
        );
      }
    } catch (error) {
      console.error("Error reporting incorrect question:", error);
      if (error instanceof AxiosError) {
        toast.error(
          `Wystąpił błąd podczas wysyłania zgłoszenia. Spróbuj ponownie później. \n${
            error.response?.data.error
          }`,
        );
      } else {
        toast.error(
          "Wystąpił błąd podczas wysyłania zgłoszenia. Spróbuj ponownie później.",
        );
      }
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  return (
    <Dialog
      open={show}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Zgłoś problem z pytaniem</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="report-question-issue-textarea">Opisz błąd</Label>
          <Textarea
            id="report-question-issue-textarea"
            rows={4}
            value={issue}
            onChange={(e) => {
              setIssue(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Escape") {
                e.stopPropagation();
              }
            }}
            placeholder="Opisz co jest nie tak z tym pytaniem..."
          />
        </div>
        <DialogFooter>
          <DialogClose>
            <Button variant="outline">Anuluj</Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !issue.trim()}
          >
            {isSubmitting ? "Wysyłanie..." : "Wyślij zgłoszenie"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportQuestionIssueModal;
