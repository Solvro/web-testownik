import React, { useContext, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle as DialogTitleShad,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileJsonIcon, FileUpIcon } from "lucide-react";
import AppContext from "../AppContext.tsx";
import { Quiz } from "../components/quiz/types.ts";
import QuizPreviewModal from "../components/quiz/QuizPreviewModal.tsx";
import { useNavigate } from "react-router";
import { validateQuiz } from "../components/quiz/helpers/quizValidation.ts";
import { toast } from "react-toastify";
import { uuidv4 } from "../components/quiz/helpers/uuid.ts";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label.tsx";

function TypographyInlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono">
      {children}
    </code>
  );
}

type UploadType = "file" | "link" | "json";

const ImportQuizPage: React.FC = () => {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const [uploadType, setUploadType] = useState<UploadType>("link");
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
    if (file) {
      setFileName(file.name);
      setError(null);
    } else {
      setFileName(null);
    }
  };

  const setErrorAndNotify = (message: string) => {
    setError(message);
    toast.error(message);
    setLoading(false);
  };

  const addQuestionIdsIfMissing = (quiz: Quiz): Quiz => {
    let id = 1;
    for (const question of quiz.questions) {
      if (!question.id) {
        question.id = id++;
      } else {
        id = Math.max(id, question.id + 1);
      }
    }
    return quiz;
  };

  const handleImport = async () => {
    setError(null);
    setLoading(true);
    if (uploadType === "file") {
      const file = fileInputRef.current?.files?.[0];
      if (!file) {
        setErrorAndNotify("Wybierz plik z quizem.");
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const data = JSON.parse(reader.result as string);
          const validationError = validateQuiz(addQuestionIdsIfMissing(data));
          if (validationError) {
            setErrorAndNotify(validationError);
            return false;
          }
          await submitImport("json", data);
        } catch (error) {
          if (error instanceof Error) {
            setError(
              `Wystąpił błąd podczas wczytywania pliku: ${error.message}`,
            );
          } else {
            setError("Wystąpił błąd podczas wczytywania pliku.");
          }
          console.error("Błąd podczas wczytywania pliku:", error);
        }
      };
      reader.readAsText(file);
    } else if (uploadType === "link") {
      const linkInput = (
        document.getElementById("link-input") as HTMLInputElement
      )?.value;
      if (!linkInput) {
        setErrorAndNotify("Wklej link do quizu.");
        setLoading(false);
        return;
      }
      try {
        new URL(linkInput);
        await submitImport("link", linkInput);
      } catch {
        setError("Link jest niepoprawny.");
      }
    } else if (uploadType === "json") {
      const textInput = (
        document.getElementById("text-input") as HTMLTextAreaElement
      )?.value;
      if (!textInput) {
        setError("Wklej quiz w formie tekstu.");
        setLoading(false);
        return;
      }
      try {
        const data = JSON.parse(textInput);
        const validationError = validateQuiz(addQuestionIdsIfMissing(data));
        if (validationError) {
          setErrorAndNotify(validationError);
          return false;
        }
        await submitImport("json", data);
      } catch (error) {
        if (error instanceof Error) {
          setError(`Wystąpił błąd podczas parsowania JSON: ${error.message}`);
        } else {
          setError(
            "Quiz jest niepoprawny. Upewnij się, że jest w formacie JSON.",
          );
        }
        console.error("Błąd podczas parsowania JSON:", error);
      }
    }
    setLoading(false);
  };

  const submitImport = async (type: "json" | "link", data: string | Quiz) => {
    try {
      if (appContext.isGuest) {
        if (type === "link" || typeof data === "string") {
          try {
            const response = await fetch(data as string);
            data = (await response.json()) as Quiz;
          } catch {
            setError(
              "Wystąpił błąd podczas importowania quizu, będąc gościem możesz tylko importować quizy z domeny testownik.solvro.pl, które są dostępne publicznie. Ciągle możesz skorzystać z opcji importu z pliku lub wprowadzić quiz ręcznie.",
            );
            return;
          }
        }
        const tempQuiz = {
          ...data,
          id: uuidv4(),
          visibility: 0,
          version: 1,
          allow_anonymous: false,
          is_anonymous: true,
          can_edit: true,
        };
        const userQuizzes = localStorage.getItem("guest_quizzes")
          ? JSON.parse(localStorage.getItem("guest_quizzes")!)
          : [];
        userQuizzes.push(tempQuiz);
        localStorage.setItem("guest_quizzes", JSON.stringify(userQuizzes));
        setQuiz(tempQuiz);
        return;
      }
      let response;
      if (type === "json") {
        response = await appContext.axiosInstance.post("/quizzes/", data);
      } else if (type === "link") {
        response = await appContext.axiosInstance.post(
          "/import-quiz-from-link/",
          { link: data },
        );
      } else {
        return;
      }

      if (response.status === 201) {
        const result = await response.data;
        setQuiz(result);
      } else {
        const errorData = await response.data;
        setError(
          errorData.error || "Wystąpił błąd podczas importowania quizu.",
        );
      }
    } catch {
      setError("Wystąpił błąd podczas importowania quizu.");
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Zaimportuj quiz</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>{error}</AlertTitle>
            </Alert>
          )}

          <Tabs
            value={uploadType}
            onValueChange={(v) => handleUploadTypeChange(v as UploadType)}
            className="w-full"
          >
            <TabsList className="dark:bg-background mx-auto dark:border-1">
              <TabsTrigger value="file">Plik</TabsTrigger>
              <TabsTrigger value="link">Link</TabsTrigger>
              <TabsTrigger value="json">Tekst</TabsTrigger>
            </TabsList>
            <TabsContent value="file" className="mt-4">
              <div className="space-y-2">
                <Label>Plik z quizem</Label>
                <div
                  className="hover:bg-accent/40 dark:bg-input/30 border-input cursor-pointer rounded-md border p-6 text-center shadow-xs transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    accept=".json"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {fileName ? (
                    <div className="space-y-2">
                      <FileJsonIcon className="mx-auto size-8" />
                      <p className="text-sm">Wybrano plik:</p>
                      <span className="bg-secondary inline-flex rounded px-2 py-0.5 text-xs">
                        {fileName}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <FileUpIcon className="mx-auto size-8" />
                      <p className="text-sm">Wybierz plik...</p>
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
      <QuizPreviewModal
        show={quiz !== null}
        onHide={() => navigate("/")}
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
            <DialogTitleShad>Format JSON quizu</DialogTitleShad>
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
            <Button variant="outline">Zamknij</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ImportQuizPage;
