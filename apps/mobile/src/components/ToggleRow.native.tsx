import { Host, Switch } from "@expo/ui";
import { Text, View } from "react-native";

import { useTheme } from "../lib/theme";
import type { ToggleRowProps } from "./ToggleRow";

export default function ToggleRow({
  label,
  value,
  onValueChange,
  disabled,
  detail,
}: ToggleRowProps) {
  const c = useTheme();
  return (
    <View style={{ paddingVertical: 10, gap: 6 }}>
      <Host
        matchContents={{ vertical: true }}
        style={{ width: "100%" }}
        seedColor={c.primary}
      >
        <Switch
          label={label}
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
        />
      </Host>
      {detail ? (
        <Text style={{ color: c.muted, fontSize: 13 }}>{detail}</Text>
      ) : null}
    </View>
  );
}
