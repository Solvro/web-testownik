import { Trash2, TrashIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { KbdShortcut } from "@/components/ui/kbd-shortcut";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Answer, Question } from "@/types/quiz.ts";

interface QuestionFormProps {
  question: Question & { advanced?: boolean };
  onUpdate: (updatedQuestion: Question & { advanced?: boolean }) => void;
  onRemove: (id: number) => void;
}

export function QuestionForm({
  question,
  onUpdate,
  onRemove,
}: QuestionFormProps) {
  const isAdvanced = Boolean(question.advanced);

  const handleTextChange = (text: string) => {
    onUpdate({ ...question, question: text });
  };

  const handleExplanationChange = (explanation: string) => {
    onUpdate({ ...question, explanation });
  };

  const handleImageUrlChange = (image: string) => {
    onUpdate({ ...question, image });
  };

  const handleMultipleChange = (multiple: boolean) => {
    // If switching from multiple choice to single choice and there are multiple correct answers,
    // keep only the first correct answer
    if (
      !multiple &&
      question.multiple &&
      question.answers.filter((a) => a.correct).length > 1
    ) {
      const firstCorrectIndex = question.answers.findIndex((a) => a.correct);
      const updatedAnswers = question.answers.map((a, index) => ({
        ...a,
        correct: index === firstCorrectIndex,
      }));
      onUpdate({ ...question, multiple, answers: updatedAnswers });
    } else {
      onUpdate({ ...question, multiple });
    }
  };

  const addAnswer = () => {
    const newAnswer = { answer: "", correct: false, image: "" };
    onUpdate({ ...question, answers: [...question.answers, newAnswer] });
  };

  const updateAnswer = (index: number, updatedAnswer: Answer) => {
    // If this is a single-choice question and we're marking an answer as correct,
    // unmark all other answers as correct
    if (!question.multiple && updatedAnswer.correct) {
      const updatedAnswers = question.answers.map((a, index_) => ({
        ...a,
        correct: index_ === index,
      }));
      updatedAnswers[index] = updatedAnswer;
      onUpdate({ ...question, answers: updatedAnswers });
    } else {
      const updatedAnswers = question.answers.map((a, index_) =>
        index_ === index ? updatedAnswer : a,
      );
      onUpdate({ ...question, answers: updatedAnswers });
    }
  };

  const removeAnswer = (index: number) => {
    const updatedAnswers = question.answers.filter(
      (_, index_) => index_ !== index,
    );
    onUpdate({ ...question, answers: updatedAnswers });
  };

  const [focusedAnswer, setFocusedAnswer] = useState<number | null>(null);

  const handlePasteMultipleAnswers = useCallback(
    async (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "v"
      ) {
        event.preventDefault();

        try {
          const clipboardData = await navigator.clipboard.readText();
          const pastedAnswers = clipboardData
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

          if (pastedAnswers.length > 0) {
            const start: number | null = focusedAnswer;
            if (start === null) {
              return;
            }

            const newAnswers: Answer[] = [];
            for (const answerText of pastedAnswers) {
              const updatedAnswer: Answer = {
                answer: answerText,
                correct: false,
                image: "",
              };
              newAnswers.push(updatedAnswer);
            }
            const updatedAnswers: Answer[] = [...question.answers];
            updatedAnswers.splice(start, 1, ...newAnswers);
            onUpdate({ ...question, answers: updatedAnswers });
          }
        } catch (error) {
          console.error("Failed to read clipboard:", error);
          toast.error(
            "Aby wkleić odpowiedzi, musisz włączyć dostęp do schowka w przeglądarce.",
          );
        }
      }
    },
    [focusedAnswer, question, onUpdate],
  );

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="group/question bg-card/20 hover:bg-card/30 relative space-y-4 rounded-lg px-2 transition-colors sm:px-4"
      id={`question-${question.id.toString()}`}
      onKeyDown={handlePasteMultipleAnswers}
      role="group"
      aria-labelledby={`question-text-${question.id.toString()}`}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label
            htmlFor={`question-text-${question.id.toString()}`}
            className="pr-4"
          >
            Pytanie {question.id}
          </Label>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Switch
                id={`advanced-question-${question.id.toString()}`}
                checked={isAdvanced}
                onCheckedChange={(checked) => {
                  onUpdate({ ...question, advanced: checked });
                }}
              />
              <span className="text-muted-foreground text-xs">
                Zaawansowane
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-7 w-7 shrink-0 rounded-full transition"
              aria-label="Usuń pytanie"
              onClick={() => {
                onRemove(question.id);
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
        <Textarea
          id={`question-text-${question.id.toString()}`}
          placeholder="Podaj treść pytania"
          value={question.question}
          onChange={(event_) => {
            handleTextChange(event_.target.value);
          }}
        />
      </div>

      {isAdvanced ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor={`question-image-${question.id.toString()}`}>
                URL zdjęcia dla pytania
              </Label>
              <Input
                id={`question-image-${question.id.toString()}`}
                placeholder="Podaj URL zdjęcia"
                value={question.image ?? ""}
                onChange={(event_) => {
                  handleImageUrlChange(event_.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`question-expl-${question.id.toString()}`}>
                Wyjaśnienie
              </Label>
              <Textarea
                id={`question-expl-${question.id.toString()}`}
                placeholder="Podaj wyjaśnienie pytania"
                value={question.explanation ?? ""}
                onChange={(event_) => {
                  handleExplanationChange(event_.target.value);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Checkbox
          id={`multiple-choice-${question.id.toString()}`}
          checked={question.multiple}
          onCheckedChange={(checked) => {
            handleMultipleChange(Boolean(checked));
          }}
        />
        <Label
          htmlFor={`multiple-choice-${question.id.toString()}`}
          className="cursor-pointer"
        >
          Wielokrotny wybór
        </Label>
      </div>

      <h6 className="text-sm font-semibold tracking-tight">
        Odpowiedzi
        <span className="text-muted-foreground ml-1 font-normal">
          {question.multiple ? "(wielokrotny wybór)" : "(pojedynczy wybór)"}
        </span>
      </h6>
      {question.multiple ? (
        <div>
          {question.answers.map((answer, index) => (
            <div
              key={`answer-multiple-${index.toString()}`}
              className="bg-background/40 pointer-fine:hover:ring-border -mx-2 flex flex-row items-start gap-3 rounded-md py-2 ring-1 ring-transparent sm:items-center sm:px-2"
            >
              <div className="flex-1 space-y-2">
                <Textarea
                  className="min-h-8"
                  placeholder="Treść odpowiedzi"
                  value={answer.answer}
                  onChange={(event_) => {
                    updateAnswer(index, {
                      ...answer,
                      answer: event_.target.value,
                    });
                  }}
                  onFocus={() => {
                    setFocusedAnswer(index);
                  }}
                  onBlur={(_event) => {
                    setFocusedAnswer(null);
                  }}
                />
                {isAdvanced ? (
                  <Input
                    placeholder="URL zdjęcia dla odpowiedzi"
                    value={answer.image ?? ""}
                    onChange={(event_) => {
                      updateAnswer(index, {
                        ...answer,
                        image: event_.target.value,
                      });
                    }}
                  />
                ) : null}
              </div>
              <div className="flex flex-row items-center gap-2">
                <Checkbox
                  aria-label={
                    answer.correct
                      ? "Odpowiedź poprawna"
                      : "Oznacz jako poprawną"
                  }
                  checked={answer.correct}
                  onCheckedChange={(checked) => {
                    updateAnswer(index, {
                      ...answer,
                      correct: Boolean(checked),
                    });
                  }}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    removeAnswer(index);
                  }}
                >
                  <TrashIcon />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <RadioGroup
          value={(() => {
            const index = question.answers.findIndex((a) => a.correct);
            return index === -1 ? undefined : String(index);
          })()}
          onValueChange={(value) => {
            const selected = Number.parseInt(value, 10);
            const newAnswers = question.answers.map((a, index) => ({
              ...a,
              correct: index === selected,
            }));
            onUpdate({ ...question, answers: newAnswers });
          }}
          className="gap-0"
        >
          {question.answers.map((answer, index) => (
            <div
              key={`answer-single-${index.toString()}`}
              className="bg-background/40 pointer-fine:hover:ring-border -mx-2 flex flex-row items-start gap-3 rounded-md py-2 ring-1 ring-transparent sm:items-center sm:px-2"
            >
              <div className="flex-1 space-y-2">
                <Textarea
                  className="min-h-8"
                  placeholder="Treść odpowiedzi"
                  value={answer.answer}
                  onChange={(event_) => {
                    updateAnswer(index, {
                      ...answer,
                      answer: event_.target.value,
                    });
                  }}
                  onFocus={() => {
                    setFocusedAnswer(index);
                  }}
                  onBlur={(_event) => {
                    setFocusedAnswer(null);
                  }}
                />
                {isAdvanced ? (
                  <Input
                    placeholder="URL zdjęcia dla odpowiedzi"
                    value={answer.image ?? ""}
                    onChange={(event_) => {
                      updateAnswer(index, {
                        ...answer,
                        image: event_.target.value,
                      });
                    }}
                  />
                ) : null}
              </div>
              <div className="flex flex-row items-center gap-2">
                <RadioGroupItem
                  value={String(index)}
                  aria-label={
                    answer.correct
                      ? "Poprawna odpowiedź"
                      : "Wybierz jako poprawną"
                  }
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    removeAnswer(index);
                  }}
                >
                  <TrashIcon />
                </Button>
              </div>
            </div>
          ))}
        </RadioGroup>
      )}
      <Button variant="secondary" size="sm" onClick={addAnswer}>
        + Dodaj odpowiedź
      </Button>
      <span className="text-muted-foreground hidden text-xs font-normal sm:block">
        <KbdShortcut suffix="+ Shift + V" /> aby wkleić wiele odpowiedzi naraz
      </span>
    </div>
  );
}
