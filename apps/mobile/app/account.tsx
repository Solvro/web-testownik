import type { AuthorizedApp, UserData } from "@testownik/core/user/types";
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useEffect, useRef, useState } from "react";

import AccountContent from "../src/components/account/AccountContent";
import { notify, useConfirm } from "../src/lib/alerts";
import { WEB_URL, api } from "../src/lib/api";
import { useLocale } from "../src/lib/locale";
import { OAUTH_CLIENT_ID } from "../src/lib/oauth-config";
import { permissionDescriptions } from "../src/lib/oauth-permissions";
import { useSession } from "../src/lib/session";
import { useTheme } from "../src/lib/theme";
import { tokenStore } from "../src/lib/storage";
import { userError } from "../src/lib/user-error";

export default function Account() {
  const [client] = useState(() => api.forSession());
  const { t } = useLocale();
  const c = useTheme();
  const confirm = useConfirm();
  const cache = useQueryClient();
  const mounted = useRef(true);
  const [session] = useState(() => tokenStore.session());
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const s = useSession();
  const [error, setError] = useState<unknown>(null);
  const mutationKey = ["profile-privacy", s.user?.id];
  // Keep the existing busy-until-ACK contract even after leaving and reopening.
  const busy = useIsMutating({ mutationKey }) > 0;
  const privacy = useMutation({
    mutationKey,
    networkMode: "always",
    mutationFn: (hide_profile: boolean) =>
      client.patch<UserData>("user/", { hide_profile }),
    onSuccess: (user) => {
      if (session.aborted) return;
      // Reload enforces account/session safety; local caching cannot undo the ACK.
      return s.reload(user);
    },
    onError: (error: unknown) => {
      if (session.aborted) return;
      if (mounted.current) setError(error);
      else
        notify(
          t("Nie zapisano zmiany", "Change Not Saved"),
          userError(error, t),
        );
    },
  });
  const apps = useQuery({
    queryKey: ["authorized-apps", s.user?.id],
    networkMode: "always",
    queryFn: ({ signal }) =>
      client.request<AuthorizedApp[]>("oauth/authorized-apps/", { signal }),
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
        if (cache.isMutating({ mutationKey })) return;
        setError(null);
        privacy.mutate(hide_profile);
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
            try {
              await client.delete(
                `oauth/authorized-apps/${encodeURIComponent(app.id)}/`,
              );
              if (session.aborted) return;
              const queryKey = ["authorized-apps", s.user?.id];
              await cache.cancelQueries({ queryKey, exact: true });
              if (session.aborted) return;
              cache.setQueryData<AuthorizedApp[]>(queryKey, (items) =>
                items?.filter((item) => item.client_id !== app.id),
              );
              void cache.invalidateQueries({ queryKey, exact: true });
            } catch (error) {
              if (session.aborted) return;
              throw error;
            }
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
        }).catch(() =>
          notify(
            t("Nie udało się otworzyć linku", "Couldn’t Open Link"),
            t("Spróbuj ponownie za chwilę.", "Please try again in a moment."),
          ),
        )
      }
    />
  );
}
