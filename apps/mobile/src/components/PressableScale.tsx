import { useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type Props = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle> | ((pressed: boolean) => StyleProp<ViewStyle>);
};

// Responds on touch-down and commits on release: a quick ease-out shrink,
// then a critically damped spring back so the release is never bouncy.
export default function PressableScale({ style, disabled, ...props }: Props) {
  const [scale] = useState(() => new Animated.Value(1));
  return (
    <Pressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        Animated.timing(scale, {
          toValue: 0.97,
          duration: 120,
          easing: Easing.bezier(0.23, 1, 0.32, 1),
          useNativeDriver: true,
        }).start();
        props.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        Animated.spring(scale, {
          toValue: 1,
          damping: 20,
          stiffness: 300,
          mass: 1,
          useNativeDriver: true,
        }).start();
        props.onPressOut?.(event);
      }}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            typeof style === "function" ? style(pressed) : style,
            { transform: [{ scale }] },
          ]}
        >
          {typeof props.children === "function"
            ? props.children({ pressed, hovered: false })
            : props.children}
        </Animated.View>
      )}
    </Pressable>
  );
}
