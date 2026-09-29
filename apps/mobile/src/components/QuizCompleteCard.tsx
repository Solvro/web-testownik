import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { questionCount } from "../lib/collection-copy";
import { useLocale } from "../lib/locale";
import { useQuizRating } from "../lib/quiz-rating";
import { useTheme } from "../lib/theme";
import BeerMug from "./BeerMug";
import RatingControl from "./RatingControl";

/**
 * The finish line: the web's "go have a beer" Easter egg, then a gentle ask to
 * rate the quiz while it's fresh.
 */
export default function QuizCompleteCard({
  quizId,
  total,
  studyTime,
}: {
  quizId: string;
  total: number;
  studyTime: string;
}) {
  const c = useTheme();
  const { t } = useLocale();
  const { mine, current, state, rate } = useQuizRating(quizId);
  const card = {
    backgroundColor: c.surface,
    borderRadius: 20,
    borderCurve: "continuous" as const,
    padding: 20,
    gap: 10,
    alignItems: "center" as const,
  };
  return (
    <View style={{ gap: 16, paddingVertical: 16 }}>
      <View style={card}>
        <BeerMug />
        <Text
          accessibilityRole="header"
          style={{ color: c.text, fontSize: 24, fontWeight: "700" }}
        >
          {t("Quiz ukończony!", "Quiz Complete!")}
        </Text>
        <Text style={{ color: c.muted, fontSize: 15, textAlign: "center" }}>
          {t(
            `Opanowano ${questionCount(total, "pl")} w ${studyTime}.`,
            total === 1
              ? `You mastered the only question in ${studyTime}.`
              : `You mastered all ${questionCount(total, "en")} in ${studyTime}.`,
          )}
        </Text>
        <Text style={{ color: c.muted, fontSize: 13, textAlign: "center" }}>
          {t(
            "Idź się napić piwka i odpocznij — zasłużyłeś!",
            "Go grab a beer and take a break — you’ve earned it!",
          )}
        </Text>
      </View>
      <View style={card}>
        <Text style={{ color: c.text, fontSize: 17, fontWeight: "600" }}>
          {t("Jak Ci się podobał ten quiz?", "How Was This Quiz?")}
        </Text>
        <RatingControl
          value={current?.score ?? 0}
          onChange={(score) => void rate(score)}
        />
        <Text
          accessibilityLiveRegion="polite"
          style={{
            color: state === "error" ? c.danger : c.muted,
            fontSize: 13,
          }}
        >
          {mine.isPending
            ? " "
            : state === "saving"
              ? t("Zapisywanie…", "Saving…")
              : state === "error"
                ? t(
                    "Nie zapisano oceny. Spróbuj ponownie.",
                    "Rating not saved. Try again.",
                  )
                : current
                  ? t("Dziękujemy za ocenę!", "Thanks for rating!")
                  : t("Dotknij gwiazdki, aby ocenić", "Tap a star to rate")}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: "/community", params: { id: quizId } })
          }
          hitSlop={8}
          style={({ pressed }) => ({
            opacity: pressed ? 0.5 : 1,
            paddingTop: 4,
          })}
        >
          <Text style={{ color: c.primary, fontSize: 16 }}>
            {t("Napisz komentarz", "Write a Comment")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
