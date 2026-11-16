import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { useLocale } from "../lib/locale";
import { useTheme } from "../lib/theme";
import type { RatingControlProps } from "./RatingControl";

// A star row, matching the "Tap a star to rate" copy. Borderless ripples give
// Material touch feedback on each star.
export default function RatingControl({
  value,
  onChange,
  disabled = false,
}: RatingControlProps) {
  const c = useTheme();
  const { t } = useLocale();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t("Ocena quizu", "Quiz rating")}
      style={{ flexDirection: "row", justifyContent: "center", gap: 4 }}
    >
      {[1, 2, 3, 4, 5].map((score) => (
        <Pressable
          key={score}
          accessibilityRole="radio"
          accessibilityLabel={t(`Ocena ${score} z 5`, `Rate ${score} out of 5`)}
          accessibilityState={{ checked: value === score, disabled }}
          disabled={disabled}
          android_ripple={{ color: c.fill, borderless: true, radius: 24 }}
          onPress={() => onChange(score)}
          style={{
            width: 48,
            height: 48,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name={score <= value ? "star" : "star-outline"}
            size={32}
            color={c.caution}
          />
        </Pressable>
      ))}
    </View>
  );
}
