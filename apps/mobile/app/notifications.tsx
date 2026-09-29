import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type Href, Stack, router } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useRef, useState } from "react";
import { Platform, View } from "react-native";

import Inbox from "../src/components/notifications/Inbox";
import type { InboxItem } from "../src/components/notifications/types";
import { notify } from "../src/lib/alerts";
import { WEB_URL, api, listOf } from "../src/lib/api";
import { notificationDestination } from "../src/lib/notification-link";
import { haptics } from "../src/lib/haptics";
import { useLocale } from "../src/lib/locale";
import { useSession } from "../src/lib/session";
import { useTheme } from "../src/lib/theme";
import { userError } from "../src/lib/user-error";

export default function Notifications() {
  const { user } = useSession();
  return <AccountNotifications key={user?.id} userId={user?.id} />;
}

function AccountNotifications({ userId }: { userId?: string }) {
  const { t, language } = useLocale(),
    c = useTheme(),
    cache = useQueryClient();
  const [busy, setBusy] = useState(false),
    // Per row, so opening a second notification still marks it read.
    pending = useRef(new Set<string>());
  const key = ["notifications", userId];
  const q = useQuery({
    queryKey: key,
    enabled: !!userId,
    queryFn: async () =>
      listOf(await api.request<InboxItem[]>("notifications/")),
  });
  async function mark(read: boolean, id?: string) {
    const target = id ?? "all";
    if (pending.current.has(target) || pending.current.has("all")) return;
    pending.current.add(target);
    setBusy(true);
    // Update the row at once; the request confirms it and a failure rolls back.
    const previous = cache.getQueryData<InboxItem[]>(key);
    cache.setQueryData<InboxItem[]>(key, (items) =>
      items?.map((item) =>
        !id || item.id === id ? { ...item, is_read: read } : item,
      ),
    );
    try {
      await api.patch(
        id ? `notifications/${id}/` : "notifications/mark-all-read/",
        id ? { is_read: read } : {},
      );
      if (!id) haptics.success();
      await q.refetch();
    } catch (error) {
      cache.setQueryData(key, previous);
      notify(
        t("Nie zaktualizowano powiadomień", "Couldn’t Update Notifications"),
        userError(error, t),
      );
    } finally {
      pending.current.delete(target);
      setBusy(pending.current.size > 0);
    }
  }
  const unread = q.data?.filter((n) => !n.is_read).length ?? 0;
  const openLink = (href: string) =>
    void openBrowserAsync(href, { controlsColor: c.primary }).catch(() =>
      notify(
        t("Nie udało się otworzyć linku", "Couldn’t Open Link"),
        t("Spróbuj ponownie za chwilę.", "Please try again in a moment."),
      ),
    );
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {Platform.OS !== "web" ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="envelope.open"
            disabled={!unread || busy}
            onPress={() => void mark(true)}
          >
            {t("Oznacz wszystkie jako przeczytane", "Mark All as Read")}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
      <Inbox
        items={q.data ?? []}
        loading={q.isLoading}
        error={q.error}
        busy={busy}
        refresh={() => q.refetch()}
        retry={() => void q.refetch()}
        mark={(read, id) => void mark(read, id)}
        date={(value) =>
          value && Number.isFinite(Date.parse(value))
            ? new Date(value).toLocaleDateString(
                language === "pl" ? "pl-PL" : "en-GB",
                { month: "short", day: "numeric" },
              )
            : null
        }
        open={(item) => {
          if (!item.is_read) void mark(true, item.id);
          const destination = notificationDestination(item.link, WEB_URL);
          if (destination?.kind === "app")
            router.push(destination.href as Href);
          else if (destination?.kind === "web") openLink(destination.url);
        }}
        openLink={openLink}
      />
    </View>
  );
}
