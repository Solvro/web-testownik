import { Platform, useColorScheme } from "react-native";

export const light = {
  bg: "#F4F6FA",
  surface: "#FFFFFF",
  text: "#17243C",
  muted: "#526079",
  // The web's primary (oklch(0.6068 0.172 258.85)).
  primary: "#3B7FE7",
  tint: "#E8EFFC",
  border: "#D7DFED",
  success: "#17663C",
  successBg: "#E3F3E9",
  danger: "#B42D38",
  dangerBg: "#FDECEF",
  gold: "#805600",
  // Swipe and menu action colors; iOS overrides them with system colors.
  destructive: "#B42D38",
  caution: "#B35C00",
  // Fill for prominent buttons; white labels need a darker blue than `primary` in dark mode.
  prominent: "#3B7FE7",
  // Neutral fill behind images and placeholders (iOS systemGray5).
  fill: "#E5E5EA",
};
export const dark = {
  bg: "#101826",
  surface: "#192437",
  text: "#F4F7FE",
  muted: "#A9B8CF",
  primary: "#91B7FF",
  tint: "#243D62",
  border: "#34445C",
  success: "#88DCAD",
  successBg: "#193D2C",
  danger: "#FF9CA6",
  dangerBg: "#492731",
  gold: "#EAC469",
  destructive: "#FF9CA6",
  caution: "#FFB45C",
  // The web's dark-mode primary (oklch(0.553 0.18 259.121)).
  prominent: "#266DD9",
  fill: "#2C2C2E",
};
// iOS uses neutral grouped surfaces; Testownik blue remains the interaction tint.
const iosLight = {
  ...light,
  bg: "#F2F2F7",
  text: "#1C1C1E",
  muted: "#62626A",
  border: "#D1D1D6",
  destructive: "#FF3B30",
  caution: "#FF9500",
};
const iosDark = {
  ...dark,
  bg: "#000000",
  surface: "#1C1C1E",
  text: "#F2F2F7",
  muted: "#A1A1AA",
  border: "#38383A",
  destructive: "#FF453A",
  caution: "#FF9F0A",
};
export function useTheme() {
  const isDark = useColorScheme() === "dark";
  return Platform.OS === "ios"
    ? isDark
      ? iosDark
      : iosLight
    : isDark
      ? dark
      : light;
}
