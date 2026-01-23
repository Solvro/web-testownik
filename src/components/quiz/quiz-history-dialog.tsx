import React from "react";

import { computeAnswerVariant } from "@/components/quiz/helpers/question-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { AnswerRecord, QuizWithUserProgress } from "@/types/quiz";

interface QuizHistoryDialogProps {
  quiz: QuizWithUserProgress;
  answers: AnswerRecord[];
  showHistory: boolean;
  toggleHistory: () => void;
  openHistoryQuestion: (answer?: AnswerRecord) => void;
}

export function QuizHistoryDialog({
  quiz, // Answers from quiz are not updated
  answers,
  showHistory,
  toggleHistory,
  openHistoryQuestion,
}: QuizHistoryDialogProps): React.JSX.Element {
  return (
    <Dialog open={showHistory} onOpenChange={toggleHistory}>
      <DialogContent className="flex flex-col md:max-w-xl">
        <DialogHeader>
          <DialogTitle>Historia pytań</DialogTitle>
          <DialogDescription>
            Wybierz pytanie poniżej aby zobaczyć jego podgląd
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1 overflow-y-scroll">
          <div className="grid max-h-80 w-full flex-col gap-2">
            {answers.length === 0 ? (
              <p className="flex justify-center p-4 text-sm">
                Nie znaleziono historii w tej sesji quizu.
              </p>
            ) : (
              answers.toReversed().map((answer) => {
                const question = quiz.questions.find(
                  (q) => q.id === answer.question,
                );

                return (
                  <button
                    key={`history-question-${answer.id}`}
                    id={`history-question-${answer.id}`}
                    onClick={() => {
                      openHistoryQuestion(answer);
                      toggleHistory();
                    }}
                    className={cn(
                      "w-full justify-start rounded-md border px-4 py-3 text-left text-sm font-medium transition-colors",
                      computeAnswerVariant(
                        answer.selected_answers.length > 0,
                        true,
                        answer.selected_answers.length > 0
                          ? answer.was_correct
                          : true,
                      ),
                    )}
                  >
                    <span className="w-full">
                      {question?.order}. {question?.text}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <ScrollBar orientation="vertical"></ScrollBar>
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Zamknij</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
