import { Pressable, Text, View } from "react-native";
import type { ChoiceProps } from "../native/Choice";
import { useTheme } from "../../lib/theme";

export default function GradesPicker({
  label,
  value,
  options,
  onChange,
}: ChoiceProps) {
  const c = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        padding: 4,
        gap: 4,
        backgroundColor: c.bg,
        borderRadius: 12,
      }}
    >
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="radio"
          accessibilityLabel={option.label}
          accessibilityState={{ checked: value === option.value }}
          onPress={() => onChange(option.value)}
          style={{
            flexGrow: 1,
            minWidth: 44,
            minHeight: 44,
            paddingHorizontal: 8,
            justifyContent: "center",
            alignItems: "center",
            borderRadius: 8,
            backgroundColor: value === option.value ? c.tint : "transparent",
          }}
        >
          <Text
            style={{
              color: value === option.value ? c.primary : c.muted,
              fontSize: 15,
              fontWeight: "600",
            }}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
