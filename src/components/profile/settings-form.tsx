import { useEffect, useRef, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { SettingsFormProps } from "@/types/user";

export function SettingsForm({ settings, onSettingChange }: SettingsFormProps) {
  const [localInitialReoccurrences, setLocalInitialReoccurrences] = useState(
    settings.initial_reoccurrences.toString(),
  );
  const [localWrongAnswerReoccurrences, setLocalWrongAnswerReoccurrences] =
    useState(settings.wrong_answer_reoccurrences.toString());

  const [sliderInitialValue, setSliderInitialValue] = useState(
    settings.initial_reoccurrences * 10,
  );
  const [sliderWrongAnswerValue, setSliderWrongAnswerValue] = useState(
    settings.wrong_answer_reoccurrences * 10,
  );

  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const debouncedSave = (
    key: "initial_reoccurrences" | "wrong_answer_reoccurrences",
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
              Wstępna liczba powtórzeń
            </Label>
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
            onValueCommit={(values) => {
              handleInitialReoccurrencesCommit(values[0]);
            }}
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label
              className="text-sm font-medium"
              htmlFor="wrong-answer-reoccurrences"
            >
              Liczba dodatkowych powtórzeń przy błędnej odpowiedzi
            </Label>
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
            onValueCommit={(values) => {
              handleWrongAnswerReoccurrencesCommit(values[0]);
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
