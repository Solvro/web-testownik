import JSZip from "jszip";
import {
  FolderArchiveIcon,
  FolderIcon,
  FolderOpenIcon,
  LoaderCircleIcon,
} from "lucide-react";
import React, { useContext, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
// Migrated from react-bootstrap to shadcn/ui + Tailwind
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea";

import AppContext from "../app-context";
import { uuidv4 } from "../components/quiz/helpers/uuid.ts";
import QuizPreviewModal from "../components/quiz/quiz-preview-modal";
import type { Question, Quiz } from "../components/quiz/types.ts";

const trueFalseStrings = {
  prawda: true,
  tak: true,
  true: true,
  fałsz: false,
  nie: false,
  false: false,
};

const ImportQuizLegacyPage: React.FC = () => {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [directoryName, setDirectoryName] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [directoryFiles, setDirectoryFiles] = useState<File[]>([]);
  const [quiz, setQuiz] = useState<Quiz | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);

  document.title = "Importuj quiz (stara wersja) - Testownik Solvro";

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setDirectoryName(null);
      setDirectoryFiles([]);
      if (directoryInputRef.current) {
        directoryInputRef.current.value = "";
      }
    } else {
      setFileName(null);
    }
  };

  const handleDirectorySelect = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = [...(event.target.files || [])];
    if (files.length > 0) {
      const directoryPath = files[0].webkitRelativePath.split("/")[0];
      setDirectoryName(directoryPath);
      setDirectoryFiles(files);
      setFileName(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } else {
      setDirectoryName(null);
    }
  };

  const handleFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files[0];
    if (file) {
      if (fileInputRef.current) {
        fileInputRef.current.files = event.dataTransfer.files;
      }
      setFileName(file.name);
      setDirectoryName(null);
      setDirectoryFiles([]);
      if (directoryInputRef.current) {
        directoryInputRef.current.value = "";
      }
    }
  };

  const handleDirectoryDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const directory =
      event.dataTransfer.items[0].webkitGetAsEntry() as FileSystemDirectoryEntry;
    if (directory && directory.isDirectory) {
      const reader = directory.createReader();
      const files: File[] = [];
      const readEntries = () => {
        reader.readEntries((entries) => {
          if (entries.length > 0) {
            for (const entry of entries) {
              if (entry.isFile) {
                (entry as FileSystemFileEntry).file((file) => {
                  files.push(file);
                });
              }
            }
            readEntries();
          } else {
            setDirectoryFiles(files);
            setDirectoryName(directory.name);
            setFileName(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }
        });
      };
      readEntries();
    } else {
      setError("Wybrano niepoprawny folder.");
    }
  };

  const handleDragOverFile = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect =
      event.dataTransfer.items &&
      event.dataTransfer.items.length === 1 &&
      event.dataTransfer.items[0].kind === "file" &&
      [
        "application/zip",
        "application/zip-compressed",
        "application/x-zip-compressed",
        "multipart/x-zip",
      ].includes(event.dataTransfer.items[0].type)
        ? "copy"
        : "none";
  };

  const handleDragOverDirectory = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect =
      event.dataTransfer.items &&
      event.dataTransfer.items.length === 1 &&
      event.dataTransfer.items[0].kind === "file"
        ? "copy"
        : "none";
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleImport = async () => {
    if (!fileName && !directoryName) {
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

      if (appContext.isGuest) {
        const userQuizzes = localStorage.getItem("guest_quizzes")
          ? JSON.parse(localStorage.getItem("guest_quizzes")!)
          : [];
        const temporaryQuiz = {
          ...quizData,
          id: uuidv4(),
          visibility: 0,
          version: 1,
          allow_anonymous: false,
          is_anonymous: true,
          can_edit: true,
        };
        userQuizzes.push(temporaryQuiz);
        localStorage.setItem("guest_quizzes", JSON.stringify(userQuizzes));
        setQuiz(temporaryQuiz);
        setLoading(false);
        return;
      }

      const response = await appContext.axiosInstance.post(
        "/quizzes/",
        quizData,
      );

      if (response.status === 201) {
        const quiz = response.data;
        setQuiz(quiz);
      } else {
        const errorData = await response.data;
        setError(
          errorData.error || "Wystąpił błąd podczas importowania quizu.",
        );
      }
    } catch (error_) {
      setError(`Wystąpił błąd podczas przetwarzania plików: ${error_}`);
    } finally {
      setLoading(false);
    }
  };

  const processFiles = async (): Promise<Question[]> => {
    if (directoryFiles.length > 0) {
      return processDirectory(directoryFiles);
    } else if (fileInputRef.current?.files?.length) {
      return processZip(fileInputRef.current.files[0]);
    } else {
      throw new Error("Nie wybrano pliku ani folderu.");
    }
  };

  async function detectEncodingAndReadFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        if (reader.result === null) {
          reject("Error reading file");
          return;
        }
        try {
          const decoder = new TextDecoder("utf-8", { fatal: true });
          // @ts-expect-error: This is necessary to allow reading the result as an ArrayBuffer
          const content = decoder.decode(reader.result);
          resolve(content);
        } catch {
          const decoder = new TextDecoder("windows-1250");
          // @ts-expect-error: This is necessary to allow reading the result as an ArrayBuffer
          const content = decoder.decode(reader.result);
          resolve(content);
        }
      });
      reader.onerror = () => {
        reject(reader.error);
      };
      reader.readAsArrayBuffer(file);
    });
  }

  const processDirectory = async (files: File[]): Promise<Question[]> => {
    const questions: Question[] = [];
    let index = 1;
    for (const file of files) {
      if (file.name.endsWith(".txt")) {
        let content;
        try {
          content = await detectEncodingAndReadFile(file);
        } catch (error_) {
          console.error(`Error reading file ${file.name}: ${error_}`);
          continue;
        }
        const lines = content.split("\n").map((line) => line.trim());
        const question = await parseQuestion(lines, file.name, index++);
        if (question) {
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
          const decoder = new TextDecoder("utf-8", { fatal: true });
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
        const question = await parseQuestion(lines, filename, index++);
        if (question) {
          questions.push(question);
        }
      }
    }
    return questions;
  };

  const parseQuestion = async (
    lines: string[],
    filename: string,
    index: number,
  ): Promise<Question | null> => {
    if (lines.length < 2) {
      console.error(`Error in file ${filename}. Not enough lines. Skipping.`);
      return null;
    }
    const template = lines[0]?.trim();
    const questionLinesCount = template
      .split("")
      .filter((c) => c.toLowerCase() === "x").length;

    if (!template) {
      console.error(`Error in file ${filename}. Template not found. Skipping.`);
      return null;
    } else if (template.startsWith("QQ")) {
      return parseQTemplate(lines, filename, index);
    } else if (!["x", "y"].includes(template[0]?.toLowerCase())) {
      console.error(
        `Error in file ${filename}. Template not recognized. Skipping.`,
      );
      return null;
    } else if (
      [...template.slice(questionLinesCount)].some(
        (c) => c !== "0" && c !== "1",
      )
    ) {
      console.error(
        `Error in file ${filename}. Template not recognized. Skipping.`,
      );
      return null;
    }

    let question = lines.slice(1, questionLinesCount + 1).join("\n");

    // Extract number from filename
    const filenameNumberMatch = /^0*(\d+)/.exec(filename);
    if (filenameNumberMatch) {
      const filenameNumber = filenameNumberMatch[1];
      // Remove the number from the beginning of the question if it matches the filename number
      const questionNumberMatch = /^0*(\d+)\.\s*(0*\d+\.\s*)?(.*)/.exec(
        question,
      );
      if (questionNumberMatch && questionNumberMatch[1] === filenameNumber) {
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
      } catch (error) {
        console.error(
          `Error in file ${filename} at line ${s}. Replacing the unknown value with False. Error: ${error}`,
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

  const parseQTemplate = async (
    lines: string[],
    filename: string,
    index: number,
  ): Promise<Question | null> => {
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
    const correctness = templateParts.slice(2).split(""); // Remove "QQ" and split into individual characters

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
    if (!questionMatch) {
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
      if (answerMatch) {
        const answerIndex = answers.length; // Determine the index of the answer based on its position
        answers.push({
          answer: answerMatch[2], // The answer text
          correct: correctness[answerIndex] === "1", // Check if it's correct
        });
      } else if (answerLine) {
        console.error(
          `Error in file ${filename} at line ${index_ + 1}. Invalid answer format. Skipping.`,
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

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Zaimportuj quiz ze starej wersji</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>{error}</AlertTitle>
            </Alert>
          ) : null}
          <div className="grid gap-6 md:grid-cols-11">
            <div className="space-y-2 md:col-span-5">
              <Label>Plik zip z pytaniami</Label>
              <div
                className="hover:bg-muted/40 dark:bg-input/30 border-input dark:hover:bg-input/40 relative cursor-pointer rounded-md border p-4 text-center text-sm shadow-xs transition"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleFileDrop}
                onDragOver={handleDragOverFile}
                onDragLeave={handleDragLeave}
              >
                <input
                  type="file"
                  accept=".zip"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {fileName ? (
                  <div className="space-y-1">
                    <FolderOpenIcon className="mx-auto size-6" />
                    <p className="break-all">{fileName}</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <FolderArchiveIcon className="mx-auto size-6" />
                    <p>Wybierz plik...</p>
                  </div>
                )}
              </div>
            </div>
            <div className="text-muted-foreground flex items-center justify-center text-sm md:col-span-1">
              lub
            </div>
            <div className="space-y-2 md:col-span-5">
              <Label>Folder z pytaniami</Label>
              <div
                className="hover:bg-muted/40 dark:bg-input/30 border-input dark:hover:bg-input/40 relative cursor-pointer rounded-md border p-4 text-center text-sm shadow-xs transition"
                onClick={() => directoryInputRef.current?.click()}
                onDrop={handleDirectoryDrop}
                onDragOver={handleDragOverDirectory}
                onDragLeave={handleDragLeave}
              >
                <input
                  type="file"
                  ref={directoryInputRef}
                  /* @ts-expect-error: directory selection */
                  directory=""
                  webkitdirectory=""
                  onChange={handleDirectorySelect}
                  className="hidden"
                />
                {directoryName ? (
                  <div className="space-y-1">
                    <FolderOpenIcon className="mx-auto size-6" />
                    <p className="break-all">{directoryName}</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <FolderIcon className="mx-auto size-6" />
                    <p>Wybierz folder...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nazwa</Label>
            <Input
              placeholder="Nazwa quizu"
              value={quizTitle}
              onChange={(e) => {
                setQuizTitle(e.target.value);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Opis</Label>
            <Textarea
              rows={3}
              placeholder="Dodatkowy opis"
              value={quizDescription}
              onChange={(e) => {
                setQuizDescription(e.target.value);
              }}
            />
          </div>
          <div className="text-center">
            <Button onClick={handleImport} disabled={loading}>
              {loading ? (
                <>
                  <LoaderCircleIcon className="animate-spin" /> Import...
                </>
              ) : (
                "Importuj"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <QuizPreviewModal
        show={quiz !== null}
        onHide={async () => navigate("/")}
        quiz={quiz}
        type="imported"
      />
    </>
  );
};

export default ImportQuizLegacyPage;
