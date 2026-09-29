import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useTheme } from "../lib/theme";

type Props = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle> | ((pressed: boolean) => StyleProp<ViewStyle>);
};

// Material touch feedback is a ripple clipped to the shape, not a shrink.
export default function PressableScale({ style, ...props }: Props) {
  const c = useTheme();
  return (
    <Pressable
      {...props}
      android_ripple={{ color: c.fill, foreground: true }}
      style={({ pressed }) => [
        typeof style === "function" ? style(pressed) : style,
        { overflow: "hidden" },
      ]}
    />
  );
}
