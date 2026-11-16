import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StatsPageClient } from "./client";

const { state, refetch } = vi.hoisted(() => ({
  state: { error: null as Error | null, isFetching: true },
  refetch: vi.fn(),
}));
vi.mock("@/hooks/use-quiz-stats", () => ({
  useQuizMetadata: () => ({ data: undefined, ...state, refetch }),
  useQuizStats: () => ({ data: undefined }),
}));

beforeEach(() => {
  state.error = null;
  state.isFetching = true;
  refetch.mockClear();
});

describe("statistics metadata states", () => {
  it("shows a loader rather than a blank report during metadata loading", () => {
    render(<StatsPageClient quizId="fixture" />);
    expect(screen.getByRole("status")).toHaveTextContent("Ładowanie statystyk");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("lets the user retry a failed metadata request", () => {
    state.error = new Error("Network failure");
    state.isFetching = false;
    render(<StatsPageClient quizId="fixture" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Nie udało się wczytać statystyk",
    );
    fireEvent.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
    expect(refetch).toHaveBeenCalledOnce();
  });
  it("disables retry while recovery is pending", () => {
    state.error = new Error("Network failure");
    render(<StatsPageClient quizId="fixture" />);
    expect(screen.getByRole("button", { name: "Ładowanie…" })).toBeDisabled();
  });
});
