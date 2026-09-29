import { Button, Host, Image } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled,
  frame,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { Platform } from "react-native";
import { useTheme } from "../../lib/theme";
import type { EditorActionProps } from "./EditorAction";
export default function EditorAction({
  label,
  action,
  disabled: unavailable,
  onPress,
}: EditorActionProps) {
  const c = useTheme();
  return (
    <Host ignoreSafeArea="all" style={{ width: 44, height: 44 }}>
      <Button
        onPress={onPress}
        modifiers={[
          buttonStyle(
            Number.parseInt(String(Platform.Version), 10) >= 26
              ? "glass"
              : "bordered",
          ),
          buttonBorderShape("circle"),
          controlSize("large"),
          tint(c.primary),
          disabled(!!unavailable),
          accessibilityLabel(label),
          frame({ width: 44, height: 44 }),
        ]}
      >
        <Image
          systemName={
            action === "edit"
              ? "pencil"
              : action === "add"
                ? "plus"
                : action === "next"
                  ? "chevron.right"
                  : "chevron.left"
          }
          size={18}
          color={unavailable ? c.muted : c.primary}
          modifiers={[frame({ width: 22, height: 22 })]}
        />
      </Button>
    </Host>
  );
}
