import { View } from "react-native";
import { Button, Label } from "../ui";
export interface NumberSettingProps {
  label: string;
  value: number;
  min: number;
  onChange: (value: number) => void;
}
export default function NumberSetting({
  label,
  value,
  min,
  onChange,
}: NumberSettingProps) {
  return (
    <View>
      <Label>
        {label}: {value}
      </Label>
      <View style={{ flexDirection: "row" }}>
        <Button
          kind="secondary"
          disabled={value <= min}
          onPress={() => onChange(value - 1)}
        >
          −
        </Button>
        <Button kind="secondary" onPress={() => onChange(value + 1)}>
          +
        </Button>
      </View>
    </View>
  );
}
