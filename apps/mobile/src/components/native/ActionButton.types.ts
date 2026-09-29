export interface ActionButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  kind: "primary" | "secondary" | "danger";
  testID?: string;
}
