import {
  Host,
  HStack,
  Image,
  Menu,
  Picker,
  Spacer,
  Text,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonStyle,
  contentShape,
  disabled,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  menuIndicator,
  padding,
  pickerStyle,
  shapes,
  tag,
} from "@expo/ui/swift-ui/modifiers";
import { useTheme } from "../../lib/theme";
import type { ValueMenuProps } from "./ValueMenu";
export default function ValueMenu({
  label,
  value,
  options,
  disabled: unavailable,
  onChange,
}: ValueMenuProps) {
  const c = useTheme();
  return (
    <Host
      matchContents={{ vertical: true }}
      ignoreSafeArea="all"
      style={{ width: "100%" }}
    >
      <Menu
        label={
          <HStack
            spacing={12}
            modifiers={[
              frame({ minHeight: 48, maxWidth: Infinity }),
              padding({ vertical: 8 }),
              contentShape(shapes.rectangle()),
            ]}
          >
            <Text
              modifiers={[
                font({ textStyle: "body" }),
                fixedSize({ horizontal: false, vertical: true }),
                foregroundStyle({ type: "color", color: c.text }),
              ]}
            >
              {options.find((option) => option.value === value)?.label ?? ""}
            </Text>
            <Spacer />
            <Image
              systemName="chevron.up.chevron.down"
              size={12}
              color={c.primary}
            />
          </HStack>
        }
        modifiers={[
          buttonStyle("plain"),
          menuIndicator("hidden"),
          disabled(!!unavailable),
          accessibilityLabel(label),
        ]}
      >
        <Picker
          label={label}
          selection={value}
          onSelectionChange={(next: string) => onChange(next)}
          modifiers={[pickerStyle("inline")]}
        >
          {options.map((option) => (
            <Text key={option.value} modifiers={[tag(option.value)]}>
              {option.label}
            </Text>
          ))}
        </Picker>
      </Menu>
    </Host>
  );
}
