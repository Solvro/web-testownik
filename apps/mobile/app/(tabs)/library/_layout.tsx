import { useLocale } from "../../../src/lib/locale";
import { Stack } from "expo-router";
import { Platform } from "react-native";

import { useTheme } from "../../../src/lib/theme";

export default function Layout() {
  const c = useTheme();
  const { t } = useLocale();
  // Declared up front so the search bar is there during the push animation;
  // the screen adds its handlers once it renders.
  const search =
    Platform.OS === "web"
      ? undefined
      : {
          placeholder: t("Szukaj quizów", "Search Quizzes"),
          autoCapitalize: "none" as const,
          hideWhenScrolling: false,
          placement: "automatic" as const,
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
        contentStyle: { backgroundColor: c.bg },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t("Biblioteka", "Library"),
          headerSearchBarOptions: search,
        }}
      />
      <Stack.Screen
        name="[folder]"
        options={{ title: "Folder", headerSearchBarOptions: search }}
      />
    </Stack>
  );
}
