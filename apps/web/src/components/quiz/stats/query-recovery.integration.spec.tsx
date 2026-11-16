import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { HourlyChart } from "./hourly-chart";
import { ScoreChart } from "./score-chart";
import { StatsTable } from "./stats-table";
import { StudyTimeChart } from "./study-time-chart";

let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0, gcTime: 0 } },
  });
  document.body.dataset.mobileEmbed = "true";
});
afterEach(() => {
  client.clear();
  delete document.body.dataset.mobileEmbed;
  vi.unstubAllGlobals();
});
function show(element: React.ReactNode) {
  return render(
    <QueryClientProvider client={client}>{element}</QueryClientProvider>,
  );
}
const summary = {
  sessions_count: 0,
  total_answers: 0,
  correct_answers: 0,
  wrong_answers: 0,
  average_study_time_seconds: 0,
  total_study_time_seconds: 0,
  first_answer_accuracy: 0,
  unique_users_count: 0,
};
function response(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

it("recovers a real hourly query from exhausted retries to a loaded empty result", async () => {
  let failing = true;
  const fetch = vi.fn(
    async () => await Promise.resolve(response([], failing ? 503 : 200)),
  );
  vi.stubGlobal("fetch", fetch);
  show(<HourlyChart quizId="fixture" canViewAll={false} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Nie udało się wczytać",
  );
  expect(screen.queryByText("Brak danych")).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(2);
  failing = false;
  fireEvent.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
  expect(await screen.findByText("Brak danych")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(3);
});

it("summary retry requests only the failed permitted column and retains the other values", async () => {
  let failingAll = true;
  const fetch = vi.fn(async (url: string) => {
    const scope = new URL(url, "http://localhost").searchParams.get("scope");
    return await Promise.resolve(
      response(summary, scope === "all" && failingAll ? 503 : 200),
    );
  });
  vi.stubGlobal("fetch", fetch);
  show(<StatsTable quizId="fixture" canViewAll />);
  await screen.findByRole("alert");
  expect(
    fetch.mock.calls.filter(([url]) => url.includes("scope=me")),
  ).toHaveLength(1);
  expect(screen.getAllByText("0").length).toBeGreaterThan(0);
  failingAll = false;
  fireEvent.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
  await waitFor(() =>
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
  );
  expect(
    fetch.mock.calls.filter(([url]) => url.includes("scope=me")),
  ).toHaveLength(1);
  expect(
    fetch.mock.calls.filter(([url]) => url.includes("scope=all")),
  ).toHaveLength(3);
});

it.each([ScoreChart, StudyTimeChart])(
  "mode change ignores the disabled sessions query's previous failure (%s)",
  async (Chart) => {
    const fetch = vi.fn(
      async (url: string) =>
        await Promise.resolve(
          response([], url.includes("part=sessions") ? 503 : 200),
        ),
    );
    vi.stubGlobal("fetch", fetch);
    show(<Chart quizId="fixture" canViewAll={false} />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("tab", { name: "Dni" }));
    expect(await screen.findByText("Brak danych")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Spróbuj ponownie" }),
    ).not.toBeInTheDocument();
  },
);

it("retains a previously loaded empty result when a real background refresh fails", async () => {
  let failing = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => await Promise.resolve(response([], failing ? 503 : 200))),
  );
  show(<HourlyChart quizId="fixture" canViewAll={false} />);
  await screen.findByText("Brak danych");
  failing = true;
  await act(async () => {
    await client.invalidateQueries({
      queryKey: ["quiz-stats", "fixture", "hourly"],
    });
  });
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent(
      "ostatnio wczytane dane",
    ),
  );
  expect(screen.getByText("Brak danych")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
