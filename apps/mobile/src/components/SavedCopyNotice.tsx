import { Text, View } from "react-native";

import { useLocale } from "../lib/locale";
import { useTheme } from "../lib/theme";
import { Button } from "./ui";

export default function SavedCopyNotice({
  retry,
  disabled = false,
}: {
  retry: () => Promise<unknown>;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  const c = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 13, lineHeight: 19, color: c.muted }}>
        {t(
          "Zapisana kopia. Nie udało się odświeżyć quizu.",
          "Saved copy. Couldn’t refresh this quiz.",
        )}
      </Text>
      <Button
        kind="secondary"
        disabled={disabled}
        onPress={async () => {
          await retry();
        }}
      >
        {t("Sprawdź aktualizacje", "Retry Updates")}
      </Button>
    </View>
  );
}
