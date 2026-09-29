import { consumeText } from "./stream";

export interface ChatToolPart {
  type: "dynamic-tool";
  toolName: string;
  toolCallId: string;
  state:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  input?: unknown;
  output?: unknown;
  errorText?: string;
}
export type ChatPart = { type: "text"; text: string } | ChatToolPart;

/** Preserve the AI SDK's tool parts so replies can be rendered and replayed to the server. */
export async function consumeChat(
  response: Response,
  onParts: (parts: ChatPart[]) => void,
  signal?: AbortSignal,
): Promise<ChatPart[]> {
  const parts: ChatPart[] = [];
  const textIndexes = new Map<string, number>();
  const toolIndexes = new Map<string, number>();
  await consumeText(
    response,
    () => {},
    true,
    signal,
    (event) => {
      if (signal?.aborted) return;
      if (event.type === "text-delta" && typeof event.delta === "string") {
        const id = typeof event.id === "string" ? event.id : "legacy-text";
        let index = textIndexes.get(id);
        if (index === undefined) {
          index = parts.length;
          textIndexes.set(id, index);
          parts.push({ type: "text", text: "" });
        }
        const part = parts[index];
        if (part.type === "text") part.text += event.delta;
      } else if (
        typeof event.type === "string" &&
        event.type.startsWith("tool-") &&
        typeof event.toolCallId === "string"
      ) {
        let index = toolIndexes.get(event.toolCallId);
        if (index === undefined) {
          if (typeof event.toolName !== "string") return;
          index = parts.length;
          toolIndexes.set(event.toolCallId, index);
          parts.push({
            type: "dynamic-tool",
            toolName: event.toolName,
            toolCallId: event.toolCallId,
            state: "input-streaming",
          });
        }
        const part = parts[index];
        if (part.type !== "dynamic-tool") return;
        switch (event.type) {
          case "tool-input-available":
            part.input = event.input;
            part.state = "input-available";
            break;
          case "tool-output-available":
            part.output = event.output;
            part.state = "output-available";
            break;
          case "tool-input-error":
          case "tool-output-error":
          case "tool-output-denied":
            part.state = "output-error";
            part.input = event.input ?? part.input;
            part.errorText =
              typeof event.errorText === "string" ? event.errorText : "";
            break;
          case "tool-input-start":
            break;
          default:
            return;
        }
      } else return;
      onParts(parts.map((part) => ({ ...part })));
    },
  );
  // An interrupted tool call is visible as a failure, never an endless spinner in history.
  for (const part of parts) {
    if (part.type === "dynamic-tool" && !part.state.startsWith("output-")) {
      part.state = "output-error";
      part.errorText = "";
    }
  }
  return parts;
}

export function hasChatContent(parts: ChatPart[]) {
  return parts.some((part) =>
    part.type === "text"
      ? !!part.text.trim()
      : part.state.startsWith("output-"),
  );
}
