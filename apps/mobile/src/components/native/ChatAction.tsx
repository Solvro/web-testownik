import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { useTheme } from "../../lib/theme";

export type ChatActionProps = {
  label: string;
  stopping: boolean;
  disabled: boolean;
  onPress: () => void;
};
export default function ChatAction({
  label,
  stopping,
  disabled,
  onPress,
}: ChatActionProps) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: c.primary,
        opacity: pressed || disabled ? 0.45 : 1,
      })}
    >
      <Ionicons name={stopping ? "stop" : "arrow-up"} size={22} color={c.bg} />
    </Pressable>
  );
}
