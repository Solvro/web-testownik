import type { UIMessage } from "ai";

import type { QuestionContextSnapshot } from "@/lib/ai/chat-messages";

/** An assistant proposal belongs to the user turn that requested it. */
export function getProposalQuestionId(
  messages: UIMessage[],
  assistantIndex: number,
  snapshots: readonly QuestionContextSnapshot[],
): string | null {
  for (let index = assistantIndex - 1; index >= 0; index--) {
    const message = messages[index];
    if (message.role === "user") {
      return (
        snapshots.find((snapshot) => snapshot.messageId === message.id)
          ?.questionId ?? null
      );
    }
  }
  return null;
}
