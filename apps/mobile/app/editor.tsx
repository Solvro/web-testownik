import { userError } from "../src/lib/user-error";
import { headerAction } from "../src/components/header-action";
import type { Question, Quiz } from "@testownik/core/quiz/types";
import { prepareQuizForSubmission } from "@testownik/core/quiz/schema";
import { editorValidation } from "../src/lib/editor-validation";
import { useLocale } from "../src/lib/locale";
import { useConfirm } from "../src/lib/alerts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  EmptyState,
  Heading,
  Label,
  Loading,
  Screen,
  notify,
} from "../src/components/ui";
import { api } from "../src/lib/api";
import { DraftWriter, waitForDraftWrites } from "../src/lib/draft-writer";
import { runEditorSave, waitForEditorSave } from "../src/lib/editor-save";
import { exportJson, pickImage } from "../src/lib/files";
import { useSession } from "../src/lib/session";
import { storage } from "../src/lib/storage";
import { ApiError } from "../src/lib/client";
import {
  editorDraftFromQuiz,
  isQuizVersion,
  restoreEditorDraft,
  type EditorDraft as Draft,
} from "../src/lib/editor-draft";

import {
  assertQuizCreateAckFits,
  acknowledgeQuizCreate,
  adoptCreatedDraft,
  clearQuizCreate,
  createQuiz,
  loadQuizCreate,
  postQuizCreate,
  sameDraftContent,
  QuizCreateError,
  type QuizCreateOperation,
  type QuizRef,
} from "../src/lib/quiz-create";

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
export default function Editor() {
  const { id, question } = useLocalSearchParams<{
    id?: string;
    question?: string;
  }>();
  const { user } = useSession();
  const { t } = useLocale();
  const routeId = typeof id === "string" && id.trim() ? id : undefined;
  const requestedQuestion =
    routeId && typeof question === "string" && question.trim()
      ? question
      : undefined;
  if ((id !== undefined && !routeId) || (question !== undefined && !routeId))
    return (
      <EmptyState
        symbol="books.vertical"
        ionicon="library-outline"
        title={t("Wybierz quiz", "Choose a Quiz")}
        description={t(
          "Otwórz quiz z biblioteki, aby go edytować.",
          "Open a quiz from the library to edit it.",
        )}
        actions={[
          {
            label: t("Przeglądaj bibliotekę", "Browse Library"),
            onPress: () => router.dismissTo("/library"),
          },
        ]}
      />
    );
  return (
    <EditorForm
      key={`${user?.id}:${routeId ?? "new"}:${requestedQuestion ?? ""}`}
      routeId={routeId}
      requestedQuestion={requestedQuestion}
    />
  );
}
function EditorForm({
  routeId,
  requestedQuestion,
}: {
  routeId?: string;
  requestedQuestion?: string;
}) {
  const [client] = useState(() => api.forSession());
  const { t } = useLocale();
  const c = useTheme();
  const confirm = useConfirm();
  const s = useSession(),
    qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => ({
      schemaVersion: 1,
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
    [savedQuiz, setSavedQuiz] = useState<QuizRef | null>(null),
    [uploads, setUploads] = useState(0),
    [saving, setSaving] = useState(false),
    [hasLocalDraft, setHasLocalDraft] = useState(false),
    [writerGeneration, setWriterGeneration] = useState(0),
    [saveConflict, setSaveConflict] = useState(false),
    [createOperation, setCreateOperation] =
      useState<QuizCreateOperation | null>(null),
    [createBlocked, setCreateBlocked] = useState(false),
    [createSuperseded, setCreateSuperseded] = useState(false);
  const id =
    routeId ??
    (createOperation?.state === "created"
      ? createOperation.result?.quiz.id
      : undefined);
  const pendingCreate = createOperation?.state === "pending";
  const inaccessibleCreate =
    createOperation?.state === "access-lost" ||
    createOperation?.state === "deleted";
  const mounted = useRef(true);
  const saveInFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [baseline, setBaseline] = useState(draft);
  const key = `draft.${s.user?.id}.${routeId ?? "new"}`;
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
    // A successful discard retires the old writer, even when the key is unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, draftWriteFailed, writerGeneration],
  );
  useEffect(() => {
    let active = true;
    (async () => {
      await waitForEditorSave(key);
      await waitForDraftWrites(storage, key);
      const saved = await storage.read<Draft | null>(key, null);
      let operation: QuizCreateOperation | null = null;
      if (!routeId && s.user?.id) {
        try {
          operation = await loadQuizCreate(storage, s.user.id);
        } catch {
          if (active) {
            setCreateBlocked(true);
            setError(
              t(
                "Nie można odczytać zapisu poprzedniego tworzenia quizu. Zachowaliśmy szkic. Wyeksportuj go i skontaktuj się z pomocą przed ponownym zapisem.",
                "Could not read the previous save record. Your draft was kept. Export it and contact support before saving again.",
              ),
            );
          }
        }
      }
      const recovered =
        saved ?? operation?.acknowledged?.snapshot ?? operation?.snapshot;
      const loadedQuiz =
        !recovered && routeId
          ? await client.request<Quiz>(`quizzes/${routeId}/`)
          : null;
      let initial = recovered
        ? restoreEditorDraft(recovered)
        : loadedQuiz
          ? editorDraftFromQuiz(loadedQuiz)
          : null;
      if (initial && operation?.result) {
        initial = adoptCreatedDraft(initial, operation.result);
        if (
          operation.acknowledged &&
          sameDraftContent(initial, operation.acknowledged.snapshot)
        ) {
          initial = {
            ...initial,
            baseVersion: operation.acknowledged.quiz.version,
          };
          if (active) {
            setSavedQuiz(operation.acknowledged.quiz);
            setError(
              t(
                "Quiz jest już zapisany. Dokończ usuwanie jego lokalnego szkicu lub otwórz quiz.",
                "Your quiz is already saved. Finish clearing its local draft or open the quiz.",
              ),
            );
          }
        }
      }
      if (active) {
        // Keep permission metadata from the initial GET even when there was no
        // restored draft. Reuse it without issuing another initial request.
        if (loadedQuiz)
          qc.setQueryData(
            ["editor-server-version", s.user?.id, routeId],
            loadedQuiz,
          );
        setCreateOperation(operation);
        if (initial) {
          setHasLocalDraft(recovered !== null && recovered !== undefined);
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
    // Ownership and route identity are already included in the draft key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, routeId, requestedQuestion, loadAttempt, client]);
  const serverVersion = useQuery({
    queryKey: ["editor-server-version", s.user?.id, id],
    queryFn: async () => {
      try {
        return await client.request<Quiz>(`quizzes/${id}/`);
      } catch (failure) {
        if (failure instanceof ApiError && [403, 404].includes(failure.status))
          return null;
        throw failure;
      }
    },
    enabled: !!id && ready && hasLocalDraft && !saving,
    gcTime: 0,
  });
  const savedVersionUnavailable =
    serverVersion.data === null || serverVersion.data?.can_edit === false;
  const conflict = inaccessibleCreate
    ? "unavailable"
    : id
      ? savedVersionUnavailable
        ? "unavailable"
        : saveConflict
          ? "changed"
          : !isQuizVersion(draft.baseVersion)
            ? "unknown"
            : hasLocalDraft &&
                serverVersion.data &&
                serverVersion.data.version !== draft.baseVersion
              ? "changed"
              : null
      : null;
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
  function openSavedQuiz(saved: Quiz | QuizRef) {
    if (!mounted.current) return;
    // Keep Study progress and its stale/storage notices until the authoritative
    // refresh is durably cached. PATCH responses contain only quiz content.
    if ("questions" in saved)
      qc.setQueryData<Quiz>(
        ["quiz", saved.id, s.user?.id],
        (previous) => previous ?? saved,
      );
    void qc.invalidateQueries({ queryKey: ["library"] });
    void qc.invalidateQueries({ queryKey: ["quiz", saved.id] });
    // Reuse the study screen when editing from it; creating from the library
    // falls back to replacing the editor because this quiz is not on the stack.
    router.dismissTo({ pathname: "/quiz/[id]", params: { id: saved.id } });
  }
  async function finishSave(
    saved: Quiz | QuizRef,
    operation = createOperation,
  ) {
    try {
      const submitted = operation?.result
        ? adoptCreatedDraft(draft, operation.result)
        : draft;
      if (operation && s.user?.id)
        await acknowledgeQuizCreate(
          storage,
          s.user.id,
          operation.requestId,
          submitted,
          saved,
        );
      if (!mounted.current) {
        const removed = await writer.discardIfUnchanged(
          () => storage.read<Draft | null>(key, null),
          (persisted) =>
            persisted !== null &&
            sameDraftContent(
              operation?.result
                ? adoptCreatedDraft(
                    restoreEditorDraft(persisted),
                    operation.result,
                  )
                : restoreEditorDraft(persisted),
              submitted,
            ),
        );
        if (removed && operation && s.user?.id)
          await clearQuizCreate(storage, s.user.id, operation.requestId);
        return;
      }
      await writer.discard();
      if (operation && s.user?.id)
        await clearQuizCreate(storage, s.user.id, operation.requestId);
      openSavedQuiz(saved);
    } catch (failure) {
      if (!mounted.current) throw failure;
      setSavedQuiz(saved);
      setError(
        t(
          "Quiz jest zapisany. Nie udało się usunąć lokalnego szkicu. Spróbuj ponownie, aby go uporządkować.",
          "Your quiz is saved. Could not remove the local draft. Retry to finish cleaning it up.",
        ),
      );
    }
  }
  function discardChanges() {
    if (saving || uploads > 0 || pendingCreate || createBlocked) return;
    confirm(
      t("Odrzucić zmiany?", "Discard Changes?"),
      t(
        "Niezapisane zmiany zostaną usunięte z tego urządzenia.",
        "Unsaved changes will be removed from this device.",
      ),
      async () => {
        if (!mounted.current || saveInFlight.current || uploads > 0) return;
        setReady(false);
        let writerRetired = false;
        try {
          // Keep the local draft if the saved quiz cannot be fetched.
          const latest = id
            ? await client.request<Quiz>(`quizzes/${id}/`)
            : null;
          const initial: Draft = latest
            ? editorDraftFromQuiz(latest)
            : {
                schemaVersion: 1,
                title: "",
                description: "",
                questions: [newQuestion()],
              };
          if (!mounted.current) return;
          writerRetired = true;
          await writer.discard();
          if (createOperation && s.user?.id)
            await clearQuizCreate(
              storage,
              s.user.id,
              createOperation.requestId,
            );
          if (!mounted.current) return;
          if (!routeId && latest) {
            openSavedQuiz(latest);
            return;
          }
          setCreateOperation(null);
          setError("");
          setHasLocalDraft(false);
          setSaveConflict(false);
          setBaseline(initial);
          setDraft(initial);
          setSelectedId(null);
          setMissingQuestion(false);
        } catch (failure) {
          if (
            mounted.current &&
            failure instanceof ApiError &&
            [403, 404].includes(failure.status)
          ) {
            qc.setQueryData(["editor-server-version", s.user?.id, id], null);
            return;
          }
          throw failure;
        } finally {
          if (mounted.current) {
            // A discarded writer ignores later writes, including when removal
            // failed. Keep protecting subsequent edits with a fresh writer.
            if (writerRetired)
              setWriterGeneration((generation) => generation + 1);
            setReady(true);
          }
        }
      },
      { action: t("Odrzuć", "Discard") },
    );
  }
  function removeLocalDraft() {
    if (saving || uploads > 0) return;
    confirm(
      t("Usunąć lokalny szkic?", "Remove Local Draft?"),
      t(
        "Niezapisane zmiany na tym urządzeniu zostaną usunięte. Aby je zachować, najpierw wyeksportuj szkic. Zapisanego quizu nie usuniemy.",
        "Unsaved changes on this device will be removed. Export the draft first to keep a copy. The saved quiz will stay unchanged.",
      ),
      async () => {
        if (!mounted.current || saveInFlight.current || uploads > 0) return;
        setReady(false);
        try {
          await writer.discard();
          if (createOperation && s.user?.id)
            await clearQuizCreate(
              storage,
              s.user.id,
              createOperation.requestId,
            );
          if (mounted.current) router.dismissTo("/library");
        } catch (failure) {
          if (mounted.current) {
            // Removal retires the writer even on failure. Success keeps it
            // retired until navigation unmounts this screen.
            setWriterGeneration((generation) => generation + 1);
            setReady(true);
          }
          throw failure;
        }
      },
      { action: t("Usuń lokalny szkic", "Remove Local Draft") },
    );
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
    if (conflict || createBlocked) return;
    setError("");
    const invalid = pendingCreate ? null : editorValidation(draft, t);
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
    const payload =
      pendingCreate && createOperation?.payload
        ? createOperation.payload
        : prepareQuizForSubmission({
            ...draft,
            questions: draft.questions.map((q, i) => ({
              ...q,
              order: i + 1,
              multiple:
                q.multiple || q.answers.filter((a) => a.is_correct).length > 1,
            })),
          });
    saveInFlight.current = true;
    setSaving(true);
    Keyboard.dismiss();
    try {
      await runEditorSave(key, async () => {
        let operation = createOperation;
        let saved: Quiz | QuizRef;
        if (id) {
          if (operation?.state === "created")
            assertQuizCreateAckFits(
              operation,
              adoptCreatedDraft(draft, operation.result!),
            );
          saved = await client.patch<Quiz>(`quizzes/${id}/`, {
            ...payload,
            expected_version: draft.baseVersion,
          });
        } else {
          if (!s.user?.id) throw new QuizCreateError("local");
          operation = await createQuiz({
            store: storage,
            owner: s.user.id,
            snapshot: draft,
            payload,
            newId: Crypto.randomUUID,
            post: (body) => postQuizCreate(client, body),
          });
          if (!operation.result || !operation.acknowledged)
            throw new QuizCreateError("response");
          saved = operation.acknowledged.quiz;
          if (mounted.current) setCreateOperation(operation);
          const adopted = adoptCreatedDraft(draft, operation.result);
          if (!sameDraftContent(adopted, operation.acknowledged.snapshot)) {
            if (
              operation.acknowledged.quiz.version >
              operation.result.created_version
            ) {
              // Another context already saved later edits. Keep its persisted
              // draft intact and let this editor explicitly recover the conflict.
              if (mounted.current) setSaveConflict(true);
              return;
            }
            // Confirm the original operation first. Later edits target that quiz,
            // with original-version CAS and the server's actual nested IDs.
            if (mounted.current) {
              setDraft(adopted);
              setBaseline(operation.acknowledged.snapshot);
              setHasLocalDraft(true);
              await writer.flush();
              await storage.write(key, adopted);
              const persisted = await storage.readStrict<Draft | null>(
                key,
                null,
              );
              if (!persisted || !sameDraftContent(persisted, adopted))
                throw new QuizCreateError("local");
              setError(
                t(
                  "Poprzedni quiz jest zapisany. Późniejsze zmiany zostały w szkicu. Sprawdź je i zapisz ponownie, aby zaktualizować ten quiz.",
                  "The original quiz is saved. Your later edits are still in the draft. Review and save again to update that quiz.",
                ),
              );
            }
            return;
          }
        }
        void qc.invalidateQueries({ queryKey: ["library"] });
        await finishSave(saved, operation);
      });
    } catch (failure) {
      if (
        id &&
        mounted.current &&
        failure instanceof ApiError &&
        [403, 404].includes(failure.status)
      )
        qc.setQueryData(["editor-server-version", s.user?.id, id], null);
      if (
        id &&
        mounted.current &&
        failure instanceof ApiError &&
        failure.status === 409
      ) {
        setSaveConflict(true);
        return;
      }
      if (
        mounted.current &&
        failure instanceof QuizCreateError &&
        failure.reason === "superseded"
      ) {
        writer.retire();
        setCreateBlocked(true);
        setCreateSuperseded(true);
        setError("");
        return;
      }
      if (!routeId && s.user?.id) {
        try {
          const operation = await loadQuizCreate(storage, s.user.id);
          if (mounted.current) setCreateOperation(operation);
        } catch {
          if (mounted.current) setCreateBlocked(true);
        }
      }
      if (mounted.current && failure instanceof QuizCreateError) {
        setError(
          failure.reason === "size"
            ? t(
                "Ten quiz jest zbyt duży, aby bezpiecznie zapisać go na tym urządzeniu. Wyeksportuj szkic i podziel go na mniejsze quizy.",
                "This quiz is too large to save safely on this device. Export your draft and split it into smaller quizzes.",
              )
            : failure.reason === "rejected"
              ? t(
                  "Serwer odrzucił poprzedni zapis. Szkic pozostał na urządzeniu. Sprawdź go i zapisz ponownie.",
                  "The server rejected the original save. Your draft is still on this device. Review it and save again.",
                )
              : failure.reason === "deleted" || failure.reason === "access-lost"
                ? t(
                    "Poprzednio utworzony quiz został usunięty lub nie możesz go już edytować. Zachowaliśmy szkic; wyeksportuj go, aby zachować kopię.",
                    "The previously created quiz was deleted or you can no longer edit it. Your draft was kept; export it to keep a copy.",
                  )
                : t(
                    "Nie udało się potwierdzić poprzedniego zapisu. Szkic i zapis odzyskiwania pozostały na urządzeniu. Spróbuj ponownie.",
                    "Could not confirm the previous save. Your draft and recovery record are still on this device. Try again.",
                  ),
        );
        return;
      }
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
  const canDiscard =
    !pendingCreate &&
    !inaccessibleCreate &&
    !createBlocked &&
    (hasLocalDraft || draft !== baseline);
  const restoredNotice = hasLocalDraft
    ? id
      ? t(
          "Przywrócono szkic z tego urządzenia. Aby wrócić do zapisanej wersji, wybierz „Odrzuć zmiany” w opcjach edytora.",
          "A draft was restored from this device. To return to the saved version, choose Discard Changes in Editor options.",
        )
      : t(
          "Przywrócono szkic z tego urządzenia. Aby zacząć od nowa, wybierz „Odrzuć zmiany” w opcjach edytora.",
          "A draft was restored from this device. To start again, choose Discard Changes in Editor options.",
        )
    : "";
  const versionNotice =
    conflict === "unavailable"
      ? t(
          "Nie można znaleźć zapisanego quizu lub nie masz już do niego dostępu, więc nie można zapisać tego szkicu. Twój szkic nadal jest na tym urządzeniu. Wyeksportuj go, aby zachować kopię.",
          "The saved quiz can’t be found or you no longer have access, so this draft can’t be saved. Your draft is still on this device. Export it to keep a copy.",
        )
      : conflict === "changed"
        ? t(
            "Zapisany quiz zmienił się od rozpoczęcia tego szkicu. Twoje zmiany są bezpieczne na urządzeniu. Wyeksportuj szkic lub wczytaj zapisaną wersję przed dalszym zapisywaniem.",
            "The saved quiz changed since this draft was started. Your changes are safe on this device. Export your draft or load the saved version before saving again.",
          )
        : conflict === "unknown"
          ? t(
              "Nie znamy wersji quizu, na której powstał ten starszy szkic. Wyeksportuj go, aby zachować zmiany, lub wczytaj zapisaną wersję przed dalszym zapisywaniem.",
              "The original quiz version for this older draft is unknown. Export it to keep your changes, or load the saved version before saving again.",
            )
          : "";
  const createNotice = createSuperseded
    ? t(
        "Ten zapis został zakończony lub zastąpiony w innej karcie. Szkic jest nadal widoczny tutaj i możesz go wyeksportować. Wróć do Biblioteki i otwórz quiz ponownie, aby kontynuować.",
        "This save was completed or replaced in another tab. Your draft is still visible here and can be exported. Return to Library and reopen the quiz to continue.",
      )
    : createBlocked
      ? t(
          "Nie można odczytać zapisu odzyskiwania. Eksportuj szkic i skontaktuj się z pomocą przed ponownym zapisem.",
          "The recovery record cannot be read. Export your draft and contact support before saving again.",
        )
      : pendingCreate
        ? t(
            "Wynik poprzedniego zapisu jest nieznany. Zapisz ponownie, aby potwierdzić ten sam quiz. Późniejsze zmiany pozostaną w szkicu.",
            "The previous save result is unknown. Save again to confirm that same quiz. Later edits will stay in your draft.",
          )
        : "";
  const notice = createNotice || versionNotice || restoredNotice;
  const noticeActions: {
    label: string;
    onPress: () => void;
    destructive?: boolean;
  }[] =
    conflict || pendingCreate || createBlocked
      ? [
          {
            label: t("Eksportuj szkic", "Export Draft"),
            onPress: () =>
              void exportJson(draft.title || "quiz", draft).catch(
                (failure: unknown) =>
                  notify(
                    t("Nie wyeksportowano quizu", "Couldn’t Export Quiz"),
                    userError(failure, t),
                  ),
              ),
          },
          ...(createSuperseded
            ? [
                {
                  label: t("Wróć do Biblioteki", "Back to Library"),
                  onPress: () => router.replace("/library"),
                },
              ]
            : []),
          ...(!conflict || inaccessibleCreate
            ? []
            : [
                {
                  label:
                    conflict === "unavailable"
                      ? t("Sprawdź ponownie", "Check Again")
                      : t("Wczytaj zapisaną wersję", "Load Saved Version"),
                  onPress:
                    conflict === "unavailable"
                      ? async () => {
                          const result = await serverVersion.refetch();
                          if (result.error)
                            notify(
                              t("Nie sprawdzono quizu", "Couldn’t Check Quiz"),
                              userError(result.error, t),
                            );
                        }
                      : discardChanges,
                },
              ]),
          ...(conflict === "unavailable"
            ? [
                {
                  label: t("Usuń lokalny szkic", "Remove Local Draft"),
                  onPress: removeLocalDraft,
                  destructive: true,
                },
              ]
            : []),
        ]
      : [];
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
      canSave: dirty && !conflict && !createBlocked,
    });
    // The published functions close over the current render's state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    key,
    ready,
    draft,
    saving,
    uploads,
    dirty,
    conflict,
    createBlocked,
    createOperation,
  ]);
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
        <Label>{draft.title}</Label>
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
      items={
        // Mapping menu entries does not invoke their press callbacks or read refs.
        // eslint-disable-next-line react-hooks/refs
        [
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
          ...(canDiscard
            ? [
                {
                  title: t("Odrzuć zmiany", "Discard Changes"),
                  destructive: true,
                  onPress: discardChanges,
                },
              ]
            : []),
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
                        await client.delete(`quizzes/${id}/`);
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
        ].map((item) => ({ ...item, disabled: saving || uploads > 0 }))
      }
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
              disabled={saving || uploads > 0}
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
              hidden={!canDiscard}
              disabled={saving || uploads > 0}
              onPress={discardChanges}
            >
              {t("Odrzuć zmiany", "Discard Changes")}
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              icon="trash"
              destructive
              hidden={!id}
              disabled={saving || uploads > 0}
              onPress={() =>
                confirm(
                  t("Usunąć quiz?", "Delete Quiz?"),
                  t(
                    "Quiz zostanie przeniesiony do kosza.",
                    "The quiz will be moved to trash.",
                  ),
                  async () => {
                    await client.delete(`quizzes/${id}/`);
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
            disabled={
              saving || uploads > 0 || !dirty || !!conflict || createBlocked
            }
            onPress={() => void save()}
          >
            {saving ? t("Zapisywanie…", "Saving…") : t("Zapisz", "Save")}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
        <EditorOverview
          title={draft.title}
          description={draft.description}
          questions={draft.questions}
          notice={notice}
          noticeActions={noticeActions}
          busy={saving || uploads > 0}
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
              saveDisabled={
                saving || uploads > 0 || !!conflict || createBlocked
              }
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
              <Button
                disabled={saving || uploads > 0 || !!conflict || createBlocked}
                onPress={save}
              >
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
      {notice ? <Label>{notice}</Label> : null}
      {/* Mapping actions stores event callbacks; only a confirmed press reads refs. */}
      {/* eslint-disable-next-line react-hooks/refs */}
      {noticeActions.map((action) => (
        <Button
          key={action.label}
          kind={action.destructive ? "danger" : "secondary"}
          disabled={saving || uploads > 0}
          onPress={action.onPress}
        >
          {action.label}
        </Button>
      ))}
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
