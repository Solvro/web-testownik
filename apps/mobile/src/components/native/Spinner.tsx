import { ActivityIndicator } from "react-native";

/** Indeterminate progress for a screen that is still loading. */
export default function Spinner({ label }: { label: string }) {
  return <ActivityIndicator size="large" accessibilityLabel={label} />;
}
