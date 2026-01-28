"use client";

import { ArrowDownToLineIcon, Loader2, PlusIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { QuestionForm } from "@/components/quiz/editor/question-form";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useGlobalFileDragMonitor } from "@/hooks/use-image-drag";
import type {
  AnswerFormData,
  QuestionFormData,
  QuizFormData,
} from "@/lib/schemas/quiz.schema";
import { validateQuizForm } from "@/lib/schemas/quiz.schema";
import { cn } from "@/lib/utils";
import type { Quiz } from "@/types/quiz";

export type QuizEditorResult = QuizFormData;

interface QuizEditorCreateProps {
  mode: "create";
  onSave: (data: QuizEditorResult) => Promise<boolean>;
}

interface QuizEditorEditProps {
  mode: "edit";
  initialQuiz?: Quiz;
  onSave: (data: QuizEditorResult) => Promise<boolean>;
  onSaveAndClose?: (data: QuizEditorResult) => Promise<boolean>;
}

export type QuizEditorProps = QuizEditorCreateProps | QuizEditorEditProps;

type SavingState = "idle" | "saving" | "savingAndClosing";

function createNewAnswer(order: number): AnswerFormData {
  return {
    id: crypto.randomUUID(),
    order,
    text: "",
    is_correct: false,
    image: null,
    image_url: null,
    image_upload: null,
    image_width: null,
    image_height: null,
  };
}

function createNewQuestion(order: number): QuestionFormData {
  return {
    id: crypto.randomUUID(),
    order,
    text: "",
    multiple: false,
    answers: [createNewAnswer(1), createNewAnswer(2)],
    image: null,
    image_url: null,
    image_upload: null,
    explanation: "",
  };
}

function getDefaultFormData(): QuizFormData {
  return {
    title: "",
    description: "",
    questions: [createNewQuestion(1)],
  };
}

const scrollToBottom = () => {
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
};

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
};

export function QuizEditor(props: QuizEditorProps) {
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<QuestionFormData[]>([]);

  // UI state
  const [savingState, setSavingState] = useState<SavingState>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [uploadCount, setUploadCount] = useState(0);
  const activeUploadsRef = useRef(0);
  const [atBottom, setAtBottom] = useState(false);
  const [atTop, setAtTop] = useState(true);

  // Initialize form data
  const initialQuiz = props.mode === "edit" ? props.initialQuiz : undefined;
  useEffect(() => {
    let initialData = getDefaultFormData();

    if (initialQuiz !== undefined) {
      initialData = initialQuiz;
    }

    setTitle(initialData.title);
    setDescription(initialData.description);
    setQuestions(initialData.questions);
  }, [props.mode, initialQuiz]);

  // Scroll position tracking
  useEffect(() => {
    const THRESHOLD = 200;
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;
      const distanceToBottom = scrollHeight - (scrollTop + clientHeight);
      setAtBottom(distanceToBottom < THRESHOLD);
      setAtTop(scrollTop < THRESHOLD);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // To prevent dropped files from opening them in the browser if not handled
  useGlobalFileDragMonitor();

  function handleUploadStart() {
    activeUploadsRef.current += 1;
    setUploadCount(activeUploadsRef.current);
  }

  function handleUploadEnd() {
    activeUploadsRef.current = Math.max(0, activeUploadsRef.current - 1);
    setUploadCount(activeUploadsRef.current);
  }

  function addQuestion() {
    const newOrder = questions.length + 1;
    const newQuestion = createNewQuestion(newOrder);

    setQuestions((previous) => [...previous, newQuestion]);

    requestAnimationFrame(() => {
      const element = document.querySelector(`#question-${newQuestion.id}`);
      if (element === null) {
        setTimeout(() => {
          const element2 = document.querySelector(
            `#question-${newQuestion.id}`,
          );
          if (element2 !== null) {
            element2.scrollIntoView({ behavior: "smooth" });
            const textarea = element2.querySelector("textarea");
            textarea?.focus({ preventScroll: true });
          }
        }, 50);
      } else {
        element.scrollIntoView({ behavior: "smooth" });
        const textarea = element.querySelector("textarea");
        textarea?.focus({ preventScroll: true });
      }
    });
  }

  function updateQuestion(
    questionId: string,
    updates: Partial<QuestionFormData>,
  ) {
    setQuestions((previous) =>
      previous.map((q) => (q.id === questionId ? { ...q, ...updates } : q)),
    );
  }

  function removeQuestion(questionId: string) {
    if (questions.length <= 1) {
      toast.error("Quiz musi mieć przynajmniej jedno pytanie.");
      return;
    }

    setQuestions((previous) => {
      const filtered = previous.filter((q) => q.id !== questionId);
      return filtered.map((q, index) => ({ ...q, order: index + 1 }));
    });
  }

  const allQuestionsMultiple: boolean | null = (() => {
    if (questions.length === 0) {
      return null;
    }
    const allTrue = questions.every((q) => q.multiple);
    const allFalse = questions.every((q) => !q.multiple);
    if (allTrue) {
      return true;
    }
    if (allFalse) {
      return false;
    }
    return null;
  })();

  function setAllQuestionsMultiple(multiple: boolean) {
    setQuestions((previous) => previous.map((q) => ({ ...q, multiple })));
  }

  const handleValidationFailure = (validation: {
    success: false;
    error: string;
    path?: (string | number)[];
  }) => {
    let scrollToId: string | null = null;
    const path = validation.path;

    if (Array.isArray(path) && path.length > 0) {
      const questionIndex = path.indexOf("questions");

      if (questionIndex !== -1) {
        const rawQIndex = path[questionIndex + 1];

        if (typeof rawQIndex === "number") {
          const question = questions[rawQIndex];

          scrollToId = `question-${question.id}`;

          const answerIndex = path.indexOf("answers");
          if (answerIndex !== -1) {
            const rawAIndex = path[answerIndex + 1];

            if (typeof rawAIndex === "number") {
              const answer = question.answers[rawAIndex];

              scrollToId = `answer-${answer.id}`;
            }
          }
        }
      }
    }

    toast.error(validation.error, {
      action:
        scrollToId === null
          ? undefined
          : {
              label: "Pokaż",
              onClick: () => {
                const element = document.querySelector<HTMLElement>(
                  `#${scrollToId}`,
                );
                if (element !== null) {
                  element.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                  const input =
                    element.querySelector<HTMLElement>("input, textarea");
                  if (input !== null) {
                    input.focus();
                  }
                }
              },
            },
      actionButtonStyle: {
        background: "var(--destructive)",
      },
    });
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();

    const formData: QuizFormData = {
      title,
      description,
      questions,
    };

    const validation = validateQuizForm(formData);
    if (!validation.success) {
      handleValidationFailure(validation);
      return;
    }

    setSavingState("saving");
    setError(null);

    try {
      const success = await props.onSave(validation.data);
      if (!success) {
        setError(new Error("Nie udało się zapisać quizu."));
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError
          : new Error("Wystąpił nieoczekiwany błąd."),
      );
    } finally {
      setSavingState("idle");
    }
  }

  async function handleSaveAndClose() {
    if (props.mode !== "edit" || props.onSaveAndClose === undefined) {
      return;
    }

    const formData: QuizFormData = {
      title,
      description,
      questions,
    };

    const validation = validateQuizForm(formData);
    if (!validation.success) {
      handleValidationFailure(validation);
      return;
    }

    setSavingState("savingAndClosing");
    setError(null);

    try {
      const success = await props.onSaveAndClose(validation.data);
      if (!success) {
        setError(new Error("Nie udało się zapisać quizu."));
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError
          : new Error("Wystąpił nieoczekiwany błąd."),
      );
    } finally {
      setSavingState("idle");
    }
  }

  const hasActiveUploads = uploadCount > 0;
  const canSubmit = savingState === "idle" && !hasActiveUploads;

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-8">
        <Card className="relative">
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>
                {props.mode === "create" ? "Stwórz nowy quiz" : "Edytuj quiz"}
              </CardTitle>
              <CardDescription>
                {props.mode === "create"
                  ? "Uzupełnij podstawowe informacje i pytania, a następnie zapisz."
                  : "Wprowadź zmiany w quizie i zapisz."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {error !== null && (
              <Alert variant="destructive">
                <AlertTitle>{error.message}</AlertTitle>
              </Alert>
            )}

            <div className="grid gap-6">
              <div className="space-y-2">
                <Label htmlFor="quiz-title">Tytuł</Label>
                <Input
                  id="quiz-title"
                  placeholder="Podaj tytuł quizu"
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quiz-description">Opis</Label>
                <Textarea
                  id="quiz-description"
                  rows={3}
                  placeholder="Podaj opis quizu"
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                  }}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="all-multiple"
                    checked={allQuestionsMultiple ?? "indeterminate"}
                    onCheckedChange={(checked) => {
                      setAllQuestionsMultiple(Boolean(checked));
                    }}
                  />
                  <Label htmlFor="all-multiple" className="cursor-pointer">
                    Wielokrotny wybór (dla wszystkich pytań)
                  </Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Pytania</h2>
            <Button type="button" onClick={addQuestion}>
              <PlusIcon className="mr-2 size-4" />
              Dodaj pytanie
            </Button>
          </div>

          <div className="space-y-6">
            {questions.map((question) => (
              <QuestionForm
                key={question.id}
                question={question}
                onUpdate={(updates) => {
                  updateQuestion(question.id, updates);
                }}
                onRemove={() => {
                  removeQuestion(question.id);
                }}
                onUploadStart={handleUploadStart}
                onUploadEnd={handleUploadEnd}
              />
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed py-8"
            onClick={addQuestion}
          >
            <PlusIcon className="mr-2 size-4" />
            Dodaj kolejne pytanie
          </Button>
        </div>

        <div className="bg-background fixed right-0 bottom-0 left-0 z-10 border-t p-4 sm:pointer-events-none sm:sticky sm:bottom-10 sm:flex sm:justify-center sm:border-t-0 sm:bg-transparent sm:p-0">
          <div className="sm:bg-background/60 pointer-events-auto flex flex-row flex-wrap justify-center gap-3 sm:items-center sm:rounded-md sm:px-6 sm:py-3 sm:shadow-sm sm:backdrop-blur">
            {props.mode === "edit" && props.onSaveAndClose !== undefined && (
              <Button
                type="button"
                disabled={!canSubmit}
                onClick={handleSaveAndClose}
              >
                {savingState === "savingAndClosing" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Zapisywanie...
                  </>
                ) : (
                  "Zapisz i wróć"
                )}
              </Button>
            )}
            <Button type="submit" disabled={!canSubmit}>
              {savingState === "saving" ? (
                <>
                  <Loader2 className="animate-spin" />
                  Zapisywanie...
                </>
              ) : props.mode === "create" ? (
                "Utwórz"
              ) : (
                "Zapisz"
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={addQuestion}
              type="button"
            >
              <PlusIcon />
              Pytanie
            </Button>
          </div>
        </div>
      </div>

      <div className="fixed right-4 bottom-10 z-20 hidden flex-col items-end gap-3 sm:flex">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={scrollToTop}
          aria-label="Przewiń na górę"
          className={cn(
            "size-12 rounded-full p-0 shadow-md transition-all duration-300 ease-out",
            atTop
              ? "pointer-events-none translate-y-2 scale-90 opacity-0"
              : "translate-y-0 scale-100 opacity-100",
          )}
        >
          <ArrowDownToLineIcon className="size-6 rotate-180" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={scrollToBottom}
          aria-label="Przewiń na dół"
          className={cn(
            "size-12 rounded-full p-0 shadow-md transition-all duration-300 ease-out",
            atBottom
              ? "pointer-events-none -translate-y-2 scale-90 opacity-0"
              : "translate-y-0 scale-100 opacity-100",
          )}
        >
          <ArrowDownToLineIcon className="size-6" />
        </Button>
      </div>
    </form>
  );
}
