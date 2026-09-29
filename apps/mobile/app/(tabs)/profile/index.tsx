import type { AIUsageSummary } from "@testownik/core/ai/usage";
import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { router } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";

import ProfileContent from "../../../src/components/profile/ProfileContent";
import { usageWindow } from "../../../src/lib/ai-usage";
import { notify, useConfirm } from "../../../src/lib/alerts";
import { WEB_URL, api } from "../../../src/lib/api";
import { useLocale } from "../../../src/lib/locale";
import { useSession } from "../../../src/lib/session";
import { userError } from "../../../src/lib/user-error";

export default function Profile() {
  const confirm = useConfirm();
  const s = useSession();
  const { t, preference, setPreference } = useLocale();
  const usage = useQuery({
    queryKey: ["ai-usage", s.user?.id],
    queryFn: () => api.request<AIUsageSummary>("ai/usage/me/?days=7"),
    enabled: !!s.user && s.user.account_type !== "guest" && !s.offline,
  });
  return (
    <ProfileContent
      name={s.user?.full_name || t("Twoje konto", "Your account")}
      photo={s.user?.photo}
      tier={s.user?.account_level ?? "basic"}
      usage={
        // Skip the card rather than crash on an unexpected response.
        usage.data?.session && usage.data.weekly
          ? {
              session: usageWindow(usage.data.session, t),
              weekly: usageWindow(usage.data.weekly, t),
              exhausted: usage.data.exhausted,
            }
          : null
      }
      language={preference}
      setLanguage={(value) =>
        void setPreference(value).catch((error: unknown) =>
          notify(
            t("Nie zmieniono języka", "Couldn’t Change Language"),
            userError(error, t),
          ),
        )
      }
      sync={{
        offline: s.offline,
        pending: s.pending,
        error: s.syncError,
        run: s.sync,
      }}
      changePhoto={() => router.push("/photo")}
      openUsage={(tab) => router.push({ pathname: "/usage", params: { tab } })}
      openSettings={() => router.push("/settings")}
      openWrapped={() => router.push("/wrapped")}
      openNotifications={() => router.push("/notifications")}
      openAccount={() => router.push("/account")}
      openFeedback={() => router.push("/feedback")}
      openLink={(url) => void openBrowserAsync(url)}
      version={Constants.expoConfig?.version ?? ""}
      webUrl={WEB_URL}
      signOut={() =>
        confirm(
          t("Wylogować się?", "Sign Out?"),
          s.pending
            ? t(
                "Odpowiedzi czekają na synchronizację. Połącz się z internetem przed wylogowaniem.",
                "Some answers are waiting to sync. Connect to the internet before signing out.",
              )
            : t(
                "Zakończysz sesję na tym urządzeniu.",
                "This will end your session on this device.",
              ),
          s.logout,
          { action: t("Wyloguj się", "Sign Out") },
        )
      }
    />
  );
}
