import type { Question } from "@testownik/core/quiz/types";
import { Modal, Platform, View } from "react-native";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocale } from "../lib/locale";
import { useTheme } from "../lib/theme";
import { Button, Heading, Label } from "./ui";
import QuestionList from "./native/QuestionList";
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
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ padding: 16, gap: 8 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Heading>{t("Pytania", "Questions")}</Heading>
            <Button kind="secondary" onPress={onClose}>
              {t("Gotowe", "Done")}
            </Button>
          </View>
          <Label>
            {editing
              ? Platform.OS === "ios"
                ? t(
                    "Przeciągnij uchwyt, aby zmienić kolejność pytań.",
                    "Drag a handle to reorder questions.",
                  )
                : t(
                    "Użyj strzałek, aby zmienić kolejność pytań.",
                    "Use the arrows to reorder questions.",
                  )
              : t(
                  "Wybierz pytanie, aby je edytować.",
                  "Choose a question to edit.",
                )}
          </Label>
          <Button
            kind="secondary"
            onPress={() => setEditing((value) => !value)}
          >
            {editing
              ? t("Zakończ zmianę kolejności", "Finish Reordering")
              : t("Zmień kolejność", "Reorder")}
          </Button>
        </View>
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
