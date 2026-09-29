import { useLocale } from "../lib/locale";
import { useSession } from "../lib/session";
import { userError } from "../lib/user-error";
import { Button, Card, Label } from "./ui";

export default function SyncStatus() {
  const s = useSession();
  const { t } = useLocale();
  if (!s.offline && !s.pending && !s.syncError) return null;
  return (
    <Card>
      <Label>
        {s.offline
          ? t(
              "Tryb offline — odpowiedzi zapisujemy na urządzeniu.",
              "You’re offline. Answers are saved on this device.",
            )
          : t(
              `Odpowiedzi do synchronizacji: ${s.pending}.`,
              `Answers waiting to sync: ${s.pending}.`,
            )}
      </Label>
      {s.syncError ? <Label>{userError(s.syncError, t)}</Label> : null}
      <Button kind="secondary" onPress={s.sync}>
        {t("Synchronizuj", "Sync Now")}
      </Button>
    </Card>
  );
}
