import { expect, it, vi } from "vitest";
import { consumeAiResponse } from "../src/lib/ai-response";

function options(controller = new AbortController()) {
  return {
    mode: "hint" as const,
    answerCount: 2,
    signal: controller.signal,
    onText: vi.fn(),
    onReady: vi.fn(),
    emptyMessage: "No response received",
  };
}

it("publishes many hint chunks but signals ready only after the validated stream ends", async () => {
  const config = options();
  const chunks = [
    "<general_hint>",
    "Consider the mechanism.",
    "</general_hint>",
  ];
  config.onText.mockImplementation(() =>
    expect(config.onReady).not.toHaveBeenCalled(),
  );
  await consumeAiResponse(
    Promise.resolve(
      new Response(
        new ReadableStream({
          start(stream) {
            for (const chunk of chunks)
              stream.enqueue(new TextEncoder().encode(chunk));
            stream.close();
          },
        }),
      ),
    ),
    config,
  );
  expect(config.onText).toHaveBeenCalledTimes(3);
  expect(config.onReady).toHaveBeenCalledOnce();
});

it.each(["", "  ", '<answer_hints><hint answer="'])(
  "does not signal a blank or unusable hint as ready: %j",
  async (body) => {
    const config = options();
    await expect(
      consumeAiResponse(Promise.resolve(new Response(body)), config),
    ).rejects.toThrow(config.emptyMessage);
    expect(config.onReady).not.toHaveBeenCalled();
  },
);

it("a rejected request never signals ready", async () => {
  const config = options();
  await expect(
    consumeAiResponse(Promise.reject(new Error("offline")), config),
  ).rejects.toThrow("offline");
  expect(config.onReady).not.toHaveBeenCalled();
});

it("a body failure after visible partial text never signals ready", async () => {
  const config = options();
  const request = Promise.resolve(
    new Response(
      new ReadableStream({
        pull(stream) {
          if (!config.onText.mock.calls.length) {
            stream.enqueue(new TextEncoder().encode("Partial hint"));
          } else stream.error(new Error("Connection lost"));
        },
      }),
    ),
  );
  await expect(consumeAiResponse(request, config)).rejects.toThrow(
    "Connection lost",
  );
  expect(config.onReady).not.toHaveBeenCalled();
});

it("cleanup during a partial explanation cancels the reader and never signals ready", async () => {
  const controller = new AbortController();
  const config = { ...options(controller), mode: "explain" as const };
  const cancel = vi.fn();
  config.onText.mockImplementation(() => controller.abort());
  const request = Promise.resolve(
    new Response(
      new ReadableStream({
        start(stream) {
          stream.enqueue(new TextEncoder().encode("Partial explanation"));
        },
        cancel,
      }),
    ),
  );
  await expect(consumeAiResponse(request, config)).rejects.toMatchObject({
    name: "AbortError",
  });
  expect(cancel).toHaveBeenCalledOnce();
  expect(config.onReady).not.toHaveBeenCalled();
});

it("a successful plain explanation signals ready once", async () => {
  const config = { ...options(), mode: "explain" as const };
  await consumeAiResponse(
    Promise.resolve(new Response("A complete explanation.")),
    config,
  );
  expect(config.onReady).toHaveBeenCalledOnce();
});
