import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HourlyChart } from "./hourly-chart";
import { StatsTable } from "./stats-table";

const { state, refetch } = vi.hoisted(() => ({
  state: {
    data: undefined as [] | undefined,
    isPending: false,
    isFetching: false,
    isError: true,
  },
  refetch: vi.fn(),
}));
vi.mock("@/hooks/use-quiz-stats", () => ({
  useQuizHourly: () => ({ ...state, refetch }),
  useQuizStats: () => ({ ...state, refetch }),
}));

beforeEach(() => {
  state.data = undefined;
  state.isPending = false;
  state.isFetching = false;
  state.isError = true;
  refetch.mockClear();
});

describe("statistics section network recovery", () => {
  it("distinguishes a failed hourly request from an empty study history", () => {
    render(<HourlyChart quizId="fixture" canViewAll={false} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Nie udało się wczytać",
    );
    expect(screen.queryByText("Brak danych")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
    expect(refetch).toHaveBeenCalledOnce();
  });
  it("offers recovery when the summary request fails", () => {
    render(<StatsTable quizId="fixture" canViewAll={false} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Nie udało się wczytać",
    );
    fireEvent.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});

it("keeps a previously loaded empty history visible after a failed refresh", () => {
  state.data = [];
  render(<HourlyChart quizId="fixture" canViewAll={false} />);
  expect(screen.getByRole("status")).toHaveTextContent(
    "ostatnio wczytane dane",
  );
  expect(screen.getByText("Brak danych")).toBeInTheDocument();
});

it("disables section retry while its request is running", () => {
  state.isFetching = true;
  state.data = [];
  render(<HourlyChart quizId="fixture" canViewAll={false} />);
  expect(screen.getByRole("button", { name: "Ładowanie…" })).toBeDisabled();
});

it("does not show an error for a successfully loaded empty history", () => {
  state.isError = false;
  state.data = [];
  render(<HourlyChart quizId="fixture" canViewAll={false} />);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByText("Brak danych")).toBeInTheDocument();
});
