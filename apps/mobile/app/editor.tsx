import { userError } from "../src/lib/user-error";
import { headerAction } from "../src/components/header-action";
import type { Question, Quiz } from "@testownik/core/quiz/types";
import { prepareQuizForSubmission } from "@testownik/core/quiz/schema";
import { editorValidation } from "../src/lib/editor-validation";
import { useLocale } from "../src/lib/locale";
import { useConfirm } from "../src/lib/alerts";
import { useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Keyboard, Platform, View } from "react-native";

import Overflow from "../src/components/Overflow";
import AnswerEditor from "../src/components/editor/AnswerEditor";
import type { EditorAnswer } from "../src/components/editor/AnswerEditor.types";
import EditorAction from "../src/components/native/EditorAction";
import EditorBottomBar from "../src/components/editor/EditorBottomBar";
import EditorQuestions from "../src/components/EditorQuestions";
import { moveQuestion } from "../src/lib/editor-order";
import EditorImage from "../src/components/EditorImage";
import EditorOverview from "../src/components/editor/EditorOverview";
import { publishEditor } from "../src/lib/editor-store";
import { useTheme } from "../src/lib/theme";
import Field from "../src/components/editor/EditorField";
import {
  Button,
  ErrorScreen,
  Heading,
  Label,
  Loading,
  Screen,
  notify,
} from "../src/components/ui";
import { api } from "../src/lib/api";
import { DraftWriter, waitForDraftWrites } from "../src/lib/draft-writer";
import { exportJson, pickImage } from "../src/lib/files";
import { useSession } from "../src/lib/session";
import { storage } from "../src/lib/storage";

function newQuestion(): Question {
  return {
    id: Crypto.randomUUID(),
    text: "",
    order: 0,
    multiple: false,
    answers: [
      { id: Crypto.randomUUID(), text: "", order: 0, is_correct: true },
      { id: Crypto.randomUUID(), text: "", order: 1, is_correct: false },
    ],
  };
}
interface Draft {
  title: string;
  description: string;
  questions: Question[];
}
export default function Editor() {
  const { id, question } = useLocalSearchParams<{
    id?: string;
    question?: string;
  }>();
  const { user } = useSession();
  return <EditorForm key={`${user?.id}:${id ?? "new"}:${question ?? ""}`} />;
}
function EditorForm() {
  const { t } = useLocale();
  const c = useTheme();
  const confirm = useConfirm();
  const { id, question: requestedQuestion } = useLocalSearchParams<{
      id?: string;
      question?: string;
    }>(),
    s = useSession(),
    qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => ({
      title: "",
      description: "",
      questions: [newQuestion()],
    })),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [ready, setReady] = useState(false),
    [loadError, setLoadError] = useState<unknown>(null),
    [loadAttempt, setLoadAttempt] = useState(0),
    [error, setError] = useState(""),
    [details, setDetails] = useState(false),
    [overview, setOverview] = useState(false),
    [missingQuestion, setMissingQuestion] = useState(false),
    [savedQuiz, setSavedQuiz] = useState<Quiz | null>(null),
    [uploads, setUploads] = useState(0),
    [saving, setSaving] = useState(false),
    [hasLocalDraft, setHasLocalDraft] = useState(false);
  const mounted = useRef(true);
  const saveInFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [baseline, setBaseline] = useState(draft);
  const key = `draft.${s.user?.id}.${id ?? "new"}`;
  const draftWriteFailed = useCallback(() => {
    const message = t(
      "Nie udało się zapisać szkicu na urządzeniu.",
      "Could not save your draft on this device.",
    );
    if (mounted.current) setError(message);
    else notify(t("Szkic nie został zapisany", "Draft Not Saved"), message);
  }, [t]);
  const writer = useMemo(
    // DraftWriter stores the callback; only asynchronous writes invoke it.
    // eslint-disable-next-line react-hooks/refs
    () => new DraftWriter<Draft>(key, storage, draftWriteFailed),
    [key, draftWriteFailed],
  );
  useEffect(() => {
    let active = true;
    (async () => {
      await waitForDraftWrites(storage, key);
      const saved = await storage.read<Draft | null>(key, null);
      const initial =
        saved ?? (id ? await api.request<Quiz>(`quizzes/${id}/`) : null);
      if (active) {
        if (initial) {
          setHasLocalDraft(saved !== null);
          setBaseline(initial);
          setDraft(initial);
          if (requestedQuestion) {
            if (
              initial.questions.some(
                (question) => question.id === requestedQuestion,
              )
            ) {
              setSelectedId(requestedQuestion);
            } else {
              setMissingQuestion(true);
              setOverview(true);
            }
          }
        }
        setReady(true);
      }
    })().catch((e) => {
      if (active) setLoadError(e);
    });
    return () => {
      active = false;
    };
  }, [key, id, requestedQuestion, loadAttempt]);
  useEffect(() => {
    if (!ready || draft === baseline) return;
    writer.schedule(draft);
  }, [draft, baseline, ready, writer]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") void writer.flush();
    });
    return () => {
      listener.remove();
      void writer.flush();
    };
  }, [writer]);
  const patchAnswer = useCallback(
    (questionId: string, answerId: string, patch: Partial<EditorAnswer>) => {
      setDraft((d) => ({
        ...d,
        questions: d.questions.map((q) =>
          q.id === questionId
            ? {
                ...q,
                answers: q.answers.map((a) =>
                  a.id === answerId ? { ...a, ...patch } : a,
                ),
              }
            : q,
        ),
      }));
    },
    [],
  );
  const removeAnswer = useCallback((questionId: string, answerId: string) => {
    setDraft((d) => ({
      ...d,
      questions: d.questions.map((q) =>
        q.id === questionId && q.answers.length > 1
          ? { ...q, answers: q.answers.filter((a) => a.id !== answerId) }
          : q,
      ),
    }));
  }, []);
  const replaceAnswerImage = useCallback(
    async (questionId: string, answerId: string) => {
      setUploads((n) => n + 1);
      try {
        const result = await pickImage();
        if (result)
          patchAnswer(questionId, answerId, {
            image_upload: result.id,
            image_url: null,
            image: result.url ?? null,
            image_width: result.width ?? null,
            image_height: result.height ?? null,
          });
      } finally {
        setUploads((n) => n - 1);
      }
    },
    [patchAnswer],
  );
  function openSavedQuiz(saved: Quiz) {
    if (!mounted.current) return;
    qc.setQueryData(["quiz", saved.id, s.user?.id], saved);
    void qc.invalidateQueries({ queryKey: ["library"] });
    void qc.invalidateQueries({ queryKey: ["quiz", saved.id] });
    router.replace({ pathname: "/quiz/[id]", params: { id: saved.id } });
  }
  async function finishSave(saved: Quiz) {
    if (!mounted.current) return;
    try {
      await writer.discard();
      openSavedQuiz(saved);
    } catch {
      setSavedQuiz(saved);
      setError(
        t(
          "Quiz jest zapisany. Nie udało się usunąć lokalnego szkicu. Spróbuj ponownie, aby go uporządkować.",
          "Your quiz is saved. Could not remove the local draft. Retry to finish cleaning it up.",
        ),
      );
    }
  }
  function openQuestion(questionId: string, validate = false) {
    Keyboard.dismiss();
    router.push({
      pathname: "/editor-question",
      params: { key, question: questionId, ...(validate && { validate: "1" }) },
    });
  }
  function addQuestion() {
    const added = newQuestion();
    setDraft((d) => ({ ...d, questions: [...d.questions, added] }));
    setSelectedId(added.id);
    return added.id;
  }
  async function uploadEditorImage() {
    setUploads((n) => n + 1);
    try {
      return await pickImage();
    } finally {
      setUploads((n) => n - 1);
    }
  }
  async function save() {
    if (saveInFlight.current || uploads > 0) return;
    setError("");
    const invalid = editorValidation(draft, t);
    if (invalid) {
      if (invalid.question !== undefined) {
        const target = draft.questions[invalid.question]?.id ?? null;
        setMissingQuestion(false);
        setSelectedId(target);
        // The iOS list shows the problem; take the author to the question itself.
        if (Platform.OS === "ios" && target) openQuestion(target, true);
      }
      setError(invalid.message);
      return;
    }
    const payload = prepareQuizForSubmission({
      ...draft,
      questions: draft.questions.map((q, i) => ({
        ...q,
        order: i + 1,
        multiple: q.answers.filter((a) => a.is_correct).length > 1,
      })),
    });
    saveInFlight.current = true;
    setSaving(true);
    Keyboard.dismiss();
    try {
      const saved = id
        ? await api.patch<Quiz>(`quizzes/${id}/`, payload)
        : await api.post<Quiz>("quizzes/", payload);
      void qc.invalidateQueries({ queryKey: ["library"] });
      await finishSave(saved);
    } catch (failure) {
      if (mounted.current)
        setError(
          failure instanceof Error
            ? userError(failure, t)
            : t(
                "Nie udało się zapisać quizu. Spróbuj ponownie.",
                "Could not save the quiz. Try again.",
              ),
        );
    } finally {
      saveInFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  const dirty = !id || hasLocalDraft || draft !== baseline;
  // Question and details screens edit this draft through the editor store.
  useEffect(() => {
    if (!ready) return;
    publishEditor(key, {
      draft,
      update: setDraft,
      save,
      addQuestion,
      uploadImage: uploadEditorImage,
      saving,
      uploads,
      canSave: dirty,
    });
    // The published functions close over the current render's state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready, draft, saving, uploads, dirty]);
  useEffect(() => () => publishEditor(key, null), [key]);
  // "Edit this question" from a study session opens that question directly.
  const openedRequested = useRef(false);
  useEffect(() => {
    if (
      Platform.OS !== "ios" ||
      !ready ||
      !requestedQuestion ||
      openedRequested.current ||
      !draft.questions.some((q) => q.id === requestedQuestion)
    )
      return;
    openedRequested.current = true;
    openQuestion(requestedQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, requestedQuestion]);
  if (savedQuiz)
    return (
      <Screen>
        <Heading>{t("Quiz zapisany", "Quiz Saved")}</Heading>
        <Label>{savedQuiz.title}</Label>
        {error ? (
          <Label>{error}</Label>
        ) : (
          <Label>{t("Kończę zapisywanie…", "Finishing up…")}</Label>
        )}
        {error ? (
          <>
            <Button onPress={() => finishSave(savedQuiz)}>
              {t("Usuń zapisany szkic", "Clear Saved Draft")}
            </Button>
            <Button kind="secondary" onPress={() => openSavedQuiz(savedQuiz)}>
              {t("Otwórz zapisany quiz", "Open Saved Quiz")}
            </Button>
          </>
        ) : null}
      </Screen>
    );
  if (loadError)
    return (
      <ErrorScreen
        title={t("Nie udało się otworzyć quizu", "Couldn’t Open Quiz")}
        error={loadError}
        retry={() => {
          setLoadError(null);
          setLoadAttempt((attempt) => attempt + 1);
        }}
      />
    );
  if (!ready) return <Loading />;
  const index = Math.max(
    0,
    draft.questions.findIndex((q) => q.id === selectedId),
  );
  const question = draft.questions[index];
  function setIndex(next: number) {
    setMissingQuestion(false);
    setSelectedId(draft.questions[next]?.id ?? null);
  }
  function updateQuestion(patch: Partial<Question>) {
    setDraft((d) => ({
      ...d,
      questions: d.questions.map((q) =>
        q.id === question.id ? { ...q, ...patch } : q,
      ),
    }));
  }
  async function replaceQuestionImage() {
    const result = await uploadEditorImage();
    if (result)
      updateQuestion({
        image_upload: result.id,
        image_url: null,
        image: result.url ?? null,
        image_width: result.width ?? null,
        image_height: result.height ?? null,
      });
  }
  const clearedImage = {
    image: null,
    image_url: null,
    image_upload: null,
    image_width: null,
    image_height: null,
  };
  const editorMenu = (
    <Overflow
      glass
      label={t("Opcje edytora", "Editor options")}
      items={[
        {
          title: details
            ? t("Ukryj szczegóły", "Hide Details")
            : t(
                "Opis, obrazy i wyjaśnienie",
                "Description, images and explanation",
              ),
          onPress: () => setDetails((v) => !v),
        },
        {
          title: t("Eksportuj JSON", "Export JSON"),
          onPress: () => exportJson(draft.title || "quiz", draft),
        },
        ...(id
          ? [
              {
                title: t("Usuń quiz", "Delete Quiz"),
                destructive: true,
                onPress: () =>
                  confirm(
                    t("Usunąć quiz?", "Delete Quiz?"),
                    t(
                      "Quiz zostanie przeniesiony do kosza.",
                      "The quiz will be moved to trash.",
                    ),
                    async () => {
                      await api.delete(`quizzes/${id}/`);
                      await qc.invalidateQueries({
                        queryKey: ["library"],
                      });
                      router.replace("/library");
                    },
                    { action: t("Usuń", "Delete") },
                  ),
              },
            ]
          : []),
      ].map((item) => ({ ...item, disabled: saving }))}
    />
  );
  if (Platform.OS === "ios")
    return (
      <View style={{ flex: 1 }}>
        <Stack.Screen
          options={{
            title: id
              ? t("Edytuj quiz", "Edit Quiz")
              : t("Nowy quiz", "New Quiz"),
            headerBackVisible: saving ? false : undefined,
            headerBackButtonDisplayMode: "minimal",
            gestureEnabled: !saving,
          }}
        />
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu
            icon="ellipsis"
            accessibilityLabel={t("Opcje edytora", "Editor options")}
          >
            <Stack.Toolbar.MenuAction
              icon="square.and.arrow.up"
              onPress={() =>
                void exportJson(draft.title || "quiz", draft).catch(
                  (failure: unknown) =>
                    notify(
                      t("Nie wyeksportowano quizu", "Couldn’t Export Quiz"),
                      userError(failure, t),
                    ),
                )
              }
            >
              {t("Eksportuj JSON", "Export JSON")}
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              icon="arrow.uturn.backward"
              destructive
              hidden={id ? !dirty : !hasLocalDraft && draft === baseline}
              onPress={() =>
                confirm(
                  t("Odrzucić zmiany?", "Discard Changes?"),
                  t(
                    "Niezapisane zmiany zostaną usunięte z tego urządzenia.",
                    "Unsaved changes will be removed from this device.",
                  ),
                  async () => {
                    await writer.discard();
                    setError("");
                    if (id) setLoadAttempt((attempt) => attempt + 1);
                    else {
                      const blank = {
                        title: "",
                        description: "",
                        questions: [newQuestion()],
                      };
                      setHasLocalDraft(false);
                      setBaseline(blank);
                      setDraft(blank);
                    }
                  },
                  { action: t("Odrzuć", "Discard") },
                )
              }
            >
              {t("Odrzuć zmiany", "Discard Changes")}
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              icon="trash"
              destructive
              hidden={!id}
              onPress={() =>
                confirm(
                  t("Usunąć quiz?", "Delete Quiz?"),
                  t(
                    "Quiz zostanie przeniesiony do kosza.",
                    "The quiz will be moved to trash.",
                  ),
                  async () => {
                    await api.delete(`quizzes/${id}/`);
                    await qc.invalidateQueries({ queryKey: ["library"] });
                    router.replace("/library");
                  },
                  { action: t("Usuń", "Delete") },
                )
              }
            >
              {t("Usuń quiz", "Delete Quiz")}
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
          <Stack.Toolbar.Button
            variant="prominent"
            tintColor={c.prominent}
            disabled={saving || uploads > 0 || !dirty}
            onPress={() => void save()}
          >
            {saving ? t("Zapisywanie…", "Saving…") : t("Zapisz", "Save")}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
        <EditorOverview
          title={draft.title}
          description={draft.description}
          questions={draft.questions}
          error={
            error ||
            (missingQuestion
              ? t(
                  "Tego pytania nie ma już w szkicu. Wybierz inne pytanie z listy.",
                  "This question is no longer in the draft. Choose another question from the list.",
                )
              : "")
          }
          openDetails={() =>
            router.push({ pathname: "/editor-details", params: { key } })
          }
          openQuestion={openQuestion}
          move={(from, to) =>
            setDraft((d) => {
              const questions = [...d.questions];
              const [moved] = questions.splice(from, 1);
              questions.splice(to > from ? to - 1 : to, 0, moved);
              return { ...d, questions };
            })
          }
          remove={(index) =>
            confirm(
              t("Usunąć pytanie?", "Delete Question?"),
              t(
                "Zmiana zostanie zastosowana po zapisaniu quizu.",
                "This change takes effect when you save the quiz.",
              ),
              () =>
                setDraft((d) => ({
                  ...d,
                  questions: d.questions.filter((_, i) => i !== index),
                })),
              { action: t("Usuń", "Delete") },
            )
          }
          add={() => openQuestion(addQuestion())}
        />
      </View>
    );
  return (
    <Screen
      footer={
        <View style={{ gap: 8 }}>
          {error ? (
            <Label>{error}</Label>
          ) : missingQuestion ? (
            <Label>
              {t(
                "Tego pytania nie ma już w szkicu. Wybierz inne pytanie z listy.",
                "This question is no longer in the draft. Choose another question from the list.",
              )}
            </Label>
          ) : null}
          {uploads > 0 ? (
            <Label>{t("Wysyłam obraz…", "Uploading image…")}</Label>
          ) : null}
          {Platform.OS === "android" ? (
            // Material 3 bottom app bar on Android.
            <EditorBottomBar
              position={`${draft.questions.length ? index + 1 : 0} / ${draft.questions.length}`}
              positionLabel={t(
                `Pytanie ${draft.questions.length ? index + 1 : 0} z ${draft.questions.length}`,
                `Question ${draft.questions.length ? index + 1 : 0} of ${draft.questions.length}`,
              )}
              canPrevious={index > 0}
              canNext={index < draft.questions.length - 1}
              disabled={saving}
              saveDisabled={saving || uploads > 0}
              saveLabel={t("Zapisz", "Save")}
              previous={() => setIndex(index - 1)}
              next={() => setIndex(index + 1)}
              add={() => {
                const added = newQuestion();
                setDraft((d) => ({
                  ...d,
                  questions: [...d.questions, added],
                }));
                setSelectedId(added.id);
              }}
              openList={() => {
                Keyboard.dismiss();
                setOverview(true);
              }}
              save={() => void save()}
            />
          ) : (
            <>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <EditorAction
                  label={t("Poprzednie pytanie", "Previous Question")}
                  action="previous"
                  disabled={saving || index === 0}
                  onPress={() => setIndex(index - 1)}
                />
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Button
                    kind="secondary"
                    disabled={saving}
                    onPress={() => {
                      Keyboard.dismiss();
                      setOverview(true);
                    }}
                  >
                    {t(
                      `Pytanie ${draft.questions.length ? index + 1 : 0} z ${draft.questions.length}`,
                      `Question ${draft.questions.length ? index + 1 : 0} of ${draft.questions.length}`,
                    )}
                  </Button>
                </View>
                <EditorAction
                  label={t("Następne pytanie", "Next Question")}
                  action="next"
                  disabled={saving || index >= draft.questions.length - 1}
                  onPress={() => setIndex(index + 1)}
                />
                <View style={{ marginLeft: 12 }}>
                  <EditorAction
                    label={t("Dodaj pytanie", "Add Question")}
                    action="add"
                    disabled={saving}
                    onPress={() => {
                      const added = newQuestion();
                      setDraft((d) => ({
                        ...d,
                        questions: [...d.questions, added],
                      }));
                      setSelectedId(added.id);
                    }}
                  />
                </View>
              </View>
              <Button disabled={saving || uploads > 0} onPress={save}>
                {t("Zapisz quiz", "Save Quiz")}
              </Button>
            </>
          )}
        </View>
      }
    >
      {overview && (
        <EditorQuestions
          questions={draft.questions}
          selectedId={question?.id ?? ""}
          onClose={() => setOverview(false)}
          onSelect={(id) => {
            const next = draft.questions.findIndex((q) => q.id === id);
            if (next >= 0) setIndex(next);
            setOverview(false);
          }}
          onMove={(id, beforeId) => {
            setSelectedId(question?.id ?? null);
            setDraft((d) => ({
              ...d,
              questions: moveQuestion(d.questions, id, beforeId),
            }));
          }}
        />
      )}
      <Stack.Screen
        options={{
          title: id
            ? t("Edytuj quiz", "Edit Quiz")
            : t("Nowy quiz", "New Quiz"),
          ...headerAction(() => editorMenu),
        }}
      />
      <Field
        editable={!saving}
        label={t("Tytuł quizu", "Quiz title")}
        value={draft.title}
        onChangeText={(title) => setDraft((d) => ({ ...d, title }))}
      />
      {details ? (
        <Field
          editable={!saving}
          label={t("Opis", "Description")}
          multiline
          value={draft.description}
          onChangeText={(description) =>
            setDraft((d) => ({ ...d, description }))
          }
        />
      ) : null}
      {question ? (
        <>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Heading small>
              {t(
                `Pytanie ${index + 1} z ${draft.questions.length}`,
                `Question ${index + 1} of ${draft.questions.length}`,
              )}
            </Heading>
            <Overflow
              label={t("Opcje pytania", "Question options")}
              items={[
                {
                  title: t("Dodaj zdjęcie pytania", "Add Question Image"),
                  disabled: saving,
                  onPress: replaceQuestionImage,
                },
                {
                  title: t("Usuń pytanie", "Delete Question"),
                  disabled: saving,
                  destructive: true,
                  onPress: () =>
                    confirm(
                      t("Usunąć pytanie?", "Delete Question?"),
                      t(
                        "Zmiana zostanie zastosowana po zapisaniu quizu.",
                        "This change takes effect when you save the quiz.",
                      ),
                      () => {
                        setDraft((d) => ({
                          ...d,
                          questions: d.questions.filter((_, i) => i !== index),
                        }));
                        setIndex(Math.max(0, index - 1));
                      },
                      { action: t("Usuń", "Delete") },
                    ),
                },
              ]}
            />
          </View>
          <Field
            editable={!saving}
            key={question.id}
            label={t("Treść pytania", "Question text")}
            multiline
            value={question.text}
            onChangeText={(text) => updateQuestion({ text })}
          />
          {question.image || question.image_url || question.image_upload ? (
            <EditorImage
              key={`${question.id}:${question.image_url ?? question.image}`}
              uri={question.image_url || question.image}
              label={t("Ilustracja pytania", "Question image")}
              disabled={saving}
              onReplace={replaceQuestionImage}
              onRemove={() => updateQuestion(clearedImage)}
            />
          ) : null}
          {details ? (
            <Field
              editable={!saving}
              nativeBuffer={false}
              key={`image-url:${question.id}`}
              label={t("Adres obrazu pytania", "Question image URL")}
              value={question.image_url ?? ""}
              autoCapitalize="none"
              onChangeText={(image_url) =>
                updateQuestion({
                  image_url: image_url || null,
                  image_upload: null,
                  image: null,
                  image_width: null,
                  image_height: null,
                })
              }
            />
          ) : null}
          {question.answers.map((answer, i) => (
            <AnswerEditor
              key={answer.id}
              answer={answer}
              index={i}
              questionId={question.id}
              canDelete={question.answers.length > 1}
              disabled={saving}
              onPatch={patchAnswer}
              onRemove={removeAnswer}
              onUpload={replaceAnswerImage}
            />
          ))}
          <Button
            kind="secondary"
            disabled={saving}
            onPress={() =>
              updateQuestion({
                answers: [
                  ...question.answers,
                  {
                    id: Crypto.randomUUID(),
                    order: question.answers.length,
                    text: "",
                    is_correct: false,
                  },
                ],
              })
            }
          >
            {t("Dodaj odpowiedź", "Add Answer")}
          </Button>
          {details ? (
            <Field
              editable={!saving}
              key={`explanation:${question.id}`}
              label={t("Wyjaśnienie", "Explanation")}
              multiline
              value={question.explanation ?? ""}
              onChangeText={(explanation) => updateQuestion({ explanation })}
            />
          ) : null}
        </>
      ) : null}
      <Label muted>
        {t(
          "Szkic zapisuje się na tym urządzeniu. Zapisz quiz, aby korzystać z niego na innych urządzeniach.",
          "Your draft is saved on this device. Save the quiz to use it on your other devices.",
        )}
      </Label>
    </Screen>
  );
}
