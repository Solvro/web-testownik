import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  correctPracticeAnswer,
  type PracticeQuestion,
} from "../../lib/chat-tools";
import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import OptionIndicator from "../native/OptionIndicator";
import AiRichText from "../AiRichText";
import { Button } from "../ui";

export default function PracticeQuestions({
  questions,
  fromQuiz = false,
  disabled = false,
  onInteraction,
}: {
  questions: PracticeQuestion[];
  fromQuiz?: boolean;
  disabled?: boolean;
  onInteraction?: () => void;
}) {
  const c = useTheme();
  const { t } = useLocale();
  const [index, setIndex] = useState(0);
  const [attempts, setAttempts] = useState<
    Record<number, { selected: number[]; checked: boolean }>
  >({});
  const question = questions[index];
  const attempt = attempts[index] ?? { selected: [], checked: false };
  const multiple =
    question.answers.filter((answer) => answer.is_correct).length > 1;
  const correct = correctPracticeAnswer(question, attempt.selected);
  function update(next: typeof attempt) {
    onInteraction?.();
    setAttempts((all) => ({ ...all, [index]: next }));
  }
  return (
    <View
      testID="assistant-practice"
      style={{
        backgroundColor: c.surface,
        borderRadius: 20,
        padding: 16,
        gap: 16,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 20, fontWeight: "600", color: c.text }}
        >
          {fromQuiz
            ? t("Pytanie z quizu", "Quiz question")
            : t("Przećwicz", "Try it yourself")}
        </Text>
        <Text style={{ fontSize: 13, color: c.muted }}>
          {t(
            "Ćwiczenie w rozmowie · nie zmienia postępu quizu",
            "Chat practice · does not change quiz progress",
          )}
        </Text>
      </View>
      {questions.length > 1 ? (
        <Text style={{ color: c.muted, fontSize: 15 }}>
          {t(
            `Pytanie ${index + 1} z ${questions.length}`,
            `Question ${index + 1} of ${questions.length}`,
          )}
        </Text>
      ) : null}
      <AiRichText text={question.text} />
      <Text style={{ fontSize: 13, color: c.muted }}>
        {multiple
          ? t(
              "Wybierz wszystkie poprawne odpowiedzi",
              "Select all correct answers",
            )
          : t("Wybierz jedną odpowiedź", "Select one answer")}
      </Text>
      <View style={{ gap: 8 }}>
        {question.answers.map((answer, answerIndex) => {
          const selected = attempt.selected.includes(answerIndex);
          const feedback = attempt.checked
            ? answer.is_correct
              ? t("Poprawna odpowiedź", "Correct answer")
              : selected
                ? t("Twoja odpowiedź — niepoprawna", "Your answer — incorrect")
                : ""
            : "";
          const color =
            attempt.checked && answer.is_correct
              ? c.success
              : attempt.checked && selected
                ? c.danger
                : c.text;
          return (
            <Pressable
              key={answerIndex}
              testID={`practice-answer-${answerIndex}`}
              accessibilityRole={multiple ? "checkbox" : "radio"}
              accessibilityLabel={`${t("Odpowiedź", "Answer")} ${answerIndex + 1}: ${answer.text}${feedback ? `. ${feedback}` : ""}`}
              aria-checked={selected}
              accessibilityState={{
                checked: selected,
                disabled: disabled || attempt.checked,
              }}
              disabled={disabled || attempt.checked}
              onPress={() =>
                update({
                  checked: false,
                  selected: multiple
                    ? selected
                      ? attempt.selected.filter(
                          (value) => value !== answerIndex,
                        )
                      : [...attempt.selected, answerIndex]
                    : [answerIndex],
                })
              }
              style={({ pressed }) => ({
                minHeight: 48,
                borderRadius: 12,
                padding: 12,
                gap: 10,
                flexDirection: "row",
                alignItems: "flex-start",
                backgroundColor:
                  attempt.checked && answer.is_correct
                    ? c.successBg
                    : attempt.checked && selected
                      ? c.dangerBg
                      : selected
                        ? c.tint
                        : c.bg,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <OptionIndicator selected={selected} multiple={multiple} />
              <View
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{ flex: 1, gap: 6 }}
              >
                <AiRichText text={answer.text} size={16} />
                {feedback ? (
                  <Text style={{ color, fontWeight: "600", fontSize: 13 }}>
                    {feedback}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      {attempt.checked ? (
        <View accessibilityLiveRegion="polite" style={{ gap: 12 }}>
          <Text
            style={{
              fontSize: 17,
              fontWeight: "600",
              color: correct ? c.success : c.danger,
            }}
          >
            {correct
              ? t("Dobrze!", "Correct!")
              : t(
                  "Jeszcze nie. Zobacz poprawną odpowiedź.",
                  "Not quite. Review the correct answer.",
                )}
          </Text>
          {question.explanation ? (
            <AiRichText text={question.explanation} size={16} />
          ) : null}
          <Button
            kind="secondary"
            onPress={() => update({ selected: [], checked: false })}
          >
            {t("Spróbuj ponownie", "Try Again")}
          </Button>
        </View>
      ) : (
        <Button
          disabled={disabled || !attempt.selected.length}
          onPress={() => update({ ...attempt, checked: true })}
        >
          {t("Sprawdź odpowiedź", "Check Answer")}
        </Button>
      )}
      {questions.length > 1 ? (
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Button
              kind="secondary"
              disabled={index === 0}
              onPress={() => {
                onInteraction?.();
                setIndex(index - 1);
              }}
            >
              {t("Poprzednie", "Previous")}
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button
              kind="secondary"
              disabled={index === questions.length - 1}
              onPress={() => {
                onInteraction?.();
                setIndex(index + 1);
              }}
            >
              {t("Następne", "Next")}
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  );
}
