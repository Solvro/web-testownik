import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { useTheme } from "../../lib/theme";
export interface EditorActionProps {
  label: string;
  action: "previous" | "next" | "add" | "edit";
  disabled?: boolean;
  onPress: () => void;
}
export default function EditorAction({
  label,
  action,
  disabled,
  onPress,
}: EditorActionProps) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: c.tint,
        opacity: disabled ? 0.35 : pressed ? 0.65 : 1,
      })}
    >
      <Ionicons
        name={
          action === "edit"
            ? "pencil"
            : action === "add"
              ? "add"
              : action === "next"
                ? "chevron-forward"
                : "chevron-back"
        }
        size={22}
        color={c.primary}
      />
    </Pressable>
  );
}
