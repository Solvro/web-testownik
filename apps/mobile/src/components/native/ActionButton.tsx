import { ActivityIndicator, Pressable, Text } from "react-native";

import { useTheme } from "../../lib/theme";
import type { ActionButtonProps } from "./ActionButton.types";

export default function ActionButton({
  label,
  onPress,
  disabled,
  busy,
  kind,
  testID,
}: ActionButtonProps) {
  const c = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      aria-busy={Boolean(busy)}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: 20,
        paddingVertical: 13,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: kind === "primary" ? c.primary : "transparent",
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 16,
          fontWeight: "600",
          opacity: busy ? 0 : 1,
          color:
            kind === "primary"
              ? c.bg
              : kind === "danger"
                ? c.danger
                : c.primary,
        }}
      >
        {label}
      </Text>
      {busy ? (
        <ActivityIndicator
          style={{ position: "absolute" }}
          color={kind === "primary" ? c.bg : c.primary}
          accessibilityElementsHidden
          aria-hidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
    </Pressable>
  );
}
