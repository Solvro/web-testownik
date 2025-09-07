import { CheckIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { ShareQuizModal } from "@/components/quiz/ShareQuizModal/share-quiz-modal.tsx";
import type { Quiz } from "@/components/quiz/types.ts";
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
import { ScrollArea } from "@/components/ui/scroll-area.tsx";

interface QuizPreviewModalProps {
  show: boolean;
  onHide: () => void;
  quiz: Quiz | null;
  type: "created" | "imported"; // To distinguish between created and imported quizzes
}

export function QuizPreviewModal({
  show,
  onHide,
  quiz,
  type,
}: QuizPreviewModalProps) {
  const [showShareModal, setShowShareModal] = useState(false);

  if (quiz == null) {
    return null;
  }

  const { id, title, description, questions } = quiz;
  const previewQuestions = questions.slice(0, 10);

  const handleShare = () => {
    setShowShareModal(true);
  };

  return (
    <>
      <Dialog
        open={show}
        onOpenChange={(open) => {
          if (!open) {
            onHide();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {type === "created"
                ? `Quiz "${title}" został utworzony`
                : `Quiz "${title}" został zaimportowany`}
            </DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="space-y-2">
            <h5 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              Pytania{" "}
              {questions.length > 10
                ? `(pierwsze 10, łącznie ${questions.length.toString()})`
                : `(${questions.length.toString()})`}
            </h5>
            <ScrollArea>
              <div className="max-h-80">
                <ol className="space-y-3">
                  {previewQuestions.map((question, qi) => (
                    <li
                      key={question.id}
                      className="border-border/60 bg-card/40 hover:bg-card/55 rounded-md border p-3 shadow-sm transition"
                    >
                      <div className="mb-2 flex items-start gap-2">
                        <span className="bg-primary/10 text-primary inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                          {qi + 1}
                        </span>
                        <p className="text-sm leading-snug font-medium">
                          {question.question}
                        </p>
                      </div>
                      <ul className="grid gap-1.5 sm:grid-cols-2">
                        {question.answers.map((answer) => {
                          const correct = answer.correct;
                          return (
                            <li
                              key={answer.answer}
                              className={`group relative flex items-start gap-2 rounded border px-2 py-1.5 text-xs ${
                                correct
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "border-border/50 bg-muted/40 text-muted-foreground"
                              }`}
                            >
                              <span
                                className={`mt-0.5 inline-flex size-4 items-center justify-center rounded-full border text-[10px] ${
                                  correct
                                    ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                    : "border-destructive/40 bg-destructive/10 text-destructive"
                                }`}
                                aria-label={
                                  correct
                                    ? "Poprawna odpowiedź"
                                    : "Niepoprawna odpowiedź"
                                }
                              >
                                {correct ? (
                                  <CheckIcon
                                    className="size-3"
                                    strokeWidth={3}
                                  />
                                ) : (
                                  <XIcon className="size-3" strokeWidth={3} />
                                )}
                              </span>
                              <span className="flex-1 leading-snug">
                                {answer.answer}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ol>
              </div>
            </ScrollArea>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="grid grid-cols-3 gap-2 sm:flex">
              <DialogClose asChild>
                <Button variant="outline">Zamknij</Button>
              </DialogClose>
              <Button variant="outline" onClick={handleShare}>
                Udostępnij
              </Button>
              <Link to={`/edit-quiz/${id}`}>
                <Button variant="outline" className="w-full sm:w-auto">
                  Edytuj
                </Button>
              </Link>
            </div>
            <Link to={`/quiz/${id}`}>
              <Button className="w-full sm:w-auto">Otwórz</Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ShareQuizModal
        show={showShareModal}
        onHide={() => {
          setShowShareModal(false);
        }}
        quiz={quiz}
      />
    </>
  );
}
