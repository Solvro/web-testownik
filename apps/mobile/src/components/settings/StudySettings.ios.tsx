import {
  Button,
  HStack,
  Host,
  Image,
  Label,
  List,
  Section,
  Slider,
  Spacer,
  Text,
  Toggle,
  VStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  accessibilityValue,
  Animation,
  animation,
  contentTransition,
  font,
  frame,
  foregroundStyle,
  listStyle,
  monospacedDigit,
  padding,
} from "@expo/ui/swift-ui/modifiers";

import { useState } from "react";

import { haptics } from "../../lib/haptics";
import { Chevron, rowLabel, secondary } from "../quiz-list/QuizRow";
import { useLocale } from "../../lib/locale";
import { userError } from "../../lib/user-error";
import type { StudySettingsProps } from "./types";

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
  openModels,
  defaultModel,
  canNotify,
  canUseAi,
  saveError,
  retrySave,
}: StudySettingsProps) {
  const { t } = useLocale();
  const limit = value.max_question_reoccurrences;
  const current = models?.find(
    (model) => model.value === value.default_ai_model,
  );
  const [lastLimit, setLastLimit] = useState(limit ?? 10);
  return (
    <Host style={{ flex: 1 }}>
      <List modifiers={[listStyle("insetGrouped")]}>
        {saveError ? (
          <Section>
            <Label
              title={`${t("Nie zapisano zmian", "Changes Not Saved")}: ${userError(saveError, t)}`}
              systemImage="exclamationmark.triangle"
            />
            <Button
              label={t("Spróbuj ponownie", "Try Again")}
              onPress={retrySave}
            />
          </Section>
        ) : null}

        <Section
          title={t("Powtórki", "Repetition")}
          footer={
            <Text>
              {t(
                "Pytanie jest opanowane po tylu poprawnych odpowiedziach. Błędna odpowiedź dodaje kolejne powtórki. Limit określa, ile razy jedno pytanie może wrócić.",
                "A question is mastered after this many correct answers. A wrong answer adds more repetitions. The limit caps how many times one question can come back.",
              )}
            </Text>
          }
        >
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
          <Toggle
            label={t("Limit powtórek", "Limit Repetitions")}
            isOn={limit !== null}
            onIsOnChange={(on) =>
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
        </Section>

        {canUseAi ? (
          <Section
            title={t("Asystent AI", "AI Assistant")}
            footer={
              modelsError ? (
                <Text>{userError(modelsError, t)}</Text>
              ) : (
                <Text>
                  {t(
                    "Podpowiedzi i asystent w quizach. Odpowiedzi AI mogą zawierać błędy.",
                    "Hints and the assistant in quizzes. AI answers can contain mistakes.",
                  )}
                </Text>
              )
            }
          >
            <Toggle
              label={t("Asystent AI", "AI Assistant")}
              isOn={!value.ai_disabled}
              onIsOnChange={(on) => update({ ai_disabled: !on })}
            />
            {models && !value.ai_disabled ? (
              <Button onPress={openModels} modifiers={[rowLabel]}>
                <HStack spacing={8}>
                  <Text>{t("Model", "Model")}</Text>
                  <Spacer />
                  {current?.provider ? (
                    <Image
                      assetName={`provider-${current.provider}`}
                      modifiers={[frame({ width: 18, height: 18 }), secondary]}
                    />
                  ) : null}
                  <Text modifiers={[secondary]}>
                    {current?.label ??
                      (defaultModel
                        ? t(
                            `Domyślny (${defaultModel})`,
                            `Default (${defaultModel})`,
                          )
                        : t("Domyślny", "Default"))}
                  </Text>
                  <Chevron />
                </HStack>
              </Button>
            ) : null}
            {modelsError ? (
              <Button
                label={t("Wczytaj modele ponownie", "Reload Models")}
                onPress={retryModels}
              />
            ) : null}
          </Section>
        ) : null}

        {canNotify ? (
          <Section
            title={t("Powiadomienia", "Notifications")}
            footer={
              <Text>
                {t(
                  "Wybierz, które powiadomienia chcesz otrzymywać. Zmiany zapisują się automatycznie.",
                  "Choose which notifications you get. Changes are saved automatically.",
                )}
              </Text>
            }
          >
            <Toggle
              label={t("Udostępnione quizy", "Shared Quizzes")}
              isOn={value.notify_quiz_shared}
              onIsOnChange={(on) => update({ notify_quiz_shared: on })}
            />
            <Toggle
              label={t("Zgłoszenia problemów", "Issue Reports")}
              isOn={value.notify_bug_reported}
              onIsOnChange={(on) => update({ notify_bug_reported: on })}
            />
            <Toggle
              label={t("Nowości Testownika", "Testownik News")}
              isOn={value.notify_marketing}
              onIsOnChange={(on) => update({ notify_marketing: on })}
            />
          </Section>
        ) : null}
      </List>
    </Host>
  );
}

/** A setting picked on a scale, with the current value spelled out above it. */
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
  // The native thumb owns the value while dragging; save once it's released.
  const [dragging, setDragging] = useState<number | null>(null);
  const shown = dragging ?? value;
  return (
    <VStack
      alignment="leading"
      spacing={10}
      modifiers={[padding({ vertical: 6 })]}
    >
      <HStack>
        <Text>{label}</Text>
        <Spacer />
        <Text
          modifiers={[
            foregroundStyle({ type: "hierarchical", style: "secondary" }),
            monospacedDigit(),
            contentTransition("numericText"),
            animation(Animation.default, shown),
          ]}
        >
          {display(shown)}
        </Text>
      </HStack>
      <Slider
        // Values set on the web can exceed the scale; the thumb then rests at the end.
        value={Math.min(max, Math.max(min, value))}
        min={min}
        max={max}
        step={1}
        minimumValueLabel={
          <Text modifiers={[font({ textStyle: "footnote" })]}>
            {String(min)}
          </Text>
        }
        maximumValueLabel={
          <Text modifiers={[font({ textStyle: "footnote" })]}>
            {String(max)}
          </Text>
        }
        modifiers={[
          accessibilityLabel(label),
          accessibilityValue(display(shown)),
        ]}
        onValueChange={(next) => {
          const n = Math.round(next);
          if (n === shown) return;
          haptics.selection();
          // VoiceOver adjusts without a drag; save those right away.
          if (dragging === null) onChange(n);
          else setDragging(n);
        }}
        onEditingChanged={(editing) => {
          if (editing) setDragging(Math.min(max, Math.max(min, value)));
          else {
            if (dragging !== null && dragging !== value) onChange(dragging);
            setDragging(null);
          }
        }}
      />
    </VStack>
  );
}
