import { describe, expect, it, vi } from "vitest";
import { consumeText } from "../src/lib/stream";

const encoder = new TextEncoder();
describe("assistant streaming", () => {
  it("closes a response when cancellation already happened before reading", async () => {
    const cancel = vi.fn();
    const controller = new AbortController();
    controller.abort();
    const response = new Response(new ReadableStream({ cancel }));
    await expect(
      consumeText(response, vi.fn(), true, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("cancels a pending reader immediately and never emits an aborted reply", async () => {
    const cancel = vi.fn();
    const onText = vi.fn();
    const controller = new AbortController();
    const response = new Response(new ReadableStream({ cancel }));
    const result = consumeText(response, onText, true, controller.signal);
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(onText).not.toHaveBeenCalled();
    expect(response.body?.locked).toBe(false);
  });
  it("stops after a partial reply without committing later chunks", async () => {
    const controller = new AbortController();
    const onText = vi.fn(() => controller.abort());
    const cancel = vi.fn();
    const response = new Response(
      new ReadableStream({
        start(stream) {
          stream.enqueue(
            encoder.encode('data: {"type":"text-delta","delta":"First"}\n'),
          );
          stream.enqueue(
            encoder.encode('data: {"type":"text-delta","delta":" later"}\n'),
          );
        },
        cancel,
      }),
    );
    await expect(
      consumeText(response, onText, true, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(onText.mock.calls).toEqual([["First"]]);
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("preserves Polish text split across UTF-8 chunks and SSE frames", async () => {
    const bytes = encoder.encode(
      'data: {"type":"text-delta","delta":"Żółć"}\n\ndata: [DONE]\n',
    );
    const onText = vi.fn();
    const response = new Response(
      new ReadableStream({
        start(stream) {
          for (const byte of bytes) stream.enqueue(new Uint8Array([byte]));
          stream.close();
        },
      }),
    );
    await consumeText(response, onText, true);
    expect(onText).toHaveBeenLastCalledWith("Żółć");
    expect(onText).toHaveBeenCalledOnce();
    expect(response.body?.locked).toBe(false);
  });
  it("surfaces server stream errors instead of treating partial text as success", async () => {
    const response = new Response(
      'data: {"type":"text-delta","delta":"Partial"}\ndata: {"type":"error","errorText":"Unavailable"}\n',
    );
    await expect(consumeText(response, vi.fn(), true)).rejects.toThrow(
      "Unavailable",
    );
    expect(response.body?.locked).toBe(false);
  });
});
