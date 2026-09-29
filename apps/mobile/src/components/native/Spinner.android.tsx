import { LoadingIndicator } from "@expo/ui/jetpack-compose";
import { View } from "react-native";

import { useTheme } from "../../lib/theme";
import M3Host from "./M3Host";

// Material 3 Expressive loading indicator (morphing shapes), the M3
// replacement for an indeterminate circular spinner on short waits.
export default function Spinner({ label }: { label: string }) {
  const c = useTheme();
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      <M3Host matchContents>
        <LoadingIndicator color={c.primary} />
      </M3Host>
    </View>
  );
}
