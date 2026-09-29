import { fill, rowLabel, secondary } from "../quiz-list/QuizRow";
import {
  Button,
  HStack,
  Host,
  Image,
  Label,
  LabeledContent,
  List,
  ProgressView,
  Section,
  SwipeActions,
  Text,
  Toggle,
  VStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityValue,
  Animation,
  animation,
  disabled,
  font,
  foregroundStyle,
  listStyle,
  rotationEffect,
  tint,
} from "@expo/ui/swift-ui/modifiers";

import { Fragment, useState } from "react";

import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import { userError } from "../../lib/user-error";
import type { Translate } from "../../lib/user-error";
import { NavRow, tile } from "../settings/SettingsRows";
import type { AccountContentProps } from "./types";

export default function AccountContent(props: AccountContentProps) {
  const c = useTheme();
  const { t } = useLocale();
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <Host style={{ flex: 1 }}>
      <List
        modifiers={[
          listStyle("insetGrouped"),
          // Permission rows slide in and out with the chevron.
          animation(
            Animation.easeOut({ duration: 0.25 }),
            (props.apps?.findIndex((app) => app.id === expanded) ?? -1) + 1,
          ),
        ]}
      >
        <Section
          title={t("Twoje dane", "Your Information")}
          footer={
            <Text>
              {props.privacyError
                ? `${t("Nie zapisano zmiany", "The change was not saved")}: ${userError(props.privacyError, t)}`
                : t(
                    "Ukryty profil nie pojawia się innym osobom w wyszukiwaniu i przy udostępnianiu.",
                    "A hidden profile doesn’t appear to other people in search or when sharing.",
                  )}
            </Text>
          }
        >
          <LabeledContent label={t("Imię i nazwisko", "Name")}>
            <Text modifiers={[secondary]}>{props.name}</Text>
          </LabeledContent>
          {props.email ? (
            <LabeledContent label={t("E-mail", "Email")}>
              <Text modifiers={[secondary]}>{props.email}</Text>
            </LabeledContent>
          ) : null}
          <Toggle
            label={t("Ukryj profil", "Hide Profile")}
            isOn={props.hideProfile}
            onIsOnChange={props.setHideProfile}
            modifiers={[disabled(props.busy)]}
          />
        </Section>

        <Section
          title={t("Połączone aplikacje", "Connected Apps")}
          footer={
            <Text>
              {t(
                "Aplikacje z dostępem do Twojego konta Testownika. Dotknij, aby zobaczyć uprawnienia, lub przesuń w lewo, aby odłączyć. Aplikacji, której używasz, nie można odłączyć — wyloguj się.",
                "Apps with access to your Testownik account. Tap to see permissions or swipe left to disconnect. To remove this app, sign out instead.",
              )}
            </Text>
          }
        >
          {props.appsLoading ? <ProgressView /> : null}
          {props.appsError ? (
            <>
              <Label
                title={userError(props.appsError, t)}
                systemImage="exclamationmark.triangle"
              />
              <Button
                label={t("Spróbuj ponownie", "Try Again")}
                onPress={props.retryApps}
              />
            </>
          ) : null}
          {props.apps?.length === 0 ? (
            <Text modifiers={[secondary]}>
              {t(
                "Żadna dodatkowa aplikacja nie ma dostępu do Twojego konta.",
                "No other apps have access to your account.",
              )}
            </Text>
          ) : null}
          {props.apps?.map((app) => {
            const open = expanded === app.id;
            return (
              <Fragment key={app.id}>
                <SwipeActions>
                  <Button
                    onPress={() => setExpanded(open ? null : app.id)}
                    modifiers={[
                      rowLabel,
                      accessibilityValue(
                        open
                          ? t("Rozwinięte", "Expanded")
                          : t("Zwinięte", "Collapsed"),
                      ),
                    ]}
                  >
                    <HStack spacing={12}>
                      <VStack
                        alignment="leading"
                        spacing={2}
                        modifiers={[fill]}
                      >
                        <Text>{app.name}</Text>
                        <Text
                          modifiers={[
                            font({ textStyle: "footnote" }),
                            secondary,
                          ]}
                        >
                          {app.current
                            ? t("Używasz jej teraz", "You’re using this app")
                            : permissionCount(app.permissions.length, t)}
                        </Text>
                      </VStack>
                      <Image
                        systemName="chevron.right"
                        size={13}
                        modifiers={[
                          foregroundStyle({
                            type: "hierarchical",
                            style: "tertiary",
                          }),
                          rotationEffect(open ? 90 : 0),
                          animation(
                            Animation.easeOut({ duration: 0.25 }),
                            open,
                          ),
                        ]}
                      />
                    </HStack>
                  </Button>
                  <SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
                    {app.current ? (
                      <Button
                        label={t("W użyciu", "In Use")}
                        modifiers={[tint(c.muted)]}
                        onPress={props.explainCurrentApp}
                      />
                    ) : (
                      <Button
                        label={t("Odłącz", "Disconnect")}
                        // Not role="destructive": that removes the row before
                        // the confirmation, and it stays gone if cancelled.
                        modifiers={[tint(c.destructive)]}
                        onPress={() => props.disconnect(app)}
                      />
                    )}
                  </SwipeActions.Actions>
                </SwipeActions>
                {open
                  ? app.permissions.map((permission) => (
                      <Label
                        key={permission}
                        title={permission}
                        systemImage="checkmark.shield"
                        modifiers={[
                          font({ textStyle: "subheadline" }),
                          secondary,
                        ]}
                      />
                    ))
                  : null}
                {open && !app.current ? (
                  <Button
                    label={t("Odłącz aplikację", "Disconnect App")}
                    role="destructive"
                    onPress={() => props.disconnect(app)}
                  />
                ) : null}
              </Fragment>
            );
          })}
        </Section>

        <Section>
          <NavRow
            symbol="hand.raised.fill"
            color={tile.blue}
            title={t("Polityka prywatności", "Privacy Policy")}
            onPress={props.openPrivacyPolicy}
          />
        </Section>

        {props.deleteAccount ? (
          <Section
            footer={
              <Text>
                {t(
                  "Usuwa konto i dane na zawsze. Quizy możesz wcześniej przekazać innej osobie.",
                  "Permanently deletes your account and data. You can transfer your quizzes to someone first.",
                )}
              </Text>
            }
          >
            <Button role="destructive" onPress={props.deleteAccount}>
              <Text
                modifiers={[
                  foregroundStyle({ type: "color", color: c.destructive }),
                ]}
              >
                {t("Usuń konto", "Delete Account")}
              </Text>
            </Button>
          </Section>
        ) : null}
      </List>
    </Host>
  );
}

const permissionCount = (n: number, t: Translate) =>
  t(`Uprawnienia: ${n}`, `${n} ${n === 1 ? "permission" : "permissions"}`);
