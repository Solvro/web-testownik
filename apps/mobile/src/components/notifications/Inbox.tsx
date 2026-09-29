import { FlatList, Platform, Text, View } from "react-native";

import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import NotificationBody from "../NotificationBody";
import { Button, ErrorState, Label, Loading } from "../ui";
import type { InboxProps } from "./types";

// Browser preview and Android. iOS renders a native SwiftUI list instead.
export default function Inbox(props: InboxProps) {
  const { t } = useLocale();
  const c = useTheme();
  if (props.loading) return <Loading />;
  const unread = props.items.filter((n) => !n.is_read).length;
  return (
    <FlatList
      data={props.items}
      keyExtractor={(item) => item.id}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: 20,
        paddingBottom: 40,
        maxWidth: 760,
        width: "100%",
        alignSelf: "center",
        gap: 12,
      }}
      refreshing={false}
      onRefresh={() => void props.refresh()}
      ListHeaderComponent={
        <View style={{ gap: 8 }}>
          {props.error ? (
            <ErrorState error={props.error} retry={props.retry} />
          ) : null}
          {props.items.length ? (
            <Label muted>
              {unread
                ? t(`Nieprzeczytane: ${unread}`, `Unread: ${unread}`)
                : t("Wszystko przeczytane", "All caught up")}
            </Label>
          ) : null}
          {/* Android drops the SF-symbol toolbar button, so it needs this too. */}
          {Platform.OS !== "ios" && unread > 0 ? (
            <Button
              kind="secondary"
              disabled={props.busy}
              onPress={() => props.mark(true)}
            >
              {t("Oznacz wszystkie jako przeczytane", "Mark All as Read")}
            </Button>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        !props.error ? (
          <View style={{ paddingVertical: 24, gap: 8 }}>
            <Text
              accessibilityRole="header"
              style={{ fontSize: 21, fontWeight: "600", color: c.text }}
            >
              {t("Nie masz jeszcze powiadomień", "No Notifications Yet")}
            </Text>
            <Label muted>
              {t(
                "Tutaj pojawią się informacje o udostępnionych quizach i aktywności na Twoim koncie.",
                "Updates about shared quizzes and activity on your account appear here.",
              )}
            </Label>
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <View
          style={{
            backgroundColor: c.surface,
            borderRadius: 14,
            padding: 16,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {!item.is_read && (
              <View
                accessibilityLabel={t("Nieprzeczytane", "Unread")}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: c.primary,
                }}
              />
            )}
            <Text
              accessibilityRole="header"
              style={{
                flex: 1,
                fontSize: 17,
                fontWeight: item.is_read ? "500" : "700",
                color: c.text,
              }}
            >
              {item.title}
            </Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>
              {props.date(item.created_at)}
            </Text>
          </View>
          <NotificationBody content={item.content} />
          {item.link ? (
            <Button onPress={() => props.open(item)}>
              {t("Otwórz", "Open")}
            </Button>
          ) : null}
          <Button
            kind="secondary"
            disabled={props.busy}
            onPress={() => props.mark(!item.is_read, item.id)}
          >
            {item.is_read
              ? t("Oznacz jako nieprzeczytane", "Mark as Unread")
              : t("Oznacz jako przeczytane", "Mark as Read")}
          </Button>
        </View>
      )}
    />
  );
}
