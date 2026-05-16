import { frontendTools } from "@assistant-ui/react-ai-sdk";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import type { JSONSchema7, ModelMessage, UIMessage } from "ai";
import { cookies } from "next/headers";
import { z } from "zod";

import { env } from "@/env";
import { resolveImages } from "@/lib/ai/images";
import { chatModel } from "@/lib/ai/model";
import { API_URL } from "@/lib/api";
import { AUTH_COOKIES } from "@/lib/auth/constants";
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

const getQuestionSchema = z.object({
  question_order: z
    .number()
    .int()
    .min(1)
    .describe("Numer pytania w quizie (1-indexed)"),
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
    canEdit,
    quizId,
    tools: clientTools,
  } = (await request.json()) as {
    messages: UIMessage[];
    system?: string;
    images?: string[];
    canEdit?: boolean;
    quizId?: string;
    tools?: Record<string, { description?: string; parameters: JSONSchema7 }>;
  };

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_COOKIES.ACCESS_TOKEN)?.value;

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
      generate_practice_questions: {
        description:
          "Wygeneruj pytania quizowe do ćwiczeń, aby student mógł sprawdzić swoją wiedzę. Użyj tego, gdy student prosi o pytanie ćwiczeniowe, podobne pytanie lub chce się sprawdzić. Zawsze generuj pytania przez to narzędzie — jedno lub wiele.",
        inputSchema: z.object({
          questions: z
            .array(practiceQuestionSchema)
            .min(1)
            .describe("Lista wygenerowanych pytań"),
        }),
        execute: (arguments_: {
          questions: z.infer<typeof practiceQuestionSchema>[];
        }) => {
          return JSON.stringify(arguments_);
        },
      },
      ...(quizId === undefined || accessToken === undefined
        ? {}
        : {
            get_question: {
              description:
                "Pobierz pełne szczegóły konkretnego pytania z quizu (treść, odpowiedzi, wyjaśnienie). Użyj tego, gdy użytkownik pyta o konkretne pytanie z quizu (np. 'pokaż pytanie 5', 'wyjaśnij pytanie nr 12').",
              inputSchema: getQuestionSchema,
              execute: async (
                arguments_: z.infer<typeof getQuestionSchema>,
              ) => {
                try {
                  const response = await fetch(
                    `${API_URL}/quizzes/${quizId}/`,
                    {
                      headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                      },
                    },
                  );
                  if (!response.ok) {
                    return JSON.stringify({
                      error: "Nie udało się pobrać quizu",
                    });
                  }
                  const quiz = (await response.json()) as {
                    questions: {
                      id: string;
                      order: number;
                      text: string;
                      explanation?: string | null;
                      multiple: boolean;
                      answers: {
                        text: string;
                        is_correct: boolean;
                        order: number;
                      }[];
                    }[];
                  };
                  const question = quiz.questions.find(
                    (q) => q.order === arguments_.question_order,
                  );
                  if (question === undefined) {
                    return JSON.stringify({
                      error: `Nie znaleziono pytania nr ${arguments_.question_order.toString()}. Quiz ma ${quiz.questions.length.toString()} pytań.`,
                    });
                  }
                  return JSON.stringify({
                    order: question.order,
                    text: question.text,
                    explanation: question.explanation ?? null,
                    multiple: question.multiple,
                    answers: question.answers.map((a) => ({
                      text: a.text,
                      is_correct: a.is_correct,
                    })),
                  });
                } catch {
                  return JSON.stringify({
                    error: "Błąd podczas pobierania pytania",
                  });
                }
              },
            },
          }),
      ...(canEdit === true
        ? {
            edit_question: {
              description:
                "Zaproponuj edycję aktualnego pytania quizowego. Użyj tego, gdy student prosi o poprawienie, ulepszenie lub zmianę treści pytania, odpowiedzi lub wyjaśnienia. Edycja musi zostać zatwierdzona przez użytkownika przed zastosowaniem.",
              inputSchema: editQuestionSchema,
              execute: (arguments_: z.infer<typeof editQuestionSchema>) => {
                return JSON.stringify(arguments_);
              },
            },
          }
        : {}),
      disable_ai: {
        description:
          "Zaproponuj wyłączenie wszystkich funkcji AI w aplikacji. Użyj tego TYLKO gdy użytkownik wyraźnie mówi, że nie chce korzystać z AI, nie potrzebuje AI, lub prosi o wyłączenie/usunięcie AI. Wymaga potwierdzenia użytkownika.",
        inputSchema: z.object({
          reason: z
            .string()
            .describe(
              "Krótkie wyjaśnienie dlaczego AI proponuje wyłączenie (np. na prośbę użytkownika)",
            ),
        }),
        execute: (arguments_: { reason: string }) => {
          return JSON.stringify({
            action: "disable_ai",
            reason: arguments_.reason,
          });
        },
      },
    },
  });

  return result.toUIMessageStreamResponse();
}
