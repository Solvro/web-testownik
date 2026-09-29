import { userError, failureTitle } from "../lib/user-error";
import { Button, Host, Image, Menu } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled,
  frame,
  menuIndicator,
} from "@expo/ui/swift-ui/modifiers";
import type { ComponentProps } from "react";
import { Platform } from "react-native";
import { useTheme } from "../lib/theme";
import { useLocale } from "../lib/locale";
import type { OverflowProps } from "./Overflow";
import { notify } from "./ui";

type SystemImage = ComponentProps<typeof Button>["systemImage"];

export default function Overflow({
  items,
  glass = false,
  muted = false,
  label,
  icon = "ellipsis-horizontal",
}: OverflowProps) {
  const c = useTheme();
  const { t } = useLocale();
  return (
    <Host ignoreSafeArea="all" style={{ width: 44, height: 44 }}>
      <Menu
        label={
          <Image
            systemName={
              icon === "add"
                ? "plus"
                : icon === "sort"
                  ? "arrow.up.arrow.down"
                  : "ellipsis"
            }
            size={20}
            color={muted ? c.muted : c.primary}
            modifiers={[
              frame({ width: glass ? 22 : 44, height: glass ? 22 : 44 }),
            ]}
          />
        }
        modifiers={[
          buttonStyle(
            glass
              ? Number.parseInt(String(Platform.Version), 10) >= 26
                ? "glass"
                : "bordered"
              : "plain",
          ),
          buttonBorderShape("circle"),
          controlSize("large"),
          menuIndicator("hidden"),
          accessibilityLabel(label ?? t("Opcje", "Options")),
          frame({ width: 44, height: 44 }),
        ]}
      >
        {items.map((item) => (
          <Button
            key={item.title}
            label={item.title}
            systemImage={
              (item.selected ? "checkmark" : item.symbol) as SystemImage
            }
            role={item.destructive ? "destructive" : undefined}
            modifiers={[disabled(!!item.disabled)]}
            onPress={() => {
              void Promise.resolve()
                .then(item.onPress)
                .catch((error: unknown) =>
                  notify(failureTitle(t, item.title), userError(error, t)),
                );
            }}
          />
        ))}
      </Menu>
    </Host>
  );
}
