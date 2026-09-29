import { Host, Picker, Text, HStack, Spacer } from "@expo/ui/swift-ui";
import {
  pickerStyle,
  tag,
  foregroundStyle,
  font,
  frame,
  controlSize,
} from "@expo/ui/swift-ui/modifiers";
import type { ChoiceProps } from "./Choice";
import { useTheme } from "../../lib/theme";
export default function Choice({
  label,
  value,
  options,
  onChange,
  segmented,
}: ChoiceProps) {
  const c = useTheme();
  return (
    <Host
      ignoreSafeArea="all"
      matchContents={{ vertical: true }}
      style={{ width: "100%", minHeight: 44 }}
    >
      <HStack modifiers={[frame({ minHeight: 44, maxWidth: Infinity })]}>
        {!segmented ? (
          <>
            <Text
              modifiers={[
                font({ textStyle: "body" }),
                foregroundStyle({ type: "color", color: c.text }),
              ]}
            >
              {label}
            </Text>
            <Spacer />
          </>
        ) : null}
        <Picker
          label={label}
          selection={value}
          onSelectionChange={onChange}
          modifiers={[
            pickerStyle(segmented ? "segmented" : "menu"),
            controlSize("regular"),
          ]}
        >
          {options.map((option) => (
            <Text key={option.value} modifiers={[tag(option.value)]}>
              {option.label}
            </Text>
          ))}
        </Picker>
      </HStack>
    </Host>
  );
}
