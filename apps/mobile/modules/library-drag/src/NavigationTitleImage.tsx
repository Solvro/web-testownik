import { requireNativeView } from "expo";
import type { ComponentType } from "react";
import { Platform, type ViewProps } from "react-native";

interface Props extends ViewProps {
  imageName: string;
  inlineHeight?: number;
  expandedHeight?: number;
}

const NativeTitle: ComponentType<Props> | null =
  Platform.OS === "ios"
    ? requireNativeView("LibraryDrag", "NavigationTitleImageView")
    : null;

export function NavigationTitleImage(props: Props) {
  return NativeTitle ? (
    <NativeTitle
      {...props}
      pointerEvents="none"
      style={{ position: "absolute", width: 0, height: 0 }}
    />
  ) : null;
}
