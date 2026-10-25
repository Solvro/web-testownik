import {
  buildQuestionHintSystemPrompt,
  buildQuestionHintUserPrompt,
} from "@/lib/ai/prompts";
import { createQuestionCompletionRoute } from "@/lib/ai/question-route.server";

export const maxDuration = 30;

export const POST = createQuestionCompletionRoute({
  scope: "hint",
  buildSystemPrompt: buildQuestionHintSystemPrompt,
  buildUserPrompt: buildQuestionHintUserPrompt,
});
