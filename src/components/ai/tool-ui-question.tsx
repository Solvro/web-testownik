"use client";
/* eslint-disable react-refresh/only-export-components */
import { makeAssistantToolUI, useToolArgsStatus } from "@assistant-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import * as z from "zod";

import { useAiChatContext } from "@/components/ai/ai-chat-context";
import { ImageLoad } from "@/components/image-load";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { computeAnswerVariant } from "@/components/quiz/helpers/question-card";
import { quizDetailQueryKey } from "@/components/quiz/helpers/utils";
import { QuickEditQuestionDialog } from "@/components/quiz/quick-edit-question-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getQuizService } from "@/services";
import type { Question, QuizWithUserProgress } from "@/types/quiz";

interface ImageFields {
  image?: string | null;
  image_url?: string | null;
  image_upload?: string | null;
}

interface GeneratedAnswer {
  text?: string;
  is_correct?: boolean;
  image?: string | null;
  image_url?: string | null;
  image_upload?: string | null;
}

interface GeneratedQuestion {
  text?: string;
  answers?: GeneratedAnswer[];
  explanation?: string;
  image?: string | null;
  image_url?: string | null;
  image_upload?: string | null;
}

interface GeneratedQuestionsArguments {
  questions?: GeneratedQuestion[];
}

function AnswerSkeleton() {
  return (
    <div className="border-border flex w-full items-center gap-2 rounded-md border px-3 py-2.5">
      <div className="bg-muted h-3.5 w-2/3 animate-pulse rounded" />
    </div>
  );
}

function getImageSource(item: ImageFields): string | null {
  return item.image ?? item.image_url ?? null;
}

function hasImageValue(item: ImageFields): boolean {
  return (
    (item.image != null && item.image !== "") ||
    (item.image_url != null && item.image_url !== "") ||
    (item.image_upload != null && item.image_upload !== "")
  );
}

function getDraftId(ids: Map<number, string>, index: number): string {
  const existingId = ids.get(index);
  if (existingId !== undefined) {
    return existingId;
  }
  const id = crypto.randomUUID();
  ids.set(index, id);
  return id;
}

function createDraftAnswer(
  answerIds: Map<number, string>,
  index: number,
): Question["answers"][number] {
  return {
    id: getDraftId(answerIds, index),
    order: index + 1,
    text: "",
    is_correct: false,
    image: null,
    image_url: null,
    image_upload: null,
    image_width: null,
    image_height: null,
  };
}

const questionPayloadSchema = z
  .object({
    text: z.string(),
    explanation: z.string().optional(),
    image: z.string().nullable().optional(),
    image_url: z.string().nullable().optional(),
    image_upload: z.string().nullable().optional(),
    answers: z
      .array(
        z.object({
          order: z.number(),
          text: z.string(),
          is_correct: z.boolean(),
          image: z.string().nullable().optional(),
          image_url: z.string().nullable().optional(),
          image_upload: z.string().nullable().optional(),
        }),
      )
      .min(2),
  })
  .refine((question) => question.text.trim() !== "" || hasImageValue(question))
  .refine((question) =>
    question.answers.every(
      (answer) => answer.text.trim() !== "" || hasImageValue(answer),
    ),
  )
  .transform((question) => {
    const answers = question.answers.toSorted((a, b) => a.order - b.order);
    return {
      text: question.text,
      explanation: question.explanation ?? "",
      multiple: answers.filter((answer) => answer.is_correct).length > 1,
      is_ai_generated: true,
      image_url: question.image_url,
      image_upload: question.image_upload,
      answers: answers.map((answer) => ({
        text: answer.text,
        is_correct: answer.is_correct,
        image_url: answer.image_url,
        image_upload: answer.image_upload,
      })),
    };
  });

function toQuestionDraft(
  question: GeneratedQuestion,
  questionId = crypto.randomUUID(),
  answerIds = new Map<number, string>(),
): Question {
  const answers = (question.answers ?? []).map((answer, index) => ({
    ...createDraftAnswer(answerIds, index),
    ...answer,
    order: index + 1,
    text: answer.text ?? "",
    is_correct: answer.is_correct ?? false,
  }));

  return {
    id: questionId,
    order: 1,
    text: question.text ?? "",
    explanation: question.explanation ?? "",
    multiple: answers.filter((answer) => answer.is_correct).length > 1,
    is_ai_generated: true,
    image: question.image ?? question.image_url ?? null,
    image_url: question.image_url ?? null,
    image_upload: question.image_upload ?? null,
    image_width: null,
    image_height: null,
    answers,
  };
}

function isQuestionComplete(question: Question): boolean {
  return questionPayloadSchema.safeParse(question).success;
}

function toCreatePayload(question: Question) {
  return questionPayloadSchema.parse(question);
}

function QuestionCard({
  question,
  isBulkSaved,
}: {
  question: GeneratedQuestion;
  isBulkSaved: boolean;
}) {
  const { quizId, canEdit } = useAiChatContext();
  const queryClient = useQueryClient();
  const [showExplanation, setShowExplanation] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [individuallySaved, setIndividuallySaved] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editedQuestion, setEditedQuestion] = useState<Question | null>(null);
  const draftQuestionId = useMemo(() => crypto.randomUUID(), []);
  const draftAnswerIds = useMemo(() => new Map<number, string>(), []);

  const visibleQuestion =
    editedQuestion ??
    toQuestionDraft(question, draftQuestionId, draftAnswerIds);
  const saved = isBulkSaved || individuallySaved;
  const answers = visibleQuestion.answers.toSorted((a, b) => a.order - b.order);
  const isComplete = isQuestionComplete(visibleQuestion);
  const isMultiple =
    isComplete && answers.filter((answer) => answer.is_correct).length > 1;
  const hasExplanation = Boolean(visibleQuestion.explanation?.trim());

  const { isPending: isSaving, mutateAsync: saveToQuiz } = useMutation({
    mutationFn: async () => {
      return await getQuizService().createQuestion(
        quizId,
        toCreatePayload(visibleQuestion),
      );
    },
    onSuccess: (newQuestion: Question) => {
      setIndividuallySaved(true);
      toast.success("Pytanie dodane do quizu");
      queryClient.setQueryData<QuizWithUserProgress>(
        quizDetailQueryKey(quizId),
        (old) => {
          if (old === undefined) {
            void queryClient.refetchQueries({
              queryKey: ["quiz", quizId],
            });
            return old;
          }
          return {
            ...old,
            questions: [...old.questions, newQuestion],
          };
        },
      );
    },
    onError: () => {
      toast.error("Nie udało się dodać pytania");
    },
  });

  const handleAnswerClick = (index: number) => {
    if (checked || !isComplete) {
      return;
    }
    if (isMultiple) {
      setSelectedAnswers((previous) =>
        previous.includes(index)
          ? previous.filter((index_) => index_ !== index)
          : [...previous, index],
      );
    } else {
      setSelectedAnswers((previous) =>
        previous.includes(index) ? [] : [index],
      );
    }
  };

  const handleCheck = () => {
    if (selectedAnswers.length === 0) {
      return;
    }
    setChecked(true);
  };

  const hasAnswers = answers.length > 0;

  return (
    <Card className="border-primary/20 from-primary/5 bg-linear-to-br to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 flex size-5 items-center justify-center rounded-full">
            <SparklesIcon className="text-primary size-3" />
          </div>
          <CardTitle className="text-xs font-medium">
            Wygenerowane pytanie
          </CardTitle>
          {isComplete ? (
            <Badge
              variant="outline"
              className="text-primary/70 border-primary/20 ml-auto gap-1 px-1.5 py-0 text-[10px]"
            >
              <SparklesIcon className="size-2.5" />
              AI
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="ml-auto gap-1 px-1.5 py-0 text-[10px]"
            >
              <LoaderCircleIcon className="size-2.5 animate-spin" />
              Generowanie...
            </Badge>
          )}
        </div>
        {visibleQuestion.text === "" ? null : (
          <CardDescription className="text-foreground mt-1.5 overflow-y-auto text-sm leading-snug font-medium">
            <MarkdownRenderer>{visibleQuestion.text}</MarkdownRenderer>
          </CardDescription>
        )}
        {hasImageValue(visibleQuestion) ? (
          <ImageLoad
            url={getImageSource(visibleQuestion)}
            alt={
              visibleQuestion.text === ""
                ? "Obrazek pytania"
                : visibleQuestion.text
            }
            className="mx-auto mt-3 max-h-48 rounded border object-contain"
          />
        ) : null}
      </CardHeader>
      <CardContent className="space-y-1.5 pt-0">
        {hasAnswers
          ? answers.map((answer, index) => {
              if (answer.text === "" && !hasImageValue(answer)) {
                return null;
              }
              const isSelected = selectedAnswers.includes(index);
              return (
                <button
                  key={`gen-answer-${index.toString()}`}
                  onClick={() => {
                    handleAnswerClick(index);
                  }}
                  disabled={checked || !isComplete}
                  className={cn(
                    "animate-in fade-in slide-in-from-bottom-1 w-full justify-start rounded-md border px-3 py-2.5 text-left font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed",
                    "bg-input dark:bg-background",
                    computeAnswerVariant(
                      isSelected,
                      checked,
                      answer.is_correct,
                    ),
                  )}
                >
                  {answer.text === "" ? null : (
                    <MarkdownRenderer className="pointer-events-none w-full text-sm">
                      {answer.text}
                    </MarkdownRenderer>
                  )}
                  {hasImageValue(answer) ? (
                    <ImageLoad
                      url={getImageSource(answer)}
                      alt={
                        answer.text === "" ? "Obrazek odpowiedzi" : answer.text
                      }
                      className="mx-auto mt-2 max-h-32 rounded object-contain"
                    />
                  ) : null}
                </button>
              );
            })
          : null}

        {isComplete ? null : <AnswerSkeleton />}

        {checked ? (
          <div className="pt-1 text-sm">
            {selectedAnswers.every(
              (index) => answers[index]?.is_correct ?? false,
            ) &&
            answers.every(
              (a, index) => !a.is_correct || selectedAnswers.includes(index),
            ) ? (
              <p className="font-medium text-green-600 dark:text-green-400">
                Poprawna odpowiedź!
              </p>
            ) : (
              <p className="text-destructive font-medium">
                Niepoprawna odpowiedź.
              </p>
            )}
          </div>
        ) : null}

        {isComplete && !checked && hasAnswers ? (
          <Button
            size="sm"
            className="mt-2 w-full"
            onClick={handleCheck}
            disabled={selectedAnswers.length === 0}
          >
            Sprawdź odpowiedź
          </Button>
        ) : null}

        {checked && isComplete && hasExplanation ? (
          <div className="pt-1">
            {showExplanation ? (
              <div className="bg-muted/40 rounded-lg border p-3 text-xs">
                <MarkdownRenderer>
                  {visibleQuestion.explanation}
                </MarkdownRenderer>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowExplanation(true);
                }}
                className="text-xs"
              >
                Pokaż wyjaśnienie
              </Button>
            )}
          </div>
        ) : null}

        {isComplete && hasAnswers && canEdit ? (
          <div className="mt-2 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-w-0 flex-1"
              onClick={() => {
                void saveToQuiz();
              }}
              disabled={isSaving || saved}
            >
              {isSaving ? (
                <>
                  <LoaderCircleIcon className="animate-spin" />
                  Dodawanie...
                </>
              ) : saved ? (
                <>
                  <CheckIcon />
                  Dodano do quizu
                </>
              ) : (
                <>
                  <PlusIcon />
                  Dodaj do quizu
                </>
              )}
            </Button>
            {saved ? null : (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => {
                        setEditOpen(true);
                      }}
                      aria-label="Edytuj przed dodaniem"
                    >
                      <PencilIcon />
                    </Button>
                  }
                ></TooltipTrigger>
                <TooltipContent>Edytuj przed dodaniem</TooltipContent>
              </Tooltip>
            )}
          </div>
        ) : null}

        {editOpen ? (
          <QuickEditQuestionDialog
            open
            onOpenChange={setEditOpen}
            question={visibleQuestion}
            quizId={quizId}
            onSaveDraft={(updatedQuestion) => {
              setEditedQuestion(updatedQuestion);
              setSelectedAnswers([]);
              setChecked(false);
              setShowExplanation(false);
            }}
            hideDelete
            hideFullEditor
            minAnswers={2}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function LoadingCard() {
  return (
    <Card className="border-primary/20 from-primary/5 bg-linear-to-br to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 flex size-5 items-center justify-center rounded-full">
            <SparklesIcon className="text-primary size-3" />
          </div>
          <CardTitle className="text-xs font-medium">
            Wygenerowane pytanie
          </CardTitle>
          <Badge
            variant="secondary"
            className="ml-auto gap-1 px-1.5 py-0 text-[10px]"
          >
            <LoaderCircleIcon className="size-2.5 animate-spin" />
            Generowanie...
          </Badge>
        </div>
        <div className="bg-muted mt-1.5 h-4 w-4/5 animate-pulse rounded" />
      </CardHeader>
      <CardContent className="space-y-1.5 pt-0">
        <AnswerSkeleton />
        <AnswerSkeleton />
      </CardContent>
    </Card>
  );
}

function QuestionsCarousel({ questions }: { questions: GeneratedQuestion[] }) {
  const { quizId, canEdit } = useAiChatContext();
  const { status } = useToolArgsStatus();
  const queryClient = useQueryClient();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [isBulkSaved, setIsBulkSaved] = useState(false);

  const isToolComplete = status === "complete";
  const visibleQuestions = questions.filter(
    (question) =>
      (question.text !== undefined && question.text !== "") ||
      hasImageValue(question),
  );
  const count = visibleQuestions.length;
  const showNav = count > 1;

  const savablePayloads =
    isToolComplete && !isBulkSaved
      ? visibleQuestions
          .map((question) => toQuestionDraft(question))
          .filter((question) => isQuestionComplete(question))
          .map((question) => toCreatePayload(question))
      : [];

  const handleSaveAll = async () => {
    if (savablePayloads.length === 0) {
      return;
    }
    setIsSavingAll(true);
    try {
      const newQuestions = await getQuizService().bulkCreateQuestions(
        quizId,
        savablePayloads.map((p) => ({ ...p, is_ai_generated: true })),
      );
      setIsBulkSaved(true);
      toast.success(`Dodano ${newQuestions.length.toString()} pytań do quizu`);
      queryClient.setQueryData<QuizWithUserProgress>(
        quizDetailQueryKey(quizId),
        (old) => {
          if (old === undefined) {
            void queryClient.refetchQueries({ queryKey: ["quiz", quizId] });
            return old;
          }
          return {
            ...old,
            questions: [...old.questions, ...newQuestions],
          };
        },
      );
    } catch {
      toast.error("Nie udało się dodać pytań");
    } finally {
      setIsSavingAll(false);
    }
  };

  if (status === "running" && visibleQuestions.length === 0) {
    return <LoadingCard />;
  }

  return (
    <div className="flex flex-col gap-2">
      {visibleQuestions.map((question, index) => (
        <div
          key={`question-${index.toString()}`}
          className={showNav && index !== activeIndex ? "hidden" : undefined}
        >
          <QuestionCard question={question} isBulkSaved={isBulkSaved} />
        </div>
      ))}

      {showNav ? (
        <div className="mb-2 space-y-1.5">
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setActiveIndex((current) => Math.max(0, current - 1));
              }}
              disabled={activeIndex === 0}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <span className="text-muted-foreground text-xs font-medium tabular-nums">
              {(activeIndex + 1).toString()} / {count.toString()}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setActiveIndex((current) => Math.min(count - 1, current + 1));
              }}
              disabled={activeIndex >= count - 1}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>

          {canEdit && savablePayloads.length > 1 ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                void handleSaveAll();
              }}
              disabled={isSavingAll}
            >
              {isSavingAll ? (
                <>
                  <LoaderCircleIcon className="size-3.5 animate-spin" />
                  Dodawanie...
                </>
              ) : (
                <>
                  <PlusIcon className="size-3.5" />
                  Dodaj wszystkie do quizu ({savablePayloads.length.toString()})
                </>
              )}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
//eslint-disable-next-line @typescript-eslint/no-deprecated
export const GeneratedQuestionsToolUI = makeAssistantToolUI<
  GeneratedQuestionsArguments,
  string
>({
  toolName: "generate_practice_questions",
  render: ({ args, status }) => {
    if (status.type === "incomplete") {
      return (
        <Card className="border-destructive/20 from-destructive/5 bg-linear-to-br to-transparent">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="bg-destructive/10 flex size-5 items-center justify-center rounded-full">
                <AlertTriangleIcon className="text-destructive size-3" />
              </div>
              <CardTitle className="text-xs font-medium">
                Błąd generowania pytań
              </CardTitle>
            </div>
            <CardDescription className="text-destructive/70 mt-1 text-sm">
              Generowanie nie powiodło się. Spróbuj ponownie.
            </CardDescription>
          </CardHeader>
        </Card>
      );
    }
    const questions = args.questions ?? [];
    if (questions.length === 0 && status.type !== "running") {
      return null;
    }
    return <QuestionsCarousel questions={questions} />;
  },
});
