"use client";
/* eslint-disable react-refresh/only-export-components */
import { makeAssistantToolUI, useToolArgsStatus } from "@assistant-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { diffChars, diffLines } from "diff";
import type { Change } from "diff";
import {
  AlertTriangleIcon,
  CheckIcon,
  DiffIcon,
  LoaderCircleIcon,
  PencilIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useAiChatContext } from "@/components/ai/ai-chat-context";
import { ImageLoad } from "@/components/image-load";
import { MarkdownRenderer } from "@/components/markdown-renderer";
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
import { prepareQuestionForSubmission } from "@/lib/schemas/quiz.schema";
import { cn } from "@/lib/utils";
import { getQuizService } from "@/services";
import type { Answer, Question, QuizWithUserProgress } from "@/types/quiz";

interface ImageFields {
  image?: string | null;
  image_url?: string | null;
  image_upload?: string | null;
}

interface EditedAnswer {
  text?: string;
  is_correct?: boolean;
  image?: string | null;
  image_url?: string | null;
  image_upload?: string | null;
}

interface EditedQuestion {
  text?: string;
  answers?: EditedAnswer[];
  explanation?: string;
  image?: string | null;
  image_url?: string | null;
  image_upload?: string | null;
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

function createDraftAnswer(ids: Map<number, string>, index: number): Answer {
  return {
    id: getDraftId(ids, index),
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

function normalizeText(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function formatAnswerForDiff(
  answer: {
    text?: string | null;
    is_correct?: boolean | null;
  },
  index: number,
): string {
  return `${(index + 1).toString()}. ${answer.is_correct === true ? "poprawna" : "niepoprawna"}: ${answer.text ?? ""}`;
}

function buildEditedQuestion(
  question: Question,
  edit: EditedQuestion,
  newAnswerIds: Map<number, string>,
): Question {
  const answers = (edit.answers ?? question.answers).map((answer, index) => ({
    ...(question.answers[index] ?? createDraftAnswer(newAnswerIds, index)),
    ...answer,
    order: index + 1,
  }));

  return {
    ...question,
    text: edit.text ?? question.text,
    explanation: edit.explanation ?? question.explanation,
    image: edit.image ?? edit.image_url ?? question.image,
    image_url: edit.image_url ?? question.image_url,
    image_upload: edit.image_upload ?? question.image_upload,
    multiple: answers.filter((answer) => answer.is_correct).length > 1,
    answers,
  };
}

interface DiffSection {
  label: string;
  changes: Change[];
}

function buildDiffSections(
  beforeQuestion: Question,
  afterQuestion: Question,
): DiffSection[] {
  const sections = [
    {
      label: "Treść pytania",
      before: beforeQuestion.text,
      after: afterQuestion.text,
    },
    {
      label: "Odpowiedzi",
      before: beforeQuestion.answers
        .toSorted((a, b) => a.order - b.order)
        .map((answer, index) => formatAnswerForDiff(answer, index))
        .join("\n"),
      after: afterQuestion.answers
        .toSorted((a, b) => a.order - b.order)
        .map((answer, index) => formatAnswerForDiff(answer, index))
        .join("\n"),
    },
    {
      label: "Wyjaśnienie",
      before: beforeQuestion.explanation ?? "",
      after: afterQuestion.explanation ?? "",
    },
  ];

  return sections.flatMap((section) => {
    if (normalizeText(section.before) === normalizeText(section.after)) {
      return [];
    }
    return [
      {
        label: section.label,
        changes: diffLines(section.before, section.after, {
          ignoreNewlineAtEof: true,
        }),
      },
    ];
  });
}

function DiffChunk({ change }: { change: Change }) {
  const prefix = change.added ? "+" : change.removed ? "-" : " ";
  return (
    <pre
      className={cn(
        "font-mono text-[11px] leading-relaxed whitespace-pre-wrap",
        change.added && "bg-green-500/10 text-green-900 dark:text-green-200",
        change.removed && "bg-red-500/10 text-red-900 dark:text-red-200",
        !change.added && !change.removed && "text-muted-foreground",
      )}
    >
      {change.value
        .split("\n")
        .filter((line, index, lines) => index < lines.length - 1 || line !== "")
        .map((line) => `${prefix} ${line}`)
        .join("\n")}
    </pre>
  );
}

function InlineDiffLine({ before, after }: { before: string; after: string }) {
  const charChanges = diffChars(before, after);
  const removedParts = charChanges.filter((part) => !part.added);
  const addedParts = charChanges.filter((part) => !part.removed);

  return (
    <>
      <pre className="bg-red-500/10 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-red-900 dark:text-red-200">
        -{" "}
        {removedParts.map((part, index) => (
          <span
            key={`removed-${index.toString()}`}
            className={cn(part.removed && "rounded bg-red-500/25")}
          >
            {part.value}
          </span>
        ))}
      </pre>
      <pre className="bg-green-500/10 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-green-900 dark:text-green-200">
        +{" "}
        {addedParts.map((part, index) => (
          <span
            key={`added-${index.toString()}`}
            className={cn(part.added && "rounded bg-green-500/25")}
          >
            {part.value}
          </span>
        ))}
      </pre>
    </>
  );
}

function DiffSectionContent({ changes }: { changes: Change[] }) {
  const nodes: React.ReactNode[] = [];

  for (let index = 0; index < changes.length; index += 1) {
    const current = changes[index];
    const next = index + 1 < changes.length ? changes[index + 1] : undefined;
    if (
      current.removed &&
      next?.added === true &&
      current.count === 1 &&
      next.count === 1
    ) {
      nodes.push(
        <InlineDiffLine
          key={`inline-${index.toString()}`}
          before={current.value.trimEnd()}
          after={next.value.trimEnd()}
        />,
      );
      index += 1;
      continue;
    }

    nodes.push(
      <DiffChunk key={`chunk-${index.toString()}`} change={current} />,
    );
  }

  return nodes;
}

function QuestionDiff({ sections }: { sections: DiffSection[] }) {
  return (
    <div className="space-y-2">
      {sections.map((section) => (
        <div key={section.label} className="overflow-hidden rounded-lg border">
          <div className="bg-muted/40 px-3 py-2 text-xs font-medium">
            {section.label}
          </div>
          <div className="overflow-x-auto">
            <DiffSectionContent changes={section.changes} />
          </div>
        </div>
      ))}
      <div className="text-muted-foreground grid grid-cols-2 gap-2 text-[11px]">
        <span className="rounded bg-red-500/10 px-2 py-1">- usunięto</span>
        <span className="rounded bg-green-500/10 px-2 py-1">+ dodano</span>
      </div>
    </div>
  );
}

function EditQuestionCard({ edit }: { edit: EditedQuestion }) {
  const { quizId, questionId, question, canEdit } = useAiChatContext();
  const queryClient = useQueryClient();
  const { status, propStatus } = useToolArgsStatus();
  const isRunning = status === "running";
  const answersComplete = propStatus.answers === "complete";
  const [applied, setApplied] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [draftQuestion, setDraftQuestion] = useState<Question | null>(null);
  const newAnswerIds = useMemo(() => new Map<number, string>(), []);

  const editableQuestion =
    question === null
      ? null
      : (draftQuestion ?? buildEditedQuestion(question, edit, newAnswerIds));
  const answers = editableQuestion?.answers ?? [];
  const diffSections =
    question === null || editableQuestion === null || !answersComplete
      ? []
      : buildDiffSections(question, editableQuestion);
  const hasDiff = diffSections.length > 0;
  const explanation = editableQuestion?.explanation?.trim() ?? "";
  const hasExplanation = explanation !== "";

  const { isPending, mutateAsync: applyEdit } = useMutation({
    mutationFn: async () => {
      if (questionId === null) {
        throw new Error("No current question");
      }
      if (editableQuestion === null) {
        throw new Error("No editable question");
      }
      return await getQuizService().updateQuestion(
        questionId,
        prepareQuestionForSubmission(editableQuestion),
      );
    },
    onSuccess: (updatedQuestion) => {
      setApplied(true);
      toast.success("Pytanie zaktualizowane");
      queryClient.setQueryData<QuizWithUserProgress>(
        quizDetailQueryKey(quizId),
        (old) => {
          if (old === undefined) {
            void queryClient.refetchQueries({ queryKey: ["quiz", quizId] });
            return old;
          }
          return {
            ...old,
            questions: old.questions.map((q) =>
              q.id === questionId ? updatedQuestion : q,
            ),
          };
        },
      );
    },
    onError: () => {
      toast.error("Nie udało się zaktualizować pytania");
    },
  });

  const hasAnswers = answers.length > 0;

  return (
    <Card className="border-amber-500/20 bg-linear-to-br from-amber-500/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-full bg-amber-500/10">
            <PencilIcon className="size-3.5 text-amber-600" />
          </div>
          <CardTitle className="text-sm">Proponowana edycja</CardTitle>
          <div className="ml-auto flex items-center gap-1">
            {answersComplete && hasDiff ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant={showDiff ? "secondary" : "ghost"}
                      size="icon-sm"
                      onClick={() => {
                        setShowDiff((current) => !current);
                      }}
                      aria-label={showDiff ? "Ukryj różnicę" : "Pokaż różnicę"}
                    >
                      <DiffIcon />
                    </Button>
                  }
                ></TooltipTrigger>
                <TooltipContent>
                  {showDiff ? "Ukryj różnicę" : "Pokaż różnicę"}
                </TooltipContent>
              </Tooltip>
            ) : null}
            {isRunning ? (
              <Badge variant="secondary" className="text-xs">
                <LoaderCircleIcon className="size-3 animate-spin" />
                Generowanie...
              </Badge>
            ) : null}
          </div>
        </div>
        {!showDiff &&
        editableQuestion?.text != null &&
        editableQuestion.text !== "" ? (
          <CardDescription className="text-foreground mt-2 overflow-y-hidden text-sm font-medium">
            <MarkdownRenderer>{editableQuestion.text}</MarkdownRenderer>
          </CardDescription>
        ) : null}
        {editableQuestion !== null && hasImageValue(editableQuestion) ? (
          <ImageLoad
            url={getImageSource(editableQuestion)}
            alt={
              editableQuestion.text === ""
                ? "Obrazek pytania"
                : editableQuestion.text
            }
            className="mx-auto mt-3 max-h-48 rounded border object-contain"
          />
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {showDiff ? (
          <QuestionDiff sections={diffSections} />
        ) : (
          <>
            {hasAnswers
              ? answers.map((answer, index) => {
                  if (answer.text === "" && !hasImageValue(answer)) {
                    return null;
                  }
                  const isCorrect = answer.is_correct;
                  return (
                    <div
                      key={`edit-answer-${index.toString()}`}
                      className={cn(
                        "animate-in fade-in slide-in-from-bottom-1 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm duration-200",
                        isCorrect
                          ? "border-green-500/30 bg-green-500/5"
                          : "border-border",
                      )}
                    >
                      {isCorrect ? (
                        <CheckIcon className="size-3.5 shrink-0 text-green-600" />
                      ) : (
                        <XIcon className="text-muted-foreground size-3.5 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        {answer.text === "" ? null : (
                          <MarkdownRenderer className="pointer-events-none">
                            {answer.text}
                          </MarkdownRenderer>
                        )}
                        {hasImageValue(answer) ? (
                          <ImageLoad
                            url={getImageSource(answer)}
                            alt={
                              answer.text === ""
                                ? "Obrazek odpowiedzi"
                                : answer.text
                            }
                            className="mx-auto mt-2 max-h-32 rounded object-contain"
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                })
              : null}

            {answersComplete && hasExplanation ? (
              <div className="bg-muted/40 mt-2 rounded-lg border p-3 text-xs">
                <p className="text-muted-foreground mb-1 font-medium">
                  Wyjaśnienie:
                </p>
                <MarkdownRenderer>{explanation}</MarkdownRenderer>
              </div>
            ) : null}
          </>
        )}

        {answersComplete ? null : (
          <div className="border-border flex w-full items-center gap-2 rounded-lg border px-3 py-2">
            <div className="bg-muted size-3.5 shrink-0 animate-pulse rounded-full" />
            <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
          </div>
        )}

        {answersComplete && questionId !== null && canEdit ? (
          <div className="mt-2 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-w-0 flex-1 border-amber-500/30 hover:bg-amber-500/10"
              onClick={() => {
                void applyEdit();
              }}
              disabled={isPending || applied}
            >
              {isPending ? (
                <>
                  <LoaderCircleIcon className="animate-spin" />
                  Zapisywanie...
                </>
              ) : applied ? (
                <>
                  <CheckIcon />
                  Zastosowano zmiany
                </>
              ) : (
                <>
                  <CheckIcon />
                  Zastosuj zmiany
                </>
              )}
            </Button>
            {applied || editableQuestion === null ? null : (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => {
                        setEditOpen(true);
                      }}
                      aria-label="Edytuj przed zastosowaniem"
                    >
                      <SlidersHorizontalIcon />
                    </Button>
                  }
                ></TooltipTrigger>
                <TooltipContent>Edytuj przed zastosowaniem</TooltipContent>
              </Tooltip>
            )}
          </div>
        ) : null}

        {editOpen && editableQuestion !== null ? (
          <QuickEditQuestionDialog
            open
            onOpenChange={setEditOpen}
            question={editableQuestion}
            quizId={quizId}
            onSaveDraft={(updatedQuestion) => {
              setDraftQuestion(updatedQuestion);
              setShowDiff(false);
            }}
            hideDelete
            hideFullEditor
            minAnswers={2}
          />
        ) : null}

        {answersComplete && questionId === null && canEdit ? (
          <p className="text-muted-foreground mt-2 text-center text-xs">
            Brak aktualnego pytania do edycji
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ToolErrorCard({ label }: { label: string }) {
  return (
    <Card className="border-destructive/20 from-destructive/5 bg-linear-to-br to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="bg-destructive/10 flex size-6 items-center justify-center rounded-full">
            <AlertTriangleIcon className="text-destructive size-3.5" />
          </div>
          <CardTitle className="text-sm">{label}</CardTitle>
        </div>
        <CardDescription className="text-destructive/70 mt-1 text-sm">
          Generowanie nie powiodło się. Spróbuj ponownie.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export const EditQuestionToolUI = makeAssistantToolUI<EditedQuestion, string>({
  toolName: "edit_question",
  render: ({ args, status }) => {
    if (status.type === "incomplete") {
      return <ToolErrorCard label="Błąd edycji pytania" />;
    }
    if (args.text == null || args.text === "") {
      return null;
    }
    return <EditQuestionCard edit={args} />;
  },
});
