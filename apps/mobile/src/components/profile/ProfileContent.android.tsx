import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, Text, View } from "react-native";

import { usageWindowLabels } from "../../lib/ai-usage";
import { useLocale, type LanguagePreference } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import { Collection, CollectionDivider } from "../Collection";
import { SectionTitle as Heading } from "../SettingsGroup";
import SyncStatus from "../SyncStatus";
import Choice from "../native/Choice";
import CollectionRow from "../native/CollectionRow";
import { Button, Screen } from "../ui";
import type { ProfileContentProps } from "./types";

// Material 3 list sections with leading icons. Mirrors the iOS list: AI usage
// rows open the usage sheet and an About section links out.
export default function ProfileContent(props: ProfileContentProps) {
  const c = useTheme();
  const { t } = useLocale();
  const color =
    props.tier === "gold"
      ? c.gold
      : props.tier === "silver"
        ? c.muted
        : c.primary;
  const footer = {
    color: c.muted,
    fontSize: 13,
    paddingHorizontal: 16,
    marginTop: -4,
  };
  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Zmień zdjęcie", "Change Photo")}
        onPress={props.changePhoto}
        android_ripple={{ color: c.fill }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          paddingVertical: 12,
        }}
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
          <Text style={{ color: c.primary, fontSize: 14 }}>
            {t("Zmień zdjęcie", "Change Photo")}
          </Text>
        </View>
      </Pressable>
      <SyncStatus />
      <Heading small>{t("Nauka", "Study")}</Heading>
      <Collection>
        <CollectionRow
          ionicon="options-outline"
          title={t("Ustawienia nauki", "Study Settings")}
          detail={t("Powtórki i asystent AI", "Repetition and AI assistant")}
          onPress={props.openSettings}
        />
        <CollectionDivider />
        <CollectionRow
          ionicon="sparkles-outline"
          title="Wrapped"
          detail={t("Twój semestr w Testowniku", "Your semester in Testownik")}
          onPress={props.openWrapped}
        />
      </Collection>
      {props.usage ? (
        <>
          <Heading small>{t("Wykorzystanie AI", "AI Usage")}</Heading>
          <Collection>
            {(
              [
                ["session", usageWindowLabels(t).session, props.usage.session],
                ["week", usageWindowLabels(t).weekly, props.usage.weekly],
              ] as const
            ).map(([key, label, window], index) => (
              <View key={key}>
                {index ? <CollectionDivider /> : null}
                <CollectionRow
                  ionicon={
                    key === "session" ? "time-outline" : "calendar-outline"
                  }
                  title={label}
                  detail={[
                    window.unlimited
                      ? t("Bez limitu", "No Limit")
                      : `${Math.round(window.fraction * 100)}%`,
                    window.unlimited ? null : window.resets,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  onPress={() => props.openUsage(key)}
                />
              </View>
            ))}
          </Collection>
          <Text style={footer}>
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
        </>
      ) : null}
      <Heading small>{t("Aplikacja", "App")}</Heading>
      <Collection>
        {/* Choice bleeds 16dp for its ripple; the icon sits in the inset. */}
        <View style={{ paddingLeft: 56, paddingRight: 16 }}>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 16,
              top: 0,
              bottom: 0,
              justifyContent: "center",
            }}
          >
            <Ionicons name="language-outline" size={24} color={c.muted} />
          </View>
          <Choice
            label={t("Język", "Language")}
            value={props.language}
            options={[
              {
                value: "system",
                label: t("Jak w systemie", "System Default"),
              },
              { value: "pl", label: "Polski" },
              { value: "en", label: "English" },
            ]}
            onChange={(value) => props.setLanguage(value as LanguagePreference)}
          />
        </View>
        <CollectionDivider />
        <CollectionRow
          ionicon="notifications-outline"
          title={t("Powiadomienia", "Notifications")}
          onPress={props.openNotifications}
        />
      </Collection>
      <Heading small>{t("Konto i pomoc", "Account & Support")}</Heading>
      <Collection>
        <CollectionRow
          ionicon="shield-checkmark-outline"
          title={t("Konto i prywatność", "Account & Privacy")}
          onPress={props.openAccount}
        />
        <CollectionDivider />
        <CollectionRow
          ionicon="mail-outline"
          title={t("Prześlij opinię", "Send Feedback")}
          onPress={props.openFeedback}
        />
      </Collection>
      <Heading small>{t("O aplikacji", "About")}</Heading>
      <Collection>
        <CollectionRow
          ionicon="people-outline"
          title="Solvro"
          onPress={() => props.openLink("https://solvro.pwr.edu.pl")}
        />
        <CollectionDivider />
        <CollectionRow
          ionicon="logo-github"
          title={t("Kod źródłowy na GitHubie", "Source Code on GitHub")}
          onPress={() =>
            props.openLink("https://github.com/Solvro/web-testownik")
          }
        />
        <CollectionDivider />
        <CollectionRow
          ionicon="document-text-outline"
          title={t("Polityka prywatności", "Privacy Policy")}
          onPress={() => props.openLink(`${props.webUrl}/privacy-policy`)}
        />
      </Collection>
      <Text style={footer}>
        {t(
          `Testownik ${props.version} · Tworzony przez KN Solvro na Politechnice Wrocławskiej.`,
          `Testownik ${props.version} · Made by KN Solvro at Wrocław University of Science and Technology.`,
        )}
      </Text>
      <Button kind="danger" onPress={props.signOut}>
        {t("Wyloguj się", "Sign Out")}
      </Button>
    </Screen>
  );
}
