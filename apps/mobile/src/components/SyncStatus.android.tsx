import { Column, Icon, Row, Text, TextButton } from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  padding,
  paddingAll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";
import { View } from "react-native";

import { useLocale } from "../lib/locale";
import { useSession } from "../lib/session";
import { useTheme } from "../lib/theme";
import { userError } from "../lib/user-error";
import M3Host from "./native/M3Host";
import { symbol } from "./native/materialIcons.android";

// Material 3 banner-style status: an icon, what is going on, and a text
// button only when there is something to retry. Answers sync by themselves
// when the connection comes back, so being offline needs no button.
export default function SyncStatus() {
  const s = useSession();
  const c = useTheme();
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  if (!s.offline && !s.pending && !s.syncError) return null;
  const failed = !s.offline && !!s.syncError;
  const message = s.offline
    ? s.pending
      ? t(
          `Tryb offline. Odpowiedzi do synchronizacji: ${s.pending}. Wyślemy je po odzyskaniu połączenia.`,
          `You’re offline. ${s.pending} ${s.pending === 1 ? "answer" : "answers"} will sync when you’re back online.`,
        )
      : t(
          "Tryb offline — odpowiedzi zapisujemy na urządzeniu.",
          "You’re offline. Answers are saved on this device.",
        )
    : t(
        `Odpowiedzi do synchronizacji: ${s.pending}.`,
        `Answers waiting to sync: ${s.pending}.`,
      );
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        marginTop: 8,
        borderRadius: 20,
        overflow: "hidden",
        backgroundColor: c.surface,
      }}
    >
      <M3Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
        <Row
          verticalAlignment="top"
          horizontalArrangement={{ spacedBy: 16 }}
          modifiers={[fillMaxWidth(), paddingAll(16)]}
        >
          <Icon
            source={symbol(
              s.offline ? "cloudOff" : failed ? "cloudAlert" : "sync",
            )}
            tint={failed ? c.danger : c.muted}
            size={24}
          />
          <Column verticalArrangement={{ spacedBy: 4 }} modifiers={[weight(1)]}>
            <Text color={c.text} style={{ typography: "bodyMedium" }}>
              {message}
            </Text>
            {failed ? (
              <Text color={c.muted} style={{ typography: "bodySmall" }}>
                {userError(s.syncError, t)}
              </Text>
            ) : null}
            {!s.offline && (s.pending || s.syncError) ? (
              <TextButton
                enabled={!busy}
                onClick={() => {
                  setBusy(true);
                  void s.sync().finally(() => setBusy(false));
                }}
                modifiers={[padding(0, 4, 0, 0)]}
              >
                <Text>
                  {busy
                    ? t("Synchronizowanie…", "Syncing…")
                    : failed
                      ? t("Spróbuj ponownie", "Try Again")
                      : t("Synchronizuj", "Sync Now")}
                </Text>
              </TextButton>
            ) : null}
          </Column>
        </Row>
      </M3Host>
    </View>
  );
}
