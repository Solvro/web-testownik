import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  Text,
  View,
} from "react-native";

import { useLocale } from "../lib/locale";
import { useTheme } from "../lib/theme";
import type { useAiResponse } from "../lib/use-ai-response";
import AiRichText from "./AiRichText";
import { Button } from "./ui";

type AiState = ReturnType<typeof useAiResponse>;

/** General AI hint or explanation, shown below the answers like on the web. */
export default function InlineHint({
  mode,
  state,
  onClose,
}: {
  mode: "hint" | "explain";
  state: AiState;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const c = useTheme();
  const title =
    mode === "hint"
      ? t("Podpowiedź AI", "AI Hint")
      : t("Wyjaśnienie AI", "AI Explanation");
  const perAnswer = state.answers.size;
  return (
    <FadeIn>
      <View
        style={{
          backgroundColor: c.tint,
          borderRadius: 16,
          borderCurve: "continuous",
          padding: 16,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="sparkles" size={16} color={c.primary} />
          <Text
            accessibilityRole="header"
            style={{ flex: 1, fontWeight: "600", fontSize: 15, color: c.text }}
          >
            {title}
          </Text>
          {state.busy ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Wygeneruj ponownie", "Regenerate")}
              onPress={state.retry}
              hitSlop={12}
              style={{
                width: 28,
                height: 28,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="refresh" size={18} color={c.muted} />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Zamknij podpowiedź", "Close hint")}
            onPress={onClose}
            hitSlop={12}
            style={{
              width: 28,
              height: 28,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={18} color={c.muted} />
          </Pressable>
        </View>
        {state.general.length ? (
          <View
            testID="hint-response"
            accessible
            accessibilityLabel={state.general
              .map((block) => block.text)
              .join("\n")}
            style={{ gap: 8 }}
          >
            {state.general.map((block) => (
              <AiRichText
                key={block.key}
                text={block.text}
                streaming={state.busy}
              />
            ))}
          </View>
        ) : null}
        {!state.busy && !state.failure && perAnswer ? (
          <Text style={{ fontSize: 13, color: c.muted }}>
            {t(
              "Wskazówki do poszczególnych odpowiedzi znajdziesz pod nimi.",
              "Tips for individual answers appear below them.",
            )}
          </Text>
        ) : null}
        {state.busy ? (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <ActivityIndicator color={c.primary} />
            <Text style={{ color: c.muted }}>{t("Myślę…", "Thinking…")}</Text>
          </View>
        ) : null}
        {state.failure ? (
          <>
            <Text accessibilityRole="alert" style={{ color: c.danger }}>
              {state.failure}
            </Text>
            <Button kind="secondary" onPress={state.retry}>
              {t("Spróbuj ponownie", "Try Again")}
            </Button>
          </>
        ) : null}
        {!state.busy && !state.failure ? (
          <Text style={{ fontSize: 12, color: c.muted }}>
            {t(
              "AI może się mylić. Sprawdź odpowiedź w materiałach do zajęć.",
              "AI can make mistakes. Check it against your course materials.",
            )}
          </Text>
        ) : null}
      </View>
    </FadeIn>
  );
}

/** A per-answer hint directly under its answer, as on the web. */
export function AnswerHint({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  const c = useTheme();
  const { t } = useLocale();
  return (
    <FadeIn>
      <View
        accessible
        accessibilityLabel={`${t("Wskazówka AI", "AI tip")}: ${text}`}
        style={{
          flexDirection: "row",
          gap: 8,
          marginTop: 6,
          marginHorizontal: 4,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 12,
          borderCurve: "continuous",
          backgroundColor: c.tint,
        }}
      >
        <Ionicons
          name="sparkles"
          size={13}
          color={c.primary}
          style={{ marginTop: 3 }}
        />
        <View style={{ flex: 1 }}>
          <AiRichText text={text} streaming={streaming} size={14} />
        </View>
      </View>
    </FadeIn>
  );
}

// Enters with a short ease-out fade and rise; frequent enough to stay quick.
function FadeIn({ children }: { children: React.ReactNode }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [progress]);
  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [6, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
