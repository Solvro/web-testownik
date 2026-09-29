import { Image, Pressable, Text, View } from "react-native";

import { usageWindowLabels } from "../../lib/ai-usage";
import { useLocale, type LanguagePreference } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import Card, { SectionTitle as Heading } from "../SettingsGroup";
import SyncStatus from "../SyncStatus";
import Choice from "../native/Choice";
import { Button, Row, Screen } from "../ui";
import type { ProfileContentProps } from "./types";

// Browser preview and Android. iOS renders a native SwiftUI list instead.
export default function ProfileContent(props: ProfileContentProps) {
  const c = useTheme();
  const { t } = useLocale();
  const color =
    props.tier === "gold"
      ? c.gold
      : props.tier === "silver"
        ? c.muted
        : c.primary;
  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Zmień zdjęcie", "Change Photo")}
        onPress={props.changePhoto}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          paddingVertical: 12,
          opacity: pressed ? 0.65 : 1,
        })}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            borderWidth: 2,
            borderColor: color,
            backgroundColor: c.tint,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {props.photo ? (
            <Image
              source={{ uri: props.photo }}
              style={{ width: 60, height: 60, borderRadius: 30 }}
            />
          ) : (
            <Text style={{ fontSize: 26, color: c.primary }}>
              {props.name[0] ?? "T"}
            </Text>
          )}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontSize: 22, fontWeight: "600", color: c.text }}>
            {props.name}
          </Text>
          <Text style={{ color, fontSize: 14, fontWeight: "600" }}>
            Testownik {props.tier[0].toUpperCase() + props.tier.slice(1)}
          </Text>
          <Text style={{ color: c.muted, fontSize: 13 }}>
            {t("Zmień zdjęcie", "Change Photo")}
          </Text>
        </View>
      </Pressable>
      <SyncStatus />
      <Heading small>{t("Nauka", "Study")}</Heading>
      <Card>
        <Row
          title={t("Ustawienia nauki", "Study Settings")}
          detail={t("Powtórki i asystent AI", "Repetition and AI assistant")}
          onPress={props.openSettings}
        />
        <Row
          title="Wrapped"
          detail={t("Twój semestr w Testowniku", "Your semester in Testownik")}
          onPress={props.openWrapped}
        />
      </Card>
      {props.usage ? (
        <>
          <Heading small>{t("Wykorzystanie AI", "AI Usage")}</Heading>
          <Card>
            {(
              [
                [usageWindowLabels(t).session, props.usage.session],
                [usageWindowLabels(t).weekly, props.usage.weekly],
              ] as const
            ).map(([label, window]) => (
              <Row
                key={label}
                title={label}
                detail={[
                  window.unlimited
                    ? t("Bez limitu", "No Limit")
                    : `${Math.round(window.fraction * 100)}%`,
                  window.unlimited ? null : window.resets,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))}
          </Card>
        </>
      ) : null}
      <Heading small>{t("Aplikacja", "App")}</Heading>
      <Card>
        <Choice
          label={t("Język", "Language")}
          value={props.language}
          options={[
            { value: "system", label: t("Jak w systemie", "System Default") },
            { value: "pl", label: "Polski" },
            { value: "en", label: "English" },
          ]}
          onChange={(value) => props.setLanguage(value as LanguagePreference)}
        />
        <Row
          title={t("Powiadomienia", "Notifications")}
          onPress={props.openNotifications}
        />
      </Card>
      <Heading small>{t("Konto i pomoc", "Account & Support")}</Heading>
      <Card>
        <Row
          title={t("Konto i prywatność", "Account & Privacy")}
          onPress={props.openAccount}
        />
        <Row
          title={t("Prześlij opinię", "Send Feedback")}
          onPress={props.openFeedback}
        />
      </Card>
      <Button kind="danger" onPress={props.signOut}>
        {t("Wyloguj się", "Sign Out")}
      </Button>
    </Screen>
  );
}
