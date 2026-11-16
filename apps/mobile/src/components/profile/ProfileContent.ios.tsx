import { fill, Chevron, rowLabel, secondary } from "../quiz-list/QuizRow";
import {
  Button,
  Host,
  HStack,
  Label,
  List,
  ProgressView,
  RNHostView,
  Section,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  font,
  foregroundStyle,
  listStyle,
  monospacedDigit,
  padding,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { Image, Text as NativeText, View } from "react-native";

import { usageWindowLabels } from "../../lib/ai-usage";
import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import { userError } from "../../lib/user-error";
import { NavRow, tile } from "../settings/SettingsRows";
import SolvroLogo from "../SolvroLogo";
import type { ProfileContentProps } from "./types";

function Avatar({
  name,
  photo,
  ring,
}: {
  name: string;
  photo?: string | null;
  ring: string;
}) {
  const c = useTheme();
  return (
    <View
      style={{
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 2,
        borderColor: ring,
        backgroundColor: c.tint,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={{ width: 60, height: 60, borderRadius: 30 }}
        />
      ) : (
        <NativeText style={{ fontSize: 26, color: c.primary }}>
          {name[0] ?? "T"}
        </NativeText>
      )}
    </View>
  );
}

export default function ProfileContent(props: ProfileContentProps) {
  const c = useTheme();
  const { t } = useLocale();
  const ring =
    props.tier === "gold"
      ? c.gold
      : props.tier === "silver"
        ? c.muted
        : c.primary;
  const tierName = `Testownik ${props.tier[0].toUpperCase()}${props.tier.slice(1)}`;
  return (
    <Host style={{ flex: 1 }}>
      <List modifiers={[listStyle("insetGrouped")]}>
        <Section>
          <Button
            onPress={props.changePhoto}
            modifiers={[
              rowLabel,
              accessibilityLabel(
                `${props.name}, ${tierName}. ${t("Zmień zdjęcie", "Change Photo")}`,
              ),
            ]}
          >
            <HStack spacing={16} modifiers={[padding({ vertical: 6 })]}>
              <RNHostView matchContents>
                <Avatar name={props.name} photo={props.photo} ring={ring} />
              </RNHostView>
              <VStack alignment="leading" spacing={3} modifiers={[fill]}>
                <Text
                  modifiers={[
                    font({ textStyle: "title3", weight: "semibold" }),
                  ]}
                >
                  {props.name}
                </Text>
                <Text
                  modifiers={[
                    font({ textStyle: "subheadline", weight: "medium" }),
                    foregroundStyle({ type: "color", color: ring }),
                  ]}
                >
                  {tierName}
                </Text>
                <Text modifiers={[font({ textStyle: "footnote" }), secondary]}>
                  {t("Zmień zdjęcie", "Change Photo")}
                </Text>
              </VStack>
              <Chevron />
            </HStack>
          </Button>
        </Section>

        {props.sync.offline || props.sync.pending || props.sync.error ? (
          <Section
            footer={
              props.sync.error ? (
                <Text>{userError(props.sync.error, t)}</Text>
              ) : undefined
            }
          >
            <Label
              title={
                props.sync.offline
                  ? t(
                      "Jesteś offline. Odpowiedzi zapisujemy na urządzeniu.",
                      "You’re offline. Answers are saved on this device.",
                    )
                  : t(
                      `Odpowiedzi czekające na synchronizację: ${props.sync.pending}`,
                      `Answers waiting to sync: ${props.sync.pending}`,
                    )
              }
              systemImage={
                props.sync.offline
                  ? "wifi.slash"
                  : "arrow.triangle.2.circlepath"
              }
            />
            {props.sync.offline ? null : (
              <Button
                label={t("Synchronizuj teraz", "Sync Now")}
                onPress={props.sync.run}
              />
            )}
          </Section>
        ) : null}

        <Section title={t("Nauka", "Study")}>
          <NavRow
            symbol="slider.horizontal.3"
            color={tile.blue}
            title={t("Ustawienia nauki", "Study Settings")}
            detail={t("Powtórki i asystent AI", "Repetition and AI assistant")}
            onPress={props.openSettings}
          />
          <NavRow
            symbol="sparkles"
            color={tile.purple}
            title="Wrapped"
            detail={t(
              "Twój semestr w Testowniku",
              "Your semester in Testownik",
            )}
            onPress={props.openWrapped}
          />
        </Section>

        {props.usageError ? (
          <Section title={t("Wykorzystanie AI", "AI Usage")}>
            <Text>{userError(props.usageError, t)}</Text>
            <Button
              label={t("Spróbuj ponownie", "Try Again")}
              onPress={props.retryUsage}
            />
          </Section>
        ) : props.usageLoading ? (
          <Section title={t("Wykorzystanie AI", "AI Usage")}>
            <ProgressView />
          </Section>
        ) : null}
        {props.usage ? (
          <Section
            title={t("Wykorzystanie AI", "AI Usage")}
            footer={
              <Text>
                {props.usage.exhausted
                  ? t(
                      "Limit został wykorzystany. Asystent wróci po odnowieniu.",
                      "You’ve reached your limit. The assistant is back after it renews.",
                    )
                  : t(
                      "Podpowiedzi, wyjaśnienia i asystent korzystają z tego samego limitu.",
                      "Hints, explanations and the assistant share this allowance.",
                    )}
              </Text>
            }
          >
            {(
              [
                ["session", usageWindowLabels(t).session, props.usage.session],
                ["week", usageWindowLabels(t).weekly, props.usage.weekly],
              ] as const
            ).map(([key, label, window]) => (
              <Button
                key={key}
                onPress={() => props.openUsage(key)}
                modifiers={[rowLabel]}
              >
                <VStack alignment="leading" spacing={6}>
                  <HStack>
                    <Text>{label}</Text>
                    <Spacer />
                    <Text modifiers={[secondary, monospacedDigit()]}>
                      {window.unlimited
                        ? t("Bez limitu", "No Limit")
                        : `${Math.round(window.fraction * 100)}%`}
                    </Text>
                    <Chevron />
                  </HStack>
                  {window.unlimited ? null : (
                    <ProgressView
                      value={window.fraction}
                      modifiers={[
                        tint(
                          window.fraction >= 0.9 ? c.destructive : c.primary,
                        ),
                      ]}
                    />
                  )}
                  {window.resets && !window.unlimited ? (
                    <Text
                      modifiers={[font({ textStyle: "footnote" }), secondary]}
                    >
                      {window.resets}
                    </Text>
                  ) : null}
                </VStack>
              </Button>
            ))}
          </Section>
        ) : null}

        <Section title={t("Konto i pomoc", "Account & Support")}>
          <NavRow
            symbol="person.crop.circle"
            color={tile.gray}
            title={t("Konto i prywatność", "Account & Privacy")}
            onPress={props.openAccount}
          />
          <NavRow
            symbol="bell.badge"
            color={tile.red}
            title={t("Powiadomienia", "Notifications")}
            onPress={props.openNotifications}
          />
          <NavRow
            symbol="envelope"
            color={tile.teal}
            title={t("Prześlij opinię", "Send Feedback")}
            onPress={props.openFeedback}
          />
        </Section>

        <Section
          title={t("O aplikacji", "About")}
          footer={
            <Text>
              {t(
                `Testownik ${props.version} · Tworzony przez KN Solvro na Politechnice Wrocławskiej. Aplikacja mobilna: Antoni Czaplicki.`,
                `Testownik ${props.version} · Made by KN Solvro at Wrocław University of Science and Technology. Mobile app by Antoni Czaplicki.`,
              )}
            </Text>
          }
        >
          <NavRow
            symbol="person.3.fill"
            color={tile.blue}
            title={t("Solvro", "Solvro")}
            leading={
              <RNHostView matchContents>
                <SolvroLogo />
              </RNHostView>
            }
            onPress={() => props.openLink("https://solvro.pwr.edu.pl")}
          />
          <NavRow
            symbol="chevron.left.forwardslash.chevron.right"
            color={tile.gray}
            title={t("Kod źródłowy na GitHubie", "Source Code on GitHub")}
            onPress={() =>
              props.openLink("https://github.com/Solvro/web-testownik")
            }
          />
          <NavRow
            symbol="hand.raised.fill"
            color={tile.blue}
            title={t("Polityka prywatności", "Privacy Policy")}
            onPress={() => props.openLink(`${props.webUrl}/privacy-policy`)}
          />
        </Section>

        <Section>
          <Button role="destructive" onPress={props.signOut}>
            <HStack>
              <Spacer />
              <Text
                modifiers={[
                  foregroundStyle({ type: "color", color: c.destructive }),
                ]}
              >
                {t("Wyloguj się", "Sign Out")}
              </Text>
              <Spacer />
            </HStack>
          </Button>
        </Section>
      </List>
    </Host>
  );
}
