"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { QuizFormData } from "@testownik/core/quiz/schema";
import type { Quiz, QuizVersionQuestion } from "@testownik/core/quiz/types";
import {
  ArrowLeftIcon,
  CheckIcon,
  HistoryIcon,
  Loader2Icon,
  RotateCcwIcon,
} from "lucide-react";
import { useContext, useState } from "react";
import { toast } from "sonner";

import { AppContext } from "@/app-context";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { quizQueryKey } from "@/components/quiz/helpers/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { moveRovingFocus } from "@/lib/roving-focus";
import { cn } from "@/lib/utils";
import { getQuizService } from "@/services";

import {
  authorLabel,
  describeSummary,
  formatWhen,
  quizVersionsQueryKey,
  sourceLabel,
} from "./version-history";

/** How a question in a version compares with the editor now. */
function laterChange(
  question: QuizVersionQuestion,
  current: QuizFormData,
): "removed" | "changed" | null {
  const now = current.questions.find((item) => item.id === question.id);
  if (now === undefined) {
    return "removed";
  }
  const same =
    now.text === question.text &&
    (now.explanation ?? "") === question.explanation &&
    now.multiple === question.multiple &&
    now.answers.length === question.answers.length &&
    now.answers.every((answer, index) => {
      const old = question.answers.at(index);
      return (
        answer.id === old?.id &&
        answer.text === old.text &&
        answer.is_correct === old.is_correct
      );
    });
  return same ? null : "changed";
}

export function VersionHistoryDialog({
  quizId,
  open,
  onOpenChange,
  current,
  hasChanges,
  onRestoringChange,
  hasUnsavedChanges,
  canStart,
  onRestored,
}: {
  quizId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The editor's values, to mark what changed since a version. */
  current: () => QuizFormData;
  /** Restoring discards the editor's unsaved changes. */
  hasChanges: boolean;
  /** The editor disables itself while a restore is in flight. */
  onRestoringChange: (restoring: boolean) => void;
  /** Whether the editor has edits since the last save or restore. */
  hasUnsavedChanges: () => boolean;
  /** Whether no save or restore is running; shows why otherwise. */
  canStart: () => boolean;
  /** Loads the restored quiz into the editor. */
  onRestored: (quiz: Quiz) => void;
}) {
  const queryClient = useQueryClient();
  const userId = useContext(AppContext).user?.user_id;
  const [selected, setSelected] = useState<number | null>(null);
  const [focusVersion, setFocusVersion] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);
  const versions = useQuery({
    queryKey: quizVersionsQueryKey(quizId),
    queryFn: async () => getQuizService().getQuizVersions(quizId),
    enabled: open,
    staleTime: 0,
  });
  const latest = versions.data?.at(0)?.version;
  const shown = selected ?? latest ?? null;
  const detail = useQuery({
    queryKey: ["quiz-version", quizId, shown],
    queryFn: async () => getQuizService().getQuizVersion(quizId, shown ?? 0),
    enabled: open && shown !== null,
    // A version number always names the same content.
    staleTime: Number.POSITIVE_INFINITY,
  });

  /** Restores `version`; `undoTo` offers restoring that version back. */
  async function restore(version: number, message: string, undoTo?: number) {
    if (!canStart()) {
      return;
    }
    setRestoring(true);
    onRestoringChange(true);
    try {
      const quiz = await getQuizService().restoreQuizVersion(quizId, version);
      queryClient.setQueryData(quizQueryKey(quizId), quiz);
      await queryClient.invalidateQueries({
        queryKey: quizVersionsQueryKey(quizId),
      });
      onRestored(quiz);
      onOpenChange(false);
      setSelected(null);
      toast.success(message, {
        duration: 10_000,
        action:
          undoTo === undefined
            ? undefined
            : {
                label: "Cofnij",
                onClick: () => {
                  // Undoing would also throw away edits made since.
                  if (hasUnsavedChanges()) {
                    toast.info(
                      "Masz już nowe zmiany. Zapisz je albo przywróć wersję z historii.",
                    );
                    return;
                  }
                  void restore(undoTo, "Cofnięto przywrócenie wersji");
                },
              },
      });
    } catch {
      toast.error("Nie udało się przywrócić wersji. Spróbuj ponownie.");
    } finally {
      setRestoring(false);
      onRestoringChange(false);
    }
  }

  const shownVersion = versions.data?.find((item) => item.version === shown);
  const tabbable =
    focusVersion !== null &&
    versions.data?.some((item) => item.version === focusVersion) === true
      ? focusVersion
      : shown;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Stays open while restoring, so no edits are made in the meantime.
        if (!next && restoring) {
          return;
        }
        onOpenChange(next);
        if (!next) {
          setSelected(null);
          setFocusVersion(null);
        }
      }}
    >
      <DialogContent className="flex h-[min(46rem,90dvh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <div className="border-border border-b px-5 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2 text-base">
            <HistoryIcon className="text-muted-foreground size-4" />
            Historia wersji
          </DialogTitle>
        </div>
        {versions.isPending ? (
          <div className="text-muted-foreground flex flex-1 items-center justify-center gap-2">
            <Loader2Icon className="size-4 animate-spin" />
            Wczytywanie historii…
          </div>
        ) : versions.isError ? (
          <div className="p-5">
            <Alert variant="destructive">
              <AlertDescription>
                {/* The API refuses non-editors with 403. */}
                {versions.error.message.includes("(403)")
                  ? "Historię wersji widzą tylko osoby, które mogą edytować ten quiz."
                  : "Nie udało się wczytać historii wersji."}
              </AlertDescription>
            </Alert>
          </div>
        ) : versions.data.length === 0 ? (
          <p className="text-muted-foreground flex flex-1 items-center justify-center px-5 text-center">
            Ten quiz nie ma jeszcze zapisanych wersji. Pojawią się po pierwszej
            zmianie.
          </p>
        ) : (
          <div className="grid min-h-0 flex-1 md:grid-cols-[18rem_minmax(0,1fr)]">
            <nav
              aria-label="Wersje"
              className={cn(
                "border-border min-h-0 overflow-y-auto border-r p-2",
                selected !== null && "max-md:hidden",
              )}
            >
              {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Arrow keys move between the buttons inside. */}
              <ol
                className="space-y-0.5"
                onKeyDown={(event) => {
                  moveRovingFocus(event, "[data-version]", "vertical");
                }}
                onFocus={(event) => {
                  const version = event.target.dataset.version;
                  if (version !== undefined) {
                    setFocusVersion(Number(version));
                  }
                }}
              >
                {versions.data.map((version) => (
                  <li key={version.version}>
                    <button
                      type="button"
                      data-version={version.version}
                      tabIndex={version.version === tabbable ? 0 : -1}
                      aria-current={
                        version.version === shown ? "true" : undefined
                      }
                      onClick={() => {
                        setSelected(version.version);
                        // On phones the list gives way to the preview.
                        requestAnimationFrame(() => {
                          const back = document.querySelector<HTMLElement>(
                            "[data-history-back]",
                          );
                          if (back !== null && back.offsetParent !== null) {
                            back.focus();
                          }
                        });
                      }}
                      className={cn(
                        "focus-visible:outline-primary w-full rounded-lg px-3 py-2.5 text-left transition-colors outline-none focus-visible:outline-2",
                        version.version === shown
                          ? "bg-primary/10 dark:bg-primary/20"
                          : "hover:bg-muted/60",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {formatWhen(version.updated_at)}
                        </span>
                        {version.version === latest ? (
                          <span className="text-primary-text text-xs font-medium">
                            Aktualna
                          </span>
                        ) : null}
                      </span>
                      <span className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                        <Badge variant="secondary" className="px-1.5 py-0">
                          {sourceLabel(version)}
                        </Badge>
                        <span className="truncate">
                          {authorLabel(version, userId)}
                        </span>
                      </span>
                      <span className="text-muted-foreground mt-0.5 block text-xs">
                        {describeSummary(
                          version.summary,
                          version.question_count,
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
            <section
              aria-label="Podgląd wersji"
              className={cn(
                "flex min-h-0 flex-col",
                selected === null && "max-md:hidden",
              )}
            >
              {shownVersion === undefined ? null : (
                <div className="border-border flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 py-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="md:hidden"
                    aria-label="Wróć do listy wersji"
                    data-history-back
                    onClick={() => {
                      const shownNow = shown;
                      setSelected(null);
                      requestAnimationFrame(() => {
                        document
                          .querySelector<HTMLElement>(
                            `[data-version="${String(shownNow)}"]`,
                          )
                          ?.focus();
                      });
                    }}
                  >
                    <ArrowLeftIcon />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {formatWhen(shownVersion.updated_at)}
                    </p>
                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      Wersja {String(shownVersion.version)} ·{" "}
                      {authorLabel(shownVersion, userId)}
                      <Badge variant="secondary" className="px-1.5 py-0">
                        {sourceLabel(shownVersion)}
                      </Badge>
                    </p>
                  </div>
                  {shownVersion.version === latest ? (
                    <span className="text-muted-foreground text-sm max-sm:basis-full">
                      Obecna wersja quizu
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant={hasChanges ? "destructive" : "default"}
                      disabled={restoring}
                      aria-busy={restoring}
                      onClick={() => {
                        void restore(
                          shownVersion.version,
                          `Przywrócono wersję ${String(shownVersion.version)}`,
                          latest,
                        );
                      }}
                    >
                      {restoring ? (
                        <Loader2Icon className="animate-spin" />
                      ) : (
                        <RotateCcwIcon />
                      )}
                      {hasChanges
                        ? "Odrzuć zmiany i przywróć"
                        : "Przywróć tę wersję"}
                    </Button>
                  )}
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {hasChanges && shownVersion?.version !== latest ? (
                  <p className="text-muted-foreground mb-4 text-sm">
                    Masz niezapisane zmiany. Przywrócenie wersji je odrzuci;
                    obecna zapisana treść zostanie w historii.
                  </p>
                ) : null}
                {shown === null ? null : detail.isPending ? (
                  <div className="text-muted-foreground flex items-center gap-2">
                    <Loader2Icon className="size-4 animate-spin" />
                    Wczytywanie wersji…
                  </div>
                ) : detail.isError ? (
                  <Alert variant="destructive">
                    <AlertDescription>
                      Nie udało się wczytać tej wersji.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <VersionContent
                    content={detail.data.content}
                    current={current()}
                    isLatest={shownVersion?.version === latest}
                  />
                )}
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VersionContent({
  content,
  current,
  isLatest,
}: {
  content: {
    title: string;
    description: string;
    questions: QuizVersionQuestion[];
  };
  current: QuizFormData;
  isLatest: boolean;
}) {
  return (
    <article className="space-y-4">
      <header>
        <h3 className="text-xl font-semibold">{content.title}</h3>
        {content.description === "" ? null : (
          <MarkdownRenderer className="text-muted-foreground prose-p:my-0 mt-1 text-base!">
            {content.description}
          </MarkdownRenderer>
        )}
      </header>
      {content.questions.length === 0 ? (
        <p className="text-muted-foreground">Ta wersja nie ma pytań.</p>
      ) : (
        <ol className="space-y-3">
          {content.questions.map((question, index) => {
            const change = isLatest ? null : laterChange(question, current);
            return (
              <li
                key={question.id}
                className={cn(
                  "rounded-lg border p-3",
                  change === "removed"
                    ? "border-amber-500/60"
                    : change === "changed"
                      ? "border-primary/40"
                      : "border-border",
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-muted-foreground w-6 shrink-0 tabular-nums">
                    {String(index + 1)}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    {change === null ? null : (
                      <p
                        className={cn(
                          "text-xs font-medium",
                          change === "removed"
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-primary-text",
                        )}
                      >
                        {change === "removed"
                          ? "Później usunięte"
                          : "Później zmienione"}
                      </p>
                    )}
                    <MarkdownRenderer className="prose-p:my-0 text-sm!">
                      {question.text}
                    </MarkdownRenderer>
                    {question.image === null ? null : (
                      // eslint-disable-next-line @next/next/no-img-element -- Images come from many hosts and have unknown sizes.
                      <img
                        src={question.image}
                        alt={`Zdjęcie do pytania ${String(index + 1)}`}
                        className="max-h-40 rounded border object-contain"
                      />
                    )}
                    <ul className="space-y-1">
                      {question.answers.map((answer) => (
                        <li
                          key={answer.id}
                          className={cn(
                            "flex items-start gap-2 rounded-md px-2 py-1 text-sm",
                            answer.is_correct &&
                              "bg-green-500/10 dark:bg-green-400/10",
                          )}
                        >
                          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                            {answer.is_correct ? (
                              <CheckIcon
                                className="size-4 text-green-700 dark:text-green-400"
                                aria-label="Poprawna"
                              />
                            ) : null}
                          </span>
                          <div className="min-w-0 flex-1 space-y-1">
                            {answer.text === "" ? null : (
                              <MarkdownRenderer className="prose-p:my-0 min-w-0 text-sm!">
                                {answer.text}
                              </MarkdownRenderer>
                            )}
                            {answer.image === null ? null : (
                              // eslint-disable-next-line @next/next/no-img-element -- Images come from many hosts and have unknown sizes.
                              <img
                                src={answer.image}
                                alt="Zdjęcie do odpowiedzi"
                                className="max-h-24 rounded border object-contain"
                              />
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                    {question.explanation === "" ? null : (
                      <div className="text-muted-foreground flex gap-1.5 text-sm">
                        <span className="shrink-0 font-medium">
                          Wyjaśnienie:
                        </span>
                        <MarkdownRenderer className="prose-p:my-0 min-w-0 text-sm! text-inherit!">
                          {question.explanation}
                        </MarkdownRenderer>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}
