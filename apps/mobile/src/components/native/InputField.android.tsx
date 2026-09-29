import {
  OutlinedTextField,
  Text,
  useNativeState,
} from "@expo/ui/jetpack-compose";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";
import { useEffect, useRef } from "react";
import { NativeTextBinding } from "../../lib/native-text";
import type { InputFieldProps } from "./InputField.types";
import M3Host from "./M3Host";

export default function InputField({
  label,
  value = "",
  onChangeText,
  onSubmitEditing,
  multiline,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  returnKeyType,
  editable,
  secureTextEntry,
  maxLength,
}: InputFieldProps) {
  const state = useNativeState(value);
  const binding = useRef(new NativeTextBinding());
  useEffect(() => {
    if (binding.current.shouldApply(value) && state.get() !== value)
      state.set(value);
  }, [state, value]);
  const keyboard =
    keyboardType === "email-address"
      ? "email"
      : keyboardType === "number-pad"
        ? "number"
        : keyboardType === "decimal-pad" || keyboardType === "numeric"
          ? "decimal"
          : keyboardType === "phone-pad"
            ? "phone"
            : keyboardType === "url"
              ? "uri"
              : "text";
  return (
    <M3Host
      matchContents={{ vertical: true }}
      style={{ width: "100%", marginBottom: 12 }}
    >
      <OutlinedTextField
        value={state}
        onValueChange={(text) => {
          if (onChangeText) {
            binding.current.typed(text);
            onChangeText(text);
          }
        }}
        singleLine={!multiline}
        minLines={multiline ? 2 : 1}
        enabled={editable !== false}
        maxLength={maxLength}
        visualTransformation={secureTextEntry ? "password" : "none"}
        keyboardActions={{ onSearch: onSubmitEditing, onDone: onSubmitEditing }}
        keyboardOptions={{
          keyboardType: keyboard,
          capitalization: autoCapitalize ?? "sentences",
          autoCorrectEnabled: autoCorrect ?? true,
          imeAction: returnKeyType === "search" ? "search" : "done",
        }}
        modifiers={[fillMaxWidth()]}
      >
        <OutlinedTextField.Label>
          <Text>{label}</Text>
        </OutlinedTextField.Label>
      </OutlinedTextField>
    </M3Host>
  );
}
