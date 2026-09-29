import { useLocale } from "../../../src/lib/locale";
import { Stack } from "expo-router";
import { Platform } from "react-native";

import { useTheme } from "../../../src/lib/theme";

export default function Layout() {
  const c = useTheme();
  const { t } = useLocale();
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
      <Stack.Screen name="index" options={{ title: t("Oceny", "Grades") }} />
    </Stack>
  );
}
