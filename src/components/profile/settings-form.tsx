import { useEffect, useRef, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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
      settings.max_question_reoccurrences === null
        ? (DEFAULT_USER_SETTINGS.max_question_reoccurrences ?? 3).toString()
        : settings.max_question_reoccurrences.toString(),
    );

  const [sliderInitialValue, setSliderInitialValue] = useState(
    settings.initial_reoccurrences * 10,
  );
  const [sliderWrongAnswerValue, setSliderWrongAnswerValue] = useState(
    settings.wrong_answer_reoccurrences * 10,
  );
  const [sliderMaxQuestionValue, setSliderMaxQuestionValue] = useState(
    settings.max_question_reoccurrences === null
      ? (DEFAULT_USER_SETTINGS.max_question_reoccurrences ?? 3) * 10
      : settings.max_question_reoccurrences * 10,
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

  const handleInitialReoccurrencesCommit = (sliderValue: number) => {
    const transformedValue = Math.max(1, Math.round(sliderValue / 10));
    setLocalInitialReoccurrences(transformedValue.toString());
    setSliderInitialValue(transformedValue * 10);
    onSettingChange("initial_reoccurrences", transformedValue);
  };

  const handleWrongAnswerReoccurrencesCommit = (sliderValue: number) => {
    const transformedValue = Math.round(sliderValue / 10);
    setLocalWrongAnswerReoccurrences(transformedValue.toString());
    setSliderWrongAnswerValue(transformedValue * 10);
    onSettingChange("wrong_answer_reoccurrences", transformedValue);
  };

  const handleMaxQuestionReoccurrencesCommit = (sliderValue: number) => {
    const transformedValue = Math.max(1, Math.round(sliderValue / 10));
    setLocalMaxQuestionReoccurrences(transformedValue.toString());
    setSliderMaxQuestionValue(transformedValue * 10);
    onSettingChange("max_question_reoccurrences", transformedValue);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ustawienia</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <Label
                className="text-sm font-medium"
                htmlFor="initial-reoccurrences"
              >
                <p>Wstępna liczba powtórzeń pytania</p>
              </Label>
              <p className="text-muted-foreground text-xs">
                Standardowa ilość powtórzeń pytania która może ulec zmianie w
                trakcie wykonywania quizu
              </p>
            </div>
            <Input
              type="number"
              min={1}
              value={localInitialReoccurrences}
              onChange={(event_) => {
                const value = event_.target.value;
                setLocalInitialReoccurrences(value);
                const numberValue = Number(value);
                if (!Number.isNaN(numberValue) && numberValue >= 1) {
                  setSliderInitialValue(numberValue * 10);
                  debouncedSave("initial_reoccurrences", numberValue);
                }
              }}
              aria-invalid={(() => {
                const numberValue = Number(localInitialReoccurrences);
                return Number.isNaN(numberValue) || numberValue < 1;
              })()}
              className="h-8 w-16 text-center font-semibold"
            />
          </div>
          <Slider
            id="initial-reoccurrences"
            min={10}
            max={100}
            step={1}
            value={[sliderInitialValue]}
            onValueChange={(values) => {
              setSliderInitialValue(values[0]);
              const transformedValue = Math.max(1, Math.round(values[0] / 10));
              setLocalInitialReoccurrences(transformedValue.toString());
            }}
            onLostPointerCapture={() => {
              handleInitialReoccurrencesCommit(
                Number.parseInt(localInitialReoccurrences) * 10,
              );
            }}
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <Label
                className="text-sm font-medium"
                htmlFor="wrong-answer-reoccurrences"
              >
                <p>Liczba dodatkowych powtórzeń przy błędnej odpowiedzi</p>
              </Label>
              <p className="text-muted-foreground text-xs">
                Określa, ile dodatkowych razy to pytanie pojawi się w quizie,
                jeśli użytkownik udzieli błędnej odpowiedzi
              </p>
            </div>
            <Input
              type="number"
              min={0}
              value={localWrongAnswerReoccurrences}
              onChange={(event_) => {
                const value = event_.target.value;
                setLocalWrongAnswerReoccurrences(value);
                const numberValue = Number(value);
                if (!Number.isNaN(numberValue) && numberValue >= 0) {
                  setSliderWrongAnswerValue(numberValue * 10);
                  debouncedSave("wrong_answer_reoccurrences", numberValue);
                }
              }}
              aria-invalid={(() => {
                const numberValue = Number(localWrongAnswerReoccurrences);
                return Number.isNaN(numberValue) || numberValue < 0;
              })()}
              className="h-8 w-16 text-center font-semibold"
            />
          </div>
          <Slider
            id="wrong-answer-reoccurrences"
            min={0}
            max={100}
            step={1}
            value={[sliderWrongAnswerValue]}
            onValueChange={(values) => {
              setSliderWrongAnswerValue(values[0]);
              const transformedValue = Math.round(values[0] / 10);
              setLocalWrongAnswerReoccurrences(transformedValue.toString());
            }}
            onLostPointerCapture={() => {
              handleWrongAnswerReoccurrencesCommit(
                Number.parseInt(localWrongAnswerReoccurrences) * 10,
              );
            }}
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <Label
                className="text-sm font-medium"
                htmlFor="max-question-reoccurrences"
              >
                <p>Maksymalna liczba powtórzeń pytania</p>
              </Label>
              <p className="text-muted-foreground text-xs">
                Maksymalna liczba powtórek tego pytania w jednej sesji quizu
              </p>
            </div>
            <Input
              type="number"
              min={1}
              value={localMaxQuestionReoccurrences}
              onChange={(event_) => {
                const value = event_.target.value;
                setLocalMaxQuestionReoccurrences(value);
                const numberValue = Number(value);
                if (!Number.isNaN(numberValue) && numberValue >= 1) {
                  setSliderMaxQuestionValue(numberValue * 10);
                  debouncedSave("max_question_reoccurrences", numberValue);
                }
              }}
              aria-invalid={(() => {
                const numberValue = Number(localMaxQuestionReoccurrences);
                return Number.isNaN(numberValue) || numberValue < 1;
              })()}
              className="h-8 w-16 text-center font-semibold"
            />
          </div>
          <Slider
            id="max-question-reoccurrences"
            min={10}
            max={100}
            step={1}
            value={[sliderMaxQuestionValue]}
            onValueChange={(values) => {
              setSliderMaxQuestionValue(values[0]);
              const transformedValue = Math.max(1, Math.round(values[0] / 10));
              setLocalMaxQuestionReoccurrences(transformedValue.toString());
            }}
            onLostPointerCapture={() => {
              handleMaxQuestionReoccurrencesCommit(
                Number.parseInt(localMaxQuestionReoccurrences) * 10,
              );
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
