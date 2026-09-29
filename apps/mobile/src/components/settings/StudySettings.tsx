import { useLocale } from "../../lib/locale";
import Card, { SectionTitle as Heading } from "../SettingsGroup";
import ToggleRow from "../ToggleRow";
import Choice from "../native/Choice";
import NumberSetting from "../native/NumberSetting";
import { ErrorState, Label, Screen } from "../ui";
import type { StudySettingsProps } from "./types";

// Browser preview and Android. iOS renders a native SwiftUI list instead.
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
        <NumberSetting
          label={t("Do opanowania", "To Master")}
          value={value.initial_reoccurrences}
          min={1}
          onChange={(n) => update({ initial_reoccurrences: n })}
        />
        <NumberSetting
          label={t("Po błędnej odpowiedzi", "After a Wrong Answer")}
          value={value.wrong_answer_reoccurrences}
          min={0}
          onChange={(n) => update({ wrong_answer_reoccurrences: n })}
        />
        <ToggleRow
          label={t("Limit powtórek", "Limit Repetitions")}
          value={value.max_question_reoccurrences !== null}
          onValueChange={(on) =>
            update({ max_question_reoccurrences: on ? 5 : null })
          }
        />
        {value.max_question_reoccurrences !== null ? (
          <NumberSetting
            label={t("Maksymalnie", "At Most")}
            value={value.max_question_reoccurrences}
            min={1}
            onChange={(n) => update({ max_question_reoccurrences: n })}
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
