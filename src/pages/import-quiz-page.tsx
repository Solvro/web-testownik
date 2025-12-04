import JSZip from "jszip";
import {
  FileJsonIcon,
  FileUpIcon,
  FolderArchiveIcon,
  FolderIcon,
  FolderOpenIcon,
} from "lucide-react";
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
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Question, Quiz } from "@/types/quiz.ts";

const trueFalseStrings = {
  prawda: true,
  tak: true,
  true: true,
  fałsz: false,
  nie: false,
  false: false,
};

function TypographyInlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono">
      {children}
    </code>
  );
}

type UploadType = "file" | "json" | "old";

const handleDragOverFile = (event: React.DragEvent<HTMLDivElement>) => {
  event.preventDefault();
  event.stopPropagation();
  const items = event.dataTransfer.items;
  event.dataTransfer.dropEffect =
    items.length === 1 &&
    items[0].kind === "file" &&
    [
      "application/zip",
      "application/zip-compressed",
      "application/x-zip-compressed",
      "multipart/x-zip",
    ].includes(items[0].type)
      ? "copy"
      : "none";
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

const parseQTemplate = (
  lines: string[],
  filename: string,
  index: number,
): Question | null => {
  // Validate template format
  const templateLine = lines[0]?.trim();
  if (!templateLine.startsWith("QQ")) {
    console.error(
      `Error in file ${filename}. Template does not start with QQ. Skipping.`,
    );
    return null;
  }

  // Extract correctness indicators (1/0) from the template
  const templateParts = templateLine.split(";")[0]; // Ignore parts after semicolon
  const segmenter = new Intl.Segmenter();
  const correctness = Array.from(
    segmenter.segment(templateParts.slice(2)),
    ({ segment }) => segment,
  ); // Remove "QQ" and split into individual characters

  // Validate correctness indicators
  if (!correctness.every((c) => c === "1" || c === "0")) {
    console.error(
      `Error in file ${filename}. Invalid correctness indicators. Skipping.`,
    );
    return null;
  }

  // Extract question text from the second line
  const questionLine = lines[1]?.trim();
  const questionMatch = /^(\d+)\.\t(.*)/.exec(questionLine); // Match number, period, tab, and question text
  if (questionMatch === null) {
    console.error(
      `Error in file ${filename}. Invalid question format. Skipping.`,
    );
    return null;
  }
  const questionText = questionMatch[2];

  // Extract answers from subsequent lines
  const answers: { answer: string; correct: boolean }[] = [];
  for (let index_ = 2; index_ < lines.length; index_++) {
    const answerLine = lines[index_]?.trim();
    const answerMatch = /^\t?\(([a-z])\)\s+(.*)/.exec(answerLine); // Match optional tab, "(letter)", and answer text
    if (answerMatch !== null) {
      const answerIndex = answers.length; // Determine the index of the answer based on its position
      answers.push({
        answer: answerMatch[2], // The answer text
        correct: correctness[answerIndex] === "1", // Check if it's correct
      });
    } else if (answerLine) {
      console.error(
        `Error in file ${filename} at line ${String(index_ + 1)}. Invalid answer format. Skipping.`,
      );
    }
  }

  // Ensure that the number of answers matches the correctness indicators
  if (answers.length !== correctness.length) {
    console.error(
      `Error in file ${filename}. Mismatch between answers and correctness indicators. Skipping.`,
    );
    return null;
  }

  return {
    question: questionText,
    answers,
    multiple: correctness.filter((c) => c === "1").length > 1, // True if multiple answers are correct
    id: index,
  };
};

const parseQuestion = (
  lines: string[],
  filename: string,
  index: number,
): Question | null => {
  if (lines.length < 2) {
    console.error(`Error in file ${filename}. Not enough lines. Skipping.`);
    return null;
  }
  const template = lines[0]?.trim();
  const segmenter = new Intl.Segmenter();
  const questionLinesCount = Array.from(
    segmenter.segment(template),
    ({ segment }) => segment,
  ).filter((c) => c.toLowerCase() === "x").length;

  if (!template) {
    console.error(`Error in file ${filename}. Template not found. Skipping.`);
    return null;
  } else if (template.startsWith("QQ")) {
    return parseQTemplate(lines, filename, index);
  } else if (!["x", "y"].includes(template[0].toLowerCase())) {
    console.error(
      `Error in file ${filename}. Template not recognized. Skipping.`,
    );
    return null;
  } else if (
    Array.from(
      segmenter.segment(template.slice(questionLinesCount)),
      ({ segment }) => segment,
    ).some((c) => c !== "0" && c !== "1")
  ) {
    console.error(
      `Error in file ${filename}. Template not recognized. Skipping.`,
    );
    return null;
  }

  let question = lines.slice(1, questionLinesCount + 1).join("\n");

  // Extract number from filename
  const filenameNumberMatch = /^0*(\d+)/.exec(filename);
  if (filenameNumberMatch !== null) {
    const filenameNumber = filenameNumberMatch[1];
    // Remove the number from the beginning of the question if it matches the filename number
    const questionNumberMatch = /^0*(\d+)\.\s*(0*\d+\.\s*)?(.*)/.exec(question);
    if (questionNumberMatch?.[1] === filenameNumber) {
      question = questionNumberMatch[3];
    }
  }

  const answers = [];
  for (
    let s = questionLinesCount + 1;
    s < Math.min(lines.length, template.length + 1);
    s++
  ) {
    if (!lines[s] || lines[s]?.trim() === "") {
      continue;
    }
    try {
      answers.push({
        answer: lines[s]?.trim(),
        correct: template[s - 1] === "1",
      });
    } catch (error_) {
      console.error(
        `Error in file ${filename} at line ${String(s)}. Replacing the unknown value with False. Error: ${error_ instanceof Error ? error_.message : String(error_)}`,
      );
      answers.push({
        answer: lines[s]?.trim(),
        correct: false,
      });
    }
  }

  const isTrueFalse =
    (template.endsWith("X01") || template.endsWith("X10")) &&
    answers.length === 2 &&
    answers.every((a) => a.answer.toLowerCase() in trueFalseStrings);

  return {
    question,
    answers,
    multiple: !isTrueFalse,
    id: index++,
  };
};

export function ImportQuizPage(): React.JSX.Element {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const [uploadType, setUploadType] = useState<UploadType>("file");
  const [error, setError] = useState<string | null>(null);
  const [fileNameInput, setFileNameInput] = useState<string | null>(null);
  const [fileNameOld, setFileNameOld] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileOldRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [directoryName, setDirectoryName] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [directoryFiles, setDirectoryFiles] = useState<File[]>([]);

  document.title = "Importuj quiz - Testownik Solvro";

  // const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = event.target.files?.[0];
  //   if (file === undefined) {
  //     setFileName(null);
  //   } else {
  //     setFileName(file.name);
  //     setError(null);
  //   }
  // };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    switch (uploadType) {
      case "file": {
        const fileInput = files?.[0];
        if (fileInput === undefined) {
          setFileNameInput(null);
          setFileNameOld(null);
        } else {
          setFileNameInput(fileInput.name);
          setError(null);
        }
        break;
      }

      case "old": {
        if (files !== null && files.length > 0) {
          const fileOld = files[0];
          setFileNameOld(fileOld.name);
          setFileNameInput(null);
          setDirectoryName(null);
          setDirectoryFiles([]);
          if (directoryInputRef.current !== null) {
            directoryInputRef.current.value = "";
          }
        } else {
          setFileNameOld(null);
        }
        break;
      }

      case "json": {
        // No usage
        break;
      }
    }
  };

  const handleDirectorySelect = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (files !== null && files.length > 0) {
      const filesArray = [...files];
      const directoryPath = filesArray[0].webkitRelativePath.split("/")[0];
      setDirectoryName(directoryPath);
      setDirectoryFiles(filesArray);
      setFileNameOld(null);
      if (fileOldRef.current !== null) {
        fileOldRef.current.value = "";
      }
    } else {
      setDirectoryName(null);
    }
  };

  // const handleFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
  //   event.preventDefault();
  //   event.stopPropagation();
  //   if (event.dataTransfer.files.length > 0) {
  //     const file = event.dataTransfer.files[0];
  //     if (fileInputRef.current !== null) {
  //       fileInputRef.current.files = event.dataTransfer.files;
  //     }
  //     setFileName(file.name);
  //     setDirectoryName(null);
  //     setDirectoryFiles([]);
  //     if (directoryInputRef.current !== null) {
  //       directoryInputRef.current.value = "";
  //     }
  //   }
  // };

  const handleFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      switch (uploadType) {
        case "file": {
          if (fileInputRef.current !== null) {
            fileInputRef.current.files = event.dataTransfer.files;
          }
          setFileNameOld(null);
          setFileNameInput(file.name);
          break;
        }
        case "old": {
          if (fileOldRef.current !== null) {
            fileOldRef.current.files = event.dataTransfer.files;
          }
          setFileNameOld(file.name);
          setFileNameInput(null);

          break;
        }
        case "json": {
          // No usage
          break;
        }
      }
      setDirectoryName(null);
      setDirectoryFiles([]);
      if (directoryInputRef.current !== null) {
        directoryInputRef.current.value = "";
      }
    }

    // TODO: handle input and old drop separately
  };

  const handleDirectoryDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const item = event.dataTransfer.items[0];
    const entry = item.webkitGetAsEntry();
    if (entry?.isDirectory === true) {
      const directory = entry as FileSystemDirectoryEntry;
      const reader = directory.createReader();
      const files: File[] = [];
      const readAllEntries = async (
        directoryReader: FileSystemDirectoryReader,
      ): Promise<FileSystemEntry[]> => {
        return new Promise((resolve) => {
          const allEntries: FileSystemEntry[] = [];
          const read = () => {
            directoryReader.readEntries((entries) => {
              if (entries.length > 0) {
                allEntries.push(...entries);
                read();
              } else {
                resolve(allEntries);
              }
            });
          };
          read();
        });
      };

      const getFile = async (fileEntry: FileSystemFileEntry): Promise<File> => {
        return new Promise((resolve) => {
          fileEntry.file(resolve);
        });
      };

      const readDirectoryRecursively = async (
        directoryReader: FileSystemDirectoryReader,
      ) => {
        const entries = await readAllEntries(directoryReader);
        for (const entryItem of entries) {
          if (entryItem.isFile) {
            const fileEntry = entryItem as FileSystemFileEntry;
            const file = await getFile(fileEntry);
            files.push(file);
          } else if (entryItem.isDirectory) {
            const directoryEntry = entryItem as FileSystemDirectoryEntry;
            const subReader = directoryEntry.createReader();
            await readDirectoryRecursively(subReader);
          }
        }
      };

      void (async () => {
        await readDirectoryRecursively(reader);
        setDirectoryFiles(files);
        setDirectoryName(directory.name);
        setFileNameOld(null);
        if (fileInputRef.current !== null) {
          fileInputRef.current.value = "";
        }
      })();
    } else {
      setError("Wybrano niepoprawny folder.");
    }
  };

  const processDirectory = async (files: File[]): Promise<Question[]> => {
    const questions: Question[] = [];
    let index = 1;
    for (const file of files) {
      if (file.name.endsWith(".txt")) {
        let content;
        try {
          content = await detectEncodingAndReadFile(file);
        } catch (error_) {
          console.error(
            `Error reading file ${file.name}: ${error_ instanceof Error ? error_.message : String(error_)}`,
          );
          continue;
        }
        const lines = content.split("\n").map((line) => line.trim());
        const question = parseQuestion(lines, file.name, index++);
        if (question !== null) {
          questions.push(question);
        }
      }
    }
    return questions;
  };

  const processZip = async (file: File): Promise<Question[]> => {
    const questions: Question[] = [];
    const zip = await JSZip.loadAsync(file);
    let index = 1;
    for (const filename of Object.keys(zip.files)) {
      if (filename.endsWith(".txt")) {
        const content = await zip.file(filename)?.async("uint8array");
        let lines;
        try {
          const decoder = new TextDecoder("utf8", { fatal: true });
          lines = decoder
            .decode(content)
            .split("\n")
            .map((line) => line.trim());
        } catch {
          const decoder = new TextDecoder("windows-1250");
          lines = decoder
            .decode(content)
            .split("\n")
            .map((line) => line.trim());
        }
        const question = parseQuestion(lines, filename, index++);
        if (question !== null) {
          questions.push(question);
        }
      }
    }
    return questions;
  };

  const processFiles = async (): Promise<Question[]> => {
    if (directoryFiles.length > 0) {
      return processDirectory(directoryFiles);
    } else if (
      fileInputRef.current?.files != null &&
      fileInputRef.current.files.length > 0
    ) {
      return processZip(fileInputRef.current.files[0]);
    } else {
      throw new Error("Nie wybrano pliku ani folderu.");
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
      case "old": {
        if (fileNameOld == null && directoryName == null) {
          setError("Nie wybrano pliku ani folderu.");
          return;
        }

        if (!quizTitle.trim()) {
          setError("Nie podano nazwy quiz.");
          return;
        }

        setLoading(true);
        setError(null);

        try {
          const questions = await processFiles();

          if (questions.length === 0) {
            setError("Nie znaleziono pytań w wybranych plikach.");
            setLoading(false);
            return;
          }

          const quizData = {
            title: quizTitle,
            description: quizDescription,
            questions,
          };

          const importedQuiz =
            await appContext.services.quiz.createQuiz(quizData);
          setQuiz(importedQuiz);
        } catch (error_) {
          setError(
            `Wystąpił błąd podczas przetwarzania plików: ${error_ instanceof Error ? error_.message : String(error_)}`,
          );
        }
        break;
      }
      // No default
    }
    setLoading(false);
  };

  async function detectEncodingAndReadFile(file: File): Promise<string> {
    const content = await file.arrayBuffer();
    try {
      const decoder = new TextDecoder("utf8", { fatal: true });
      return decoder.decode(content);
    } catch {
      const decoder = new TextDecoder("windows-1250");
      return decoder.decode(content);
    }
  }

  const handleUploadTypeChange = (type: UploadType) => {
    setUploadType(type);
    setError(null);
  };

  // const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
  //   const files = event.target.files;
  //   if (files !== null && files.length > 0) {
  //     const file = files[0];
  //     setFileName(file.name);
  //     setDirectoryName(null);
  //     setDirectoryFiles([]);
  //     if (directoryInputRef.current !== null) {
  //       directoryInputRef.current.value = "";
  //     }
  //   } else {
  //     setFileName(null);
  //   }
  // };
  //
  // const handleDirectorySelect = (
  //   event: React.ChangeEvent<HTMLInputElement>,
  // ) => {
  //   const files = event.target.files;
  //   if (files !== null && files.length > 0) {
  //     const filesArray = [...files];
  //     const directoryPath = filesArray[0].webkitRelativePath.split("/")[0];
  //     setDirectoryName(directoryPath);
  //     setDirectoryFiles(filesArray);
  //     setFileName(null);
  //     if (fileInputRef.current !== null) {
  //       fileInputRef.current.value = "";
  //     }
  //   } else {
  //     setDirectoryName(null);
  //   }
  // };
  //

  //
  // const handleDirectoryDrop = (event: React.DragEvent<HTMLDivElement>) => {
  //   event.preventDefault();
  //   event.stopPropagation();
  //   const item = event.dataTransfer.items[0];
  //   const entry = item.webkitGetAsEntry();
  //   if (entry?.isDirectory === true) {
  //     const directory = entry as FileSystemDirectoryEntry;
  //     const reader = directory.createReader();
  //     const files: File[] = [];
  //     const readAllEntries = async (
  //       directoryReader: FileSystemDirectoryReader,
  //     ): Promise<FileSystemEntry[]> => {
  //       return new Promise((resolve) => {
  //         const allEntries: FileSystemEntry[] = [];
  //         const read = () => {
  //           directoryReader.readEntries((entries) => {
  //             if (entries.length > 0) {
  //               allEntries.push(...entries);
  //               read();
  //             } else {
  //               resolve(allEntries);
  //             }
  //           });
  //         };
  //         read();
  //       });
  //     };
  //
  //     const getFile = async (fileEntry: FileSystemFileEntry): Promise<File> => {
  //       return new Promise((resolve) => {
  //         fileEntry.file(resolve);
  //       });
  //     };
  //
  //     const readDirectoryRecursively = async (
  //       directoryReader: FileSystemDirectoryReader,
  //     ) => {
  //       const entries = await readAllEntries(directoryReader);
  //       for (const entryItem of entries) {
  //         if (entryItem.isFile) {
  //           const fileEntry = entryItem as FileSystemFileEntry;
  //           const file = await getFile(fileEntry);
  //           files.push(file);
  //         } else if (entryItem.isDirectory) {
  //           const directoryEntry = entryItem as FileSystemDirectoryEntry;
  //           const subReader = directoryEntry.createReader();
  //           await readDirectoryRecursively(subReader);
  //         }
  //       }
  //     };
  //
  //     void (async () => {
  //       await readDirectoryRecursively(reader);
  //       setDirectoryFiles(files);
  //       setDirectoryName(directory.name);
  //       setFileName(null);
  //       if (fileInputRef.current !== null) {
  //         fileInputRef.current.value = "";
  //       }
  //     })();
  //   } else {
  //     setError("Wybrano niepoprawny folder.");
  //   }
  // };
  //
  //   const processDirectory = async (files: File[]): Promise<Question[]> => {
  //       const questions: Question[] = [];
  //       let index = 1;
  //       for (const file of files) {
  //           if (file.name.endsWith(".txt")) {
  //               let content;
  //               try {
  //                   content = await detectEncodingAndReadFile(file);
  //               } catch (error_) {
  //                   console.error(
  //                       `Error reading file ${file.name}: ${error_ instanceof Error ? error_.message : String(error_)}`,
  //                   );
  //                   continue;
  //               }
  //               const lines = content.split("\n").map((line) => line.trim());
  //               const question = parseQuestion(lines, file.name, index++);
  //               if (question !== null) {
  //                   questions.push(question);
  //               }
  //           }
  //       }
  //       return questions;
  //   };
  //
  //   const processZip = async (file: File): Promise<Question[]> => {
  //       const questions: Question[] = [];
  //       const zip = await JSZip.loadAsync(file);
  //       let index = 1;
  //       for (const filename of Object.keys(zip.files)) {
  //           if (filename.endsWith(".txt")) {
  //               const content = await zip.file(filename)?.async("uint8array");
  //               let lines;
  //               try {
  //                   const decoder = new TextDecoder("utf8", { fatal: true });
  //                   lines = decoder
  //                       .decode(content)
  //                       .split("\n")
  //                       .map((line) => line.trim());
  //               } catch {
  //                   const decoder = new TextDecoder("windows-1250");
  //                   lines = decoder
  //                       .decode(content)
  //                       .split("\n")
  //                       .map((line) => line.trim());
  //               }
  //               const question = parseQuestion(lines, filename, index++);
  //               if (question !== null) {
  //                   questions.push(question);
  //               }
  //           }
  //       }
  //       return questions;
  //   };
  //
  //   const processFiles = async (): Promise<Question[]> => {
  //       if (directoryFiles.length > 0) {
  //           return processDirectory(directoryFiles);
  //       } else if (
  //           fileInputRef.current?.files != null &&
  //           fileInputRef.current.files.length > 0
  //       ) {
  //           return processZip(fileInputRef.current.files[0]);
  //       } else {
  //           throw new Error("Nie wybrano pliku ani folderu.");
  //       }
  //   };
  //

  //
  //   async function detectEncodingAndReadFile(file: File): Promise<string> {
  //       const content = await file.arrayBuffer();
  //       try {
  //           const decoder = new TextDecoder("utf8", { fatal: true });
  //           return decoder.decode(content);
  //       } catch {
  //           const decoder = new TextDecoder("windows-1250");
  //           return decoder.decode(content);
  //       }
  //   }

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
            <TabsList className="dark:bg-background mx-auto dark:border-1">
              <TabsTrigger value="file">Plik</TabsTrigger>
              <TabsTrigger value="json">Tekst</TabsTrigger>
              <TabsTrigger value="old">Stara wersja</TabsTrigger>
            </TabsList>
            <TabsContent value="file" className="mt-4">
              <div className="space-y-2">
                <Label htmlFor="file-input">Plik JSON z quizem</Label>
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
                    <Label htmlFor="file-input">Plik zip z pytaniami</Label>
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
                        id="file-input"
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
