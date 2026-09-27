import {
  buildQuestionExplanationSystemPrompt,
  buildQuestionExplanationUserPrompt,
} from "@/lib/ai/prompts";
import { createQuestionCompletionRoute } from "@/lib/ai/question-route.server";

export const maxDuration = 30;

export const POST = createQuestionCompletionRoute({
  scope: "explain",
  buildSystemPrompt: buildQuestionExplanationSystemPrompt,
  buildUserPrompt: buildQuestionExplanationUserPrompt,
});
