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
import { useMemo, useRef, useState } from "react";

import { QuizPreviewDialog } from "@/components/quiz/quiz-preview-dialog";
import { Alert, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { Progress } from "@/components/ui/progress";
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

const extractOwnText = (element: Element): string => {
  let buffer = "";
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (typeof text === "string") {
        buffer += text;
      }
      continue;
    }
    if (
      node instanceof HTMLElement &&
      node.tagName !== "UL" &&
      node.tagName !== "OL" &&
      node.tagName !== "LI" &&
      node.tagName !== "P"
    ) {
      const text = node.textContent;
      if (typeof text === "string") {
        buffer += text;
      }
    }
  }
  return buffer.trim();
};

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
    errorDetail,
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
    handleSkipImages,
    uploadProgress,
    isUploading,
    textInputRef,
  } = useImportQuiz();

  const router = useRouter();

  if (typeof document !== "undefined") {
    document.title = "Importuj quiz - Testownik Solvro";
  }

  const textRef = useRef<HTMLDivElement | null>(null);
  const [checkIcon, setCheckIcon] = useState<boolean>(false);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);
  const formattedErrorDetail = useMemo(() => {
    if (errorDetail == null) {
      return null;
    }

    const tryFormat = (value: string): string | null => {
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return null;
      }
    };

    const direct = tryFormat(errorDetail);
    if (direct !== null) {
      return direct;
    }

    const braceIndex = errorDetail.indexOf("{");
    const bracketIndex = errorDetail.indexOf("[");
    const indices = [braceIndex, bracketIndex].filter((index) => index >= 0);
    if (indices.length > 0) {
      const sliceIndex = Math.min(...indices);
      const parsed = tryFormat(errorDetail.slice(sliceIndex));
      if (parsed !== null) {
        const prefix = errorDetail.slice(0, sliceIndex).trim();
        return prefix.length > 0 ? `${prefix}\n${parsed}` : parsed;
      }
    }

    return errorDetail;
  }, [errorDetail]);
  const handleTextCopy = async () => {
    const copyTextElement = textRef.current;
    if (copyTextElement == null) {
      return;
    }

    const pre = copyTextElement.querySelector("pre");
    const preText = pre?.textContent ?? "";

    const items = [...copyTextElement.querySelectorAll("p, li")];
    const parts = [
      ...items
        .map((element) => extractOwnText(element))
        .filter((text) => text.length > 0),
      preText,
    ]
      .map((text) => text.trim())
      .filter((text) => text.length > 0);
    const copyText = parts.join("\n");
    if (copyText.length === 0) {
      return;
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
            <Alert
              variant="destructive"
              className="flex items-center justify-start gap-4"
            >
              <div>
                <AlertTitle>{error}</AlertTitle>
              </div>
              {errorDetail === null ? null : (
                <Dialog
                  open={isErrorDialogOpen}
                  onOpenChange={setIsErrorDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      Pokaż szczegóły
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Szczegóły błędu</DialogTitle>
                      <DialogDescription>
                        Pełna treść komunikatu błędu.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="bg-muted max-h-[50vh] overflow-auto rounded p-3 text-sm">
                      <pre className="text-xs leading-relaxed wrap-break-word whitespace-pre-wrap">
                        {formattedErrorDetail ?? errorDetail}
                      </pre>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => {
                          setIsErrorDialogOpen(false);
                        }}
                      >
                        Zamknij
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
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
            {isUploading && uploadProgress != null ? (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    Przesyłanie zdjęć ({uploadProgress.current} /{" "}
                    {uploadProgress.total})
                  </span>
                  <span className="text-muted-foreground">
                    {Math.round(
                      (uploadProgress.current / uploadProgress.total) * 100,
                    )}
                    %
                  </span>
                </div>
                <Progress
                  value={(uploadProgress.current / uploadProgress.total) * 100}
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="mt-2 w-full">
                      Kontynuuj bez zdjęć
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Kontynuować bez przesyłania zdjęć?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Pominięcie przesyłania zdjęć może zmniejszyć dokładność
                        niektórych pytań, zwłaszcza tych opartych na obrazach.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Anuluj</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSkipImages}>
                        Kontynuuj
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : null}
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
          <DialogContent className="flex h-[90dvh] flex-col sm:max-w-[90dvw] md:max-w-3xl">
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
                  <p>Struktura wymagana przy imporcie:</p>
                  <ul className="list-disc space-y-2 pl-5">
                    <li>
                      <TypographyInlineCode>title</TypographyInlineCode> – tytuł
                      quizu w formie tekstu.
                    </li>
                    <li>
                      <TypographyInlineCode>description</TypographyInlineCode> –
                      opcjonalny opis quizu.
                    </li>
                    <li>
                      <TypographyInlineCode>questions</TypographyInlineCode> –
                      tablica obiektów z pytaniami.
                      <p className="mt-1 ml-6">
                        Każde pytanie w tablicy{" "}
                        <TypographyInlineCode>questions</TypographyInlineCode>{" "}
                        zawiera:
                      </p>
                      <ul className="mt-1 mb-2 list-disc space-y-1 pl-6">
                        <li>
                          <TypographyInlineCode>text</TypographyInlineCode> –
                          treść pytania (wymagane).
                        </li>
                        <li>
                          <TypographyInlineCode>order</TypographyInlineCode> –
                          kolejność pytania; jeśli brak, zostanie nadana
                          automatycznie od 1 (opcjonalne).
                        </li>
                        <li>
                          <TypographyInlineCode>multiple</TypographyInlineCode>{" "}
                          – czy jest wiele poprawnych odpowiedzi; domyślnie{" "}
                          <TypographyInlineCode>false</TypographyInlineCode>{" "}
                          (opcjonalne).
                        </li>
                        <li>
                          <TypographyInlineCode>
                            explanation
                          </TypographyInlineCode>{" "}
                          – wyjaśnienie po udzieleniu odpowiedzi (opcjonalne).
                        </li>
                        <li>
                          <TypographyInlineCode>image_url</TypographyInlineCode>{" "}
                          – adres obrazka pytania (opcjonalne).
                        </li>
                        <li>
                          <TypographyInlineCode>answers</TypographyInlineCode> –
                          lista odpowiedzi (wymagane).
                          <p className="mt-1 ml-6">
                            Każda odpowiedź w tablicy{" "}
                            <TypographyInlineCode>answers</TypographyInlineCode>{" "}
                            zawiera:
                          </p>
                          <ul className="mt-1 mb-2 list-disc space-y-1 pl-6">
                            <li>
                              <TypographyInlineCode>text</TypographyInlineCode>{" "}
                              – treść odpowiedzi (wymagane).
                            </li>
                            <li>
                              <TypographyInlineCode>
                                is_correct
                              </TypographyInlineCode>{" "}
                              – czy odpowiedź jest poprawna (wymagane).
                            </li>
                            <li>
                              <TypographyInlineCode>order</TypographyInlineCode>{" "}
                              – kolejność odpowiedzi; jeśli brak, zostanie
                              nadana automatycznie od 1 (opcjonalne).
                            </li>
                            <li>
                              <TypographyInlineCode>
                                image_url
                              </TypographyInlineCode>{" "}
                              – adres obrazka odpowiedzi (opcjonalne).
                            </li>
                          </ul>
                        </li>
                      </ul>
                    </li>
                  </ul>
                  <p>Przykładowy quiz w formacie JSON:</p>
                </div>
                <ScrollArea className="bg-muted static! min-h-40 w-full flex-1 rounded-md text-xs">
                  <pre className="bg-muted w-full rounded-md p-3 text-xs">
                    {`{
    "title": "Przykładowy quiz",
    "description": "Opis quizu", // Opcjonalny
    "questions": [
        {
            "order": 1, // Opcjonalny, jeśli brak to automatycznie od 1
            "text": "Jaki jest sens sesji?",
            "answers": [
                {
                    "order": 1, // Opcjonalny, jeśli brak to automatycznie od 1
                    "text": "Nie ma sensu",
                    "is_correct": false
                },
                {
                    "order": 2, // Opcjonalny, jeśli brak to automatycznie od 1
                    "text": "Żeby zjeść obiad",
                    "is_correct": true
                },
                {
                    "order": 3, // Opcjonalny, jeśli brak to automatycznie od 1
                    "text": "Żeby się wykończyć",
                    "is_correct": false
                }
            ],
            "multiple": false, // Opcjonalny, domyślnie false
            "explanation": "Sesja ma sens, żeby zjeść obiad." // Opcjonalny
        },
        {
            "order": 2, // Opcjonalny, jeśli brak to automatycznie od 1
            "text": "Kto jest najlepszy?",
            "answers": [
                {
                    "order": 1, // Opcjonalny, jeśli brak to automatycznie od 1
                    "text": "Ja",
                    "is_correct": true
                },
                {
                    "order": 2, // Opcjonalny, jeśli brak to automatycznie od 1
                    "text": "Ty",
                    "is_correct": false
                }
            ],
            "multiple": false
        },
        {
            "order": 3, // Opcjonalny, jeśli brak to automatycznie od 1
            "text": "Pytanie ze zdjęciem",
            "image_url": "https://example.com/image.jpg", // Opcjonalny
            "answers": [
                {
                    "order": 1, // Opcjonalny, jeśli brak to automatycznie od 1
                    "text": "Odpowiedź 1",
                    "image_url": "https://example.com/image2.jpg", // Opcjonalny
                    "is_correct": true
                },
                {
                    "order": 2, // Opcjonalny, jeśli brak to automatycznie od 1
                    "text": "Odpowiedź 2",
                    "image_url": "https://example.com/image3.jpg", // Opcjonalny
                    "is_correct": false
                }
            ],
            "multiple": true // Opcjonalny, domyślnie false
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
