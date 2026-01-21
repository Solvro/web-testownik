import React from "react";

import { computeAnswerVariant } from "@/components/quiz/helpers/question-card.ts";
import type {
  HistoryEntry,
  QuizHistory,
} from "@/components/quiz/hooks/use-quiz-history.ts";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area.tsx";
import { cn } from "@/lib/utils.ts";

interface QuizHistoryDialogProps {
  history: QuizHistory;
  showHistory: boolean;
  toggleHistory: () => void;
  openHistoryQuestion: (historyQuestion?: HistoryEntry) => void;
}

export function QuizHistoryDialog({
  history,
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
            {history.entries.length === 0 ? (
              <p className="flex justify-center p-4 text-sm">
                Nie znaleziono historii dla tego quizu.
              </p>
            ) : (
              history.entries.map((historyEntry: HistoryEntry) => {
                const correctAnswers = historyEntry.question.answers
                  .filter((ans) => ans.is_correct)
                  .map((ans) => ans.id);

                const isCorrectQuestion =
                  correctAnswers.length ===
                    historyEntry.selectedAnswers.length &&
                  historyEntry.selectedAnswers.every((ans) => {
                    return correctAnswers.includes(ans);
                  });

                return (
                  <button
                    key={`history-question-${historyEntry.entryId}`}
                    id={`history-question-${historyEntry.entryId}`}
                    onClick={() => {
                      openHistoryQuestion(historyEntry);
                      toggleHistory();
                    }}
                    className={cn(
                      "w-full justify-start rounded-md border px-4 py-3 text-left text-sm font-medium transition-colors",
                      computeAnswerVariant(
                        historyEntry.selectedAnswers.length > 0,
                        true,
                        historyEntry.selectedAnswers.length > 0
                          ? isCorrectQuestion
                          : true,
                      ),
                    )}
                  >
                    <span className="w-full">
                      {historyEntry.question.order}.{" "}
                      {historyEntry.question.text}
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
