import { expect, test } from "@playwright/test";

test("malformed saved quiz shows recoverable device-data error and preserves pending answers", async ({
  page,
}) => {
  const state = {
    quizzes: { broken: null },
    queue: [
      {
        request_id: "pending-record",
        quiz_id: "retained-bank",
        session_id: "session",
        version: 1,
        question_id: "question",
        selected_answers: ["answer"],
        elapsed_seconds: 5,
        next_question: null,
        local: {
          id: "pending-record",
          question: "question",
          answered_at: "2026-10-12",
          selected_answers: ["answer"],
          was_correct: true,
        },
      },
    ],
    errors: {},
  };
  const raw = JSON.stringify(state);
  await page.addInitScript((raw) => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({ access: "shape-fixture", refresh: "fixture" }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
    localStorage.setItem("testownik.v1.offline.shape-fixture", raw);
  }, raw);
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: route.request().method() === "POST" ? 503 : 200,
      json: new URL(route.request().url()).pathname.endsWith("/user/")
        ? { id: "shape-fixture", is_guest: false }
        : [],
    }),
  );
  await page.goto("/downloads");
  const error = page.getByTestId("error-screen");
  await expect(error).toBeVisible();
  await expect(
    error.getByText(
      "Could not read the data saved on this device. It has been kept unchanged. Try again or contact support.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    error.getByRole("button", { name: "Try Again", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("testownik.v1.offline.shape-fixture"),
    ),
  ).toBe(raw);
});
