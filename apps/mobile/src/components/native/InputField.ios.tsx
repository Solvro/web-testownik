import { Text, TextInput, View } from "react-native";

import { useTheme } from "../../lib/theme";
import type { InputFieldProps } from "./InputField.types";

/** React Native synchronizes UIKit text using native event counts. */
export default function InputField({
  label,
  onSubmitEditing,
  value,
  onChangeText,
  style,
  ...props
}: InputFieldProps) {
  const c = useTheme();
  return (
    <View style={{ gap: 8, marginBottom: 16 }}>
      <Text style={{ color: c.muted, fontSize: 14 }}>{label}</Text>
      <TextInput
        {...props}
        clearButtonMode={props.multiline ? "never" : "while-editing"}
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        onSubmitEditing={
          onSubmitEditing
            ? (event) => onSubmitEditing(event.nativeEvent.text)
            : undefined
        }
        style={[
          {
            padding: 14,
            minHeight: props.multiline ? 80 : 50,
            backgroundColor: c.surface,
            borderRadius: 12,
            color: c.text,
            fontSize: 17,
            textAlignVertical: props.multiline ? "top" : "center",
          },
          style,
        ]}
      />
    </View>
  );
}
