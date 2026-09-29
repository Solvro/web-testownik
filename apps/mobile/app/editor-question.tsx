import type { Question } from "@testownik/core/quiz/types";
import * as Crypto from "expo-crypto";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Fragment, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import EditorImage from "../src/components/EditorImage";
import AnswerEditor from "../src/components/editor/AnswerEditor";
import {
  clearedEditorImage,
  type EditorAnswer,
} from "../src/components/editor/AnswerEditor.types";
import Field from "../src/components/editor/EditorField";
import { Button, Label, Screen } from "../src/components/ui";
import { notify, useConfirm } from "../src/lib/alerts";
import {
  isBlankQuestion,
  questionIssue,
  useEditorSession,
} from "../src/lib/editor-store";
import { haptics } from "../src/lib/haptics";
import { useLocale } from "../src/lib/locale";
import { useTheme } from "../src/lib/theme";
import { userError } from "../src/lib/user-error";

/** Edits one question of the draft owned by the quiz editor's list screen. */
export default function EditorQuestion() {
  const {
    key,
    question: questionId,
    validate,
  } = useLocalSearchParams<{
    key: string;
    question: string;
    /** Set when a failed save opened this question: show every problem. */
    validate?: string;
  }>();
  const session = useEditorSession(key);
  const { t } = useLocale();
  const c = useTheme();
  const confirm = useConfirm();
  const [added, setAdded] = useState<string | null>(null);
  // Questions whose answers the author has worked on; answer problems stay
  // hidden until then so typing the question isn't met with an error.
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const touch = (id: string) =>
    setTouched((ids) => (ids.has(id) ? ids : new Set(ids).add(id)));
  if (!session)
    return (
      <Screen>
        <Label>
          {t(
            "Edytor został zamknięty. Wróć do listy pytań.",
            "The editor was closed. Go back to the question list.",
          )}
        </Label>
        <Button onPress={() => router.back()}>{t("Wróć", "Go Back")}</Button>
      </Screen>
    );
  const questions = session.draft.questions;
  const index = questions.findIndex((q) => q.id === questionId);
  const question = questions[index];
  if (!question)
    return (
      <Screen>
        <Label>
          {t(
            "Tego pytania nie ma już w szkicu.",
            "This question is no longer in the draft.",
          )}
        </Label>
        <Button onPress={() => router.back()}>{t("Wróć", "Go Back")}</Button>
      </Screen>
    );
  const busy = session.saving;
  const update = (patch: Partial<Question>) =>
    session.update((d) => ({
      ...d,
      questions: d.questions.map((q) =>
        q.id === question.id ? { ...q, ...patch } : q,
      ),
    }));
  const patchAnswer = (
    target: string,
    answerId: string,
    patch: Partial<EditorAnswer>,
  ) => {
    if (patch.is_correct !== undefined) haptics.selection();
    touch(target);
    session.update((d) => ({
      ...d,
      questions: d.questions.map((q) =>
        q.id === target
          ? {
              ...q,
              answers: q.answers.map((a) =>
                a.id === answerId ? { ...a, ...patch } : a,
              ),
            }
          : q,
      ),
    }));
  };
  const uploadAnswerImage = async (target: string, answerId: string) => {
    const result = await session.uploadImage();
    if (result)
      patchAnswer(target, answerId, {
        image_upload: result.id,
        image_url: null,
        image: result.url ?? null,
        image_width: result.width ?? null,
        image_height: result.height ?? null,
      });
  };
  const replaceQuestionImage = async () => {
    const result = await session.uploadImage();
    if (result)
      update({
        image_upload: result.id,
        image_url: null,
        image: result.url ?? null,
        image_width: result.width ?? null,
        image_height: result.height ?? null,
      });
  };
  // Stay on one screen while moving between questions, so Back returns to the list.
  const show = (id: string) => router.setParams({ question: id });
  const issue = isBlankQuestion(question)
    ? null
    : questionIssue(question, t, {
        answers: validate === "1" || touched.has(question.id),
      });
  const hasImage = !!(
    question.image ||
    question.image_url ||
    question.image_upload
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen
        options={{
          title: t(
            `Pytanie ${index + 1} z ${questions.length}`,
            `Question ${index + 1} of ${questions.length}`,
          ),
          gestureEnabled: !busy,
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          icon="ellipsis"
          accessibilityLabel={t("Opcje pytania", "Question options")}
        >
          <Stack.Toolbar.MenuAction
            icon="photo"
            disabled={busy}
            onPress={() =>
              void replaceQuestionImage().catch((error: unknown) =>
                notify(
                  t("Nie dodano obrazu", "Couldn’t Add Image"),
                  userError(error, t),
                ),
              )
            }
          >
            {hasImage
              ? t("Zmień obraz", "Replace Image")
              : t("Dodaj obraz", "Add Image")}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon="trash"
            destructive
            disabled={busy}
            onPress={() =>
              confirm(
                t("Usunąć pytanie?", "Delete Question?"),
                t(
                  "Zmiana zostanie zastosowana po zapisaniu quizu.",
                  "This change takes effect when you save the quiz.",
                ),
                () => {
                  session.update((d) => ({
                    ...d,
                    questions: d.questions.filter((q) => q.id !== question.id),
                  }));
                  router.back();
                },
                { action: t("Usuń", "Delete") },
              )
            }
          >
            {t("Usuń pytanie", "Delete Question")}
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <Stack.Toolbar placement="bottom">
        <Stack.Toolbar.Button
          icon="chevron.up"
          disabled={index === 0}
          onPress={() => show(questions[index - 1].id)}
        >
          {t("Poprzednie pytanie", "Previous Question")}
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Button
          icon="chevron.down"
          disabled={index >= questions.length - 1}
          onPress={() => show(questions[index + 1].id)}
        >
          {t("Następne pytanie", "Next Question")}
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Spacer />
        <Stack.Toolbar.Button
          icon="plus"
          disabled={busy}
          onPress={() => show(session.addQuestion())}
        >
          {t("Dodaj pytanie", "Add Question")}
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Button
          variant="prominent"
          tintColor={c.prominent}
          disabled={busy || session.uploads > 0 || !session.canSave}
          onPress={() => {
            // The list screen saves and replaces itself with the quiz; invalid
            // drafts reopen the question that needs fixing.
            router.back();
            void session.save();
          }}
        >
          {busy ? t("Zapisywanie…", "Saving…") : t("Zapisz", "Save")}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <ScrollView
        key={question.id}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 40,
          maxWidth: 760,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <Field
          editable={!busy}
          label={t("Pytanie", "Question")}
          multiline
          autoFocus={!question.text && !hasImage}
          value={question.text}
          onChangeText={(text) => update({ text })}
        />
        {hasImage ? (
          <View style={{ marginBottom: 16 }}>
            <EditorImage
              key={`${question.id}:${question.image_url ?? question.image}`}
              uri={question.image_url || question.image}
              label={t("Ilustracja pytania", "Question image")}
              disabled={busy}
              onReplace={replaceQuestionImage}
              onRemove={() => update(clearedEditorImage)}
            />
          </View>
        ) : null}
        <Text
          accessibilityRole="header"
          style={{ color: c.muted, fontSize: 14, marginBottom: 8 }}
        >
          {t(
            "Odpowiedzi · dotknij kółka, aby oznaczyć poprawne",
            "Answers · tap a circle to mark it correct",
          )}
        </Text>
        <View
          style={{
            backgroundColor: c.surface,
            borderRadius: 14,
            borderCurve: "continuous",
            overflow: "hidden",
            marginBottom: 20,
          }}
        >
          {question.answers.map((answer, i) => (
            <Fragment key={answer.id}>
              {i ? <Separator color={c.border} /> : null}
              <AnswerEditor
                key={answer.id}
                answer={answer}
                index={i}
                questionId={question.id}
                canDelete={question.answers.length > 1}
                disabled={busy}
                autoFocus={answer.id === added}
                onPatch={patchAnswer}
                onRemove={(target, answerId) => {
                  touch(target);
                  session.update((d) => ({
                    ...d,
                    questions: d.questions.map((q) =>
                      q.id === target && q.answers.length > 1
                        ? {
                            ...q,
                            answers: q.answers.filter((a) => a.id !== answerId),
                          }
                        : q,
                    ),
                  }));
                }}
                onUpload={uploadAnswerImage}
              />
            </Fragment>
          ))}
          <Separator color={c.border} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Dodaj odpowiedź", "Add Answer")}
            disabled={busy}
            onPress={() => {
              const id = Crypto.randomUUID();
              setAdded(id);
              touch(question.id);
              update({
                answers: [
                  ...question.answers,
                  {
                    id,
                    order: question.answers.length,
                    text: "",
                    is_correct: false,
                  },
                ],
              });
            }}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 48,
              paddingHorizontal: 14,
              backgroundColor: pressed ? c.fill : "transparent",
            })}
          >
            <SymbolView
              name="plus.circle.fill"
              size={22}
              tintColor={c.primary}
            />
            <Text style={{ color: c.primary, fontSize: 17 }}>
              {t("Dodaj odpowiedź", "Add Answer")}
            </Text>
          </Pressable>
        </View>
        {issue ? (
          <View
            accessibilityRole="alert"
            style={{
              flexDirection: "row",
              gap: 8,
              padding: 12,
              marginBottom: 20,
              borderRadius: 12,
              backgroundColor: c.dangerBg,
            }}
          >
            <Text style={{ color: c.danger, fontSize: 14, fontWeight: "600" }}>
              {issue}
            </Text>
          </View>
        ) : null}
        <Field
          editable={!busy}
          key={`explanation:${question.id}`}
          label={t("Wyjaśnienie (opcjonalnie)", "Explanation (optional)")}
          multiline
          value={question.explanation ?? ""}
          onChangeText={(explanation) => update({ explanation })}
        />
      </ScrollView>
    </View>
  );
}

function Separator({ color }: { color: string }) {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: color,
        marginLeft: 58,
      }}
    />
  );
}
