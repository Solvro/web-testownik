import { ActivityIndicator, Pressable, Text } from "react-native";

import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import type { AddAccessMenuProps } from "./AddAccessMenu.types";

// Elsewhere people join with study access; editing is granted from the list.
export default function AddAccessMenu({
  name,
  busy,
  disabled,
  add,
}: AddAccessMenuProps) {
  const c = useTheme();
  const { t } = useLocale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(`Dodaj: ${name}`, `Add ${name}`)}
      disabled={disabled}
      onPress={() => add("study")}
      hitSlop={6}
      style={({ pressed }) => ({
        minHeight: 48,
        minWidth: 48,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: c.tint,
        opacity: pressed || disabled ? 0.6 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator size="small" />
      ) : (
        <Text style={{ color: c.primary, fontSize: 15, fontWeight: "600" }}>
          {t("Dodaj", "Add")}
        </Text>
      )}
    </Pressable>
  );
}
