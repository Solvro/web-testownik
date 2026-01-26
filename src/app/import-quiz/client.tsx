"use client";

import {
  CheckIcon,
  CopyIcon,
  FileJsonIcon,
  FileUpIcon,
  FolderArchiveIcon,
  FolderIcon,
  FolderOpenIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { QuizPreviewDialog } from "@/components/quiz/quiz-preview-dialog";
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
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { UploadType } from "@/lib/import-quiz";
import { useImportQuiz } from "@/lib/import-quiz";

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

function ImportQuizPageContent(): React.JSX.Element {
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
    textInputRef,
  } = useImportQuiz();

  const router = useRouter();

  if (typeof document !== "undefined") {
    document.title = "Importuj quiz - Testownik Solvro";
  }

  const textRef = useRef<HTMLDivElement | null>(null);
  const [checkIcon, setCheckIcon] = useState<boolean>(false);
  const handleTextCopy = async () => {
    const copyTextElement = textRef.current;
    if (copyTextElement == null) {
      return;
    }

    let copyText = "";

    for (const child of copyTextElement.children) {
      if (child.nodeName === "DIV") {
        const pre = child.querySelector("pre");
        if (pre?.textContent != null) {
          copyText += `${pre.textContent}\n\n`;
        }
        continue;
      }
      copyText += `${child.textContent}\n\n`;
    }

    setCheckIcon(true);
    setTimeout(() => {
      setCheckIcon(false);
    }, 2000); // 2 seconds

    await navigator.clipboard.writeText(copyText);
  };

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
            <TabsList className="dark:bg-background mx-auto grid grid-cols-3 dark:border">
              <TabsTrigger value="file">Plik</TabsTrigger>
              <TabsTrigger value="legacy">Stara wersja</TabsTrigger>
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
                  ref={textInputRef}
                />
              </div>
            </TabsContent>
            <TabsContent value="legacy" className="mt-4">
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
            router.push("/");
          }
        }}
        quiz={quiz}
        type="imported"
      />
      {uploadType === "json" || uploadType === "file" ? (
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
          <DialogContent className="flex h-[80dvh] flex-col md:max-w-xl">
            <DialogHeader>
              <DialogTitle>Format JSON quizu</DialogTitle>
              <DialogDescription>
                Struktura wymagana przy imporcie z pliku lub tekstu
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="min-h-0 flex-1">
              <div
                className="grid h-full w-full max-w-full grid-cols-1 flex-col space-y-4 text-sm"
                ref={textRef}
              >
                <div className="space-y-4 pr-3">
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
                    <TypographyInlineCode>text</TypographyInlineCode> i{" "}
                    <TypographyInlineCode>answers</TypographyInlineCode> oraz
                    opcjonalnie{" "}
                    <TypographyInlineCode>order</TypographyInlineCode>,{" "}
                    <TypographyInlineCode>multiple</TypographyInlineCode>{" "}
                    (domyślnie{" "}
                    <TypographyInlineCode>false</TypographyInlineCode>) i{" "}
                    <TypographyInlineCode>explanation</TypographyInlineCode>.
                    Jeśli nie podano{" "}
                    <TypographyInlineCode>order</TypographyInlineCode>, zostanie
                    on nadany automatycznie od 1.
                  </p>
                  <p>Przykładowy quiz w formacie JSON:</p>
                </div>
                <ScrollArea className="bg-muted static! min-h-40 w-full flex-1 rounded-md text-xs">
                  <pre className="bg-muted w-full rounded-md p-3 text-xs">
                    {`{
    "title": "Przykładowy quiz",
    "description": "Opis quizu", // Opcjonalny
    "questions": [
        {
            "order": 1, // Opcjonalny
            "text": "Jaki jest sens sesji?",
            "answers": [
                {
                    "order": 1, // Opcjonalny
                    "text": "Nie ma sensu",
                    "is_correct": false
                },
                {
                    "order": 2,
                    "text": "Żeby zjeść obiad",
                    "is_correct": true
                },
                {
                    "order": 3,
                    "text": "Żeby się wykończyć",
                    "is_correct": false
                }
            ],
            "multiple": false, // Opcjonalny, domyślnie false
            "explanation": "Sesja ma sens, żeby zjeść obiad." // Opcjonalny, domyślnie null
        },
        {
            "order": 2,
            "text": "Kto jest najlepszy?",
            "answers": [
                {
                    "order": 1,
                    "text": "Ja",
                    "is_correct": true
                },
                {
                    "order": 2,
                    "text": "Ty",
                    "is_correct": false
                }
            ],
            "multiple": false
        },
        {
            "order": 3,
            "text": "Pytanie ze zdjęciem",
            "image": "https://example.com/image.jpg", // Opcjonalny
            "answers": [
                {
                    "order": 1,
                    "text": "Odpowiedź 1",
                    "image": "https://example.com/image2.jpg", // Opcjonalny
                    "is_correct": true
                },
                {
                    "order": 2,
                    "text": "Odpowiedź 2",
                    "image": "https://example.com/image3.jpg", // Opcjonalny
                    "is_correct": false
                }
            ],
            "multiple": true
        }
    ]
}`}
                  </pre>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={handleTextCopy}>
                {checkIcon ? <CheckIcon /> : <CopyIcon />}
                Kopiuj instrukcję
              </Button>
              <DialogClose asChild>
                <Button variant="outline">Zamknij</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

export function ImportQuizPageClient() {
  return <ImportQuizPageContent />;
}
