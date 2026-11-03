export interface ChatToolPart {
  type: string;
  toolName?: string;
  toolCallId?: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

export function getChatToolName(part: ChatToolPart) {
  return part.type === "dynamic-tool"
    ? (part.toolName ?? "narzędzie")
    : part.type.replace(/^tool-/, "");
}

const standaloneToolResults = new Set([
  "generate_practice_questions",
  "edit_question",
  "disable_ai",
]);

export function isStandaloneToolResult(part: ChatToolPart) {
  return standaloneToolResults.has(getChatToolName(part));
}
