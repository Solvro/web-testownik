import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import type { NumberSettingProps } from "./NumberSetting";

// A settings row with a compact −/+ stepper (Material icon buttons).
export default function NumberSetting({
  label,
  value,
  min,
  onChange,
}: NumberSettingProps) {
  const c = useTheme();
  const { t } = useLocale();
  const step = (delta: number, disabled: boolean, name: "remove" | "add") => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        delta < 0 ? t("Zmniejsz", "Decrease") : t("Zwiększ", "Increase")
      }
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      android_ripple={{ color: c.fill, borderless: true, radius: 20 }}
      onPress={() => onChange(value + delta)}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: c.border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={name} size={20} color={disabled ? c.border : c.text} />
    </Pressable>
  );
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: String(value) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === "increment") onChange(value + 1);
        else if (value > min) onChange(value - 1);
      }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 56,
      }}
    >
      <Text style={{ flex: 1, color: c.text, fontSize: 16 }}>{label}</Text>
      {step(-1, value <= min, "remove")}
      <Text
        style={{
          minWidth: 24,
          textAlign: "center",
          color: c.text,
          fontSize: 16,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
      {step(1, false, "add")}
    </View>
  );
}
