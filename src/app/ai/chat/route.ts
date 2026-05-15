import { frontendTools } from "@assistant-ui/react-ai-sdk";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import type { JSONSchema7, ModelMessage, UIMessage } from "ai";
import { z } from "zod";

import { env } from "@/env";
import { resolveImages } from "@/lib/ai/images";
import { chatModel } from "@/lib/ai/model";
import { PermissionAction, hasPermission } from "@/lib/auth/permissions";
import { getServerCurrentUser } from "@/lib/auth/utils.server";

export const maxDuration = 60;

const practiceQuestionSchema = z.object({
  text: z.string().describe("Treść pytania (może zawierać markdown/LaTeX)"),
  answers: z
    .array(
      z.object({
        text: z.string().describe("Treść odpowiedzi"),
        is_correct: z.boolean().describe("Czy to jest poprawna odpowiedź"),
      }),
    )
    .min(2)
    .max(6)
    .describe("Opcje odpowiedzi (2-6 odpowiedzi, przynajmniej jedna poprawna)"),
  explanation: z
    .string()
    .optional()
    .describe("Krótkie wyjaśnienie poprawnej odpowiedzi"),
});

const editQuestionSchema = z.object({
  text: z.string().describe("Zaktualizowana treść pytania"),
  answers: z
    .array(
      z.object({
        text: z.string().describe("Treść odpowiedzi"),
        is_correct: z.boolean().describe("Czy to jest poprawna odpowiedź"),
      }),
    )
    .min(2)
    .max(6)
    .describe("Zaktualizowane opcje odpowiedzi"),
  explanation: z
    .string()
    .optional()
    .describe("Zaktualizowane lub nowe wyjaśnienie poprawnej odpowiedzi"),
});

export async function POST(request: Request) {
  if (env.OPENAI_API_KEY === undefined) {
    return new Response("AI is not configured", { status: 503 });
  }

  const user = await getServerCurrentUser();
  if (user == null) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!hasPermission(user.account_type, PermissionAction.AI_FEATURES)) {
    return new Response("AI features require a full account", { status: 403 });
  }

  const {
    messages,
    system,
    images,
    tools: clientTools,
  } = (await request.json()) as {
    messages: UIMessage[];
    system?: string;
    images?: string[];
    tools?: Record<string, { description?: string; parameters: JSONSchema7 }>;
  };

  const modelMessages = await convertToModelMessages(messages);
  const imageParts =
    images !== undefined && images.length > 0
      ? await resolveImages(images)
      : [];

  const imageContext: ModelMessage[] =
    imageParts.length > 0
      ? [
          {
            role: "user" as const,
            content: [
              { type: "text" as const, text: "[Obrazki z aktualnego pytania]" },
              ...imageParts,
            ],
          },
          {
            role: "assistant" as const,
            content:
              "Widzę obrazki z pytania. Uwzględnię je w moich odpowiedziach.",
          },
        ]
      : [];

  const result = streamText({
    model: chatModel,
    ...(system === undefined ? {} : { system }),
    messages: [...imageContext, ...modelMessages],
    stopWhen: stepCountIs(5),
    tools: {
      ...frontendTools(clientTools ?? {}),
      generate_practice_question: {
        description:
          "Wygeneruj pytanie quizowe do ćwiczeń, aby student mógł sprawdzić swoją wiedzę. Użyj tego, gdy student prosi o pytanie ćwiczeniowe, podobne pytanie lub chce się sprawdzić.",
        inputSchema: practiceQuestionSchema,
        execute: (arguments_: z.infer<typeof practiceQuestionSchema>) => {
          return JSON.stringify(arguments_);
        },
      },
      edit_question: {
        description:
          "Zaproponuj edycję aktualnego pytania quizowego. Użyj tego, gdy student prosi o poprawienie, ulepszenie lub zmianę treści pytania, odpowiedzi lub wyjaśnienia. Edycja musi zostać zatwierdzona przez użytkownika przed zastosowaniem.",
        inputSchema: editQuestionSchema,
        execute: (arguments_: z.infer<typeof editQuestionSchema>) => {
          return JSON.stringify(arguments_);
        },
      },
    },
  });

  return result.toUIMessageStreamResponse();
}
