import { useRef } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";

import { gradeTone } from "../../lib/grades-ui";
import { haptics } from "../../lib/haptics";
import { useTheme } from "../../lib/theme";

export interface SemesterPoint {
  id: string;
  label: string;
  average: number | null;
  selected: boolean;
}

const BAR_HEIGHT = 150;
// Grades run from 2.0 to 5.0; bars start at 2.0 so differences stay visible.
const height = (average: number) =>
  Math.max(6, ((Math.min(5, average) - 2) / 3) * BAR_HEIGHT);

/**
 * Averages per semester, oldest to newest. Scrolls sideways when there are
 * many semesters and starts at the most recent ones. Tap a bar to include it.
 */
export default function SemesterChart({
  points,
  format,
  onToggle,
  combined,
}: {
  points: SemesterPoint[];
  format: (value: number | null) => string;
  onToggle: (id: string) => void;
  /** The average across all semesters, drawn as a dashed reference line. */
  combined: number | null;
}) {
  const c = useTheme();
  const dark = useColorScheme() === "dark";
  const { fontScale } = useWindowDimensions();
  const textScale = Math.max(1, fontScale);
  const labelHeight = 32 * textScale;
  const scroll = useRef<ScrollView>(null);
  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      onContentSizeChange={() =>
        scroll.current?.scrollToEnd({ animated: false })
      }
      contentContainerStyle={{ paddingHorizontal: 16, flexGrow: 1 }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 12,
          flexGrow: 1,
          justifyContent: "center",
        }}
      >
        {combined != null ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              // Keep the reference line aligned as semester labels scale.
              bottom: labelHeight + 6 + height(combined),
              borderTopWidth: 1.5,
              borderStyle: "dashed",
              borderColor: gradeTone(combined, c, dark).fg,
              opacity: 0.8,
            }}
          />
        ) : null}
        {points.map((point) => {
          const tone = gradeTone(point.average, c, dark);
          return (
            <Pressable
              key={point.id}
              accessibilityRole="checkbox"
              accessibilityLabel={`${point.label}, ${format(point.average)}`}
              accessibilityState={{ checked: point.selected }}
              onPress={() => {
                haptics.selection();
                onToggle(point.id);
              }}
              style={({ pressed }) => ({
                width: 64 * textScale,
                alignItems: "center",
                gap: 6,
                opacity: pressed ? 0.6 : point.selected ? 1 : 0.4,
              })}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  color: tone.fg,
                  fontSize: 15,
                  fontWeight: "700",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {format(point.average)}
              </Text>
              <View
                style={{
                  width: 36,
                  height: point.average == null ? 6 : height(point.average),
                  borderRadius: 8,
                  borderCurve: "continuous",
                  backgroundColor: point.average == null ? c.fill : tone.fg,
                }}
              />
              <Text
                numberOfLines={2}
                style={{
                  height: labelHeight,
                  color: point.selected ? c.text : c.muted,
                  fontSize: 12,
                  textAlign: "center",
                }}
              >
                {point.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

/** A compact row of bars previewing each semester's average, scaled to their range. */
export function Sparkline({ values }: { values: (number | null)[] }) {
  const c = useTheme();
  const dark = useColorScheme() === "dark";
  const known = values.filter((value): value is number => value != null);
  const low = Math.min(...known) - 0.25;
  const span = Math.max(Math.max(...known) - low, 0.5);
  return (
    <View
      accessible={false}
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 6,
        height: 36,
      }}
    >
      {values.map((value, index) => (
        <View
          key={index}
          style={{
            flex: 1,
            maxWidth: 28,
            height: value == null ? 4 : 6 + ((value - low) / span) * 30,
            borderRadius: 4,
            backgroundColor:
              value == null ? c.fill : gradeTone(value, c, dark).fg,
          }}
        />
      ))}
    </View>
  );
}
