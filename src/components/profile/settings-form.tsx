import { InfinityIcon, MinusIcon, PlusIcon, SettingsIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { SettingsFormProps } from "@/types/user";
import { DEFAULT_USER_SETTINGS } from "@/types/user";

export function SettingsForm({
  settings,
  disabled = false,
  onSettingChange,
  variant = "card",
}: SettingsFormProps & { variant?: "card" | "plain" }) {
  const initialReoccurrences = settings.initial_reoccurrences;
  const wrongAnswerReoccurrences = settings.wrong_answer_reoccurrences;
  const maxQuestionReoccurrences = settings.max_question_reoccurrences;
  const isMaxReoccurrencesEnabled = maxQuestionReoccurrences !== null;

  const handleMaxReoccurrencesToggle = (checked: boolean) => {
    if (checked) {
      onSettingChange(
        "max_question_reoccurrences",
        DEFAULT_USER_SETTINGS.max_question_reoccurrences,
      );
    } else {
      onSettingChange("max_question_reoccurrences", null);
    }
  };

  const content = (
    <CardContent
      aria-busy={disabled}
      className={cn(
        "space-y-6",
        variant === "plain" && "px-0 group-data-[size=sm]/card:px-0",
        disabled && "animate-pulse",
      )}
    >
      <div className="grid gap-2">
        <div className="flex flex-col justify-between gap-2 md:flex-row">
          <Label
            className="text-sm font-medium"
            htmlFor="initial-reoccurrences"
          >
            Wstępna liczba powtórzeń pytania
          </Label>
          <div className="flex gap-1">
            <Button
              size="icon-sm"
              variant="outline"
              disabled={disabled || initialReoccurrences <= 1}
              onClick={() => {
                const nextValue = Math.max(initialReoccurrences - 1, 1);
                onSettingChange("initial_reoccurrences", nextValue);
              }}
              aria-label="Zmniejsz liczbę powtórzeń"
            >
              <MinusIcon />
            </Button>
            <Input
              type="number"
              id="initial-reoccurrences"
              min={1}
              value={initialReoccurrences}
              disabled={disabled}
              onChange={(_event) => {
                const value = _event.target.value;
                const numberValue = Math.floor(Number(value));
                if (!Number.isNaN(numberValue) && numberValue >= 1) {
                  onSettingChange("initial_reoccurrences", numberValue);
                }
              }}
              aria-invalid={initialReoccurrences < 1}
              className="h-8 w-16 [appearance:textfield] text-center font-semibold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <Button
              size="icon-sm"
              variant="outline"
              disabled={disabled}
              onClick={() => {
                const nextValue = Math.max(initialReoccurrences + 1, 1);
                onSettingChange("initial_reoccurrences", nextValue);
              }}
              aria-label="Zwiększ liczbę powtórzeń"
            >
              <PlusIcon />
            </Button>
          </div>
        </div>
      </div>
      <div className="grid gap-2">
        <div className="flex flex-col justify-between gap-2 md:flex-row">
          <Label
            className="text-sm font-medium"
            htmlFor="wrong-answer-reoccurrences"
          >
            Dodatkowe powtórzenia przy błędnej odpowiedzi
          </Label>
          <div className="flex gap-1">
            <Button
              size="icon-sm"
              variant="outline"
              disabled={disabled || wrongAnswerReoccurrences <= 0}
              onClick={() => {
                const nextValue = Math.max(wrongAnswerReoccurrences - 1, 0);
                onSettingChange("wrong_answer_reoccurrences", nextValue);
              }}
              aria-label="Zmniejsz liczbę powtórzeń"
            >
              <MinusIcon />
            </Button>
            <Input
              type="number"
              id="wrong-answer-reoccurrences"
              min={0}
              value={wrongAnswerReoccurrences}
              disabled={disabled}
              onChange={(_event) => {
                const value = _event.target.value;
                const numberValue = Math.floor(Number(value));
                if (!Number.isNaN(numberValue) && numberValue >= 0) {
                  onSettingChange("wrong_answer_reoccurrences", numberValue);
                }
              }}
              aria-invalid={wrongAnswerReoccurrences < 0}
              className="h-8 w-16 [appearance:textfield] text-center font-semibold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <Button
              size="icon-sm"
              variant="outline"
              disabled={disabled}
              onClick={() => {
                const nextValue = Math.max(wrongAnswerReoccurrences + 1, 0);
                onSettingChange("wrong_answer_reoccurrences", nextValue);
              }}
              aria-label="Zwiększ liczbę powtórzeń"
            >
              <PlusIcon />
            </Button>
          </div>
        </div>
      </div>
      <div className="grid gap-2">
        <div className="flex flex-col justify-between gap-2 md:flex-row">
          <Label
            className="text-sm font-medium"
            htmlFor="max-question-reoccurrences-switch"
          >
            Ogranicz maksymalną liczbę powtórzeń
          </Label>
          <div className="flex items-center justify-start gap-2 md:justify-center">
            <div className="mr-2 flex items-center justify-center">
              <Switch
                id="max-question-reoccurrences-switch"
                checked={isMaxReoccurrencesEnabled}
                onCheckedChange={handleMaxReoccurrencesToggle}
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-2">
        <div className="flex flex-col justify-between gap-2 md:flex-row">
          <Label
            className="text-sm font-medium"
            htmlFor="max-question-reoccurrences-input"
          >
            Maksymalna liczba powtórzeń pytań
          </Label>
          <div className="flex gap-1">
            <Button
              size="icon-sm"
              variant="outline"
              disabled={
                (maxQuestionReoccurrences ?? 0) <= 1 ||
                !isMaxReoccurrencesEnabled ||
                disabled
              }
              onClick={() => {
                const nextValue = Math.max(
                  (maxQuestionReoccurrences ?? 1) - 1,
                  1,
                );
                onSettingChange("max_question_reoccurrences", nextValue);
              }}
              aria-label="Zmniejsz liczbę powtórzeń"
            >
              <MinusIcon />
            </Button>
            {isMaxReoccurrencesEnabled ? (
              <Input
                id="max-question-reoccurrences-input"
                type="number"
                aria-label="Wartość maksymalnej liczby powtórzeń pytania"
                min={1}
                value={maxQuestionReoccurrences}
                disabled={disabled}
                onChange={(_event) => {
                  const value = _event.target.value;
                  const numberValue = Math.floor(Number(value));
                  if (!Number.isNaN(numberValue) && numberValue >= 1) {
                    onSettingChange("max_question_reoccurrences", numberValue);
                  }
                }}
                aria-invalid={maxQuestionReoccurrences < 1}
                className="h-8 w-16 [appearance:textfield] text-center font-semibold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            ) : (
              <div className="relative flex w-16 items-center justify-center">
                <Input
                  disabled
                  className="pointer-events-none h-8 w-16 [appearance:textfield] text-center font-semibold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <InfinityIcon
                  className="text-muted-foreground absolute size-5"
                  aria-label="Brak limitu"
                />
              </div>
            )}
            <Button
              size="icon-sm"
              variant="outline"
              disabled={!isMaxReoccurrencesEnabled || disabled}
              onClick={() => {
                const nextValue = Math.max(
                  (maxQuestionReoccurrences ?? 1) + 1,
                  1,
                );
                onSettingChange("max_question_reoccurrences", nextValue);
              }}
              aria-label="Zwiększ liczbę powtórzeń"
            >
              <PlusIcon />
            </Button>
          </div>
        </div>
      </div>
    </CardContent>
  );

  if (variant === "plain") {
    return content;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SettingsIcon className="size-5" />
          Ustawienia quizów
        </CardTitle>
      </CardHeader>
      {content}
    </Card>
  );
}
