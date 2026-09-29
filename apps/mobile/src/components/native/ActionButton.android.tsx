import {
  Button,
  FilledTonalButton,
  Text,
  TextButton,
} from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  testID as testTag,
} from "@expo/ui/jetpack-compose/modifiers";

import type { ActionButtonProps } from "./ActionButton.types";
import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import M3Host from "./M3Host";

export default function ActionButton({
  label,
  onPress,
  disabled,
  busy,
  kind,
  testID,
}: ActionButtonProps) {
  const { t } = useLocale();
  const c = useTheme();
  // Material 3 emphasis: filled for the main action, tonal for secondary
  // actions, a text button in the error colour for destructive ones.
  const Control =
    kind === "primary"
      ? Button
      : kind === "secondary"
        ? FilledTonalButton
        : TextButton;
  return (
    <M3Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <Control
        // Recreate the Compose control when its enabled state or action changes.
        // Otherwise this native build can retain its initial disabled semantics.
        key={`${label}:${Boolean(disabled || busy)}`}
        enabled={!disabled && !busy}
        onClick={onPress}
        modifiers={[fillMaxWidth(), ...(testID ? [testTag(testID)] : [])]}
        {...(kind === "danger" ? { colors: { contentColor: c.danger } } : {})}
      >
        <Text>{busy ? t("Proszę czekać…", "Please wait…") : label}</Text>
      </Control>
    </M3Host>
  );
}
