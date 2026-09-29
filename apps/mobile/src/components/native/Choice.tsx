import { View } from "react-native";
import { Button, Label } from "../ui";
export interface ChoiceProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  segmented?: boolean;
}
export default function Choice({
  label,
  value,
  options,
  onChange,
}: ChoiceProps) {
  return (
    <View style={{ gap: 4 }}>
      <Label muted>{label}</Label>
      {options.map((option) => (
        <Button
          key={option.value}
          kind={value === option.value ? "primary" : "secondary"}
          onPress={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </View>
  );
}
