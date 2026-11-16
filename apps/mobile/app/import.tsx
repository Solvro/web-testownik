import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { Stack, router, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { ZodError } from "zod";
import {
  Button,
  ErrorState,
  Field,
  Heading,
  Label,
  Loading,
  Screen,
} from "../src/components/ui";
import { Collection, CollectionDivider } from "../src/components/Collection";
import CollectionRow from "../src/components/native/CollectionRow";
import SettingsGroup from "../src/components/SettingsGroup";
import { api } from "../src/lib/api";
import {
  normalizeImport,
  readArchive,
  uploadImportedImages,
} from "../src/lib/importer";
import { editorValidation } from "../src/lib/editor-validation";
import { parseQuestion } from "../src/lib/legacy-parser";
import { useLocale } from "../src/lib/locale";
import { openImportFile } from "../src/lib/import-file";

import { useSession } from "../src/lib/session";
import { storage } from "../src/lib/storage";
import {
  beginImport,
  clearImport,
  importPreview,
  ImportCreateError,
  loadImport,
  preflightImport,
  postImport,
  resumeImport,
  type ImportOperation,
} from "../src/lib/import-create";

type Preview = ReturnType<typeof normalizeImport>;
export default function Import() {
  const { user } = useSession();
  return <ImportForm key={user?.id} />;
}
function ImportForm() {
  const { user } = useSession();
  const owner = user?.id ?? "";
  const [ready, setReady] = useState(false);
  const [operation, setOperation] = useState<ImportOperation | null>(null);
  const [recoveryError, setRecoveryError] = useState<unknown>(null);
  const [client] = useState(() => api.forSession());
  const cache = useQueryClient();
  const navigation = useNavigation();
  const mounted = useRef(true);
  const allowRemoval = useRef(false);
  const { t } = useLocale();
  const [text, setText] = useState(""),
    [paste, setPaste] = useState(false),
    [preview, setPreview] = useState<Preview | null>(null),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const uploaded = useRef(new Map<string, string>()),
    lock = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const recover = useCallback(
    () =>
      loadImport(storage, owner).then(
        (saved) => {
          if (mounted.current) {
            setOperation(saved);
            setRecoveryError(null);
            setReady(true);
          }
        },
        (failure: unknown) => {
          if (mounted.current) {
            setRecoveryError(failure);
            setReady(true);
          }
        },
      ),
    [owner],
  );
  useEffect(() => {
    void recover();
  }, [recover]);
  usePreventRemove(busy, ({ data }) => {
    if (allowRemoval.current) navigation.dispatch(data.action);
  });
  function inspect(raw: unknown, filename = "") {
    if (!mounted.current) return;
    const normalized = normalizeImport(
      raw,
      t("Importowany quiz", "Imported quiz"),
    );
    const invalid = editorValidation(normalized, t);
    if (invalid) throw new Error(invalid.message);
    preflightImport(normalized, filename);
    uploaded.current.clear();
    setPreview(normalized);
    setName(filename);
    setPaste(false);
  }
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      if (!mounted.current) return;
      try {
        const saved = await loadImport(storage, owner);
        if (mounted.current) setOperation(saved);
      } catch (failure) {
        if (mounted.current) setRecoveryError(failure);
      }
      if (!mounted.current) return;
      setError(
        e instanceof ImportCreateError
          ? new Error(
              e.reason === "size"
                ? t(
                    "Treść quizu jest zbyt duża do bezpiecznego importu. Podziel quiz na mniejsze części.",
                    "The quiz content is too large to import safely. Split it into smaller quizzes.",
                  )
                : e.reason === "response"
                  ? t(
                      "Nie można potwierdzić odpowiedzi serwera. Ponów import, aby sprawdzić ten sam quiz.",
                      "The server response could not be confirmed. Retry to check the same import.",
                    )
                  : e.reason === "occupied"
                    ? t(
                        "Najpierw potwierdź poprzedni import lub zamknij jego zakończone potwierdzenie.",
                        "Confirm the previous import or dismiss its completed receipt first.",
                      )
                    : t(
                        "Nie udało się zapisać informacji o imporcie na urządzeniu. Sprawdź wolne miejsce i spróbuj ponownie.",
                        "Import recovery could not be saved on this device. Check free space and try again.",
                      ),
            )
          : e instanceof SyntaxError
            ? new Error(
                t(
                  "Nieprawidłowy JSON. Sprawdź zawartość pliku lub wklejony tekst.",
                  "Invalid JSON. Check the file contents or pasted text.",
                ),
              )
            : e instanceof ZodError
              ? new Error(
                  t(
                    "Plik musi zawierać listę pytań i odpowiedzi w formacie Testownika.",
                    "The file must contain questions and answers in Testownik format.",
                  ),
                )
              : e,
      );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function pick() {
    await run(async () => {
      const picked = await DocumentPicker.getDocumentAsync({
        type: [
          "application/json",
          "text/plain",
          "application/zip",
          "application/x-zip-compressed",
        ],
        copyToCacheDirectory: true,
        base64: false,
      });
      if (picked.canceled || !mounted.current) return;
      setPreview(null);
      setName("");
      setPaste(false);
      uploaded.current.clear();
      const file = picked.assets[0];
      const readable = openImportFile(file, t);
      if (file.name.toLowerCase().endsWith(".zip")) {
        const bytes = await readable.arrayBuffer();
        inspect(await readArchive(bytes, file.name, t), file.name);
      } else {
        const contents = await readable.text();
        if (contents.length > 20_000_000)
          throw new Error(t("Quiz jest zbyt duży.", "The quiz is too large."));
        if (
          file.name.toLowerCase().endsWith(".txt") &&
          !contents.trimStart().startsWith("{")
        ) {
          const question = parseQuestion(
            contents.replace(/^\uFEFF/, "").split(/\r?\n/),
            file.name,
            1,
          );
          if (!question)
            throw new Error(
              t("Nieprawidłowy format pytania.", "Invalid question format."),
            );
          inspect(
            { title: file.name.replace(/\.txt$/i, ""), questions: [question] },
            file.name,
          );
        } else inspect(JSON.parse(contents.replace(/^\uFEFF/, "")), file.name);
      }
    });
  }
  function openQuiz(id: string) {
    void cache.invalidateQueries({ queryKey: ["library"] });
    allowRemoval.current = true;
    router.replace({ pathname: "/quiz/[id]", params: { id } });
  }
  async function submit() {
    await run(async () => {
      const common = {
        store: storage,
        owner,
        post: (
          body: Parameters<Parameters<typeof beginImport>[0]["post"]>[0],
        ) => postImport(client, body),
        isCurrent: () => mounted.current,
      };
      let result: ImportOperation;
      if (operation) result = await resumeImport(common);
      else {
        if (!preview) return;
        preflightImport(preview, name);
        const payload = await uploadImportedImages(
          preview,
          uploaded.current,
          t,
          client,
        );
        if (!mounted.current) return;
        result = await beginImport({
          ...common,
          payload: { ...payload, visibility: 0 },
          filename: name,
          newId: Crypto.randomUUID,
        });
      }
      if (!mounted.current) return;
      setOperation(result);
      if (result.state === "created") openQuiz(result.created.id);
    });
  }
  async function resetImport() {
    if (!operation || operation.state === "pending") return;
    await run(async () => {
      await clearImport(storage, owner, operation.requestId);
      if (!mounted.current) return;
      setOperation(null);
      setPreview(null);
      setName("");
      setText("");
      setPaste(false);
      uploaded.current.clear();
    });
  }
  const summary =
    operation?.preview ?? (preview ? importPreview(preview, name) : null);
  if (!ready) return <Loading />;
  if (recoveryError)
    return (
      <Screen>
        <ErrorState
          title={t(
            "Nie można odczytać poprzedniego importu",
            "Previous Import Couldn’t Be Read",
          )}
          error={
            new Error(
              t(
                "Informacje o poprzednim imporcie są niedostępne. Spróbuj ponownie przed importowaniem kolejnego quizu.",
                "Previous import recovery is unavailable. Try again before importing another quiz.",
              ),
            )
          }
          retry={() => {
            setReady(false);
            void recover();
          }}
        />
        <Button onPress={() => router.push("/feedback")}>
          {t("Skontaktuj się z nami", "Contact Support")}
        </Button>
      </Screen>
    );
  const terminal = operation && operation.state !== "pending";
  return (
    <Screen
      footer={
        terminal ? (
          <View style={{ gap: 8 }}>
            {operation.state === "created" && (
              <Button
                disabled={busy}
                onPress={() => openQuiz(operation.created.id)}
              >
                {t("Otwórz quiz", "Open Quiz")}
              </Button>
            )}
            <Button disabled={busy} onPress={() => void resetImport()}>
              {t("Importuj kolejny quiz", "Import Another Quiz")}
            </Button>
          </View>
        ) : summary ? (
          <Button disabled={busy} onPress={() => void submit()}>
            {busy
              ? t("Importuję…", "Importing…")
              : operation?.state === "pending"
                ? t("Ponów import", "Retry Import")
                : t("Importuj i rozpocznij naukę", "Import and Start Studying")}
          </Button>
        ) : undefined
      }
    >
      <Stack.Screen
        options={{ gestureEnabled: !busy, headerBackVisible: !busy }}
      />
      <Collection>
        <CollectionRow
          title={t("Wybierz plik", "Choose File")}
          symbol="doc.badge.plus"
          ionicon="document-attach-outline"
          disclosure={false}
          disabled={busy || !!operation}
          onPress={() => void pick()}
        />
        <CollectionDivider />
        <CollectionRow
          title={
            paste
              ? t("Ukryj pole JSON", "Hide JSON Input")
              : t("Wklej JSON", "Paste JSON")
          }
          symbol="doc.on.clipboard"
          ionicon="clipboard-outline"
          disclosure={false}
          disabled={busy || !!operation}
          onPress={() => {
            setPaste((value) => !value);
            setPreview(null);
            setError(null);
          }}
        />
      </Collection>
      <Label muted>
        {t(
          "Obsługiwane: JSON, pytanie w starszym formacie Testownika lub ZIP z pytaniami i obrazami (do 20 MB; tekst quizu do 8 MB). Zaimportowany quiz będzie prywatny.",
          "Supported: JSON, a legacy Testownik question, or a ZIP with questions and images (up to 20 MB; quiz text up to 8 MB). Imported quizzes are private.",
        )}
      </Label>
      {paste && !operation && (
        <>
          <Field
            label={t("JSON quizu", "Quiz JSON")}
            multiline
            numberOfLines={8}
            value={text}
            editable={!busy}
            onChangeText={setText}
          />
          <Button
            disabled={busy || !text.trim()}
            onPress={() => run(async () => inspect(JSON.parse(text)))}
          >
            {t("Sprawdź quiz", "Preview Quiz")}
          </Button>
        </>
      )}
      {operation && (
        <SettingsGroup>
          <View style={{ paddingVertical: 12, gap: 8 }}>
            <Heading small>
              {operation.state === "created"
                ? t("Quiz został już zaimportowany", "Quiz Already Imported")
                : operation.state === "pending"
                  ? t("Potwierdź poprzedni import", "Confirm Previous Import")
                  : t("Import wymaga uwagi", "Import Needs Attention")}
            </Heading>
            <Label>
              {operation.state === "pending"
                ? t(
                    "Odpowiedź serwera nie została potwierdzona. Ponów import, aby sprawdzić ten sam quiz bez tworzenia kopii. Możesz wrócić tutaj później.",
                    "The server response has not been confirmed. Retry to check the same quiz without creating a copy. You can return here later.",
                  )
                : operation.state === "created"
                  ? t(
                      "Ten import się zakończył. Otwórz quiz lub wybierz kolejny plik.",
                      "This import completed. Open the quiz or choose another file.",
                    )
                  : operation.state === "rejected"
                    ? t(
                        "Serwer odrzucił ten import. Quiz nie został utworzony. Popraw plik lub wybierz go ponownie, aby przesłać obrazy jeszcze raz.",
                        "The server rejected this import. No quiz was created. Correct the file or select it again to upload its images again.",
                      )
                    : operation.state === "deleted"
                      ? t(
                          "Zaimportowany quiz został usunięty. Wybierz kolejny plik, aby rozpocząć nowy import.",
                          "The imported quiz was deleted. Choose another file to start a new import.",
                        )
                      : t(
                          "Quiz został utworzony, ale nie masz już do niego dostępu. Możesz rozpocząć osobny import.",
                          "The quiz was created, but you no longer have access to it. You can start a separate import.",
                        )}
            </Label>
          </View>
        </SettingsGroup>
      )}
      {error ? (
        <ErrorState
          title={t("Nie udało się zaimportować quizu", "Couldn’t Import Quiz")}
          error={error}
        />
      ) : null}
      {summary && (
        <SettingsGroup>
          <View style={{ paddingVertical: 12, gap: 8 }}>
            <Heading small>{summary.title}</Heading>
            {summary.filename ? <Label muted>{summary.filename}</Label> : null}
            <Label>
              {t(
                `Liczba pytań: ${summary.questions}`,
                `Questions: ${summary.questions}`,
              )}
            </Label>
            {!terminal && (
              <Label muted>
                {t(
                  "Quiz zostanie dodany do Twojej biblioteki jako prywatny.",
                  "The quiz will be added to your library as private.",
                )}
              </Label>
            )}
          </View>
          <View style={{ paddingVertical: 12, gap: 8 }}>
            <Label muted>{t("Pierwsze pytanie", "First question")}</Label>
            <Label>
              {summary.firstQuestion ||
                t("Pytanie z obrazem", "Image question")}
            </Label>
            <Label muted>
              {t(
                `Odpowiedzi: ${summary.firstAnswers}`,
                `Answers: ${summary.firstAnswers}`,
              )}
            </Label>
          </View>
        </SettingsGroup>
      )}
    </Screen>
  );
}
