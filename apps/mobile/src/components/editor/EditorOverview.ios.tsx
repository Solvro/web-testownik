import { fill, Chevron, rowLabel, secondary } from "../quiz-list/QuizRow";
import type { Question } from "@testownik/core/quiz/types";
import {
  Button,
  Host,
  HStack,
  Image,
  List,
  Section,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  listStyle,
  monospacedDigit,
} from "@expo/ui/swift-ui/modifiers";

import { isBlankQuestion, questionIssue } from "../../lib/editor-store";
import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import { IconTile, tile } from "../settings/SettingsRows";

/**
 * The quiz editor starts from the whole quiz: its details, then every question
 * as a row. Drag to reorder, swipe to delete, tap to edit.
 */
export default function EditorOverview({
  title,
  description,
  questions,
  error,
  openDetails,
  openQuestion,
  move,
  remove,
  add,
}: {
  title: string;
  description: string;
  questions: Question[];
  error: string;
  openDetails: () => void;
  openQuestion: (id: string, validate?: boolean) => void;
  move: (from: number, to: number) => void;
  remove: (index: number) => void;
  add: () => void;
}) {
  const c = useTheme();
  const { t } = useLocale();
  const plain = (text: string) => text.replace(/\s+/g, " ").trim();
  return (
    <Host style={{ flex: 1 }}>
      <List modifiers={[listStyle("insetGrouped")]}>
        {error ? (
          <Section>
            <HStack spacing={10}>
              <Image
                systemName="exclamationmark.triangle.fill"
                size={16}
                color={c.destructive}
              />
              <Text
                modifiers={[
                  font({ textStyle: "subheadline" }),
                  foregroundStyle({ type: "color", color: c.destructive }),
                ]}
              >
                {error}
              </Text>
            </HStack>
          </Section>
        ) : null}

        <Section title={t("Quiz", "Quiz")}>
          <Button onPress={openDetails} modifiers={[rowLabel]}>
            <HStack spacing={14}>
              <IconTile symbol="character.cursor.ibeam" color={tile.blue} />
              <VStack alignment="leading" spacing={2} modifiers={[fill]}>
                <Text
                  modifiers={
                    title.trim()
                      ? [font({ textStyle: "headline" }), lineLimit(2)]
                      : [
                          font({ textStyle: "headline" }),
                          foregroundStyle({
                            type: "color",
                            color: error ? c.destructive : c.primary,
                          }),
                        ]
                  }
                >
                  {title.trim() || t("Dodaj tytuł", "Add a Title")}
                </Text>
                <Text
                  modifiers={[
                    font({ textStyle: "footnote" }),
                    secondary,
                    lineLimit(2),
                  ]}
                >
                  {plain(description) || t("Bez opisu", "No description")}
                </Text>
              </VStack>
              <Chevron />
            </HStack>
          </Button>
        </Section>

        <Section
          title={t(
            `Pytania (${questions.length})`,
            `Questions (${questions.length})`,
          )}
          footer={
            <Text>
              {t(
                "Przytrzymaj i przeciągnij, aby zmienić kolejność. Przesuń w lewo, aby usunąć.",
                "Touch and hold to drag a question to a new place. Swipe left to delete.",
              )}
            </Text>
          }
        >
          <List.ForEach
            onMove={(from, to) => move(from[0], to)}
            onDelete={(indices) => remove(indices[0])}
          >
            {questions.map((question, index) => {
              const blank = isBlankQuestion(question);
              const issue = blank && !error ? null : questionIssue(question, t);
              const correct = question.answers.filter(
                (a) => a.is_correct,
              ).length;
              const hasImage = !!(
                question.image ||
                question.image_url ||
                question.image_upload
              );
              return (
                <Button
                  key={question.id}
                  onPress={() => openQuestion(question.id, !!issue)}
                  modifiers={[
                    rowLabel,
                    accessibilityLabel(
                      [
                        t(`Pytanie ${index + 1}`, `Question ${index + 1}`),
                        plain(question.text),
                        issue,
                      ]
                        .filter(Boolean)
                        .join(". "),
                    ),
                  ]}
                >
                  <HStack spacing={12} alignment="top">
                    <Text
                      modifiers={[
                        secondary,
                        monospacedDigit(),
                        frame({ width: 26, alignment: "trailing" }),
                      ]}
                    >
                      {String(index + 1)}
                    </Text>
                    <VStack
                      alignment="leading"
                      spacing={3}
                      modifiers={[
                        frame({ maxWidth: Infinity, alignment: "leading" }),
                      ]}
                    >
                      <Text modifiers={[lineLimit(2)]}>
                        {plain(question.text) ||
                          (hasImage
                            ? t("Pytanie z obrazem", "Image question")
                            : t("Nowe pytanie", "New Question"))}
                      </Text>
                      <Text
                        modifiers={[
                          font({ textStyle: "footnote" }),
                          issue
                            ? foregroundStyle({
                                type: "color",
                                color: c.destructive,
                              })
                            : secondary,
                        ]}
                      >
                        {issue ??
                          (blank
                            ? t("Dotknij, aby napisać", "Tap to write")
                            : null) ??
                          [
                            t(
                              `Odpowiedzi: ${question.answers.length}`,
                              `${question.answers.length} answers`,
                            ),
                            t(`Poprawne: ${correct}`, `${correct} correct`),
                            hasImage ? t("obraz", "image") : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                      </Text>
                    </VStack>
                    <Chevron />
                  </HStack>
                </Button>
              );
            })}
          </List.ForEach>
          <Button onPress={add} modifiers={[rowLabel]}>
            <HStack spacing={12}>
              <Image
                systemName="plus.circle.fill"
                size={22}
                color={c.primary}
                modifiers={[frame({ width: 26 })]}
              />
              <Text
                modifiers={[
                  foregroundStyle({ type: "color", color: c.primary }),
                ]}
              >
                {t("Dodaj pytanie", "Add Question")}
              </Text>
              <Spacer />
            </HStack>
          </Button>
        </Section>
      </List>
    </Host>
  );
}
