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
import { tokenStore } from "../src/lib/storage";
import { useTheme } from "../src/lib/theme";
import { userError } from "../src/lib/user-error";

export default function Notifications() {
  const { user } = useSession();
  return <AccountNotifications key={user?.id} userId={user?.id} />;
}

function AccountNotifications({ userId }: { userId?: string }) {
  const [session] = useState(() => tokenStore.session());
  const [client] = useState(() => api.forSession(session));
  const { t, language } = useLocale(),
    c = useTheme(),
    cache = useQueryClient();
  const [busy, setBusy] = useState(false),
    // Per row, so opening a second notification still marks it read.
    pending = useRef(new Set<string>());
  // Preserve every acknowledged row in a concurrent batch if a focus GET
  // lands between writes. The next authoritative refresh reconciles the batch.
  const acknowledged = useRef(new Map<string, boolean>());
  const key = ["notifications", userId];
  const q = useQuery({
    queryKey: key,
    enabled: !!userId,
    networkMode: "always",
    queryFn: async ({ signal }) =>
      listOf(await client.request<InboxItem[]>("notifications/", { signal })),
  });
  async function mark(read: boolean, id?: string, quiet = false) {
    const target = id ?? "all";
    if (
      pending.current.has(target) ||
      pending.current.has("all") ||
      (!id && pending.current.size)
    )
      return;
    if (!pending.current.size) acknowledged.current.clear();
    // A newer toggle supersedes this row's earlier ACK within the same batch.
    acknowledged.current.delete(target);
    pending.current.add(target);
    setBusy(true);
    let previous: InboxItem[] | undefined;
    try {
      // A previous refresh must not overwrite this optimistic read state.
      await cache.cancelQueries({ queryKey: key });
      if (session.aborted) return;
      previous = cache.getQueryData<InboxItem[]>(key);
      cache.setQueryData<InboxItem[]>(key, (items) =>
        items?.map((item) =>
          !id || item.id === id ? { ...item, is_read: read } : item,
        ),
      );
      await client.patch(
        id ? `notifications/${id}/` : "notifications/mark-all-read/",
        id ? { is_read: read } : {},
      );
      await cache.cancelQueries({ queryKey: key, exact: true });
      if (session.aborted) return;
      acknowledged.current.set(target, read);
      cache.setQueryData<InboxItem[]>(key, (items) =>
        items?.map((item) => {
          const saved =
            acknowledged.current.get(item.id) ??
            acknowledged.current.get("all");
          return saved === undefined ? item : { ...item, is_read: saved };
        }),
      );
      if (!id) haptics.success();
    } catch (error) {
      if (session.aborted) return;
      await cache.cancelQueries({ queryKey: key, exact: true });
      if (session.aborted) return;
      // Roll back this operation only. Another notification may have succeeded
      // while a read request initiated by opening this row was still pending.
      cache.setQueryData<InboxItem[]>(key, (items) =>
        items?.map((item) =>
          acknowledged.current.has(item.id) || acknowledged.current.has("all")
            ? {
                ...item,
                is_read:
                  acknowledged.current.get(item.id) ??
                  acknowledged.current.get("all")!,
              }
            : !id || item.id === id
              ? (previous?.find((saved) => saved.id === item.id) ?? item)
              : item,
        ),
      );
      if (!quiet)
        notify(
          t("Nie zaktualizowano powiadomień", "Couldn’t Update Notifications"),
          userError(error, t),
        );
    } finally {
      pending.current.delete(target);
      setBusy(pending.current.size > 0);
      // Confirmation runs in the background; a slow GET must not lock row actions.
      if (!session.aborted && !pending.current.size) void q.refetch();
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
          // Marking read is incidental to opening; failure must not interrupt
          // the destination screen. The unread row is restored on return.
          if (!item.is_read) void mark(true, item.id, true);
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
