import type { AuthorizedApp, UserData } from "@testownik/core/user/types";
import { useQuery } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useRef, useState } from "react";

import AccountContent from "../src/components/account/AccountContent";
import { notify, useConfirm } from "../src/lib/alerts";
import { WEB_URL, api } from "../src/lib/api";
import { useLocale } from "../src/lib/locale";
import { OAUTH_CLIENT_ID } from "../src/lib/oauth-config";
import { permissionDescriptions } from "../src/lib/oauth-permissions";
import { useSession } from "../src/lib/session";
import { useTheme } from "../src/lib/theme";

export default function Account() {
  const { t } = useLocale();
  const c = useTheme();
  const confirm = useConfirm();
  const saving = useRef(false);
  const s = useSession(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const apps = useQuery({
    queryKey: ["authorized-apps", s.user?.id],
    queryFn: () => api.request<AuthorizedApp[]>("oauth/authorized-apps/"),
  });
  if (s.ready && !s.user) return <Redirect href="/login" />;
  return (
    <AccountContent
      name={
        s.user?.full_name || s.user?.email || t("Konto gościa", "Guest account")
      }
      email={s.user?.email}
      hideProfile={s.user?.hide_profile ?? false}
      busy={busy}
      setHideProfile={(hide_profile) => {
        if (saving.current) return;
        saving.current = true;
        setBusy(true);
        setError(null);
        void api
          .patch<UserData>("user/", { hide_profile })
          // Saved; refreshing local state is best effort and not a save failure.
          .then((user) => s.reload(user).catch(() => undefined), setError)
          .finally(() => {
            saving.current = false;
            setBusy(false);
          });
      }}
      privacyError={error}
      apps={apps.data?.map((app) => ({
        id: app.client_id,
        name: app.client_name,
        permissions: permissionDescriptions(app.scopes, t),
        current: app.client_id === OAUTH_CLIENT_ID,
      }))}
      appsLoading={apps.isPending}
      appsError={apps.error}
      retryApps={() => void apps.refetch()}
      disconnect={(app) =>
        confirm(
          t("Odłączyć aplikację?", "Disconnect This App?"),
          t(
            `${app.name} straci dostęp do Twojego konta.`,
            `${app.name} will lose access to your account.`,
          ),
          async () => {
            await api.delete(
              `oauth/authorized-apps/${encodeURIComponent(app.id)}/`,
            );
            await apps.refetch();
          },
          { action: t("Odłącz", "Disconnect") },
        )
      }
      explainCurrentApp={() =>
        notify(
          t("To jest ta aplikacja", "This Is the App You’re Using"),
          t(
            "Nie można odłączyć aplikacji, której właśnie używasz. Aby zakończyć jej dostęp, wyloguj się w profilu.",
            "You can’t disconnect the app you’re using right now. To end its access, sign out from your profile.",
          ),
        )
      }
      deleteAccount={
        s.user?.account_type === "guest"
          ? undefined
          : () => router.push("/delete-account")
      }
      openPrivacyPolicy={() =>
        void openBrowserAsync(`${WEB_URL}/privacy-policy`, {
          controlsColor: c.primary,
        })
      }
    />
  );
}
