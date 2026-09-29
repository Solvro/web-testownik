// SwiftUI building blocks for the iOS (*.ios.tsx) settings-style lists.
import {
  Button,
  HStack,
  Image,
  Spacer,
  Text,
  VStack,
  type ImageProps,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  background,
  font,
  foregroundStyle,
  frame,
  shapes,
} from "@expo/ui/swift-ui/modifiers";

import { Chevron, rowLabel, secondary } from "../quiz-list/QuizRow";

// System palette used by Settings-style icon tiles; the tiles carry meaning by
// shape and label too, so color is never the only signal.
export const tile = {
  blue: "#0A84FF",
  green: "#30D158",
  red: "#FF453A",
  orange: "#FF9F0A",
  purple: "#BF5AF2",
  indigo: "#5E5CE6",
  gray: "#8E8E93",
  teal: "#40C8E0",
} as const;

export function IconTile({
  symbol,
  color,
}: {
  symbol: ImageProps["systemName"];
  color: string;
}) {
  return (
    <Image
      systemName={symbol}
      size={15}
      color="#FFFFFF"
      modifiers={[
        frame({ width: 29, height: 29 }),
        background(color, shapes.roundedRectangle({ cornerRadius: 7 })),
      ]}
    />
  );
}

/** A Settings-style row that opens another screen. */
export function NavRow({
  symbol,
  color,
  title,
  detail,
  value,
  onPress,
}: {
  symbol: ImageProps["systemName"];
  color: string;
  title: string;
  detail?: string;
  value?: string;
  onPress: () => void;
}) {
  return (
    <Button
      onPress={onPress}
      modifiers={[
        rowLabel,
        accessibilityLabel([title, value].filter(Boolean).join(", ")),
      ]}
    >
      <HStack spacing={14}>
        <IconTile symbol={symbol} color={color} />
        <VStack alignment="leading" spacing={2}>
          <Text>{title}</Text>
          {detail ? (
            <Text modifiers={[font({ textStyle: "footnote" }), secondary]}>
              {detail}
            </Text>
          ) : null}
        </VStack>
        <Spacer />
        {value ? <Text modifiers={[secondary]}>{value}</Text> : null}
        <Chevron />
      </HStack>
    </Button>
  );
}

export const tertiary = foregroundStyle({
  type: "hierarchical",
  style: "tertiary",
});
