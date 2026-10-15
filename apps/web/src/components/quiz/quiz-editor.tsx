"use client";

import { useSelector } from "@tanstack/react-form";
import type { QuizFormData } from "@testownik/core/quiz/schema";
import { validateQuizForm } from "@testownik/core/quiz/schema";
import type { Quiz } from "@testownik/core/quiz/types";
import {
  CheckIcon,
  EllipsisIcon,
  HistoryIcon,
  KeyboardIcon,
  ListChecksIcon,
  Loader2Icon,
  PlusIcon,
  SaveIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { focusField } from "@/components/quiz/editor/focus-field";
import { KeyboardShortcuts } from "@/components/quiz/editor/keyboard-shortcuts";
import { QuestionEditor } from "@/components/quiz/editor/question-editor";
import {
  QuestionOutline,
  QuestionSearch,
} from "@/components/quiz/editor/question-outline";
import { QuestionRow } from "@/components/quiz/editor/question-row";
import { matchesQuery } from "@/components/quiz/editor/question-summary";
import {
  canMutate,
  createQuestion,
  quizToFormData,
  removeQuestion,
  undoChoiceChanges,
  useQuizEditorForm,
  withChoiceType,
} from "@/components/quiz/editor/quiz-editor-form";
import type {
  ChoiceChanges,
  QuizEditorForm,
} from "@/components/quiz/editor/quiz-editor-form";
import { UnsavedChangesGuard } from "@/components/quiz/editor/unsaved-changes-guard";
import { VersionHistoryDialog } from "@/components/quiz/editor/version-history-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldError } from "@/components/ui/field";
import { useGlobalFileDragMonitor } from "@/hooks/use-image-drag";
import { moveRovingFocus } from "@/lib/roving-focus";

export type QuizEditorResult = QuizFormData;
/**
 * Resolves with the saved quiz, see `quizToFormData`, or null when saving
 * failed. The editor continues from the saved quiz, with the IDs the API gave
 * new questions and answers.
 */
export type SaveQuiz = (data: QuizFormData) => Promise<QuizFormData | null>;
export type QuizEditorProps =
  | {
      mode: "create";
      initialValues: QuizFormData;
      onSave: SaveQuiz;
    }
  | {
      mode: "edit";
      initialQuiz?: Quiz;
      onSave: SaveQuiz;
      /** Leaves the editor after Zapisz i wróć has saved the quiz. */
      onClose?: () => Promise<void> | void;
    };

/** The question named by `?question=<id>`, `?scroll_to=question-<id>` or `#question-<id>`. */
function linkedQuestionId(questions: QuizFormData["questions"]) {
  if (typeof window === "undefined") {
    return;
  }
  const query = new URLSearchParams(window.location.search);
  const target =
    query.get("question") ??
    query.get("scroll_to") ??
    window.location.hash.slice(1);
  const id = target.startsWith("question-") ? target.slice(9) : target;
  return questions.find((question) => question.id === id)?.id;
}

/**
 * Focuses `element` again once the form is enabled after saving, unless
 * focus has moved on, for example to an invalid field.
 */
function restoreFocus(element: HTMLElement | null) {
  if (element === null || element === document.body) {
    return;
  }
  const selection =
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLInputElement
      ? [element.selectionStart, element.selectionEnd]
      : null;
  let attempts = 0;
  const restore = () => {
    const active = document.activeElement;
    if (!element.isConnected || (active !== null && active !== document.body)) {
      return;
    }
    if (element.matches(":disabled")) {
      if (attempts++ < 10) {
        requestAnimationFrame(restore);
      }
      return;
    }
    element.focus({ preventScroll: true });
    if (
      selection !== null &&
      (element instanceof HTMLTextAreaElement ||
        element instanceof HTMLInputElement)
    ) {
      element.setSelectionRange(selection[0], selection[1]);
    }
  };
  requestAnimationFrame(restore);
}

/** How many recently open questions keep their editors mounted. */
const KEPT_EDITORS = 6;

/** Scrolls a question to the top once it has rendered, if it is out of view. */
function revealQuestion(id: string) {
  requestAnimationFrame(() => {
    const element = document.querySelector(`#question-${CSS.escape(id)}`);
    if (element === null) {
      return;
    }
    const { top } = element.getBoundingClientRect();
    if (top < 64 || top > window.innerHeight * 0.6) {
      element.scrollIntoView({ block: "start" });
    }
  });
}

export function QuizEditor(props: QuizEditorProps) {
  // eslint-disable-next-line react/hook-use-state -- Only the first value seeds the form.
  const [defaultValues] = useState<QuizFormData>(() =>
    props.mode === "create"
      ? props.initialValues
      : props.initialQuiz === undefined
        ? { title: "", description: "", questions: [createQuestion(1)] }
        : quizToFormData(props.initialQuiz),
  );
  const [activeId, setActiveId] = useState(() => {
    const linked = linkedQuestionId(defaultValues.questions);
    if (linked !== undefined) {
      revealQuestion(linked);
    }
    return linked ?? defaultValues.questions.at(0)?.id ?? "";
  });
  const [search, setSearch] = useState("");
  const [rowFocusId, setRowFocusId] = useState("");
  // Recently open questions stay mounted, hidden, so their fields keep the
  // browser's undo history when the author comes back.
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const leaveAllowedRef = useRef(false);
  const quizId = props.mode === "edit" ? props.initialQuiz?.id : undefined;
  // Mounted on first use; it loads the history from the API.
  const [historyMounted, setHistoryMounted] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // A version is being restored; its response replaces the whole quiz.
  const [restoring, setRestoring] = useState(false);
  // React keys of questions and answers whose IDs the API replaced on save.
  const keysRef = useRef(new Map<string, string>());
  const keyOf = (id: string) => keysRef.current.get(id) ?? id;
  const savedRef = useRef(false);
  const [uploadCount, setUploadCount] = useState(0);
  useGlobalFileDragMonitor();

  const form = useQuizEditorForm({
    defaultValues,
    onInvalid: (value) => {
      setShowErrors(true);
      const validation = validateQuizForm(value);
      if (validation.success) {
        return;
      }
      const questionIndex =
        validation.path?.[0] === "questions" ? validation.path[1] : undefined;
      const question =
        typeof questionIndex === "number"
          ? value.questions.at(questionIndex)
          : undefined;
      const answerIndex =
        validation.path?.[2] === "answers" ? validation.path[3] : undefined;
      const answer =
        typeof answerIndex === "number"
          ? question?.answers.at(answerIndex)
          : undefined;
      const show = () => {
        if (question === undefined) {
          focusField("quiz-title");
          return;
        }
        // A search filter could hide the invalid question.
        setSearch("");
        setActiveId(question.id);
        revealQuestion(question.id);
        focusField(
          answer === undefined
            ? `question-text-${question.id}`
            : `answer-text-${answer.id}`,
        );
      };
      show();
      toast.error(validation.error, {
        action:
          question === undefined
            ? undefined
            : { label: "Pokaż", onClick: show },
        actionButtonStyle: { background: "var(--destructive)" },
      });
    },
    onSave: async (value) => {
      setError("");
      setSaved(false);
      try {
        const result = await props.onSave(value);
        if (result === null) {
          setError(
            "Nie udało się zapisać quizu. Twoje zmiany są nadal w edytorze.",
          );
          return null;
        }
        setSaved(true);
        setShowErrors(false);
        savedRef.current = true;
        // Questions and answers keep their positions, so follow them to their
        // saved IDs, keeping their React keys so no field is remounted.
        const renamed = new Map<string, string>();
        for (const [index, question] of value.questions.entries()) {
          const savedQuestion = result.questions.at(index);
          renamed.set(question.id, savedQuestion?.id ?? question.id);
          for (const [answerIndex, answer] of question.answers.entries()) {
            renamed.set(
              answer.id,
              savedQuestion?.answers.at(answerIndex)?.id ?? answer.id,
            );
          }
        }
        for (const [before, after] of renamed) {
          if (before !== after) {
            keysRef.current.set(after, keyOf(before));
          }
        }
        setActiveId((current) => renamed.get(current) ?? current);
        setRowFocusId((current) => renamed.get(current) ?? current);
        setRecentIds((current) => current.map((id) => renamed.get(id) ?? id));
        return result;
      } catch {
        setError(
          "Nie udało się zapisać quizu. Twoje zmiany są nadal w edytorze. Spróbuj ponownie.",
        );
        return null;
      }
    },
  });
  const isSubmitting = useSelector(form.atom, (state) => state.isSubmitting);
  // `isDirty` stays set after an edit is undone; this compares with the saved
  // values instead.
  const hasChanges = useSelector(form.atom, (state) => !state.isDefaultValue);
  const count = useSelector(
    form.atom,
    (state) => state.values.questions.length,
  );
  const activeIndex = useSelector(form.atom, (state) =>
    state.values.questions.findIndex((question) => question.id === activeId),
  );
  const currentId = activeIndex === -1 ? "" : activeId;
  if (currentId !== "" && recentIds[0] !== currentId) {
    setRecentIds([
      currentId,
      ...recentIds.filter((id) => id !== currentId).slice(0, KEPT_EDITORS - 1),
    ]);
  }
  const query = search.trim().toLocaleLowerCase("pl");
  // Only list membership changes rerender the lists; rows read their own data.
  const visible = useSelector(form.atom, (state) =>
    state.values.questions
      .flatMap((question, index) => {
        const match = query === "" || matchesQuery(question, query);
        // The open question stays open while its text no longer matches, and
        // recent ones stay mounted, hidden, to keep their undo history.
        return match ||
          question.id === currentId ||
          recentIds.includes(question.id)
          ? [`${String(index)}:${match ? "1" : "0"}:${question.id}`]
          : [];
      })
      .join("|"),
  );
  const rows =
    visible === ""
      ? []
      : visible.split("|").map((row) => {
          const [index, match, id] = row.split(":", 3);
          return { index: Number(index), id, match: match === "1" };
        });
  const matches = rows.filter((row) => row.match);
  // The closed rows share one tab stop; the arrow keys move between them.
  const closedRows = matches.filter((row) => row.id !== currentId);
  const tabbableRowId = closedRows.some((row) => row.id === rowFocusId)
    ? rowFocusId
    : (closedRows.at(0)?.id ?? "");
  const busy = isSubmitting || uploadCount > 0 || restoring;

  /** Opens a question. Keyboard users continue in its text field. */
  function select(id: string, focusText = false) {
    setActiveId(id);
    revealQuestion(id);
    if (focusText) {
      focusField(`question-text-${id}`);
      return;
    }
    // The row which was clicked is replaced by the card, so keep focus in it,
    // unless focus has already moved somewhere else.
    requestAnimationFrame(() => {
      if (
        document.activeElement !== null &&
        document.activeElement !== document.body
      ) {
        return;
      }
      document
        .querySelector<HTMLElement>(
          `#question-${CSS.escape(id)} [data-question-toggle]`,
        )
        ?.focus({ preventScroll: true });
    });
  }

  function selectAt(index: number) {
    const question = form.getFieldValue("questions").at(index);
    if (question !== undefined && index >= 0) {
      select(question.id, true);
    }
  }

  /** Closes the open question and returns focus to its row. */
  function collapse(id: string) {
    setActiveId("");
    setRowFocusId(id);
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-question-row="${CSS.escape(id)}"]`)
        ?.focus();
    });
  }

  function addQuestion() {
    const questions = form.getFieldValue("questions");
    const question = createQuestion(
      questions.length + 1,
      questions.at(-1)?.multiple ?? false,
    );
    form.pushFieldValue("questions", question);
    setSearch("");
    select(question.id);
    focusField(`question-text-${question.id}`);
  }

  function remove(id: string) {
    const questions = form.getFieldValue("questions");
    const index = questions.findIndex((question) => question.id === id);
    const restore = removeQuestion(form, id);
    if (restore === null) {
      return;
    }
    const neighbour = questions.at(index + 1) ?? questions.at(index - 1);
    if (neighbour !== undefined) {
      // The menu which deleted the question is gone, so move focus on.
      select(neighbour.id, true);
    }
    toast(`Usunięto pytanie ${String(index + 1)}`, {
      action: {
        label: "Cofnij",
        onClick: () => {
          if (!canMutate(form)) {
            return;
          }
          restore();
          setActiveId(id);
        },
      },
    });
  }

  function trackUpload(change: number) {
    setUploadCount((current) => Math.max(0, current + change));
  }

  /** Saves, and resolves true when the quiz was saved. */
  async function save() {
    if (busy) {
      return false;
    }
    const focused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    // Not `isSubmitSuccessful`: the reset after a save clears it.
    savedRef.current = false;
    await form.handleSubmit();
    // Saving disables the form, which drops focus; continue where the author was.
    restoreFocus(focused);
    return savedRef.current;
  }

  async function saveAndClose() {
    if (props.mode !== "edit" || props.onClose === undefined) {
      return;
    }
    if (await save()) {
      // The guard has not seen the saved values yet; this exit is intended.
      leaveAllowedRef.current = true;
      await props.onClose();
    }
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- The form captures the save shortcut from its fields.
    <form
      noValidate
      className="min-w-0"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void save();
      }}
      onChange={() => {
        setError("");
        setSaved(false);
      }}
      onKeyDown={(event) => {
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "s"
        ) {
          event.preventDefault();
          void save();
        }
      }}
    >
      <div className="bg-background/90 supports-backdrop-filter:bg-background/75 border-border sticky top-0 z-30 -mx-4 border-b px-4 supports-backdrop-filter:backdrop-blur-md">
        <div className="flex h-14 items-center gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base leading-tight font-semibold">
              {props.mode === "create" ? "Nowy quiz" : "Edycja quizu"}
            </h1>
            <p
              className="text-muted-foreground flex items-center gap-1.5 truncate text-xs"
              role="status"
            >
              {uploadCount > 0 ? (
                <>
                  <Loader2Icon className="size-3 animate-spin" />
                  Przesyłanie zdjęć…
                </>
              ) : isSubmitting ? (
                "Zapisywanie…"
              ) : hasChanges ? (
                <>
                  <span
                    className="size-1.5 rounded-full bg-amber-500"
                    aria-hidden="true"
                  />
                  Niezapisane zmiany
                </>
              ) : saved ? (
                <>
                  <CheckIcon className="size-3" />
                  Zapisano
                </>
              ) : (
                `Pytania: ${String(count)}`
              )}
            </p>
          </div>
          <BulkActions
            form={form}
            disabled={isSubmitting}
            onOpenShortcuts={() => {
              setShortcutsOpen(true);
            }}
            onOpenHistory={
              quizId === undefined
                ? undefined
                : () => {
                    setHistoryMounted(true);
                    setHistoryOpen(true);
                  }
            }
            onSaveAndClose={
              props.mode === "edit" && props.onClose !== undefined
                ? () => {
                    void saveAndClose();
                  }
                : undefined
            }
          />
          {props.mode === "edit" && props.onClose !== undefined ? (
            <Button
              type="button"
              variant="outline"
              className="max-sm:hidden"
              disabled={busy}
              onClick={() => {
                void saveAndClose();
              }}
            >
              Zapisz i wróć
            </Button>
          ) : null}
          <Button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            aria-keyshortcuts="Control+S Meta+S"
          >
            {busy ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
            {props.mode === "create" ? "Utwórz" : "Zapisz"}
          </Button>
        </div>
      </div>

      <fieldset
        disabled={isSubmitting || restoring}
        className="mt-6 grid min-w-0 gap-x-10 gap-y-6 pb-8 sm:pb-16 lg:grid-cols-[15rem_minmax(0,1fr)]"
      >
        <legend className="sr-only">Treść quizu</legend>
        <section aria-label="Informacje o quizie" className="lg:col-start-2">
          <form.Field name="title">
            {(field) => (
              <>
                <input
                  id="quiz-title"
                  aria-label="Tytuł quizu"
                  placeholder="Tytuł quizu"
                  autoComplete="off"
                  value={field.value}
                  aria-invalid={field.meta.isInvalid}
                  aria-describedby="quiz-title-error"
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                  }}
                  className="placeholder:text-muted-foreground/60 hover:bg-muted/40 focus-visible:ring-primary aria-invalid:ring-destructive/30 -mx-2 block w-[calc(100%+1rem)] scroll-mt-20 rounded-lg bg-transparent px-2 py-1 text-3xl font-bold tracking-tight outline-none focus-visible:bg-transparent focus-visible:ring-2 aria-invalid:ring-3 sm:text-4xl"
                />
                <div id="quiz-title-error">
                  <FieldError errors={field.errors} />
                </div>
              </>
            )}
          </form.Field>
          <form.Field name="description">
            {(field) => (
              <textarea
                id="quiz-description"
                aria-label="Opis quizu"
                placeholder="Dodaj opis (opcjonalnie)"
                rows={1}
                value={field.value}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                className="text-muted-foreground placeholder:text-muted-foreground/60 hover:bg-muted/40 focus-visible:text-foreground focus-visible:ring-primary -mx-2 mt-1 block field-sizing-content max-h-48 min-h-9 w-[calc(100%+1rem)] resize-none rounded-lg bg-transparent px-2 py-1.5 text-base outline-none focus-visible:bg-transparent focus-visible:ring-2"
              />
            )}
          </form.Field>
          {error ? (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </section>

        <aside
          aria-label="Spis pytań"
          className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start"
        >
          <QuestionSearch value={search} onChange={setSearch} />
          <p aria-live="polite" className="sr-only">
            {query === ""
              ? ""
              : matches.length === 0
                ? "Brak pasujących pytań"
                : `Pasujące pytania: ${String(matches.length)}`}
          </p>
          <QuestionOutline
            form={form}
            rows={matches}
            activeId={currentId}
            showErrors={showErrors}
            onSelect={select}
            className="hidden min-h-0 lg:block"
          />
          <Button
            type="button"
            variant="ghost"
            className="text-primary-text hover:text-primary-text hidden w-full justify-start lg:inline-flex"
            onClick={addQuestion}
          >
            <PlusIcon />
            Dodaj pytanie
          </Button>
        </aside>

        <div className="min-w-0 space-y-3 lg:col-start-2">
          {matches.length === 0 && query === "" ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Ten quiz nie ma jeszcze pytań.
            </p>
          ) : matches.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center text-sm">
              <p>Brak pasujących pytań.</p>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => {
                  setSearch("");
                }}
              >
                Pokaż wszystkie
              </Button>
            </div>
          ) : null}
          {/* Rendered even without matches, so kept editors stay mounted. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Arrow keys move between the rows inside. */}
          <ol
            aria-label="Pytania"
            className="space-y-3"
            onFocus={(event) => {
              const id = event.target.dataset.questionRow;
              if (id !== undefined) {
                setRowFocusId(id);
              }
            }}
            onKeyDown={(event) => {
              if (event.target instanceof HTMLButtonElement) {
                moveRovingFocus(event, "[data-question-row]", "vertical");
              }
            }}
          >
            {rows.map(({ index, id, match }) => (
              <li
                key={keyOf(id)}
                id={`question-${id}`}
                // A kept editor whose question the search does not match.
                hidden={!match && id !== currentId}
                className="scroll-mt-20"
              >
                {id === currentId || recentIds.includes(id) ? (
                  <QuestionEditor
                    hidden={id !== currentId}
                    keyOf={keyOf}
                    form={form}
                    index={index}
                    questionId={id}
                    count={count}
                    onNext={() => {
                      selectAt(index + 1);
                    }}
                    onAdd={addQuestion}
                    onRemove={() => {
                      remove(id);
                    }}
                    onCollapse={() => {
                      collapse(id);
                    }}
                    onUploadStart={() => {
                      trackUpload(1);
                    }}
                    onUploadEnd={() => {
                      trackUpload(-1);
                    }}
                  />
                ) : null}
                {id === currentId ? null : (
                  <QuestionRow
                    form={form}
                    index={index}
                    tabbable={id === tabbableRowId}
                    showErrors={showErrors}
                    onOpen={select}
                  />
                )}
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={addQuestion}
            className="border-border text-primary hover:border-primary/50 hover:bg-primary/5 focus-visible:ring-primary flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed py-4 font-medium transition-colors outline-none focus-visible:ring-2"
          >
            <PlusIcon className="size-4" />
            Dodaj pytanie
          </button>
        </div>
      </fieldset>
      <KeyboardShortcuts open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      {quizId === undefined || !historyMounted ? null : (
        <VersionHistoryDialog
          quizId={quizId}
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          current={() => form.state.values}
          hasChanges={hasChanges}
          onRestoringChange={setRestoring}
          onRestored={(quiz) => {
            const values = quizToFormData(quiz);
            keysRef.current.clear();
            form.reset(values);
            setShowErrors(false);
            setSaved(false);
            setActiveId((current) =>
              values.questions.some((question) => question.id === current)
                ? current
                : (values.questions.at(0)?.id ?? ""),
            );
          }}
        />
      )}
      <UnsavedChangesGuard
        // Stays on while saving: the save can still fail.
        when={hasChanges}
        allowRef={leaveAllowedRef}
      />
    </form>
  );
}

function BulkActions({
  form,
  disabled,
  onSaveAndClose,
  onOpenHistory,
  onOpenShortcuts,
}: {
  form: QuizEditorForm;
  disabled: boolean;
  /** Shown here on phones, where the save bar has no room for it. */
  onSaveAndClose?: () => void;
  /** Present for saved quizzes. */
  onOpenHistory?: () => void;
  onOpenShortcuts: () => void;
}) {
  // The choice type shared by every question, or "" when they differ.
  const allChoice = useSelector(form.atom, (state) => {
    const types = new Set(
      state.values.questions.map((question) => question.multiple),
    );
    return types.size === 1 ? ([...types][0] ? "multiple" : "single") : "";
  });

  function setAll(multiple: boolean) {
    const changes: ChoiceChanges = new Map();
    for (const question of form.getFieldValue("questions")) {
      const { unmarked } = withChoiceType(question, multiple);
      changes.set(question.id, { multiple: question.multiple, unmarked });
    }
    form.setFieldValue("questions", (questions) =>
      questions.map((question) => withChoiceType(question, multiple).question),
    );
    const unmarked = [...changes.values()].reduce(
      (total, change) => total + change.unmarked.length,
      0,
    );
    toast(
      multiple
        ? "Ustawiono wielokrotny wybór we wszystkich pytaniach"
        : "Ustawiono jednokrotny wybór we wszystkich pytaniach",
      {
        description:
          unmarked > 0
            ? `Odznaczono poprawne odpowiedzi: ${String(unmarked)}.`
            : undefined,
        action: {
          label: "Cofnij",
          onClick: () => {
            if (!canMutate(form)) {
              return;
            }
            form.setFieldValue("questions", (questions) =>
              undoChoiceChanges(questions, changes),
            );
          },
        },
      },
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground pointer-coarse:size-10"
            aria-label="Opcje quizu"
            disabled={disabled}
          >
            <EllipsisIcon />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-64">
        {onSaveAndClose === undefined ? null : (
          <>
            <DropdownMenuItem className="sm:hidden" onClick={onSaveAndClose}>
              Zapisz i wróć
            </DropdownMenuItem>
            <DropdownMenuSeparator className="sm:hidden" />
          </>
        )}
        {onOpenHistory === undefined ? null : (
          <>
            <DropdownMenuItem onClick={onOpenHistory}>
              <HistoryIcon />
              Historia wersji
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ListChecksIcon />
            Typ wyboru
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={allChoice}
              onValueChange={(value) => {
                if (value !== allChoice) {
                  setAll(value === "multiple");
                }
              }}
            >
              <DropdownMenuLabel>Dla wszystkich pytań</DropdownMenuLabel>
              <DropdownMenuRadioItem value="single">
                Jednokrotny wybór
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="multiple">
                Wielokrotny wybór
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenShortcuts}>
          <KeyboardIcon />
          Skróty klawiszowe
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
