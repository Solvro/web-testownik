import { Button, Host, HStack, Image, Menu, Text } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  backgroundOverlay,
  clipShape,
  disabled as disable,
  font,
  foregroundStyle,
  menuIndicator,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import { ActivityIndicator } from "react-native";

import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import type { AddAccessMenuProps } from "./AddAccessMenu.types";

/** "Add ▾": choose the access level as you add someone, like Calendar invites. */
export default function AddAccessMenu({
  name,
  busy,
  disabled,
  add,
}: AddAccessMenuProps) {
  const c = useTheme();
  const { t } = useLocale();
  if (busy) return <ActivityIndicator style={{ width: 72 }} />;
  return (
    <Host matchContents>
      <Menu
        label={
          <HStack spacing={4}>
            <Text
              modifiers={[
                font({ textStyle: "subheadline", weight: "semibold" }),
              ]}
            >
              {t("Dodaj", "Add")}
            </Text>
            <Image systemName="chevron.down" size={11} color={c.primary} />
          </HStack>
        }
        modifiers={[
          menuIndicator("hidden"),
          foregroundStyle({ type: "color", color: c.primary }),
          padding({ horizontal: 14, vertical: 6 }),
          backgroundOverlay({ color: c.tint }),
          clipShape("capsule"),
          disable(disabled),
          accessibilityLabel(t(`Dodaj: ${name}`, `Add ${name}`)),
        ]}
      >
        <Button
          label={t("Może się uczyć", "Can Study")}
          systemImage="book"
          onPress={() => add("study")}
        />
        <Button
          label={t("Może edytować", "Can Edit")}
          systemImage="pencil"
          onPress={() => add("edit")}
        />
      </Menu>
    </Host>
  );
}
