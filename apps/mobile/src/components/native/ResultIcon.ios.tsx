import { SymbolView } from "expo-symbols";

import { useTheme } from "../../lib/theme";
import type { ResultIconProps } from "./ResultIcon";

export default function ResultIcon({ result, size = 26 }: ResultIconProps) {
  const c = useTheme();
  // Decorative: callers always state the result in text. Unlabelled, SF
  // Symbols read their own name (the ✕ says “Close”).
  return (
    <SymbolView
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      name={
        result === "correct"
          ? "checkmark.circle.fill"
          : result === "wrong"
            ? "xmark.circle.fill"
            : "checkmark.seal.fill"
      }
      size={size}
      tintColor={result === "wrong" ? c.danger : c.success}
    />
  );
}
