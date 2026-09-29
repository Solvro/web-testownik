import { MenuView, type MenuComponentRef } from "@expo/ui/community/menu";
import { Ionicons } from "@expo/vector-icons";
import { useRef } from "react";
import { Pressable, Text, View } from "react-native";

import { useTheme } from "../../lib/theme";
import type { ValueMenuProps } from "./ValueMenu";

// Material exposed-dropdown row: the current value with a drop-down arrow;
// the whole row opens a menu anchored at the value, with the choice checked.
export default function ValueMenu({
  label,
  value,
  options,
  disabled,
  onChange,
}: ValueMenuProps) {
  const c = useTheme();
  const menu = useRef<MenuComponentRef>(null);
  const current = options.find((option) => option.value === value);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${current?.label ?? ""}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      android_ripple={{ color: c.fill }}
      onPress={() => menu.current?.show()}
      style={{
        minHeight: 56,
        justifyContent: "center",
        // Bleed into the SettingsGroup padding so the ripple fills the row.
        marginHorizontal: -16,
        paddingHorizontal: 16,
        opacity: disabled ? 0.38 : 1,
      }}
    >
      <MenuView
        ref={menu}
        style={{ alignSelf: "stretch" }}
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
          style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          <Text style={{ flex: 1, color: c.text, fontSize: 16 }}>
            {current?.label}
          </Text>
          <Ionicons name="caret-down" size={14} color={c.muted} />
        </View>
      </MenuView>
    </Pressable>
  );
}
