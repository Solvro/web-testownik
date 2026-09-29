import { useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text } from "react-native";
import type { Question } from "@testownik/core/quiz/types";
import { imageHost, markdownImages } from "../lib/image-policy";
import { useLocale } from "../lib/locale";
import { useConfirm } from "../lib/alerts";
import { useTheme } from "../lib/theme";

export default function ExternalImageNotice({
  question,
  showExplanation,
  allowed,
  approve,
}: {
  question: Question;
  showExplanation: boolean;
  allowed: (url: string) => boolean;
  approve: (hosts: string[]) => void;
}) {
  const { t } = useLocale();
  const c = useTheme();
  const confirm = useConfirm();
  const hosts = useMemo(() => {
    const urls = [question, ...question.answers].flatMap((item) => [
      ...(item.image ? [item.image] : []),
      ...markdownImages(item.text),
    ]);
    if (showExplanation && question.explanation)
      urls.push(...markdownImages(question.explanation));
    return [
      ...new Set(
        urls
          .filter((url) => !allowed(url))
          .map(imageHost)
          .filter((host): host is string => !!host),
      ),
    ].sort();
  }, [question, showExplanation, allowed]);
  if (!hosts.length) return null;
  const count = hosts.length;
  // A one-line banner; the details and the choice live in a dialog.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("Ukryte obrazy", "Hidden images")}
      accessibilityHint={hosts.join(", ")}
      onPress={() =>
        confirm(
          t(
            "Pokazać obrazy z innych stron?",
            "Show Images from Other Websites?",
          ),
          `${t(
            "Wczytanie tych obrazów połączy aplikację z:",
            "Loading these images will connect the app to:",
          )}\n${hosts.join("\n")}`,
          () => approve(hosts),
          { action: t("Pokaż obrazy", "Show Images"), destructive: false },
        )
      }
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        borderCurve: "continuous",
        backgroundColor: pressed ? c.fill : c.surface,
      })}
    >
      <Ionicons name="image-outline" size={18} color={c.muted} />
      <Text style={{ flex: 1, color: c.muted, fontSize: 14 }}>
        {t(
          `Ukryto obrazy z innych stron (${count})`,
          `Images from ${count} ${count === 1 ? "website are" : "websites are"} hidden`,
        )}
      </Text>
      <Ionicons name="chevron-forward" size={14} color={c.muted} />
    </Pressable>
  );
}
