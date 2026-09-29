import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../lib/theme";

export interface ResultIconProps {
  result: "correct" | "wrong" | "complete";
  size?: number;
}

export default function ResultIcon({ result, size = 26 }: ResultIconProps) {
  const c = useTheme();
  return (
    <Ionicons
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      name={result === "wrong" ? "close-circle" : "checkmark-circle"}
      size={size}
      color={result === "wrong" ? c.danger : c.success}
    />
  );
}
