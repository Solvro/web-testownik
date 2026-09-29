import { Host, Stepper } from "@expo/ui/swift-ui";
import { foregroundStyle } from "@expo/ui/swift-ui/modifiers";
import type { NumberSettingProps } from "./NumberSetting";
import { useTheme } from "../../lib/theme";
export default function NumberSetting({
  label,
  value,
  min,
  onChange,
}: NumberSettingProps) {
  const c = useTheme();
  return (
    <Host
      ignoreSafeArea="all"
      matchContents={{ vertical: true }}
      style={{ width: "100%", minHeight: 48 }}
    >
      <Stepper
        label={`${label}: ${value}`}
        value={value}
        min={min}
        onValueChange={onChange}
        modifiers={[foregroundStyle({ type: "color", color: c.text })]}
      />
    </Host>
  );
}
