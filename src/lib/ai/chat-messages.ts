import { convertToModelMessages } from "ai";
import type { ModelMessage, UIMessage } from "ai";

import {
  CURRENT_QUESTION_CONTEXT_MARKER,
  buildCurrentQuestionContextPrompt,
  collectQuestionImages,
} from "@/lib/ai/prompts";
import type { Question } from "@/types/quiz";

type QuestionImagePart =
  | { type: "text"; text: string }
  | { type: "image"; image: string };

export interface QuestionContextSnapshot {
  messageId: string;
  questionId: string;
}

export interface QuestionContextChange {
  previousQuestionOrder?: number | null;
}

interface BuildChatModelMessagesOptions {
  messages: UIMessage[];
  chatQuestion: Question | null;
  chatQuestions: Question[];
  questionContextSnapshots?: QuestionContextSnapshot[];
  legacyQuestionContextChange?: QuestionContextChange;
  resolveQuestionImages: (
    images: ReturnType<typeof collectQuestionImages>,
  ) => Promise<QuestionImagePart[]>;
}

function getModelMessageText(message: ModelMessage): string {
  if (typeof message.content === "string") {
    return message.content;
  }

  if (!Array.isArray(message.content)) {
    return "";
  }

  return message.content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n");
}

export function isCurrentQuestionContextMessage(
  message: ModelMessage,
): boolean {
  return getModelMessageText(message).includes(CURRENT_QUESTION_CONTEXT_MARKER);
}

function getLatestUserMessageId(messages: UIMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "user") {
      return message.id;
    }
  }

  return null;
}

async function buildCurrentQuestionContextMessage(
  question: Question,
  options: {
    questionChanged?: boolean;
    previousQuestionOrder?: number | null;
  },
  resolveQuestionImages: BuildChatModelMessagesOptions["resolveQuestionImages"],
  imagePartsByQuestionId: Map<string, Promise<QuestionImagePart[]>>,
): Promise<ModelMessage> {
  let imagePartsPromise = imagePartsByQuestionId.get(question.id);
  if (imagePartsPromise === undefined) {
    imagePartsPromise = resolveQuestionImages(collectQuestionImages(question));
    imagePartsByQuestionId.set(question.id, imagePartsPromise);
  }

  const imageParts = await imagePartsPromise;
  const text = buildCurrentQuestionContextPrompt(question, options);

  return {
    role: "user",
    content:
      imageParts.length > 0
        ? [
            {
              type: "text",
              text,
            },
            ...imageParts,
          ]
        : text,
  };
}

export async function buildChatModelMessages({
  messages,
  chatQuestion,
  chatQuestions,
  questionContextSnapshots = [],
  legacyQuestionContextChange,
  resolveQuestionImages,
}: BuildChatModelMessagesOptions): Promise<ModelMessage[]> {
  const questionsById = new Map(
    chatQuestions.map((question) => [question.id, question]),
  );
  if (chatQuestion !== null) {
    questionsById.set(chatQuestion.id, chatQuestion);
  }

  const snapshotsByMessageId = new Map(
    questionContextSnapshots.map((snapshot) => [
      snapshot.messageId,
      snapshot.questionId,
    ]),
  );
  const latestUserMessageId = getLatestUserMessageId(messages);
  const imagePartsByQuestionId = new Map<
    string,
    Promise<QuestionImagePart[]>
  >();
  const modelMessages: ModelMessage[] = [];
  let lastContextQuestionId: string | null = null;
  let lastContextQuestionOrder: number | null = null;

  for (const message of messages) {
    const snapshotQuestionId = snapshotsByMessageId.get(message.id);
    const snapshotQuestion =
      snapshotQuestionId === undefined
        ? null
        : (questionsById.get(snapshotQuestionId) ?? null);
    const fallbackQuestion =
      snapshotQuestion === null &&
      message.id === latestUserMessageId &&
      chatQuestion !== null
        ? chatQuestion
        : null;
    const contextQuestion = snapshotQuestion ?? fallbackQuestion;

    if (
      message.role === "user" &&
      contextQuestion !== null &&
      contextQuestion.id !== lastContextQuestionId
    ) {
      const hasPreviousQuestionContext = lastContextQuestionId !== null;
      modelMessages.push(
        await buildCurrentQuestionContextMessage(
          contextQuestion,
          {
            questionChanged:
              hasPreviousQuestionContext ||
              (fallbackQuestion !== null &&
                legacyQuestionContextChange !== undefined),
            previousQuestionOrder:
              hasPreviousQuestionContext && lastContextQuestionOrder !== null
                ? lastContextQuestionOrder
                : legacyQuestionContextChange?.previousQuestionOrder,
          },
          resolveQuestionImages,
          imagePartsByQuestionId,
        ),
      );
      lastContextQuestionId = contextQuestion.id;
      lastContextQuestionOrder = contextQuestion.order;
    }

    const convertedMessages = await convertToModelMessages([message]);
    modelMessages.push(...convertedMessages);
  }

  return modelMessages;
}
