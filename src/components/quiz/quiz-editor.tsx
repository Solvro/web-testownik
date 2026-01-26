import { ArrowDownToLineIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { validateQuiz } from "@/components/quiz/helpers/quiz-validation";
import { QuestionForm } from "@/components/quiz/question-form";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Question, Quiz } from "@/types/quiz";

export interface QuizEditorResult {
  title: string;
  description: string;
  questions: Question[];
}

interface QuizEditorProps {
  mode: "create" | "edit";
  initialQuiz?: Partial<Quiz> & { questions?: Question[] };
  onSave: (quiz: QuizEditorResult) => Promise<boolean> | boolean;
  onSaveAndClose?: (quiz: QuizEditorResult) => Promise<boolean> | boolean; // only for edit
  saving?: boolean;
}

type QuestionWithAdvanced = Question & { advanced?: boolean };

const sanitizeQuestions = (questions: QuestionWithAdvanced[]) =>
  questions.map((q) => {
    const isAdvanced = Boolean(q.advanced);
    const { advanced, image_url, ...rest } = q;
    return {
      ...rest,
      image_url: isAdvanced ? image_url : undefined,
      explanation: isAdvanced ? q.explanation : undefined,
      answers: q.answers.map((a) => {
        const { image_url: answerImage, ...answerRest } = a;
        return {
          ...answerRest,
          image_url: isAdvanced ? answerImage : undefined,
        };
      }),
    };
  });

const scrollToBottom = () => {
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
};

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
};

export function QuizEditor({
  mode,
  initialQuiz,
  onSave,
  onSaveAndClose,
  saving = false,
}: QuizEditorProps) {
  const initialAdvancedDefault =
    initialQuiz?.questions?.some(
      (q) =>
        Boolean(q.image_url) ||
        Boolean(q.explanation) ||
        q.answers.some((a) => Boolean(a.image_url)),
    ) ?? false;

  const [title, setTitle] = useState(initialQuiz?.title ?? "");
  const [description, setDescription] = useState(
    initialQuiz?.description ?? "",
  );

  const [questions, setQuestions] = useState<QuestionWithAdvanced[]>(() => {
    if (initialQuiz?.questions != null && initialQuiz.questions.length > 0) {
      return initialQuiz.questions.map((q) => ({
        ...q,
        advanced:
          Boolean(q.image_url) ||
          Boolean(q.explanation) ||
          q.answers.some((a) => Boolean(a.image_url)),
      }));
    }
    return [
      {
        id: crypto.randomUUID(),
        order: 1,
        text: "",
        multiple: true,
        answers: [
          {
            id: crypto.randomUUID(),
            order: 1,
            text: "",
            is_correct: false,
            image_url: "",
          },
          {
            id: crypto.randomUUID(),
            order: 2,
            text: "",
            is_correct: false,
            image_url: "",
          },
        ],
        image_url: "",
        explanation: "",
        advanced: initialAdvancedDefault,
      },
    ];
  });

  const [error, setError] = useState<string | null>(null);
  const [advancedMode, setAdvancedMode] = useState(initialAdvancedDefault);

  const [previousQuestionOrder, setPreviousQuestionOrder] = useState<number>(
    () => questions.reduce((max, q) => Math.max(q.order, max), 0),
  );

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

  const setAllQuestionsMultiple = (multiple: boolean) => {
    setQuestions((previous) => previous.map((q) => ({ ...q, multiple })));
  };

  const addQuestion = () => {
    const newOrder = previousQuestionOrder + 1;
    const newId = crypto.randomUUID();
    setQuestions((previous) => [
      ...previous,
      {
        id: newId,
        order: newOrder,
        text: "",
        multiple: true,
        answers: [
          {
            id: crypto.randomUUID(),
            order: 1,
            text: "",
            is_correct: false,
            image_url: "",
          },
          {
            id: crypto.randomUUID(),
            order: 2,
            text: "",
            is_correct: false,
            image_url: "",
          },
        ],
        image_url: "",
        explanation: "",
        advanced: advancedMode,
      },
    ]);
    setPreviousQuestionOrder(newOrder);
    // Scroll after render
    requestAnimationFrame(() => {
      const element = document.querySelector(`#question-${newId}`);
      if (element == null) {
        // fallback slight delay
        setTimeout(() => {
          const element2 = document.querySelector(`#question-${newId}`);
          if (element2 != null) {
            element2.scrollIntoView({ behavior: "smooth" });
            const textarea2 = element2.querySelector("textarea");
            if (textarea2 != null) {
              textarea2.focus({ preventScroll: true });
            }
          }
        }, 50);
      } else {
        element.scrollIntoView({ behavior: "smooth" });
        const textarea = element.querySelector("textarea");
        if (textarea != null) {
          textarea.focus({ preventScroll: true });
        }
      }
    });
  };

  const updateQuestion = (updated: QuestionWithAdvanced) => {
    setQuestions((previous) =>
      previous.map((q) => (q.id === updated.id ? updated : q)),
    );
  };
  const removeQuestion = (id: string) => {
    setQuestions((previous) => {
      const filtered = previous.filter((q) => q.id !== id);
      setPreviousQuestionOrder(filtered.length);

      return filtered.map((q, index) => ({
        ...q,
        order: index + 1,
      }));
    });
  };

  const triggerSave = async (closeAfter?: boolean) => {
    const draft = {
      title,
      description,
      questions: sanitizeQuestions(questions),
    };

    draft.title = draft.title.trim();

    const validationError = validateQuiz(draft as unknown as Quiz);
    if (validationError !== null) {
      setError(validationError);
      return;
    }
    setError(null);
    await (closeAfter === true && onSaveAndClose !== undefined
      ? onSaveAndClose(draft)
      : onSave(draft));
  };

  const [atBottom, setAtBottom] = useState(false);
  const [atTop, setAtTop] = useState(true);

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

  return (
    <Card className="relative">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>
              {mode === "create" ? "Stwórz nowy quiz" : "Edytuj quiz"}
            </CardTitle>
            <CardDescription>
              {mode === "create"
                ? "Uzupełnij podstawowe informacje i pytania, a następnie zapisz."
                : "Wprowadź zmiany w quizie i zapisz."}
            </CardDescription>
          </div>
          <div className="bg-muted/40 flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <Label htmlFor="advanced-mode" className="cursor-pointer">
              Tryb zaawansowany (domyślny dla nowych pytań)
            </Label>
            <Switch
              id="advanced-mode"
              checked={advancedMode}
              onCheckedChange={(value) => {
                setAdvancedMode(value);
              }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error == null ? null : (
          <Alert variant="destructive">
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        )}
        <div className="grid gap-6">
          <div className="space-y-2">
            <Label htmlFor="quiz-title">Tytuł</Label>
            <Input
              id="quiz-title"
              placeholder="Podaj tytuł quizu"
              value={title}
              onChange={(event_) => {
                setTitle(event_.target.value);
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
              onChange={(event_) => {
                setDescription(event_.target.value);
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Pytania</h2>
              <Button variant="outline" size="sm" onClick={addQuestion}>
                Dodaj pytanie
              </Button>
            </div>
            <div className="space-y-8">
              {questions.map((q) => (
                <QuestionForm
                  key={q.id}
                  question={q}
                  onUpdate={updateQuestion}
                  onRemove={removeQuestion}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="pointer-events-none sticky bottom-4 z-10 mt-6 flex justify-center sm:bottom-10">
          <div className="bg-background/60 pointer-events-auto -mx-16 flex flex-wrap items-center justify-center gap-3 rounded-md px-6 py-3 shadow-sm backdrop-blur sm:mx-0">
            {onSaveAndClose != null && (
              <Button disabled={saving} onClick={async () => triggerSave(true)}>
                Zapisz i wróć
              </Button>
            )}
            <Button
              variant="outline"
              disabled={saving}
              onClick={async () => triggerSave(false)}
            >
              {mode === "create" ? "Utwórz" : "Zapisz"}
            </Button>
            <Button variant="ghost" size="sm" onClick={addQuestion}>
              <PlusIcon />
              Pytanie
            </Button>
          </div>
        </div>
      </CardContent>
      <div className="fixed right-4 bottom-10 z-20 hidden flex-col items-end gap-3 sm:flex">
        <Button
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
    </Card>
  );
}
