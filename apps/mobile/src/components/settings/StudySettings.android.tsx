import { Column, Row, Slider, Text } from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  padding,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useRef, useState } from "react";

import { haptics } from "../../lib/haptics";
import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import Card, { SectionTitle as Heading } from "../SettingsGroup";
import ToggleRow from "../ToggleRow";
import Choice from "../native/Choice";
import M3Host from "../native/M3Host";
import { ErrorState, Label, Screen } from "../ui";
import type { StudySettingsProps } from "./types";

// Android: Material 3 settings list with discrete sliders, mirroring the iOS
// sliders (value label, min/max, save on release).
const correctPl = (n: number) =>
  n === 1
    ? "poprawna"
    : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
      ? "poprawne"
      : "poprawnych";
const repeatPl = (n: number) =>
  n === 1
    ? "powtórka"
    : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
      ? "powtórki"
      : "powtórek";

export default function StudySettings({
  value,
  update,
  models,
  modelsError,
  retryModels,
  canNotify,
  canUseAi,
  saveError,
  retrySave,
}: StudySettingsProps) {
  const { t } = useLocale();
  const limit = value.max_question_reoccurrences;
  const [lastLimit, setLastLimit] = useState(limit ?? 10);
  return (
    <Screen>
      {saveError ? (
        <ErrorState
          title={t("Nie zapisano zmian", "Changes Not Saved")}
          error={saveError}
          retry={retrySave}
        />
      ) : null}
      <Heading small>{t("Powtórki", "Repetition")}</Heading>
      <Card>
        <SliderRow
          label={t("Do opanowania", "To Master")}
          value={value.initial_reoccurrences}
          min={1}
          max={10}
          display={(n) => t(`${n} ${correctPl(n)}`, `${n} correct`)}
          onChange={(n) => update({ initial_reoccurrences: n })}
        />
        <SliderRow
          label={t("Po błędnej odpowiedzi", "After a Wrong Answer")}
          value={value.wrong_answer_reoccurrences}
          min={0}
          max={10}
          display={(n) =>
            n === 0
              ? t("Bez dodatkowych", "No extra")
              : t(
                  `+${n} ${repeatPl(n)}`,
                  `+${n} ${n === 1 ? "repeat" : "repeats"}`,
                )
          }
          onChange={(n) => update({ wrong_answer_reoccurrences: n })}
        />
        <ToggleRow
          label={t("Limit powtórek", "Limit Repetitions")}
          value={limit !== null}
          onValueChange={(on) =>
            update({ max_question_reoccurrences: on ? lastLimit : null })
          }
        />
        {limit !== null ? (
          <SliderRow
            label={t("Najwyżej", "At Most")}
            value={limit}
            min={1}
            max={20}
            display={(n) =>
              t(`${n} ${repeatPl(n)}`, `${n} ${n === 1 ? "time" : "times"}`)
            }
            onChange={(n) => {
              setLastLimit(n);
              update({ max_question_reoccurrences: n });
            }}
          />
        ) : null}
      </Card>
      <Label muted>
        {t(
          "Pytanie jest opanowane po tylu poprawnych odpowiedziach. Błędna odpowiedź dodaje kolejne powtórki.",
          "A question is mastered after this many correct answers. A wrong answer adds more repetitions.",
        )}
      </Label>
      {canUseAi ? (
        <>
          <Heading small>{t("Asystent AI", "AI Assistant")}</Heading>
          <Card>
            <ToggleRow
              label={t("Asystent AI", "AI Assistant")}
              value={!value.ai_disabled}
              onValueChange={(on) => update({ ai_disabled: !on })}
            />
            {models && !value.ai_disabled ? (
              <Choice
                label={t("Model", "Model")}
                value={value.default_ai_model ?? "system"}
                options={[
                  { value: "system", label: t("Domyślny", "Default") },
                  ...models,
                ]}
                onChange={(model) =>
                  update({
                    default_ai_model: model === "system" ? null : model,
                  })
                }
              />
            ) : null}
            {modelsError ? (
              <ErrorState error={modelsError} retry={retryModels} />
            ) : null}
          </Card>
        </>
      ) : null}
      {canNotify ? (
        <>
          <Heading small>{t("Powiadomienia", "Notifications")}</Heading>
          <Card>
            <ToggleRow
              label={t("Udostępnione quizy", "Shared Quizzes")}
              value={value.notify_quiz_shared}
              onValueChange={(on) => update({ notify_quiz_shared: on })}
            />
            <ToggleRow
              label={t("Zgłoszenia problemów", "Issue Reports")}
              value={value.notify_bug_reported}
              onValueChange={(on) => update({ notify_bug_reported: on })}
            />
            <ToggleRow
              label={t("Nowości Testownika", "Testownik News")}
              value={value.notify_marketing}
              onValueChange={(on) => update({ notify_marketing: on })}
            />
          </Card>
          <Label muted>
            {t(
              "Zmiany zapisują się automatycznie.",
              "Changes are saved automatically.",
            )}
          </Label>
        </>
      ) : null}
    </Screen>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  display: (n: number) => string;
  onChange: (n: number) => void;
}) {
  const c = useTheme();
  // The thumb owns the value while dragging; save once it's released.
  const [dragging, setDragging] = useState<number | null>(null);
  // A tap fires both callbacks before React re-renders; keep the latest value
  // in a ref so the release handler sees it.
  const pending = useRef<number | null>(null);
  const clamped = Math.min(max, Math.max(min, value));
  const shown = dragging ?? clamped;
  return (
    <M3Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <Column modifiers={[fillMaxWidth(), padding(0, 12, 0, 4)]}>
        <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
          <Text style={{ typography: "bodyLarge" }} modifiers={[weight(1)]}>
            {label}
          </Text>
          <Text color={c.primary} style={{ typography: "labelLarge" }}>
            {display(shown)}
          </Text>
        </Row>
        <Slider
          value={shown}
          min={min}
          max={max}
          // Discrete M3 slider: one tick per whole value.
          steps={max - min - 1}
          onValueChange={(next) => {
            const n = Math.round(next);
            if (n === shown) return;
            haptics.selection();
            pending.current = n;
            setDragging(n);
          }}
          onValueChangeFinished={() => {
            const n = pending.current;
            pending.current = null;
            if (n !== null && n !== value) onChange(n);
            setDragging(null);
          }}
        />
      </Column>
    </M3Host>
  );
}
