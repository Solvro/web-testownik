import { Pressable, ScrollView, Text } from "react-native";

import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import type { ModelListProps } from "./ModelList.types";

export default function ModelList({
  models,
  selected,
  select,
  defaultModel,
  scope = "account",
  disabled = false,
}: ModelListProps) {
  const c = useTheme();
  const { t } = useLocale();
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 8 }}>
      {[
        {
          value: null,
          label:
            scope === "quiz"
              ? t("Użyj ustawień nauki", "Use Study Settings")
              : t("Domyślny", "Default"),
        },
        ...models,
      ].map((model) => (
        <Pressable
          key={model.value ?? "default"}
          accessibilityRole="radio"
          accessibilityLabel={model.label}
          accessibilityState={{ checked: selected === model.value, disabled }}
          disabled={disabled}
          onPress={() => select(model.value)}
          style={{
            padding: 16,
            borderRadius: 12,
            backgroundColor: c.surface,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <Text
            style={{ color: selected === model.value ? c.primary : c.text }}
          >
            {model.label}
          </Text>
          {model.value === null && defaultModel ? (
            <Text style={{ color: c.muted, marginTop: 4 }}>
              {defaultModel.label}
            </Text>
          ) : null}
        </Pressable>
      ))}
      <Text style={{ color: c.muted }}>
        {scope === "quiz"
          ? t(
              "Ten wybór dotyczy tylko tego quizu. Domyślny model konta zmienisz w ustawieniach nauki.",
              "This choice applies only to this quiz. Change your account default in Study Settings.",
            )
          : t(
              "Domyślny model wybiera Testownik i może się zmieniać.",
              "Testownik picks the default model, and it may change over time.",
            )}
      </Text>
    </ScrollView>
  );
}
