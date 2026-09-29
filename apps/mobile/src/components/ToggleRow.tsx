import { ActivityIndicator, Switch, Text, View } from "react-native";

import { useTheme } from "../lib/theme";
import { useLocale } from "../lib/locale";

export interface ToggleRowProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  busy?: boolean;
  detail?: string;
}
export default function ToggleRow({
  label,
  value,
  onValueChange,
  disabled,
  busy,
  detail,
}: ToggleRowProps) {
  const c = useTheme();
  const { t } = useLocale();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        paddingVertical: 12,
      }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 16, color: c.text }}>{label}</Text>
        {detail ? (
          <Text style={{ fontSize: 13, color: c.muted }}>{detail}</Text>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        {busy !== undefined ? (
          <View style={{ width: 20, height: 20 }}>
            {busy ? (
              <ActivityIndicator
                color={c.primary}
                accessibilityElementsHidden
                aria-hidden
                importantForAccessibility="no-hide-descendants"
              />
            ) : null}
          </View>
        ) : null}
        <Switch
          accessibilityLabel={label}
          accessibilityState={{ busy: Boolean(busy) }}
          accessibilityValue={
            busy ? { text: t("Zapisywanie", "Saving") } : undefined
          }
          value={value}
          onValueChange={onValueChange}
          disabled={disabled || busy}
          trackColor={{ true: c.primary }}
        />
      </View>
    </View>
  );
}
