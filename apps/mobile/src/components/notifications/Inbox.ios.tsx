import {
  Button,
  ContentUnavailableView,
  ContextMenu,
  Host,
  HStack,
  Image,
  Label,
  List,
  Section,
  Spacer,
  SwipeActions,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  font,
  frame,
  listStyle,
  redacted,
  refreshable,
  tint,
  listRowBackground,
} from "@expo/ui/swift-ui/modifiers";

import { useLocale } from "../../lib/locale";
import {
  notificationParts,
  notificationText,
} from "../../lib/notification-text";
import { useTheme } from "../../lib/theme";
import { userError } from "../../lib/user-error";
import { Chevron, rowLabel, secondary } from "../quiz-list/QuizRow";
import type { InboxProps } from "./types";

export default function Inbox(props: InboxProps) {
  const c = useTheme();
  const { t } = useLocale();
  return (
    <Host style={{ flex: 1 }}>
      <List
        modifiers={[
          listStyle("insetGrouped"),
          refreshable(async () => {
            await props.refresh();
          }),
        ]}
      >
        {props.error ? (
          <Section>
            <Label
              title={userError(props.error, t)}
              systemImage="exclamationmark.triangle"
            />
            <Button
              label={t("Spróbuj ponownie", "Try Again")}
              onPress={props.retry}
            />
          </Section>
        ) : null}
        {props.loading ? (
          <Section>
            {[0, 1, 2].map((i) => (
              <Label
                key={i}
                title="Notification title placeholder text"
                systemImage="bell"
                modifiers={[redacted("placeholder")]}
              />
            ))}
          </Section>
        ) : null}
        {!props.loading && !props.error && !props.items.length ? (
          <Section>
            <ContentUnavailableView
              modifiers={[listRowBackground("transparent")]}
              title={t("Nie masz jeszcze powiadomień", "No Notifications")}
              systemImage="bell.slash"
              description={t(
                "Tutaj pojawią się informacje o udostępnionych quizach i aktywności na Twoim koncie.",
                "Updates about shared quizzes and activity on your account appear here.",
              )}
            />
          </Section>
        ) : null}
        {props.items.length ? (
          <Section>
            {props.items.map((item) => {
              const body = notificationText(item.content);
              const links = notificationParts(item.content).filter(
                (part) => part.href,
              );
              const date = props.date(item.created_at);
              const toggle = () => props.mark(!item.is_read, item.id);
              return (
                <SwipeActions key={item.id}>
                  <ContextMenu>
                    <ContextMenu.Trigger>
                      <Button
                        onPress={() => props.open(item)}
                        modifiers={[
                          rowLabel,
                          accessibilityLabel(
                            [
                              item.is_read
                                ? null
                                : t("Nieprzeczytane", "Unread"),
                              item.title,
                              date,
                              body,
                            ]
                              .filter(Boolean)
                              .join(". "),
                          ),
                        ]}
                      >
                        <HStack alignment="top" spacing={10}>
                          <Image
                            systemName="circle.fill"
                            size={9}
                            color={item.is_read ? "transparent" : c.primary}
                            modifiers={[frame({ width: 10, height: 20 })]}
                          />
                          <VStack alignment="leading" spacing={3}>
                            <HStack>
                              <Text
                                modifiers={[
                                  font({
                                    textStyle: "body",
                                    weight: item.is_read
                                      ? "regular"
                                      : "semibold",
                                  }),
                                ]}
                              >
                                {item.title}
                              </Text>
                              <Spacer />
                              {date ? (
                                <Text
                                  modifiers={[
                                    font({ textStyle: "footnote" }),
                                    secondary,
                                  ]}
                                >
                                  {date}
                                </Text>
                              ) : null}
                            </HStack>
                            <Text
                              modifiers={[
                                font({ textStyle: "subheadline" }),
                                secondary,
                              ]}
                            >
                              {body}
                            </Text>
                          </VStack>
                          {item.link ? <Chevron /> : null}
                        </HStack>
                      </Button>
                    </ContextMenu.Trigger>
                    <ContextMenu.Items>
                      <Button
                        label={
                          item.is_read
                            ? t("Oznacz jako nieprzeczytane", "Mark as Unread")
                            : t("Oznacz jako przeczytane", "Mark as Read")
                        }
                        systemImage={
                          item.is_read ? "envelope.badge" : "envelope.open"
                        }
                        onPress={toggle}
                      />
                      {links.map((link) => (
                        <Button
                          key={link.href}
                          label={t("Otwórz link", "Open Link")}
                          systemImage="safari"
                          onPress={() => props.openLink(link.href!)}
                        />
                      ))}
                    </ContextMenu.Items>
                  </ContextMenu>
                  <SwipeActions.Actions edge="trailing">
                    <Button
                      label={
                        item.is_read
                          ? t("Nieprzeczytane", "Unread")
                          : t("Przeczytane", "Read")
                      }
                      systemImage={
                        item.is_read ? "envelope.badge" : "envelope.open"
                      }
                      modifiers={[tint(c.primary)]}
                      onPress={toggle}
                    />
                  </SwipeActions.Actions>
                </SwipeActions>
              );
            })}
          </Section>
        ) : null}
      </List>
    </Host>
  );
}
