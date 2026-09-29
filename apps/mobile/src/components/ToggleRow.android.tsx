import { Switch } from "@expo/ui";
import { Pressable, Text, View } from "react-native";

import { useTheme } from "../lib/theme";
import type { ToggleRowProps } from "./ToggleRow";
import M3Host from "./native/M3Host";

// The Compose switch label renders at 14sp, smaller than the 16sp titles of
// neighbouring settings rows. Draw the label in React Native instead and let
// the whole row toggle, as Material settings lists do.
export default function ToggleRow({
  label,
  value,
  onValueChange,
  disabled,
  detail,
}: ToggleRowProps) {
  const c = useTheme();
  return (
    <View style={{ paddingVertical: 4, gap: 2 }}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value, disabled: !!disabled }}
        disabled={disabled}
        android_ripple={{ color: c.fill }}
        onPress={() => onValueChange(!value)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          minHeight: 56,
          // Bleed into the SettingsGroup padding so the ripple fills the row.
          marginHorizontal: -16,
          paddingHorizontal: 16,
          opacity: disabled ? 0.45 : 1,
        }}
      >
        <Text style={{ flex: 1, color: c.text, fontSize: 16 }}>{label}</Text>
        <View importantForAccessibility="no-hide-descendants">
          <M3Host matchContents>
            <Switch
              value={value}
              onValueChange={onValueChange}
              disabled={disabled}
            />
          </M3Host>
        </View>
      </Pressable>
      {detail ? (
        <Text style={{ color: c.muted, fontSize: 13, paddingBottom: 8 }}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}
