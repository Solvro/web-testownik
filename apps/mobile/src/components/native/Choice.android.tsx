import { MenuView, type MenuComponentRef } from "@expo/ui/community/menu";
import {
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text as ComposeText,
} from "@expo/ui/jetpack-compose";
import { fillMaxWidth, weight } from "@expo/ui/jetpack-compose/modifiers";
import { Ionicons } from "@expo/vector-icons";
import { useRef } from "react";
import { Pressable, Text, View } from "react-native";

import { useTheme } from "../../lib/theme";
import type { ChoiceProps } from "./Choice";
import M3Host from "./M3Host";

// Material 3: segmented buttons for short exclusive choices, otherwise a
// settings row that opens a dropdown menu (mirrors the iOS menu picker).
export default function Choice({
  label,
  value,
  options,
  onChange,
  segmented,
  disabled = false,
}: ChoiceProps) {
  const c = useTheme();
  const menu = useRef<MenuComponentRef>(null);
  if (segmented)
    return (
      <M3Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
        <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
          {options.map((option) => (
            <SegmentedButton
              key={option.value}
              selected={option.value === value}
              enabled={!disabled}
              onClick={() => onChange(option.value)}
              modifiers={[weight(1)]}
            >
              <SegmentedButton.Label>
                <ComposeText>{option.label}</ComposeText>
              </SegmentedButton.Label>
            </SegmentedButton>
          ))}
        </SingleChoiceSegmentedButtonRow>
      </M3Host>
    );
  const current = options.find((option) => option.value === value);
  return (
    // The whole row opens the menu; MenuView anchors it at the current value.
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${current?.label ?? ""}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      android_ripple={{ color: c.fill }}
      onPress={() => menu.current?.show()}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        minHeight: 56,
        // Bleed into the SettingsGroup padding so the ripple fills the row.
        marginHorizontal: -16,
        paddingHorizontal: 16,
      }}
    >
      <Text style={{ flex: 1, color: c.text, fontSize: 16 }}>{label}</Text>
      <MenuView
        ref={menu}
        title={label}
        actions={options.map((option) => ({
          id: option.value,
          title: option.label,
          state: option.value === value ? ("on" as const) : undefined,
        }))}
        onPressAction={({ nativeEvent }) => onChange(nativeEvent.event)}
      >
        <View
          importantForAccessibility="no-hide-descendants"
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
        >
          <Text numberOfLines={1} style={{ color: c.muted, fontSize: 14 }}>
            {current?.label}
          </Text>
          <Ionicons name="caret-down" size={14} color={c.muted} />
        </View>
      </MenuView>
    </Pressable>
  );
}
