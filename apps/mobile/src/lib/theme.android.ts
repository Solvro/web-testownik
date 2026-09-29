import { useMaterialColors } from "@expo/ui/jetpack-compose";
import { useColorScheme } from "react-native";

import { BRAND_SEED } from "./brand";

// Status colors Material 3 has no role for (success, gold tier, caution);
// same values as theme.ts.
const status = {
  light: {
    success: "#17663C",
    successBg: "#E3F3E9",
    gold: "#805600",
    caution: "#B35C00",
  },
  dark: {
    success: "#88DCAD",
    successBg: "#193D2C",
    gold: "#EAC469",
    caution: "#FFB45C",
  },
};

/**
 * Material 3 roles generated from the brand seed (SchemeTonalSpot): the same
 * palette every `<Host seedColor={BRAND_SEED}>` Compose tree uses, so React
 * Native surfaces and Compose components match exactly. Keys mirror theme.ts.
 */
export function useTheme() {
  const isDark = useColorScheme() === "dark";
  const m = useMaterialColors({
    seedColor: BRAND_SEED,
    colorScheme: isDark ? "dark" : "light",
  });
  return {
    ...status[isDark ? "dark" : "light"],
    // Screen background and app bars.
    bg: m.surface,
    // Grouped list segments and cards.
    surface: m.surfaceContainer,
    text: m.onSurface,
    muted: m.onSurfaceVariant,
    primary: m.primary,
    // Selected / highlighted containers.
    tint: m.secondaryContainer,
    border: m.outlineVariant,
    danger: m.error,
    dangerBg: m.errorContainer,
    destructive: m.error,
    prominent: m.primary,
    fill: m.surfaceContainerHighest,
  };
}
