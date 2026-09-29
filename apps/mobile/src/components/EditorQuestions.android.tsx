import {
  Icon,
  IconButton,
  Row,
  Text,
  TextButton,
} from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  padding,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import type { Question } from "@testownik/core/quiz/types";
import { useState } from "react";
import { Modal, Text as RNText } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useLocale } from "../lib/locale";
import { useTheme } from "../lib/theme";
import M3Host from "./native/M3Host";
import { symbol } from "./native/materialIcons.android";
import QuestionList from "./native/QuestionList";

// Full-screen Material dialog: close icon, title, and a text action to toggle
// reordering, instead of the iOS sheet header with a Done button.
export default function EditorQuestions({
  questions,
  selectedId,
  onClose,
  onSelect,
  onMove,
}: {
  questions: Question[];
  selectedId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  onMove: (id: string, beforeId: string | null) => void;
}) {
  const { t } = useLocale(),
    c = useTheme();
  const [editing, setEditing] = useState(false);
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <M3Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
          <Row
            verticalAlignment="center"
            modifiers={[fillMaxWidth(), padding(4, 8, 8, 8)]}
          >
            <IconButton onClick={onClose}>
              <Icon
                source={symbol("close")}
                contentDescription={t("Zamknij", "Close")}
              />
            </IconButton>
            <Text
              style={{ typography: "titleLarge" }}
              modifiers={[weight(1), padding(8, 0, 0, 0)]}
            >
              {t("Pytania", "Questions")}
            </Text>
            <TextButton onClick={() => setEditing((value) => !value)}>
              <Text>
                {editing
                  ? t("Gotowe", "Done")
                  : t("Zmień kolejność", "Reorder")}
              </Text>
            </TextButton>
          </Row>
        </M3Host>
        <RNText
          style={{
            color: c.muted,
            fontSize: 14,
            paddingHorizontal: 16,
            paddingBottom: 8,
          }}
        >
          {editing
            ? t(
                "Użyj strzałek, aby zmienić kolejność pytań.",
                "Use the arrows to reorder questions.",
              )
            : t(
                "Wybierz pytanie, aby je edytować.",
                "Choose a question to edit.",
              )}
        </RNText>
        <QuestionList
          rows={questions.map((q, i) => ({
            id: q.id,
            title: t(`Pytanie ${i + 1}`, `Question ${i + 1}`),
            subtitle:
              q.text.trim().replace(/\s+/g, " ").slice(0, 240) ||
              (q.image || q.image_url || q.image_upload
                ? t("Pytanie z obrazem", "Image question")
                : t("Puste pytanie", "Empty question")),
          }))}
          selectedId={selectedId}
          editing={editing}
          moveUpLabel={t("Przenieś wyżej", "Move up")}
          moveDownLabel={t("Przenieś niżej", "Move down")}
          onSelect={onSelect}
          onMove={onMove}
        />
      </SafeAreaView>
    </Modal>
  );
}
