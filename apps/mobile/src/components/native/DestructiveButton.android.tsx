import { Button, Text, useMaterialColors } from "@expo/ui/jetpack-compose";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";
import { useColorScheme } from "react-native";

import { BRAND_SEED } from "../../lib/brand";
import type { DestructiveButtonProps } from "./DestructiveButton";
import M3Host from "./M3Host";

// Material 3 filled button in the error / on-error roles.
export default function DestructiveButton({
  children,
  onPress,
  disabled,
}: DestructiveButtonProps) {
  const m = useMaterialColors({
    seedColor: BRAND_SEED,
    colorScheme: useColorScheme() === "dark" ? "dark" : "light",
  });
  return (
    <M3Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <Button
        key={String(Boolean(disabled))}
        enabled={!disabled}
        onClick={() => void onPress()}
        colors={{ containerColor: m.error, contentColor: m.onError }}
        modifiers={[fillMaxWidth()]}
      >
        <Text>{children}</Text>
      </Button>
    </M3Host>
  );
}
