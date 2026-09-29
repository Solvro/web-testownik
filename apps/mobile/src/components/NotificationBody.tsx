import { openBrowserAsync } from "expo-web-browser";
import { useMemo, useRef } from "react";
import { Text } from "react-native";
import { notify } from "../lib/alerts";
import { useLocale } from "../lib/locale";
import { notificationParts } from "../lib/notification-text";
import { useTheme } from "../lib/theme";

export default function NotificationBody({ content }: { content: string }) {
  const c = useTheme();
  const { t } = useLocale();
  const opening = useRef(false);
  const parts = useMemo(() => notificationParts(content), [content]);
  async function open(href: string) {
    if (opening.current) return;
    opening.current = true;
    try {
      await openBrowserAsync(href, { controlsColor: c.primary });
    } catch {
      notify(
        t("Nie udało się otworzyć linku", "Couldn’t Open Link"),
        t("Spróbuj ponownie za chwilę.", "Please try again in a moment."),
      );
    } finally {
      opening.current = false;
    }
  }
  return (
    <Text selectable style={{ color: c.text, fontSize: 17, lineHeight: 24 }}>
      {parts.map((part, index) =>
        part.href ? (
          <Text
            key={index}
            accessibilityRole="link"
            accessibilityHint={t(
              "Otwiera się w przeglądarce",
              "Opens in browser",
            )}
            onPress={() => void open(part.href!)}
            style={{ color: c.primary, textDecorationLine: "underline" }}
          >
            {part.text}
          </Text>
        ) : (
          part.text
        ),
      )}
    </Text>
  );
}
