import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../lib/theme";

export interface OptionIndicatorProps {
  selected: boolean;
  multiple: boolean;
  /** Set once the answer has been checked. */
  result?: "correct" | "wrong" | null;
}

export default function OptionIndicator({
  selected,
  multiple,
  result,
}: OptionIndicatorProps) {
  const c = useTheme();
  return (
    <Ionicons
      name={
        result === "correct"
          ? multiple
            ? "checkbox"
            : "checkmark-circle"
          : result === "wrong"
            ? "close-circle"
            : multiple
              ? selected
                ? "checkbox"
                : "square-outline"
              : selected
                ? "radio-button-on"
                : "radio-button-off"
      }
      size={23}
      color={
        result === "correct"
          ? c.success
          : result === "wrong"
            ? c.danger
            : selected
              ? c.primary
              : c.muted
      }
    />
  );
}
