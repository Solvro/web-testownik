import { MinusIcon, PlusIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SettingsFormProps } from "@/types/user";
import { DEFAULT_USER_SETTINGS } from "@/types/user";

export function SettingsForm({ settings, onSettingChange }: SettingsFormProps) {
  const [localInitialReoccurrences, setLocalInitialReoccurrences] = useState(
    settings.initial_reoccurrences.toString(),
  );
  const [localWrongAnswerReoccurrences, setLocalWrongAnswerReoccurrences] =
    useState(settings.wrong_answer_reoccurrences.toString());
  const [localMaxQuestionReoccurrences, setLocalMaxQuestionReoccurrences] =
    useState(
      (
        settings.max_question_reoccurrences ??
        DEFAULT_USER_SETTINGS.max_question_reoccurrences
      ).toString(),
    );

  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const debouncedSave = (
    key:
      | "initial_reoccurrences"
      | "wrong_answer_reoccurrences"
      | "max_question_reoccurrences",
    value: number,
  ) => {
    if (timeoutRef.current !== undefined) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      onSettingChange(key, value);
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleInitialReoccurrencesCommit = (value: number) => {
    setLocalInitialReoccurrences(value < 1 ? "1" : value.toString());
    onSettingChange("initial_reoccurrences", Math.max(value, 1));
  };

  const handleWrongAnswerReoccurrencesCommit = (value: number) => {
    setLocalWrongAnswerReoccurrences(value < 0 ? "0" : value.toString());
    onSettingChange("wrong_answer_reoccurrences", Math.max(value, 0));
  };

  const handleMaxQuestionReoccurrencesCommit = (value: number) => {
    setLocalMaxQuestionReoccurrences(value < 1 ? "1" : value.toString());
    onSettingChange("max_question_reoccurrences", Math.max(value, 1));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ustawienia</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label
              className="text-sm font-medium"
              htmlFor="initial-reoccurrences"
            >
              <p>Wstępna liczba powtórzeń pytania</p>
            </Label>
            <div className="flex gap-1">
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => {
                  handleInitialReoccurrencesCommit(
                    Number.parseInt(localInitialReoccurrences) - 1,
                  );
                }}
              >
                <MinusIcon />
              </Button>
              <Input
                type="number"
                min={1}
                value={localInitialReoccurrences}
                onChange={(_event) => {
                  const value = _event.target.value;
                  setLocalInitialReoccurrences(value);
                  const numberValue = Number(value);
                  if (!Number.isNaN(numberValue) && numberValue >= 1) {
                    debouncedSave("initial_reoccurrences", numberValue);
                  }
                }}
                aria-invalid={(() => {
                  const numberValue = Number.parseInt(
                    localInitialReoccurrences,
                  );
                  return Number.isNaN(numberValue) || numberValue < 1;
                })()}
                className="h-8 w-16 [appearance:textfield] text-center font-semibold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => {
                  handleInitialReoccurrencesCommit(
                    Number.parseInt(localInitialReoccurrences) + 1,
                  );
                }}
              >
                <PlusIcon />
              </Button>
            </div>
          </div>
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label
              className="text-sm font-medium"
              htmlFor="wrong-answer-reoccurrences"
            >
              <p>Dodatkowe potwórzenia przy błędnej odpowiedzi</p>
            </Label>
            <div className="flex gap-1">
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => {
                  handleWrongAnswerReoccurrencesCommit(
                    Number.parseInt(localWrongAnswerReoccurrences) - 1,
                  );
                }}
              >
                <MinusIcon />
              </Button>
              <Input
                type="number"
                min={0}
                value={localWrongAnswerReoccurrences}
                onChange={(event_) => {
                  const value = event_.target.value;
                  setLocalWrongAnswerReoccurrences(value);
                  const numberValue = Number(value);
                  if (!Number.isNaN(numberValue) && numberValue >= 0) {
                    debouncedSave("wrong_answer_reoccurrences", numberValue);
                  }
                }}
                aria-invalid={(() => {
                  const numberValue = Number.parseInt(
                    localWrongAnswerReoccurrences,
                  );
                  return Number.isNaN(numberValue) || numberValue < 0;
                })()}
                className="h-8 w-16 [appearance:textfield] text-center font-semibold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => {
                  handleWrongAnswerReoccurrencesCommit(
                    Number.parseInt(localWrongAnswerReoccurrences) + 1,
                  );
                }}
              >
                <PlusIcon />
              </Button>
            </div>
          </div>
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label
              className="text-sm font-medium"
              htmlFor="max-question-reoccurrences"
            >
              <p>Maksymalna liczba powtórzeń pytania</p>
            </Label>
            <div className="flex gap-1">
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => {
                  handleMaxQuestionReoccurrencesCommit(
                    Number.parseInt(localMaxQuestionReoccurrences) - 1,
                  );
                }}
              >
                <MinusIcon />
              </Button>
              <Input
                type="number"
                min={1}
                value={localMaxQuestionReoccurrences}
                onChange={(event_) => {
                  const value = event_.target.value;
                  setLocalMaxQuestionReoccurrences(value);
                  const numberValue = Number(value);
                  if (!Number.isNaN(numberValue) && numberValue >= 1) {
                    debouncedSave("max_question_reoccurrences", numberValue);
                  }
                }}
                aria-invalid={(() => {
                  const numberValue = Number.parseInt(
                    localMaxQuestionReoccurrences,
                  );
                  return Number.isNaN(numberValue) || numberValue < 1;
                })()}
                className="h-8 w-16 [appearance:textfield] text-center font-semibold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => {
                  handleMaxQuestionReoccurrencesCommit(
                    Number.parseInt(localMaxQuestionReoccurrences) + 1,
                  );
                }}
              >
                <PlusIcon />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
