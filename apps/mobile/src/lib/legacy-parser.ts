import type { Answer, Question } from "@testownik/core/quiz/types";
import * as crypto from "expo-crypto";

const trueFalseStrings = {
  prawda: true,
  tak: true,
  true: true,
  fałsz: false,
  nie: false,
  false: false,
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
  const correctness = Array.from(templateParts.slice(2));

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
    explanation: "",
  };
};

export const parseQuestion = (
  lines: string[],
  filename: string,
  index: number,
): Question | null => {
  if (lines.length < 2) {
    console.error(`Error in file ${filename}. Not enough lines. Skipping.`);
    return null;
  }
  const template = lines[0]?.trim();
  // The format's template is ASCII (X/Y/0/1); no grapheme segmentation is
  // needed, and Intl.Segmenter is unavailable in some native JS runtimes.
  const questionLinesCount = Array.from(template).filter(
    (c) => c.toLowerCase() === "x",
  ).length;

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
    Array.from(template.slice(questionLinesCount)).some(
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
    explanation: "",
  };
};
