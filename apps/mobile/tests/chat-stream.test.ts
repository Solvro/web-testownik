import { expect, it, vi } from "vitest";
import { consumeChat, hasChatContent } from "../src/lib/chat-stream";
const event = (value: object) => `data: ${JSON.stringify(value)}\n\n`;
it("preserves text/tool/text ordering across single-byte UTF-8 chunks and replays SDK parts", async () => {
  const input = { questions: [{ text: "Żółć", answers: [] }] };
  const source =
    event({ type: "text-delta", id: "a", delta: "Spróbuj" }) +
    event({
      type: "tool-input-start",
      toolCallId: "practice",
      toolName: "generate_practice_questions",
    }) +
    event({
      type: "tool-input-delta",
      toolCallId: "practice",
      inputTextDelta: "{",
    }) +
    event({
      type: "tool-input-available",
      toolCallId: "practice",
      toolName: "generate_practice_questions",
      input,
    }) +
    event({
      type: "tool-output-available",
      toolCallId: "practice",
      output: JSON.stringify(input),
    }) +
    event({ type: "text-delta", id: "b", delta: "Powodzenia!" }) +
    "data: [DONE]\n";
  const response = new Response(
    new ReadableStream({
      start(stream) {
        for (const byte of new TextEncoder().encode(source))
          stream.enqueue(new Uint8Array([byte]));
        stream.close();
      },
    }),
  );
  const publish = vi.fn();
  const result = await consumeChat(response, publish);
  expect(result).toEqual([
    { type: "text", text: "Spróbuj" },
    {
      type: "dynamic-tool",
      toolName: "generate_practice_questions",
      toolCallId: "practice",
      state: "output-available",
      input,
      output: JSON.stringify(input),
    },
    { type: "text", text: "Powodzenia!" },
  ]);
  expect(publish.mock.calls[1][0][1].state).toBe("input-streaming");
  expect(hasChatContent(result)).toBe(true);
  expect(response.body?.locked).toBe(false);
});
it("commits tool-only replies and marks unfinished tools as failures instead of permanent loading", async () => {
  const result = await consumeChat(
    new Response(
      event({
        type: "tool-input-available",
        toolName: "list_questions",
        toolCallId: "find",
        input: { query: "derivative" },
      }),
    ),
    vi.fn(),
  );
  expect(result[0]).toMatchObject({
    type: "dynamic-tool",
    state: "output-error",
  });
  expect(hasChatContent(result)).toBe(true);
  expect(hasChatContent([{ type: "text", text: " " }])).toBe(false);
});
it("cancels pending tool streams without persisting a result", async () => {
  const controller = new AbortController();
  const cancel = vi.fn();
  const response = new Response(
    new ReadableStream({
      start(stream) {
        stream.enqueue(
          new TextEncoder().encode(
            event({
              type: "tool-input-start",
              toolName: "generate_practice_questions",
              toolCallId: "a",
            }),
          ),
        );
      },
      cancel,
    }),
  );
  await expect(
    consumeChat(response, () => controller.abort(), controller.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(cancel).toHaveBeenCalledOnce();
});
it("surfaces stream-level errors even after a tool result was received", async () => {
  await expect(
    consumeChat(
      new Response(
        event({
          type: "tool-input-start",
          toolName: "list_questions",
          toolCallId: "a",
        }) +
          event({
            type: "tool-output-available",
            toolCallId: "a",
            output: "{}",
          }) +
          event({ type: "error", errorText: "Stream failed" }),
      ),
      vi.fn(),
    ),
  ).rejects.toThrow("Stream failed");
});
