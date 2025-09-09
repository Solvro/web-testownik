import { AlertCircleIcon, FileJsonIcon, FileUpIcon } from "lucide-react";
import React, { useContext, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";

import { AppContext } from "@/app-context.ts";
import { validateQuiz } from "@/components/quiz/helpers/quiz-validation.ts";
import { QuizPreviewDialog } from "@/components/quiz/quiz-preview-dialog.tsx";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label.tsx";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Quiz } from "@/types/quiz.ts";

function TypographyInlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono">
      {children}
    </code>
  );
}

type UploadType = "file" | "link" | "json";

export function ImportQuizPage(): React.JSX.Element {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const [uploadType, setUploadType] = useState<UploadType>(
    appContext.isGuest ? "file" : "link",
  );
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);

  document.title = "Importuj quiz - Testownik Solvro";

  const handleUploadTypeChange = (type: UploadType) => {
    setUploadType(type);
    setError(null);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file === undefined) {
      setFileName(null);
    } else {
      setFileName(file.name);
      setError(null);
    }
  };

  const setErrorAndNotify = (message: string) => {
    setError(message);
    toast.error(message);
    setLoading(false);
  };

  const addQuestionIdsIfMissing = (quizData: Quiz): Quiz => {
    let id = 1;
    for (const question of quizData.questions) {
      if (question.id) {
        id = Math.max(id, question.id + 1);
      } else {
        question.id = id++;
      }
    }
    return quizData;
  };

  const submitImport = async (type: "json" | "link", data: string | Quiz) => {
    try {
      const result =
        type === "json"
          ? await appContext.services.quiz.createQuiz(data as Quiz)
          : await appContext.services.quiz.importQuizFromLink(data as string);

      setQuiz(result);
    } catch {
      setError("Wystąpił błąd podczas importowania quizu.");
    }
  };

  const handleImport = async () => {
    setError(null);
    setLoading(true);
    switch (uploadType) {
      case "file": {
        const file = fileInputRef.current?.files?.[0];
        if (file === undefined) {
          setErrorAndNotify("Wybierz plik z quizem.");
          return;
        }
        try {
          const text = await file.text();
          const data = JSON.parse(text) as Quiz;
          const validationError = validateQuiz(addQuestionIdsIfMissing(data));
          if (validationError !== null) {
            setErrorAndNotify(validationError);
            return false;
          }
          await submitImport("json", data);
        } catch (fileError) {
          if (fileError instanceof Error) {
            setError(
              `Wystąpił błąd podczas wczytywania pliku: ${fileError.message}`,
            );
          } else {
            setError("Wystąpił błąd podczas wczytywania pliku.");
          }
          console.error("Błąd podczas wczytywania pliku:", fileError);
        }

        break;
      }
      case "link": {
        const linkInput =
          document.querySelector<HTMLInputElement>("#link-input")?.value;
        if (linkInput == null || linkInput.trim() === "") {
          setErrorAndNotify("Wklej link do quizu.");
          setLoading(false);
          return;
        }
        try {
          void new URL(linkInput);
          await submitImport("link", linkInput);
        } catch {
          setError("Link jest niepoprawny.");
        }

        break;
      }
      case "json": {
        const textInput =
          document.querySelector<HTMLTextAreaElement>("#text-input")?.value;
        if (textInput == null || textInput.trim() === "") {
          setError("Wklej quiz w formie tekstu.");
          setLoading(false);
          return;
        }
        try {
          const data = JSON.parse(textInput) as Quiz;
          const validationError = validateQuiz(addQuestionIdsIfMissing(data));
          if (validationError !== null) {
            setErrorAndNotify(validationError);
            return false;
          }
          await submitImport("json", data);
        } catch (parseError) {
          if (parseError instanceof Error) {
            setError(
              `Wystąpił błąd podczas parsowania JSON: ${parseError.message}`,
            );
          } else {
            setError(
              "Quiz jest niepoprawny. Upewnij się, że jest w formacie JSON.",
            );
          }
          console.error("Błąd podczas parsowania JSON:", error);
        }

        break;
      }
      // No default
    }
    setLoading(false);
  };

  return (
    <>
      {appContext.isGuest ? (
        <Alert>
          <AlertCircleIcon />
          <AlertTitle>
            Importowanie quizów z linku jest dostępne tylko dla zarejestrowanych
            użytkowników.
          </AlertTitle>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Zaimportuj quiz</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error != null && (
            <Alert variant="destructive">
              <AlertTitle>{error}</AlertTitle>
            </Alert>
          )}

          <Tabs
            value={uploadType}
            onValueChange={(v) => {
              handleUploadTypeChange(v as UploadType);
            }}
            className="w-full"
          >
            <TabsList className="dark:bg-background mx-auto dark:border-1">
              <TabsTrigger value="file">Plik</TabsTrigger>
              <TabsTrigger value="link" disabled={appContext.isGuest}>
                Link
              </TabsTrigger>
              <TabsTrigger value="json">Tekst</TabsTrigger>
            </TabsList>
            <TabsContent value="file" className="mt-4">
              <div className="space-y-2">
                <Label htmlFor="file-input">Plik z quizem</Label>
                <div
                  role="button"
                  tabIndex={0}
                  className="hover:bg-accent/40 dark:bg-input/30 border-input cursor-pointer rounded-md border p-6 text-center shadow-xs transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <input
                    id="file-input"
                    type="file"
                    accept=".json"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {fileName == null ? (
                    <div className="space-y-2">
                      <FileUpIcon className="mx-auto size-8" />
                      <p className="text-sm">Wybierz plik...</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <FileJsonIcon className="mx-auto size-8" />
                      <p className="text-sm">Wybrano plik:</p>
                      <span className="bg-secondary inline-flex rounded px-2 py-0.5 text-xs">
                        {fileName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="link" className="mt-4">
              <div className="space-y-2">
                <Label htmlFor="link-input">Link do quizu</Label>
                <Input id="link-input" placeholder="Wklej link do quizu" />
              </div>
            </TabsContent>
            <TabsContent value="json" className="mt-4">
              <div className="space-y-2">
                <Label htmlFor="text-input">Quiz w formie tekstu</Label>
                <Textarea
                  id="text-input"
                  rows={5}
                  placeholder="Wklej quiz w formie tekstu"
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="text-center">
            <Button onClick={handleImport} disabled={loading}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="border-border size-4 animate-spin rounded-full border-2 border-t-transparent" />{" "}
                  Importowanie...
                </span>
              ) : (
                "Importuj"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      <QuizPreviewDialog
        open={quiz !== null}
        onOpenChange={(open) => {
          if (!open) {
            void navigate("/");
          }
        }}
        quiz={quiz}
        type="imported"
      />
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="link"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            Jak powinien wyglądać quiz w formacie JSON?
          </Button>
        </DialogTrigger>
        <DialogContent className="flex h-[80vh] flex-col">
          <DialogHeader>
            <DialogTitle>Format JSON quizu</DialogTitle>
            <DialogDescription>
              Struktura wymagana przy imporcie z pliku lub tekstu
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-4 text-sm">
              <p>
                Quiz w formacie JSON powinien składać się z dwóch głównych
                kluczy: <TypographyInlineCode>title</TypographyInlineCode> i{" "}
                <TypographyInlineCode>questions</TypographyInlineCode>.
              </p>
              <p>
                Klucz <TypographyInlineCode>title</TypographyInlineCode>{" "}
                powinien zawierać tytuł quizu w formie tekstu.
              </p>
              <p>
                Klucz <TypographyInlineCode>questions</TypographyInlineCode>{" "}
                powinien zawierać tablicę obiektów reprezentujących pytania.
                Każde pytanie powinno zawierać klucze{" "}
                <TypographyInlineCode>id</TypographyInlineCode>,{" "}
                <TypographyInlineCode>question</TypographyInlineCode> i{" "}
                <TypographyInlineCode>answers</TypographyInlineCode> oraz
                opcjonalnie{" "}
                <TypographyInlineCode>multiple</TypographyInlineCode> (domyślnie{" "}
                <TypographyInlineCode>false</TypographyInlineCode>) i{" "}
                <TypographyInlineCode>explanation</TypographyInlineCode>. Jeśli
                nie podano <TypographyInlineCode>id</TypographyInlineCode>,
                zostanie on nadany automatycznie od 1.
              </p>
              <p>Przykładowy quiz w formacie JSON:</p>
              <pre className="bg-muted rounded-md p-3 text-xs">
                {`{
    "title": "Przykładowy quiz",
    "description": "Opis quizu", // Opcjonalny
    "questions": [
        {
            "id": 1,
            "question": "Jaki jest sens sesji?",
            "answers": [
                {
                    "answer": "Nie ma sensu",
                    "correct": false
                },
                {
                    "answer": "Żeby zjeść obiad",
                    "correct": true
                },
                {
                    "answer": "Żeby się wykończyć",
                    "correct": false
                }
            ],
            "multiple": false, // Opcjonalny, domyślnie false
            "explanation": "Sesja ma sens, żeby zjeść obiad." // Opcjonalny, domyślnie null
        },
        {
            "id": 2,
            "question": "Kto jest najlepszy?",
            "answers": [
                {
                    "answer": "Ja",
                    "correct": true
                },
                {
                    "answer": "Ty",
                    "correct": false
                }
            ],
            "multiple": false
        },
        {
            "id": 3,
            "question": "Pytanie ze zdjęciem",
            "image": "https://example.com/image.jpg", // Opcjonalny
            "answers": [
                {
                    "answer": "Odpowiedź 1",
                    "image": "https://example.com/image2.jpg", // Opcjonalny
                    "correct": true
                },
                {
                    "answer": "Odpowiedź 2",
                    "image": "https://example.com/image3.jpg", // Opcjonalny
                    "correct": false
                }
            ],
            "multiple": true
        }
    ]
}`}
              </pre>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Zamknij</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
