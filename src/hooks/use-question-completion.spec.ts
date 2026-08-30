import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useQuestionCompletion } from "@/hooks/use-question-completion";
import { AI_RESPONSE_HEADERS } from "@/lib/ai/quota";
import type { Question } from "@/types/quiz";

const completionMock = vi.hoisted(() => ({
  complete: vi.fn(),
  options: null as null | {
    fetch?: typeof fetch;
    onError?: (error: Error) => void;
  },
}));

vi.mock("@ai-sdk/react", () => ({
  useCompletion: (options: {
    fetch?: typeof fetch;
    onError?: (error: Error) => void;
  }) => {
    completionMock.options = options;
    return {
      completion: "",
      isLoading: false,
      error: undefined,
      complete: completionMock.complete,
      stop: vi.fn(),
    };
  },
}));

const question = {
  id: "question-1",
  question: "Test question",
  answers: [],
} as unknown as Question;

describe("useQuestionCompletion", () => {
  beforeEach(() => {
    completionMock.complete.mockReset();
    completionMock.options = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not restart a failed generation after an unrelated rerender", async () => {
    const { rerender } = renderHook(
      ({ onClose }: { onClose: () => void }) =>
        useQuestionCompletion({
          api: "/ai/hint",
          question,
          onClose,
        }),
      { initialProps: { onClose: vi.fn() } },
    );

    await waitFor(() => {
      expect(completionMock.complete).toHaveBeenCalledOnce();
    });

    act(() => {
      completionMock.options?.onError?.(new Error("request failed"));
    });
    rerender({ onClose: vi.fn() });

    expect(completionMock.complete).toHaveBeenCalledOnce();
  });

  it("exposes a served model only for a successful response", async () => {
    const failedResponse = new Response("cooldown", {
      status: 429,
      headers: {
        [AI_RESPONSE_HEADERS.model]: "grok-4.6",
        [AI_RESPONSE_HEADERS.quotaTier]: "fallback",
        [AI_RESPONSE_HEADERS.retryAfter]: "10",
      },
    });
    const successfulResponse = new Response("ok", {
      status: 200,
      headers: {
        [AI_RESPONSE_HEADERS.model]: "gpt-5.6-luna",
        [AI_RESPONSE_HEADERS.quotaTier]: "fallback",
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(failedResponse)
      .mockResolvedValueOnce(successfulResponse);
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() =>
      useQuestionCompletion({
        api: "/ai/hint",
        question,
        onClose: vi.fn(),
      }),
    );

    await act(async () => completionMock.options?.fetch?.("/ai/hint"));
    expect(result.current.servedModel).toBeNull();
    expect(result.current.fallbackModel).toBeNull();

    await act(async () => completionMock.options?.fetch?.("/ai/hint"));
    expect(result.current.servedModel).toBe("gpt-5.6-luna");
    expect(result.current.fallbackModel).toBe("gpt-5.6-luna");
  });
});
