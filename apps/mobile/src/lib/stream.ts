// The AI service emits AI SDK UI-message SSE for chat, plain text for hints.
export function chatText(
  sse: string,
  onEvent?: (event: Record<string, unknown>) => void,
): string {
  let text = "";
  for (const line of sse.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    try {
      const event = JSON.parse(line.slice(6));
      if (!event || typeof event !== "object") continue;
      onEvent?.(event);
      if (event.type === "text-delta") text += event.delta ?? "";
      if (event.type === "error")
        throw new Error(event.errorText ?? "Asystent nie mógł odpowiedzieć.");
    } catch (error) {
      if (error instanceof SyntaxError) continue;
      throw error;
    }
  }
  return text;
}
export async function consumeText(
  response: Response,
  onText: (text: string) => void,
  chat = false,
  signal?: AbortSignal,
  onEvent?: (event: Record<string, unknown>) => void,
) {
  const checkAborted = () => {
    if (signal?.aborted) {
      const error = new Error("Response cancelled");
      error.name = "AbortError";
      throw error;
    }
  };
  if (signal?.aborted) void response.body?.cancel().catch(() => {});
  checkAborted();
  if (!response.body) {
    const all = await response.text();
    checkAborted();
    onText(chat ? chatText(all, onEvent) : all);
    return;
  }
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener("abort", cancel, { once: true });
  let buffer = "";
  let text = "";
  let published = "";
  let completed = false;
  const publish = () => {
    if (text !== published) {
      published = text;
      onText(text);
    }
  };
  try {
    for (;;) {
      checkAborted();
      const { done, value } = await reader.read();
      checkAborted();
      if (done) {
        completed = true;
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      if (chat) {
        // Parse each complete SSE line once; retain only the unfinished frame.
        const end = buffer.lastIndexOf("\n");
        if (end >= 0) {
          text += chatText(buffer.slice(0, end + 1), onEvent);
          buffer = buffer.slice(end + 1);
        }
      } else {
        text = buffer;
      }
      publish();
    }
    buffer += decoder.decode();
    text = chat ? text + chatText(buffer, onEvent) : buffer;
    publish();
  } finally {
    signal?.removeEventListener("abort", cancel);
    if (!completed && !signal?.aborted) cancel();
    reader.releaseLock();
  }
}
