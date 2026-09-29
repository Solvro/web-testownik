import {
  Button,
  Divider,
  Host,
  HStack,
  Image,
  Menu,
  Picker,
  Text,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  accessibilityValue,
  backgroundOverlay,
  clipShape,
  font,
  foregroundStyle,
  menuIndicator,
  monospacedDigit,
  padding,
  pickerStyle,
  tag,
} from "@expo/ui/swift-ui/modifiers";
import { useColorScheme } from "react-native";

import { gradeTone } from "../../lib/grades-ui";
import { haptics } from "../../lib/haptics";
import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import type { GradeMenuProps } from "./GradeMenu.types";

/** The course's grade badge; tap it to predict another grade. */
export default function GradeMenu({
  label,
  value,
  display,
  options,
  predicted,
  onChange,
  onRestore,
}: GradeMenuProps) {
  const c = useTheme();
  const { t } = useLocale();
  const tone = gradeTone(value, c, useColorScheme() === "dark");
  return (
    <Host matchContents>
      <Menu
        label={
          <HStack spacing={4}>
            <Text
              modifiers={[
                font({ textStyle: "title3", weight: "bold" }),
                monospacedDigit(),
                foregroundStyle({ type: "color", color: tone.fg }),
              ]}
            >
              {display}
            </Text>
            <Image
              systemName="chevron.up.chevron.down"
              size={10}
              color={tone.fg}
            />
          </HStack>
        }
        modifiers={[
          menuIndicator("hidden"),
          padding({ horizontal: 10, vertical: 5 }),
          backgroundOverlay({ color: tone.soft }),
          clipShape("roundedRectangle", 10),
          accessibilityLabel(label),
          accessibilityValue(display),
        ]}
      >
        <Picker
          label={label}
          selection={value ?? -1}
          onSelectionChange={(next: number) => {
            haptics.selection();
            onChange(next);
          }}
          modifiers={[pickerStyle("inline")]}
        >
          {options.map((option) => (
            <Text key={option.value} modifiers={[tag(option.value)]}>
              {option.label}
            </Text>
          ))}
        </Picker>
        {predicted ? (
          <>
            <Divider />
            <Button
              label={t("Przywróć ocenę z USOS", "Restore USOS Grade")}
              systemImage="arrow.uturn.backward"
              onPress={onRestore}
            />
          </>
        ) : null}
      </Menu>
    </Host>
  );
}
