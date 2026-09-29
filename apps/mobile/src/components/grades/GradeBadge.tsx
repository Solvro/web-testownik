import { Text, useColorScheme, View } from "react-native";

import { gradeTone } from "../../lib/grades-ui";
import { useTheme } from "../../lib/theme";

/** A grade in the web's colour scale: tinted capsule, coloured value. */
export default function GradeBadge({
  value,
  label,
  testID,
}: {
  value: number | null | undefined;
  label: string;
  testID?: string;
}) {
  const c = useTheme();
  const tone = gradeTone(value, c, useColorScheme() === "dark");
  return (
    <View
      style={{
        minWidth: 52,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        borderCurve: "continuous",
        backgroundColor: tone.soft,
        alignItems: "center",
      }}
    >
      <Text
        testID={testID}
        style={{
          color: tone.fg,
          fontSize: 20,
          fontWeight: "700",
          fontVariant: ["tabular-nums"],
        }}
      >
        {label}
      </Text>
    </View>
  );
}
