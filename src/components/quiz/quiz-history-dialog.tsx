import React from "react";

import { ImageLoad } from "@/components/image-load";
import { computeAnswerVariantText } from "@/components/quiz/helpers/question-card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import type { AnswerRecord, Quiz } from "@/types/quiz";

interface QuizHistoryDialogProps {
  quiz: Quiz;
  answers: AnswerRecord[];
  showHistory: boolean;
  toggleHistory: () => void;
}

export function QuizHistoryDialog({
  quiz, // Used for question metadata; use the answers prop for up-to-date answer history
  answers,
  showHistory,
  toggleHistory,
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
            <Accordion type="single" collapsible className="max-w-lg">
              {answers.length === 0 ? (
                <p className="flex justify-center p-4 text-sm">
                  Nie znaleziono historii w tej sesji quizu.
                </p>
              ) : (
                answers.map((answer) => {
                  const question = quiz.questions.find(
                    (q) => q.id === answer.question,
                  );

                  if (question == null) {
                    return null;
                  }

                  return (
                    <AccordionItem
                      key={`history-question-${answer.id}`}
                      id={`history-question-${answer.id}`}
                      value={`history-question-${answer.id}`}
                    >
                      <AccordionTrigger
                        className={cn(
                          "w-full rounded-md px-4 py-3 text-left text-sm font-medium transition-colors",
                          computeAnswerVariantText(
                            answer.selected_answers.length > 0,
                            true,
                            answer.selected_answers.length > 0
                              ? answer.was_correct
                              : true,
                          ),
                        )}
                      >
                        <p className="line-clamp-2 text-left">
                          {question.order}.{" "}
                          {question.text || (
                            <span className="font-light italic">
                              Brak treści pytania
                            </span>
                          )}
                        </p>
                      </AccordionTrigger>
                      <AccordionContent className="px-4">
                        <ImageLoad
                          key={`question-history-image-${question.id}`}
                          url={question.image}
                          alt={question.text}
                          width={question.image_width}
                          height={question.image_height}
                          className="mb-4 max-h-40 w-fit max-w-full rounded object-contain"
                        />
                        {question.answers.map((ans) => {
                          return (
                            <div
                              key={ans.id}
                              className={cn(
                                "mb-2 flex flex-col gap-1",
                                computeAnswerVariantText(
                                  answer.selected_answers.includes(ans.id),
                                  true,
                                  ans.is_correct,
                                ),
                              )}
                            >
                              <p>{ans.text}</p>
                              <ImageLoad
                                key={`answer-history-image-${question.id}-${ans.id}`}
                                url={ans.image}
                                alt={ans.text}
                                width={ans.image_width}
                                height={ans.image_height}
                                className="max-h-20 w-fit max-w-full rounded object-contain"
                              />
                            </div>
                          );
                        })}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })
              )}
            </Accordion>
          </div>
          <ScrollBar orientation="vertical" />
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
