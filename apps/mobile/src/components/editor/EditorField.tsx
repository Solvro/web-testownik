import { useState } from "react";
import { Platform, Text, View } from "react-native";
import { useTheme } from "../../lib/theme";
import GrowingEditorInput from "./GrowingEditorInput";
import InputField from "../native/InputField";
import type { InputFieldProps } from "../native/InputField.types";

/** Key fields by the edited entity. UIKit owns its buffer; JS stores each edit for recovery. */
export default function EditorField({
  value,
  nativeBuffer = true,
  ...props
}: InputFieldProps & { nativeBuffer?: boolean }) {
  const [initialText] = useState(value);
  const c = useTheme();
  if (Platform.OS === "ios" && nativeBuffer && props.multiline) {
    const { label, onSubmitEditing, ...inputProps } = props;
    return (
      <View style={{ gap: 8, marginBottom: 16 }}>
        <Text style={{ color: c.muted, fontSize: 14 }}>{label}</Text>
        <GrowingEditorInput
          {...inputProps}
          text={value ?? ""}
          minimumHeight={80}
          inset={14}
          accessibilityLabel={label}
          onSubmitEditing={
            onSubmitEditing
              ? (event) => onSubmitEditing(event.nativeEvent.text)
              : undefined
          }
          style={[
            { backgroundColor: c.surface, borderRadius: 12 },
            props.style,
          ]}
        />
      </View>
    );
  }
  return (
    <InputField
      {...props}
      {...(Platform.OS === "ios" && nativeBuffer
        ? { defaultValue: initialText }
        : { value })}
    />
  );
}
