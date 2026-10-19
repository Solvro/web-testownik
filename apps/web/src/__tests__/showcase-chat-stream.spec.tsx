import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { StrictMode, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AiDemo } from "@/app/(dashboard)/components/landing/sections/product-showcase/ai-demo";
import { ShowcaseSessionProvider } from "@/app/(dashboard)/components/landing/sections/product-showcase/showcase-session";
import { useShowcaseSession } from "@/app/(dashboard)/components/landing/sections/product-showcase/showcase-session-context";

function Tabs() {
  const [aiOpen, setAiOpen] = useState(true);
  const { chatRuntime, quiz } = useShowcaseSession();
  return (
    <>
      <button
        onClick={() => {
          setAiOpen((current) => !current);
        }}
      >
        Switch tab
      </button>
      <output data-testid="stream-state">{chatRuntime.status}</output>
      <output data-testid="stream-content">
        {JSON.stringify(chatRuntime.messages)}
      </output>
      <output data-testid="snapshot">
        {chatRuntime.questionContextSnapshots[0]?.questionId}
      </output>
      <button
        onClick={() => {
          quiz.goTo(quiz.state.questions[1].id);
        }}
      >
        Next question
      </button>
      {aiOpen ? <AiDemo /> : <p>Quiz tab</p>}
    </>
  );
}

describe("showcase chat lifetime", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("continues the real useChat stream while the AI tab is unmounted and restores all output", async () => {
    const user = userEvent.setup();
    const continueStream = Promise.withResolvers<boolean>();
    const finishStream = Promise.withResolvers<boolean>();
    const fetchMock = vi.fn<typeof fetch>(async () => {
      await Promise.resolve();
      return createUIMessageStreamResponse({
        stream: createUIMessageStream({
          execute: async ({ writer }) => {
            writer.write({ type: "start", messageId: "assistant-stream" });
            writer.write({ type: "text-start", id: "text" });
            writer.write({
              type: "text-delta",
              id: "text",
              delta: "Początek odpowiedzi.",
            });
            await continueStream.promise;
            writer.write({
              type: "text-delta",
              id: "text",
              delta: " Dalszy ciąg z ukrytej zakładki.",
            });
            await finishStream.promise;
            writer.write({ type: "text-end", id: "text" });
            writer.write({ type: "finish", finishReason: "stop" });
          },
        }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <StrictMode>
        <ShowcaseSessionProvider>
          <Tabs />
        </ShowcaseSessionProvider>
      </StrictMode>,
    );

    await user.click(
      screen.getByRole("button", { name: "Wyjaśnij to pytanie" }),
    );
    await waitFor(() => {
      expect(screen.getByTestId("stream-state")).toHaveTextContent("streaming");
    });
    const originalQuestionId = screen.getByTestId("snapshot").textContent;
    expect(originalQuestionId).not.toBe("");
    const signal = fetchMock.mock.calls[0][1]?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);
    await user.click(screen.getByRole("button", { name: "Switch tab" }));
    expect(
      screen.queryByRole("textbox", { name: "Wiadomość" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next question" }));
    expect(signal?.aborted).toBe(false);

    await act(async () => {
      continueStream.resolve(true);
      await continueStream.promise;
    });
    await waitFor(() => {
      expect(screen.getByTestId("stream-content")).toHaveTextContent(
        "Dalszy ciąg z ukrytej zakładki.",
      );
    });
    expect(screen.getByTestId("stream-state")).toHaveTextContent("streaming");
    await act(async () => {
      finishStream.resolve(true);
      await finishStream.promise;
    });
    await waitFor(() => {
      expect(screen.getByTestId("stream-state")).toHaveTextContent("ready");
    });
    await user.click(screen.getByRole("button", { name: "Switch tab" }));

    expect(
      screen.getByText("Początek odpowiedzi. Dalszy ciąg z ukrytej zakładki."),
    ).toBeVisible();
    expect(screen.getByTestId("snapshot").textContent).toBe(originalQuestionId);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each(["submitted", "streaming"] as const)(
    "aborts a %s request when the whole showcase unmounts",
    async (phase) => {
      const user = userEvent.setup();
      const finishStream = Promise.withResolvers<boolean>();
      const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            finishStream.resolve(true);
          },
          { once: true },
        );
        if (phase === "submitted") {
          await finishStream.promise;
          init?.signal?.throwIfAborted();
        }
        return createUIMessageStreamResponse({
          stream: createUIMessageStream({
            execute: async ({ writer }) => {
              writer.write({ type: "start", messageId: "assistant-aborted" });
              writer.write({ type: "text-start", id: "text" });
              writer.write({
                type: "text-delta",
                id: "text",
                delta: "Początek odpowiedzi.",
              });
              await finishStream.promise;
              writer.write({ type: "text-end", id: "text" });
              writer.write({ type: "finish", finishReason: "stop" });
            },
          }),
        });
      });
      vi.stubGlobal("fetch", fetchMock);
      const view = render(
        <StrictMode>
          <ShowcaseSessionProvider>
            <Tabs />
          </ShowcaseSessionProvider>
        </StrictMode>,
      );
      await user.click(
        screen.getByRole("button", { name: "Wyjaśnij to pytanie" }),
      );
      await waitFor(() => {
        expect(screen.getByTestId("stream-state")).toHaveTextContent(phase);
        expect(fetchMock).toHaveBeenCalledOnce();
      });
      const signal = fetchMock.mock.calls[0][1]?.signal;
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal?.aborted).toBe(false);
      expect(screen.getByTestId("snapshot").textContent).not.toBe("");
      await act(async () => {
        view.unmount();
        await finishStream.promise;
      });
      expect(signal?.aborted).toBe(true);
    },
  );
});
