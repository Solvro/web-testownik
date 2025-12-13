import {
  FileJsonIcon,
  FileUpIcon,
  FolderArchiveIcon,
  FolderIcon,
  FolderOpenIcon,
} from "lucide-react";
import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

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
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { UploadType } from "@/lib/import-quiz.ts";
import { useImportQuiz } from "@/lib/import-quiz.ts";

function TypographyInlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono">
      {children}
    </code>
  );
}

const handleDragOverDirectory = (event: React.DragEvent<HTMLDivElement>) => {
  event.preventDefault();
  event.stopPropagation();
  const items = event.dataTransfer.items;
  event.dataTransfer.dropEffect =
    items.length === 1 && items[0].kind === "file" ? "copy" : "none";
};

const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
  event.preventDefault();
  event.stopPropagation();
};

export function ImportQuizPage(): React.JSX.Element {
  // States and functions extracted lib/import-quiz.ts
  const {
    // States
    uploadType,
    fileNameInput,
    fileNameOld,
    error,
    loading,
    fileInputRef,
    fileOldRef,
    directoryInputRef,
    directoryName,
    quizTitle,
    quizDescription,
    quiz,

    // Functions
    handleFileDrop,
    handleDragOverFile,
    handleDirectoryDrop,
    handleDirectorySelect,
    handleUploadTypeChange,
    handleFileSelect,
    setQuizTitle,
    setQuizDescription,
    handleImport,
  } = useImportQuiz();

  const navigate = useNavigate();
  const location = useLocation();

  interface LocationState {
    fromImportButton?: boolean;
  }

  const state = location.state as LocationState | null;
  const fromImportButton = state?.fromImportButton ?? false;

  useEffect(() => {
    if (fromImportButton) {
      handleUploadTypeChange("file");
      window.history.replaceState({}, document.title);
    }
  }, [fromImportButton]);

  document.title = "Importuj quiz - Testownik Solvro";

  return (
    <>
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
            <TabsList className="dark:bg-background mx-auto grid grid-cols-3 dark:border-1">
              <TabsTrigger value="file">Plik</TabsTrigger>
              <TabsTrigger value="old">Stara wersja</TabsTrigger>
              <TabsTrigger value="json">Tekst</TabsTrigger>
            </TabsList>
            <TabsContent value="file" className="mt-4">
              <div className="space-y-2">
                <Label htmlFor="file-input">Plik JSON z quizem</Label>
                <div
                  className="hover:bg-accent/40 dark:bg-input/30 border-input cursor-pointer rounded-md border p-6 text-center shadow-xs transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleFileDrop}
                  onDragOver={handleDragOverFile}
                  onDragLeave={handleDragLeave}
                  role="button"
                  tabIndex={0}
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
                  {fileNameInput == null ? (
                    <div className="space-y-2">
                      <FileUpIcon className="mx-auto size-8" />
                      <p className="text-sm">Wybierz plik...</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <FileJsonIcon className="mx-auto size-8" />
                      <p className="text-sm">Wybrano plik:</p>
                      <span className="bg-secondary inline-flex rounded px-2 py-0.5 text-xs">
                        {fileNameInput}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="json" className="mt-4">
              <div className="space-y-2">
                <Label htmlFor="text-input">Quiz w formacie JSON</Label>
                <Textarea
                  id="text-input"
                  rows={5}
                  placeholder="Wklej quiz w formie tekstu"
                />
              </div>
            </TabsContent>
            <TabsContent value="old" className="mt-4">
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-11">
                  <div className="space-y-2 md:col-span-5">
                    <Label htmlFor="file-old-input">Plik zip z pytaniami</Label>
                    <div
                      className="hover:bg-muted/40 dark:bg-input/30 border-input dark:hover:bg-input/40 relative cursor-pointer rounded-md border p-4 text-center text-sm shadow-xs transition"
                      onClick={() => fileOldRef.current?.click()}
                      onDrop={handleFileDrop}
                      onDragOver={handleDragOverFile}
                      onDragLeave={handleDragLeave}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          fileOldRef.current?.click();
                          event.preventDefault();
                        }
                      }}
                    >
                      <input
                        id="file-old-input"
                        type="file"
                        accept=".zip"
                        ref={fileOldRef}
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      {fileNameOld === null ? (
                        <div className="space-y-1">
                          <FolderArchiveIcon className="mx-auto size-6" />
                          <p>Wybierz plik...</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <FolderOpenIcon className="mx-auto size-6" />
                          <p className="break-all">{fileNameOld}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-muted-foreground flex items-center justify-center text-sm md:col-span-1">
                    lub
                  </div>
                  <div className="space-y-2 md:col-span-5">
                    <Label htmlFor="directory-input">Folder z pytaniami</Label>
                    <div
                      className="hover:bg-muted/40 dark:bg-input/30 border-input dark:hover:bg-input/40 relative cursor-pointer rounded-md border p-4 text-center text-sm shadow-xs transition"
                      onClick={() => directoryInputRef.current?.click()}
                      onDrop={handleDirectoryDrop}
                      onDragOver={handleDragOverDirectory}
                      onDragLeave={handleDragLeave}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          directoryInputRef.current?.click();
                          event.preventDefault();
                        }
                      }}
                    >
                      <input
                        id="directory-input"
                        type="file"
                        ref={directoryInputRef}
                        {...({ webkitdirectory: "" } as {
                          webkitdirectory: string;
                        })}
                        onChange={handleDirectorySelect}
                        className="hidden"
                      />
                      {directoryName === null ? (
                        <div className="space-y-1">
                          <FolderIcon className="mx-auto size-6" />
                          <p>Wybierz folder...</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <FolderOpenIcon className="mx-auto size-6" />
                          <p className="break-all">{directoryName}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quiz-title">Nazwa</Label>
                  <Input
                    id="quiz-title"
                    placeholder="Nazwa quizu"
                    value={quizTitle}
                    onChange={(event) => {
                      setQuizTitle(event.target.value);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quiz-description">Opis</Label>
                  <Textarea
                    id="quiz-description"
                    rows={3}
                    placeholder="Dodatkowy opis"
                    value={quizDescription}
                    onChange={(event) => {
                      setQuizDescription(event.target.value);
                    }}
                  />
                </div>
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
