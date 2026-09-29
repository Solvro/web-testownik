import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useWindowDimensions } from "react-native";

import { useLocale } from "../lib/locale";
import { useTheme } from "../lib/theme";

export default function AppTabs() {
  const { t } = useLocale();
  const c = useTheme(),
    { width } = useWindowDimensions();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: width > 800 ? "left" : "bottom",
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarActiveBackgroundColor: c.tint,
        tabBarStyle: { backgroundColor: c.surface },
      }}
    >
      {(
        [
          ["(home)", t("Nauka", "Study"), "school-outline"],
          ["library", t("Biblioteka", "Library"), "library-outline"],
          ["grades", t("Oceny", "Grades"), "stats-chart-outline"],
          ["profile", t("Profil", "Profile"), "person-outline"],
        ] as const
      ).map(([name, title, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarAccessibilityLabel: title,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={icon} color={color} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
