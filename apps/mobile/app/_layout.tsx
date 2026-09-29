import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { getFocusedRouteNameFromRoute } from "expo-router/react-navigation";
import { StatusBar } from "expo-status-bar";
import { Platform, useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { LocaleProvider, useLocale } from "../src/lib/locale";

import { Loading } from "../src/components/ui";
import { SessionProvider, useSession } from "../src/lib/session";
import { useTheme } from "../src/lib/theme";

export { ErrorBoundary } from "expo-router";
// A cold-start deep link (a notification, /usage) opens on top of the tabs,
// so it has a way back instead of being the only screen.
export const unstable_settings = { initialRouteName: "(tabs)" };
export default function Layout() {
  const c = useTheme();
  const base = useColorScheme() === "dark" ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: c.primary,
      background: c.bg,
      card: c.surface,
      text: c.text,
      border: c.border,
      notification: c.primary,
    },
  };
  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <LocaleProvider>
          <SessionProvider>
            <StatusBar style="auto" />
            <SessionNavigator />
          </SessionProvider>
        </LocaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function tabTitle(
  tab: string | undefined,
  t: (pl: string, en: string) => string,
) {
  switch (tab) {
    case "library":
      return t("Biblioteka", "Library");
    case "grades":
      return t("Oceny", "Grades");
    case "profile":
      return t("Profil", "Profile");
    default:
      return t("Nauka", "Study");
  }
}

function SessionNavigator() {
  const { t } = useLocale();
  const c = useTheme();
  const { ready, user } = useSession();
  if (!ready) return <Loading />;
  // Sheets show one continuous background instead of a lighter header band.
  const sheetHeader = {
    headerStyle: { backgroundColor: c.bg },
    headerShadowVisible: false,
  };
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor:
            Platform.OS === "ios"
              ? "transparent"
              : Platform.OS === "android"
                ? c.bg
                : c.surface,
        },
        headerTintColor: c.text,
        // Material 3 small top app bar title: title-large, regular weight.
        headerTitleStyle:
          Platform.OS === "android"
            ? { fontSize: 22, fontWeight: "400" }
            : undefined,
        // Material 3 top app bars are flat; no elevation shadow.
        headerShadowVisible: Platform.OS === "android" ? false : undefined,
        contentStyle: { backgroundColor: c.bg },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="login" options={{ title: "Testownik" }} />
      <Stack.Screen
        name="auth"
        options={{ title: t("Logowanie", "Sign In") }}
      />
      <Stack.Protected guard={Boolean(user)}>
        <Stack.Screen
          name="(tabs)"
          // The long-press back menu lists this title; name the visible tab
          // rather than showing the "(tabs)" route group.
          options={({ route }) => ({
            headerShown: false,
            title: tabTitle(getFocusedRouteNameFromRoute(route), t),
          })}
        />
        <Stack.Screen
          name="downloads"
          options={{ title: t("Zapisane offline", "Saved Offline") }}
        />
        <Stack.Screen
          name="account"
          options={{ title: t("Konto i prywatność", "Account & Privacy") }}
        />
        <Stack.Screen
          name="quiz/[id]"
          options={{ title: t("Nauka", "Study") }}
        />
        <Stack.Screen
          name="editor"
          options={{ title: t("Edytor quizu", "Quiz Editor") }}
        />
        <Stack.Screen
          name="delete-account"
          options={{ title: t("Usuń konto", "Delete Account") }}
        />
        <Stack.Screen name="editor-question" options={{ title: "" }} />
        <Stack.Screen
          name="editor-details"
          options={{
            ...sheetHeader,
            title: t("Szczegóły quizu", "Quiz Details"),
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="settings-model"
          options={{ title: t("Model", "Model") }}
        />
        <Stack.Screen
          name="usage"
          options={{
            ...sheetHeader,
            title: t("Wykorzystanie AI", "AI Usage"),
            presentation: "formSheet",
            sheetAllowedDetents: [0.7, 1],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="history"
          options={{ title: t("Historia odpowiedzi", "Answer History") }}
        />
        <Stack.Screen
          name="search-quiz"
          options={{ title: t("Szukaj w pytaniach", "Search Questions") }}
        />
        <Stack.Screen
          name="report"
          options={{
            ...sheetHeader,
            title: t("Zgłoś problem", "Report Question"),
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="notifications"
          options={{ title: t("Powiadomienia", "Notifications") }}
        />
        <Stack.Screen
          name="feedback"
          options={{
            ...sheetHeader,
            title: t("Prześlij opinię", "Send Feedback"),
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="stats"
          options={{ title: t("Statystyki", "Statistics") }}
        />
        <Stack.Screen
          name="share"
          options={{ title: t("Udostępnij", "Share") }}
        />
        <Stack.Screen
          name="share-invite"
          options={{
            title: t("Dodaj osoby lub grupy", "Add People or Groups"),
          }}
        />
        <Stack.Screen
          name="import"
          options={{ title: t("Importuj quiz", "Import Quiz") }}
        />
        <Stack.Screen
          name="settings"
          options={{ title: t("Ustawienia nauki", "Study Settings") }}
        />
        <Stack.Screen
          name="organize"
          options={{
            ...sheetHeader,
            presentation: "formSheet",
            sheetAllowedDetents: [0.6, 1],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="photo"
          options={{
            title: t("Zmień zdjęcie", "Change Photo"),
            presentation: "modal",
            ...sheetHeader,
          }}
        />
        <Stack.Screen
          name="community"
          options={{ title: t("Opinie i komentarze", "Reviews & Comments") }}
        />
        <Stack.Screen
          name="wrapped"
          options={{ title: t("Twój rok nauki", "Your Year of Learning") }}
        />
        <Stack.Screen
          name="ai"
          options={{
            title: t("Asystent", "Assistant"),
            contentStyle: {
              backgroundColor: Platform.OS === "ios" ? c.surface : c.bg,
            },
            presentation: Platform.OS === "android" ? "modal" : "formSheet",
            sheetAllowedDetents: Platform.OS === "android" ? [1] : [0.75, 1],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="hint"
          options={{
            title: t("Podpowiedź AI", "AI Hint"),
            presentation: "formSheet",
            sheetAllowedDetents: Platform.OS === "android" ? [0.65] : [0.5, 1],
            sheetGrabberVisible: true,
          }}
        />
      </Stack.Protected>
    </Stack>
  );
}
