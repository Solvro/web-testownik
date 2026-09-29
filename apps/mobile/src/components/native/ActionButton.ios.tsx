import { Button, Host, ProgressView, Text, ZStack } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  accessibilityHidden,
  accessibilityValue,
  buttonStyle,
  controlSize,
  contentShape,
  disabled as disable,
  frame,
  foregroundStyle,
  shapes,
  tint,
  opacity,
} from "@expo/ui/swift-ui/modifiers";
import { Platform } from "react-native";

import type { ActionButtonProps } from "./ActionButton.types";
import { useTheme } from "../../lib/theme";
import { useLocale } from "../../lib/locale";

export default function ActionButton({
  label,
  onPress,
  disabled,
  busy,
  kind,
}: ActionButtonProps) {
  const glass = Number.parseInt(String(Platform.Version), 10) >= 26;
  const c = useTheme();
  const { t } = useLocale();
  return (
    <Host
      ignoreSafeArea="all"
      matchContents={{ vertical: true }}
      style={{ width: "100%" }}
    >
      <Button
        onPress={onPress}
        role={kind === "danger" ? "destructive" : "default"}
        modifiers={[
          buttonStyle(
            kind === "primary"
              ? glass
                ? "glassProminent"
                : "borderedProminent"
              : "borderless",
          ),
          controlSize("large"),
          frame({ maxWidth: Infinity, minHeight: 48 }),
          disable(disabled || busy),
          accessibilityLabel(label),
          accessibilityValue(busy ? t("Przetwarzanie", "Working") : ""),
          tint(c.primary),
        ]}
      >
        <ZStack>
          <Text
            modifiers={[
              ...(kind === "primary"
                ? [foregroundStyle({ type: "color", color: c.bg })]
                : []),
              frame({
                maxWidth: Infinity,
                ...(kind === "primary" ? {} : { minHeight: 48 }),
              }),
              contentShape(shapes.rectangle()),
              opacity(busy ? 0 : 1),
            ]}
          >
            {label}
          </Text>
          {busy ? (
            <ProgressView
              modifiers={[
                tint(kind === "primary" ? c.bg : c.primary),
                accessibilityHidden(),
              ]}
            />
          ) : null}
        </ZStack>
      </Button>
    </Host>
  );
}
