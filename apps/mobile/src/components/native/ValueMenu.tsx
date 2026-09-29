import { Text, View } from "react-native";
import Overflow from "../Overflow";
import { useTheme } from "../../lib/theme";
export interface ValueMenuProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}
export default function ValueMenu({
  label,
  value,
  options,
  disabled,
  onChange,
}: ValueMenuProps) {
  const c = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 48,
      }}
    >
      <Text style={{ flex: 1, color: c.text, fontSize: 17 }}>
        {options.find((option) => option.value === value)?.label}
      </Text>
      <Overflow
        label={label}
        items={options.map((option) => ({
          title: option.label,
          selected: option.value === value,
          disabled,
          onPress: () => onChange(option.value),
        }))}
      />
    </View>
  );
}
