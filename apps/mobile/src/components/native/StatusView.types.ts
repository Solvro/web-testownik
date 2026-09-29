import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import type { SymbolViewProps } from "expo-symbols";

type SFSymbol = Extract<SymbolViewProps["name"], string>;

export interface StatusAction {
  label: string;
  onPress: () => void;
  primary?: boolean;
}

/** A whole-screen message: nothing here yet, or this failed to load. */
export interface StatusViewProps {
  symbol: SFSymbol;
  ionicon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  description?: string;
  actions?: StatusAction[];
  testID?: string;
}
