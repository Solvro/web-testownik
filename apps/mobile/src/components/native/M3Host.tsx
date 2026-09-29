import { Host } from "@expo/ui";
import type { ComponentProps } from "react";
import { useColorScheme } from "react-native";

import { BRAND_SEED } from "../../lib/brand";

/**
 * Compose host themed with the brand Material 3 palette. The explicit
 * colorScheme matters: the activity handles uiMode changes itself, so a Host
 * left on "follow system" keeps the old palette until it remounts.
 */
export default function M3Host(props: ComponentProps<typeof Host>) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return <Host seedColor={BRAND_SEED} colorScheme={scheme} {...props} />;
}
