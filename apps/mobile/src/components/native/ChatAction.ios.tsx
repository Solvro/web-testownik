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
import type { ChatActionProps } from "./ChatAction";

export default function ChatAction({
  label,
  stopping,
  disabled: unavailable,
  onPress,
}: ChatActionProps) {
  const c = useTheme();
  return (
    <Host ignoreSafeArea="all" style={{ width: 36, height: 36 }}>
      <Button
        onPress={onPress}
        modifiers={[
          buttonStyle(
            Number.parseInt(String(Platform.Version), 10) >= 26
              ? "glassProminent"
              : "borderedProminent",
          ),
          buttonBorderShape("circle"),
          controlSize("small"),
          tint(c.primary),
          disabled(unavailable),
          accessibilityLabel(label),
          frame({ width: 36, height: 36 }),
        ]}
      >
        <Image
          systemName={stopping ? "stop.fill" : "arrow.up"}
          size={15}
          color="#FFFFFF"
          modifiers={[frame({ width: 18, height: 18 })]}
        />
      </Button>
    </Host>
  );
}
