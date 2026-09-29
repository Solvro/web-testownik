import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router } from "expo-router";
import type { ChatToolPart } from "../../lib/chat-stream";
import { practiceQuestions, toolOutput } from "../../lib/chat-tools";
import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import { Button } from "../ui";
import AiRichText from "../AiRichText";
import PracticeQuestions from "./PracticeQuestions";

export default function ToolResult({
  part,
  streaming = false,
  onInteraction,
}: {
  part: ChatToolPart;
  streaming?: boolean;
  onInteraction?: () => void;
}) {
  const c = useTheme();
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  if (!part.state.startsWith("output-"))
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <ActivityIndicator color={c.primary} />
        <Text style={{ fontSize: 15, color: c.muted }}>
          {part.toolName === "generate_practice_questions"
            ? t("Układam ćwiczenie…", "Preparing practice…")
            : t("Sprawdzam quiz…", "Looking through the quiz…")}
        </Text>
      </View>
    );
  const unavailable = (
    <Text accessibilityRole="alert" style={{ fontSize: 15, color: c.danger }}>
      {t(
        "Nie udało się wyświetlić tego wyniku. Poproś asystenta o ponowną próbę.",
        "This result could not be displayed. Ask the assistant to try again.",
      )}
    </Text>
  );
  if (part.state === "output-error") return unavailable;
  if (
    part.toolName === "generate_practice_questions" ||
    part.toolName === "get_question"
  ) {
    const questions = practiceQuestions(
      part.output,
      part.toolName === "get_question",
    );
    return questions ? (
      <PracticeQuestions
        questions={questions}
        fromQuiz={part.toolName === "get_question"}
        disabled={streaming}
        onInteraction={onInteraction}
      />
    ) : (
      unavailable
    );
  }
  const output = toolOutput(part.output);
  if (part.toolName === "disable_ai" && output?.action === "disable_ai")
    return (
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 16, color: c.text }}>
          {t(
            "Możesz wyłączyć asystenta w ustawieniach nauki. Nic nie zostało jeszcze zmienione.",
            "You can turn the assistant off in study settings. Nothing has been changed yet.",
          )}
        </Text>
        <Button kind="secondary" onPress={() => router.push("/settings")}>
          {t("Ustawienia nauki", "Study Settings")}
        </Button>
      </View>
    );
  if (
    part.toolName === "list_questions" &&
    output &&
    Array.isArray(output.questions)
  ) {
    const rows = output.questions
      .filter(
        (q): q is { order: number; text: string } =>
          !!q &&
          typeof q === "object" &&
          typeof q.order === "number" &&
          typeof q.text === "string",
      )
      .slice(0, 100);
    return (
      <View style={{ gap: 12 }}>
        <Button
          kind="secondary"
          onPress={() => {
            onInteraction?.();
            setExpanded(!expanded);
          }}
        >
          {expanded
            ? t("Ukryj znalezione pytania", "Hide Matching Questions")
            : t(
                `Zobacz znalezione pytania (${rows.length})`,
                `View Matching Questions (${rows.length})`,
              )}
        </Button>
        {expanded ? (
          rows.length ? (
            rows.map((q) => (
              <View
                key={q.order}
                style={{
                  borderBottomWidth: 0.5,
                  borderColor: c.border,
                  paddingBottom: 12,
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 13, color: c.muted }}>
                  {t(`Pytanie ${q.order}`, `Question ${q.order}`)}
                </Text>
                <AiRichText text={q.text} size={15} />
              </View>
            ))
          ) : (
            <Text style={{ fontSize: 15, color: c.muted }}>
              {t(
                "Nie znaleziono pasujących pytań.",
                "No matching questions found.",
              )}
            </Text>
          )
        ) : null}
      </View>
    );
  }
  return unavailable;
}
