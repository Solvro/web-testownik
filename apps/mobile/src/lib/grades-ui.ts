import { gradeColor, isPassSymbol } from "@testownik/core/grades/utils";

import type { useTheme } from "./theme";
import type { Translate } from "./user-error";

type Palette = ReturnType<typeof useTheme>;

// Darker shades of the same hues keep text readable on light backgrounds.
const lightText: Record<string, string> = {
  "#10b981": "#047857",
  "#22c55e": "#15803d",
  "#84cc16": "#4d7c0f",
  "#eab308": "#a16207",
  "#f97316": "#c2410c",
  "#ef4444": "#b91c1c",
};

/** The web's grade colour scale; ungraded values use the muted palette. */
export function gradeTone(
  value: number | null | undefined,
  c: Palette,
  dark: boolean,
) {
  if (value == null) return { fg: c.muted, soft: c.fill };
  const tone = gradeColor(value);
  return dark ? tone : { ...tone, fg: lightText[tone.fg] ?? tone.fg };
}

/** USOS names terms in Polish ("Semestr letni 2025/26"); shorten and translate them. */
export function termLabel(name: string, t: Translate) {
  const match = /^semestr\s+(letni|zimowy)\s+(.+)$/i.exec(name.trim());
  if (!match) return name;
  const summer = match[1].toLowerCase() === "letni";
  return summer
    ? t(`Letni ${match[2]}`, `Summer ${match[2]}`)
    : t(`Zimowy ${match[2]}`, `Winter ${match[2]}`);
}

/** Pass/fail grades arrive as Polish USOS words ("zrealizowany"); show a short localized mark. */
export function gradeSymbol(symbol: string, t: Translate) {
  return isPassSymbol(symbol) ? t("Zal.", "Passed") : symbol;
}
