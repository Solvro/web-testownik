import type { TextInputProps } from "react-native";

export type InputFieldProps = Omit<TextInputProps, "onSubmitEditing"> & {
  label: string;
  onSubmitEditing?: (text: string) => void;
};
