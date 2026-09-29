import { Checkbox, RadioButton } from "@expo/ui/jetpack-compose";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../lib/theme";
import type { OptionIndicatorProps } from "./OptionIndicator";
import M3Host from "./M3Host";

export default function OptionIndicator({
  selected,
  multiple,
  result,
}: OptionIndicatorProps) {
  const c = useTheme();
  // After checking, show the verdict: an empty Material checkbox beside a
  // revealed correct answer would read as "not selected".
  if (result)
    return (
      <Ionicons
        name={
          result === "correct"
            ? multiple
              ? "checkbox"
              : "checkmark-circle"
            : "close-circle"
        }
        size={24}
        color={result === "correct" ? c.success : c.danger}
      />
    );
  return (
    <M3Host
      matchContents
      style={{ width: 28, height: 32 }}
      pointerEvents="none"
    >
      {multiple ? (
        <Checkbox value={selected} />
      ) : (
        <RadioButton selected={selected} />
      )}
    </M3Host>
  );
}
