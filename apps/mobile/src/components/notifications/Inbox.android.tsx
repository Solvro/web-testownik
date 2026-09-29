import { Text as ComposeText, TextButton } from "@expo/ui/jetpack-compose";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { useLocale } from "../../lib/locale";
import { usePullRefresh } from "../../lib/use-pull-refresh";
import { useTheme } from "../../lib/theme";
import { segmentRadius } from "../Collection.android";
import NotificationBody from "../NotificationBody";
import Overflow from "../Overflow";
import { ListEmpty, ListError } from "../native/ListStatus.android";
import M3Host from "../native/M3Host";
import { ErrorState, Loading } from "../ui";
import type { InboxProps } from "./types";

// Material 3 inbox: one list segment per notification, an unread dot, a
// trailing overflow menu for read state and a text button to mark all read.
export default function Inbox(props: InboxProps) {
  const { t } = useLocale();
  const c = useTheme();
  const pull = usePullRefresh(props.refresh);
  if (props.loading) return <Loading />;
  const unread = props.items.filter((n) => !n.is_read).length;
  return (
    <FlatList
      data={props.items}
      keyExtractor={(item) => item.id}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: 32,
        maxWidth: 760,
        width: "100%",
        alignSelf: "center",
        gap: 2,
        flexGrow: 1,
      }}
      refreshControl={
        <RefreshControl
          {...pull}
          colors={[c.primary]}
          progressBackgroundColor={c.surface}
        />
      }
      ListHeaderComponent={
        <View style={{ gap: 8, paddingBottom: 8 }}>
          {props.error && props.items.length ? (
            <ErrorState error={props.error} retry={props.retry} />
          ) : null}
          {props.items.length ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                minHeight: 48,
                paddingLeft: 16,
              }}
            >
              <Text
                style={{
                  flex: 1,
                  color: c.primary,
                  fontSize: 14,
                  fontWeight: "500",
                }}
              >
                {unread
                  ? t(`Nieprzeczytane: ${unread}`, `Unread: ${unread}`)
                  : t("Wszystko przeczytane", "All caught up")}
              </Text>
              {unread > 0 ? (
                <M3Host matchContents>
                  <TextButton
                    enabled={!props.busy}
                    onClick={() => props.mark(true)}
                  >
                    <ComposeText>
                      {t(
                        "Oznacz wszystkie jako przeczytane",
                        "Mark All as Read",
                      )}
                    </ComposeText>
                  </TextButton>
                </M3Host>
              ) : null}
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        props.error ? (
          <ListError error={props.error} retry={props.retry} />
        ) : (
          <ListEmpty
            ionicon="notifications-outline"
            title={t("Nie masz jeszcze powiadomień", "No Notifications Yet")}
            description={t(
              "Tutaj pojawią się informacje o udostępnionych quizach i aktywności na Twoim koncie.",
              "Updates about shared quizzes and activity on your account appear here.",
            )}
          />
        )
      }
      renderItem={({ item, index }) => (
        <View
          style={{
            ...segmentRadius(index, props.items.length),
            overflow: "hidden",
            backgroundColor: item.is_read ? c.surface : c.tint,
          }}
        >
          <Pressable
            accessibilityRole={item.link ? "button" : undefined}
            disabled={!item.link}
            android_ripple={{ color: c.fill }}
            onPress={() => props.open(item)}
            style={{
              flexDirection: "row",
              gap: 12,
              paddingLeft: 16,
              paddingVertical: 12,
            }}
          >
            <View style={{ width: 8, paddingTop: 8 }}>
              {!item.is_read ? (
                <View
                  accessibilityLabel={t("Nieprzeczytane", "Unread")}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: c.primary,
                  }}
                />
              ) : null}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Text
                  accessibilityRole="header"
                  style={{
                    flex: 1,
                    fontSize: 16,
                    lineHeight: 24,
                    fontWeight: item.is_read ? "400" : "600",
                    color: c.text,
                  }}
                >
                  {item.title}
                </Text>
                <Text style={{ color: c.muted, fontSize: 12 }}>
                  {props.date(item.created_at)}
                </Text>
              </View>
              <NotificationBody content={item.content} />
            </View>
            <Overflow
              label={t("Opcje powiadomienia", "Notification options")}
              items={[
                ...(item.link
                  ? [
                      {
                        title: t("Otwórz", "Open"),
                        onPress: () => props.open(item),
                      },
                    ]
                  : []),
                {
                  title: item.is_read
                    ? t("Oznacz jako nieprzeczytane", "Mark as Unread")
                    : t("Oznacz jako przeczytane", "Mark as Read"),
                  disabled: props.busy,
                  onPress: () => props.mark(!item.is_read, item.id),
                },
              ]}
            />
          </Pressable>
        </View>
      )}
    />
  );
}
