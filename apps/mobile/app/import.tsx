import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Platform, View } from "react-native";
import { ZodError } from "zod";
import {
  Button,
  ErrorState,
  Field,
  Heading,
  Label,
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

type Preview = ReturnType<typeof normalizeImport>;
export default function Import() {
  const { t } = useLocale();
  const [text, setText] = useState(""),
    [paste, setPaste] = useState(false),
    [preview, setPreview] = useState<Preview | null>(null),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const uploaded = useRef(new Map<string, string>()),
    lock = useRef(false);
  function inspect(raw: unknown, filename = "") {
    const normalized = normalizeImport(
      raw,
      t("Importowany quiz", "Imported quiz"),
    );
    const invalid = editorValidation(normalized, t);
    if (invalid) throw new Error(invalid.message);
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
      setError(
        e instanceof SyntaxError
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
      setBusy(false);
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
      });
      if (picked.canceled) return;
      setPreview(null);
      setName("");
      setPaste(false);
      uploaded.current.clear();
      const file = picked.assets[0];
      if ((file.size ?? 0) > 20_000_000)
        throw new Error(
          t(
            "Maksymalny rozmiar pliku to 20 MB.",
            "The maximum file size is 20 MB.",
          ),
        );
      if (file.name.toLowerCase().endsWith(".zip")) {
        const bytes =
          Platform.OS === "web"
            ? await fetch(file.uri).then((r) => r.arrayBuffer())
            : await new File(file.uri).arrayBuffer();
        inspect(await readArchive(bytes, file.name, t), file.name);
      } else {
        const contents =
          Platform.OS === "web"
            ? await fetch(file.uri).then((r) => r.text())
            : await new File(file.uri).text();
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
  return (
    <Screen
      footer={
        preview ? (
          <Button
            disabled={busy}
            onPress={() =>
              run(async () => {
                const payload = await uploadImportedImages(
                  preview,
                  uploaded.current,
                  t,
                );
                const quiz = await api.post<{ id: string }>("quizzes/", {
                  ...payload,
                  visibility: 0,
                });
                router.replace({
                  pathname: "/quiz/[id]",
                  params: { id: quiz.id },
                });
              })
            }
          >
            {busy
              ? t("Importuję…", "Importing…")
              : t("Importuj i rozpocznij naukę", "Import and Start Studying")}
          </Button>
        ) : undefined
      }
    >
      <Collection>
        <CollectionRow
          title={t("Wybierz plik", "Choose File")}
          symbol="doc.badge.plus"
          ionicon="document-attach-outline"
          disclosure={false}
          disabled={busy}
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
          disabled={busy}
          onPress={() => {
            setPaste((value) => !value);
            setPreview(null);
            setError(null);
          }}
        />
      </Collection>
      <Label muted>
        {t(
          "Obsługiwane: JSON, pytanie w starszym formacie Testownika lub ZIP z pytaniami i obrazami (do 20 MB). Zaimportowany quiz będzie prywatny.",
          "Supported: JSON, a legacy Testownik question, or a ZIP with questions and images (up to 20 MB). Imported quizzes are private.",
        )}
      </Label>
      {paste && (
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
      {error ? (
        <ErrorState
          title={t("Nie udało się zaimportować quizu", "Couldn’t Import Quiz")}
          error={error}
        />
      ) : null}
      {preview && (
        <SettingsGroup>
          <View style={{ paddingVertical: 12, gap: 8 }}>
            <Heading small>{preview.title}</Heading>
            {name ? <Label muted>{name}</Label> : null}
            <Label>
              {t(
                `Liczba pytań: ${preview.questions.length}`,
                `Questions: ${preview.questions.length}`,
              )}
            </Label>
            <Label muted>
              {t(
                "Quiz zostanie dodany do Twojej biblioteki jako prywatny.",
                "The quiz will be added to your library as private.",
              )}
            </Label>
          </View>
          <View style={{ paddingVertical: 12, gap: 8 }}>
            <Label muted>{t("Pierwsze pytanie", "First question")}</Label>
            <Label>
              {preview.questions[0].text ||
                t("Pytanie z obrazem", "Image question")}
            </Label>
            <Label muted>
              {t(
                `Odpowiedzi: ${preview.questions[0].answers.length}`,
                `Answers: ${preview.questions[0].answers.length}`,
              )}
            </Label>
          </View>
        </SettingsGroup>
      )}
    </Screen>
  );
}
