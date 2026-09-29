import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useLocale } from "../lib/locale";
import { useTheme } from "../lib/theme";

export default function AppTabs() {
  const c = useTheme();
  const { t, language } = useLocale();
  return (
    // Refresh the native tab items when language changes; iOS otherwise keeps
    // their initial titles even after the screen content has been translated.
    <NativeTabs
      key={language}
      tintColor={c.primary}
      labelVisibilityMode="labeled"
    >
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon sf="rectangle.stack.fill" md="school" />
        <NativeTabs.Trigger.Label>
          {t("Nauka", "Study")}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="library">
        <NativeTabs.Trigger.Icon sf="books.vertical.fill" md="book_2" />
        <NativeTabs.Trigger.Label>
          {t("Biblioteka", "Library")}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="grades">
        <NativeTabs.Trigger.Icon sf="chart.bar.fill" md="bar_chart" />
        <NativeTabs.Trigger.Label>
          {t("Oceny", "Grades")}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
        <NativeTabs.Trigger.Label>
          {t("Profil", "Profile")}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
