import { SymbolView } from "expo-symbols";

import { useTheme } from "../../lib/theme";
import type { OptionIndicatorProps } from "./OptionIndicator";

// Squares mean "pick any", circles "pick one"; the shape never changes once
// answers are revealed, only its fill.
export default function OptionIndicator({
  selected,
  multiple,
  result,
}: OptionIndicatorProps) {
  const c = useTheme();
  const shape = multiple ? "square" : "circle";
  const name =
    result === "correct"
      ? (`checkmark.${shape}.fill` as const)
      : result === "wrong"
        ? (`xmark.${shape}.fill` as const)
        : selected
          ? (`checkmark.${shape}.fill` as const)
          : shape;
  return (
    <SymbolView
      name={name}
      size={24}
      tintColor={
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
