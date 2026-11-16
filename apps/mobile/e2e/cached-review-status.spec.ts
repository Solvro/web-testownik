import { expect, test } from "@playwright/test";

const quiz = {
  id: "cached-review",
  title: "Cached review fixture",
  version: 1,
  user_settings: { default_ai_model: null },
  questions: [
    {
      id: "question",
      text: "Saved question text",
      multiple: false,
      answers: [
        { id: "correct", text: "Correct answer", is_correct: true },
        { id: "wrong", text: "Wrong answer", is_correct: false },
      ],
    },
  ],
  current_session: {
    id: "session",
    current_question: "question",
    study_time: 12,
    answers: [
      {
        id: "answer",
        question: "question",
        selected_answers: ["wrong"],
        was_correct: false,
        answered_at: "2026-10-11T20:00:00Z",
      },
    ],
  },
};

for (const language of ["en", "pl"] as const) {
  for (const surface of ["history", "search-quiz"] as const) {
    for (const failure of ["500", "timeout"] as const) {
      test(`${language}: ${surface} ${failure} labels saved data and refreshes without losing review state`, async ({
        page,
      }, testInfo) => {
        await page.addInitScript(
          ({ quiz, language }) => {
            sessionStorage.setItem(
              "testownik.oauth-session.v2",
              JSON.stringify({ access: "review-owner", refresh: "fixture" }),
            );
            localStorage.setItem(
              "testownik.v1.language",
              JSON.stringify(language),
            );
            localStorage.setItem(
              "testownik.v1.offline.review-owner",
              JSON.stringify({
                quizzes: { [quiz.id]: quiz },
                queue: [],
                errors: {},
              }),
            );
          },
          { quiz, language },
        );
        let available = false;
        await page.route("**/api/**", (route) => {
          const path = new URL(route.request().url()).pathname;
          if (path.endsWith("/user/"))
            return route.fulfill({
              json: { id: "review-owner", is_guest: false },
            });
          if (path.includes(`/quizzes/${quiz.id}/`)) {
            if (!available)
              return failure === "timeout"
                ? undefined
                : route.fulfill({ status: 500, json: {} });
            return route.fulfill({
              json: {
                ...quiz,
                version: 2,
                questions: [
                  { ...quiz.questions[0], text: "Refreshed question text" },
                ],
              },
            });
          }
          return route.fulfill({ json: [] });
        });
        const pl = language === "pl";
        const notice = page.getByText(
          pl
            ? "Zapisana kopia. Nie udało się odświeżyć quizu."
            : "Saved copy. Couldn’t refresh this quiz.",
          { exact: true },
        );
        const row = (text: string) =>
          page.getByRole("button", {
            name: `${surface === "history" ? (pl ? "Niepoprawnie" : "Incorrect") : pl ? "Pytanie 1" : "Question 1"}: ${text}`,
            exact: surface !== "history",
          });
        await page.goto(`/${surface}?id=${quiz.id}`);
        await expect(notice).toBeVisible({ timeout: 6500 });
        await expect(row("Saved question text")).toBeVisible();
        if (surface === "history") {
          await row("Saved question text").click();
          await expect(
            page.getByText(pl ? "Twój wybór" : "Your choice", { exact: true }),
          ).toBeVisible();
        } else {
          await page.getByRole("textbox").fill("question");
        }
        await page.screenshot({
          path: testInfo.outputPath("saved-review.png"),
        });
        available = true;
        await page
          .getByRole("button", {
            name: pl ? "Sprawdź aktualizacje" : "Retry Updates",
            exact: true,
          })
          .click();
        await expect(notice).toHaveCount(0);
        await expect(row("Refreshed question text")).toBeVisible();
        if (surface === "history")
          await expect(
            page.getByText(pl ? "Twój wybór" : "Your choice", { exact: true }),
          ).toBeVisible();
        else await expect(page.getByRole("textbox")).toHaveValue("question");
        const stored = await page.evaluate(() =>
          JSON.parse(
            localStorage.getItem("testownik.v1.offline.review-owner")!,
          ),
        );
        expect(stored.queue).toEqual([]);
        // Read-only review/search must not overwrite the study snapshot.
        expect(stored.quizzes[quiz.id]).toEqual(quiz);
      });
    }
  }
}

test("history transport fallback re-reads local answers saved while the request was in flight", async ({
  page,
}) => {
  await page.addInitScript((quiz) => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({ access: "latest-owner", refresh: "fixture" }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
    localStorage.setItem(
      "testownik.v1.offline.latest-owner",
      JSON.stringify({ quizzes: { [quiz.id]: quiz }, queue: [], errors: {} }),
    );
  }, quiz);
  let release!: () => void;
  const response = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/user/"))
      return route.fulfill({ json: { id: "latest-owner", is_guest: false } });
    if (path.includes(`/quizzes/${quiz.id}/`)) {
      started = true;
      await response;
      return route.fulfill({ status: 500, json: {} });
    }
    return route.fulfill({ json: [] });
  });
  try {
    await page.goto(`/history?id=${quiz.id}`);
    await expect.poll(() => started).toBe(true);
    await page.evaluate(() => {
      const key = "testownik.v1.offline.latest-owner";
      const state = JSON.parse(localStorage.getItem(key)!);
      const session = state.quizzes["cached-review"].current_session;
      session.answers.push({
        ...session.answers[0],
        id: "newer",
        selected_answers: ["correct"],
        was_correct: true,
        answered_at: "2026-10-11T21:00:00Z",
      });
      localStorage.setItem(key, JSON.stringify(state));
    });
    release();
    await expect(
      page.getByText("Current session · 1 of 2 correct", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: /Correct: Saved question text/,
      }),
    ).toBeVisible();
  } finally {
    release();
  }
});
