import { Text, TextInput, View } from "react-native";

import type { InputFieldProps } from "./InputField.types";
import { useTheme } from "../../lib/theme";

export default function InputField({
  label,
  onSubmitEditing,
  ...props
}: InputFieldProps) {
  const c = useTheme();
  return (
    <View style={{ gap: 7, marginBottom: 14 }}>
      <Text style={{ color: c.text, fontSize: 16 }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        onSubmitEditing={
          onSubmitEditing
            ? (event) => onSubmitEditing(event.nativeEvent.text)
            : undefined
        }
        placeholderTextColor={c.muted}
        style={{
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 10,
          padding: 14,
          minHeight: 50,
          color: c.text,
          backgroundColor: c.surface,
          fontSize: 17,
          textAlignVertical: props.multiline ? "top" : "center",
        }}
        {...props}
      />
    </View>
  );
}
