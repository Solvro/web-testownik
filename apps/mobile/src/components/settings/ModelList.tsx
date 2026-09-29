import { Pressable, ScrollView, Text } from "react-native";

import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import type { ModelListProps } from "./ModelList.types";

export default function ModelList({
  models,
  selected,
  select,
}: ModelListProps) {
  const c = useTheme();
  const { t } = useLocale();
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 8 }}>
      {[{ value: null, label: t("Domyślny", "Default") }, ...models].map(
        (model) => (
          <Pressable
            key={model.value ?? "default"}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected === model.value }}
            onPress={() => select(model.value)}
            style={{
              padding: 16,
              borderRadius: 12,
              backgroundColor: c.surface,
            }}
          >
            <Text
              style={{ color: selected === model.value ? c.primary : c.text }}
            >
              {model.label}
            </Text>
          </Pressable>
        ),
      )}
    </ScrollView>
  );
}
