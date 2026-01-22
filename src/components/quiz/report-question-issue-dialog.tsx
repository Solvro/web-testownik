import { useContext, useState } from "react";
import { toast } from "sonner";

import { AppContext } from "@/app-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ReportQuestionIssueDialogProps {
  children: React.ReactNode;
  quizId?: string;
  questionId?: string;
}

export function ReportQuestionIssueDialog({
  children,
  quizId,
  questionId,
}: ReportQuestionIssueDialogProps) {
  const appContext = useContext(AppContext);
  const [issue, setIssue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSubmit = async () => {
    if (!issue.trim()) {
      toast.error("Nie podano opisu błędu, zgłoszenie nie zostało wysłane.");
      return;
    }

    if (quizId == null || questionId == null) {
      toast.error("Brak ID quizu lub pytania, zgłoszenie nie zostało wysłane.");
      return;
    }

    setIsSubmitting(true);

    try {
      await appContext.services.quiz.reportQuestionIssue(
        quizId,
        questionId,
        issue,
      );

      toast.success(
        "Zgłoszenie zostało wysłane do właściciela quizu. Dziękujemy!",
      );
      setIssue("");
    } catch (error) {
      console.error("Error reporting incorrect question:", error);
      toast.error(
        "Wystąpił błąd podczas wysyłania zgłoszenia. Spróbuj ponownie później.",
      );
    } finally {
      setIsSubmitting(false);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
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
            onChange={(event_) => {
              setIssue(event_.target.value);
            }}
            placeholder="Opisz co jest nie tak z tym pytaniem..."
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
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
}
