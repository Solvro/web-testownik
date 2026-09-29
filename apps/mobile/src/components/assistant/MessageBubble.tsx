import { memo } from "react";
import { Text, View } from "react-native";
import type { ChatMessage } from "../../lib/chat-context";
import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import AiRichText from "../AiRichText";
import ToolResult from "./ToolResult";

/** Completed messages stay still while the next response streams. */
export default memo(function MessageBubble({
  message,
  questionLabel,
  streaming = false,
  onInteraction,
}: {
  message: ChatMessage;
  questionLabel?: string;
  streaming?: boolean;
  onInteraction?: () => void;
}) {
  const c = useTheme();
  const { t } = useLocale();
  const user = message.role === "user";
  const text = message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("");
  return (
    <View
      testID={user ? "assistant-user-message" : "assistant-reply"}
      accessibilityLabel={user ? t("Ty", "You") : t("Asystent", "Assistant")}
      style={
        user
          ? {
              alignSelf: "flex-end",
              maxWidth: "88%",
              borderRadius: 20,
              backgroundColor: c.tint,
              paddingHorizontal: 16,
              paddingVertical: 10,
            }
          : { alignSelf: "stretch", paddingVertical: 4 }
      }
    >
      {user && questionLabel ? (
        <Text style={{ fontSize: 12, color: c.muted, marginBottom: 4 }}>
          {questionLabel}
        </Text>
      ) : null}
      {user ? (
        <Text
          selectable
          style={{ fontSize: 17, lineHeight: 24, color: c.text }}
        >
          {text}
        </Text>
      ) : (
        <View style={{ gap: 16 }}>
          {message.parts.map((part, index) =>
            part.type === "text" ? (
              part.text ? (
                <AiRichText
                  key={index}
                  text={part.text}
                  streaming={streaming}
                />
              ) : null
            ) : (
              <ToolResult
                key={part.toolCallId}
                part={part}
                streaming={streaming}
                onInteraction={onInteraction}
              />
            ),
          )}
        </View>
      )}
    </View>
  );
});
