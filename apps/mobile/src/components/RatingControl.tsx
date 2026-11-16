import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { useLocale } from "../lib/locale";
import { useTheme } from "../lib/theme";

export interface RatingControlProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}
export default function RatingControl({
  value,
  onChange,
  disabled = false,
}: RatingControlProps) {
  const c = useTheme();
  const { t } = useLocale();
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((score) => (
        <Pressable
          key={score}
          accessibilityRole="button"
          accessibilityLabel={t(`Ocena ${score} z 5`, `Rate ${score} out of 5`)}
          accessibilityState={{ selected: value === score, disabled }}
          disabled={disabled}
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
            size={28}
            color={c.caution}
          />
        </Pressable>
      ))}
    </View>
  );
}
