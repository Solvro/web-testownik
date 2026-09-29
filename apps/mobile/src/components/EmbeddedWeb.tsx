import type { EmbeddedTheme } from "../lib/embed-theme";
import { Linking } from "react-native";

import { embeddedPath } from "../lib/embed-navigation";
import { useLocale } from "../lib/locale";
import { WEB_URL } from "../lib/api";
import { Button, Label, Screen } from "./ui";

export default function EmbeddedWeb({
  global,
  quizId,
}: {
  access: string;
  global?: boolean;
  quizId?: string;
  onRetry: () => void;
  onTheme?: (theme: EmbeddedTheme) => void;
  topInset?: number;
  loadingBackground?: string;
}) {
  const { t } = useLocale();
  return (
    <Screen>
      <Label>
        {t(
          "W podglądzie przeglądarkowym otwórz raport w wersji internetowej.",
          "Open the web report when using the browser preview.",
        )}
      </Label>
      <Button
        onPress={() =>
          Linking.openURL(`${WEB_URL}${embeddedPath({ quizId, global })}`)
        }
      >
        {t("Otwórz raport", "Open Report")}
      </Button>
    </Screen>
  );
}
