import JSZip from "jszip";
import React, { useContext, useState } from "react";
import { toast } from "react-toastify";

import { AppContext } from "@/app-context.ts";
import { validateLegacyQuiz } from "@/components/quiz/helpers/legacy-quiz-validation.ts";
import { validateQuiz } from "@/components/quiz/helpers/quiz-validation.ts";
import { migrateLegacyQuiz } from "@/lib/migration.ts";
import type { LegacyQuiz } from "@/types/quiz-legacy.ts";
import type { Answer, Question, Quiz } from "@/types/quiz.ts";

const trueFalseStrings = {
  prawda: true,
  tak: true,
  true: true,
  fałsz: false,
  nie: false,
  false: false,
};

export type UploadType = "file" | "json" | "legacy";

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
  const answers: Answer[] = [];
  for (let index_ = 2; index_ < lines.length; index_++) {
    const answerLine = lines[index_]?.trim();
    const answerMatch = /^\t?\(([a-z])\)\s+(.*)/.exec(answerLine); // Match optional tab, "(letter)", and answer text
    if (answerMatch !== null) {
      const answerIndex = answers.length; // Determine the index of the answer based on its position
      answers.push({
        id: crypto.randomUUID(),
        order: answerIndex + 1,
        text: answerMatch[2], // The answer text
        is_correct: correctness[answerIndex] === "1", // Check if it's correct
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
    id: crypto.randomUUID(),
    order: index,
    text: questionText,
    answers,
    multiple: correctness.filter((c) => c === "1").length > 1, // True if multiple answers are correct
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

  const answers: Answer[] = [];
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
        id: crypto.randomUUID(),
        order: answers.length + 1,
        text: lines[s]?.trim(),
        is_correct: template[s - 1] === "1",
      });
    } catch (error_) {
      console.error(
        `Error in file ${filename} at line ${String(s)}. Replacing the unknown value with False. Error: ${error_ instanceof Error ? error_.message : String(error_)}`,
      );
      answers.push({
        id: crypto.randomUUID(),
        order: answers.length + 1,
        text: lines[s]?.trim(),
        is_correct: false,
      });
    }
  }

  const isTrueFalse =
    (template.endsWith("X01") || template.endsWith("X10")) &&
    answers.length === 2 &&
    answers.every((a) => a.text.toLowerCase() in trueFalseStrings);

  return {
    id: crypto.randomUUID(),
    order: index,
    text: question,
    answers,
    multiple: !isTrueFalse,
  };
};

export const useImportQuiz = () => {
  const appContext = useContext(AppContext);
  const [uploadType, setUploadType] = useState<UploadType>("legacy");
  const [fileNameInput, setFileNameInput] = useState<string | null>(null);
  const [fileNameOld, setFileNameOld] = useState<string | null>(null);
  const [directoryName, setDirectoryName] = useState<string | null>(null);
  const [directoryFiles, setDirectoryFiles] = useState<File[]>([]);
  const [quizTitle, setQuizTitle] = useState<string>("");
  const [quizDescription, setQuizDescription] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const fileOldRef = React.useRef<HTMLInputElement>(null);
  const directoryInputRef = React.useRef<HTMLInputElement>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);

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
      setFileNameInput(null);
      if (fileOldRef.current !== null) {
        fileOldRef.current.value = "";
      }
    } else {
      setDirectoryName(null);
    }
  };

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
        case "legacy": {
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
  };

  const handleDragOverFile = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const items = event.dataTransfer.items;
    switch (uploadType) {
      case "file": {
        event.dataTransfer.dropEffect =
          items.length === 1 &&
          items[0].kind === "file" &&
          items[0].type === "application/json"
            ? "copy"
            : "none";
        break;
      }
      case "legacy": {
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
        break;
      }
      case "json": {
        // No usage
        break;
      }
    }
  };

  const handleDirectoryDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.items.length === 0) {
      return;
    }
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    switch (uploadType) {
      case "file": {
        const fileInput = files?.[0];
        if (fileInput === undefined) {
          setFileNameInput(null);
        } else {
          setFileNameInput(fileInput.name);
          setFileNameOld(null);
          setDirectoryName(null);
          setError(null);
        }
        break;
      }

      case "legacy": {
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
        const fileData = zip.file(filename);
        if (fileData == null) {
          continue;
        }
        const content = await fileData.async("uint8array");
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
      fileOldRef.current?.files != null &&
      fileOldRef.current.files.length > 0
    ) {
      return processZip(fileOldRef.current.files[0]);
    } else {
      throw new Error("Nie wybrano pliku ani folderu.");
    }
  };

  const setErrorAndNotify = (message: string) => {
    setError(message);
    toast.error(message);
    setLoading(false);
  };

  const submitImport = async (data: Quiz) => {
    try {
      const { id, ...rest } = data;
      const result = await appContext.services.quiz.createQuiz(rest);

      setQuiz(result);
    } catch {
      setError("Wystąpił błąd podczas importowania quizu.");
    }
  };

  const processAndSubmitImport = async (data: unknown) => {
    const validationError = validateQuiz(data);
    if (validationError === null) {
      await submitImport(data as Quiz);
      return;
    }
    const legacyError = validateLegacyQuiz(data);
    if (legacyError === null) {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const { quiz: migratedQuiz } = migrateLegacyQuiz(data as LegacyQuiz);
      const postMigrationError = validateQuiz(migratedQuiz);
      if (postMigrationError !== null) {
        setErrorAndNotify(`Błąd migracji quizu legacy: ${postMigrationError}`);
        return;
      }
      await submitImport(migratedQuiz);
      return;
    }

    setErrorAndNotify(`Nieprawidłowy format quizu. ${validationError}`);
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
          await processAndSubmitImport(JSON.parse(text));
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
          await processAndSubmitImport(JSON.parse(textInput));
        } catch (parseError) {
          if (parseError instanceof Error) {
            setError(
              `Wystąpił błąd podczas parsowania JSON: ${parseError.message}`,
            );
          } else {
            setError(
              `Wystąpił błąd podczas parsowania JSON: ${String(parseError)}`,
            );
          }
          console.error("Błąd podczas parsowania JSON:", parseError);
        }

        break;
      }
      case "legacy": {
        if (fileNameOld == null && directoryName == null) {
          setError("Nie wybrano pliku ani folderu.");
          setLoading(false);
          return;
        }
        if (!quizTitle.trim()) {
          setError("Nie podano nazwy quizu.");
          setLoading(false);
          return;
        }

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

  return {
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
  };
};
