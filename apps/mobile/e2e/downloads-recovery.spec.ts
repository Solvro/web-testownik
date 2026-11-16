import { expect, test, type Page } from "@playwright/test";

const quiz = {
  id: "downloads-recovery",
  title: "Downloads recovery fixture",
  version: 1,
  user_settings: { default_ai_model: null },
  questions: [
    {
      id: "question",
      text: "Saved question",
      multiple: false,
      answers: [{ id: "choice", text: "Choice", is_correct: true }],
    },
  ],
  current_session: {
    id: "session",
    current_question: "question",
    study_time: 1,
    answers: [],
  },
};
const answer = {
  id: "pending-answer",
  question: "question",
  selected_answers: ["choice"],
  was_correct: true,
  answered_at: "2026-10-12T00:00:00Z",
};
const queued = {
  request_id: answer.id,
  quiz_id: quiz.id,
  session_id: "session",
  version: 1,
  question_id: "question",
  selected_answers: ["choice"],
  elapsed_seconds: 1,
  next_question: "question",
  local: answer,
};
const key = "testownik.v1.offline.downloads-owner";

async function setup(page: Page, language: "en" | "pl", pending: boolean) {
  await page.addInitScript(
    ({ quiz, queued, key, language, pending }) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "downloads-fixture", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
      if (localStorage.getItem(key) === null)
        localStorage.setItem(
          key,
          JSON.stringify({
            quizzes: { [quiz.id]: quiz },
            queue: pending ? [queued] : [],
            errors: pending ? { [quiz.id]: "Session changed" } : {},
          }),
        );
    },
    { quiz, queued, key, language, pending },
  );
  let posts = 0;
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/user/"))
      return route.fulfill({
        json: { id: "downloads-owner", is_guest: false },
      });
    if (path.endsWith("/answer/")) {
      posts++;
      return route.fulfill({
        status: 409,
        json: { detail: "Session changed" },
      });
    }
    if (path.includes(`/quizzes/${quiz.id}/`))
      return route.fulfill({ status: 503, json: {} });
    return route.fulfill({ json: [] });
  });
  return () => posts;
}

for (const language of ["en", "pl"] as const) {
  const pl = language === "pl";
  test(`${language}: discarding a Downloads quiz immediately clears its session pending status`, async ({
    page,
  }) => {
    const posts = await setup(page, language, true);
    await page.goto("/");
    const waiting = page.getByText(
      pl ? "Odpowiedzi do synchronizacji: 1." : "Answers waiting to sync: 1.",
      { exact: true },
    );
    await expect(waiting).toBeVisible();
    await expect.poll(posts).toBeGreaterThan(0);
    await page
      .getByRole("button", {
        name: pl ? "Zapisane offline" : "Saved Offline",
        exact: true,
      })
      .click();
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", {
        name: pl
          ? `Usuń „${quiz.title}” z urządzenia`
          : `Remove ${quiz.title} from this device`,
        exact: true,
      })
      .click();
    await expect(
      page.getByText(pl ? "Brak zapisanych quizów" : "No Saved Quizzes", {
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).queue.length,
        key,
      ),
    ).toBe(0);
    await page.goBack();
    await expect(waiting).toHaveCount(0, { timeout: 2500 });
    await expect(
      page.getByRole("button", {
        name: pl ? "Synchronizuj" : "Sync Now",
        exact: true,
      }),
    ).toHaveCount(0);
  });

  test(`${language}: Downloads refreshes a removed local quiz after returning from study`, async ({
    page,
  }) => {
    await setup(page, language, true);
    await page.goto("/downloads");
    await page.getByRole("button", { name: quiz.title, exact: true }).click();
    await expect(
      page.getByText(
        pl ? "Odpowiedzi wymagają uwagi" : "Answers Need Attention",
        { exact: true },
      ),
    ).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", {
        name: pl ? "Usuń lokalną kopię" : "Remove Local Copy",
        exact: true,
      })
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          (key) =>
            Object.keys(JSON.parse(localStorage.getItem(key)!).quizzes).length,
          key,
        ),
      )
      .toBe(0);
    await expect(page.getByTestId("error-screen")).toBeVisible();
    await page.goBack();
    await expect(
      page.getByText(pl ? "Brak zapisanych quizów" : "No Saved Quizzes", {
        exact: true,
      }),
    ).toBeVisible({ timeout: 2500 });
    await expect(
      page.getByRole("button", { name: quiz.title, exact: true }),
    ).toHaveCount(0);
  });

  test(`${language}: quiz discard clears pending status before a slow replacement download`, async ({
    page,
  }) => {
    await setup(page, language, true);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`**/api/quizzes/${quiz.id}/?**`, async (route) => {
      await gate;
      await route.fulfill({ status: 503, json: {} }).catch(() => undefined);
    });
    try {
      await page.goto("/");
      const waiting = page.getByText(
        pl ? "Odpowiedzi do synchronizacji: 1." : "Answers waiting to sync: 1.",
        { exact: true },
      );
      await expect(waiting).toBeVisible();
      await page
        .getByRole("button", {
          name: pl ? "Zapisane offline" : "Saved Offline",
          exact: true,
        })
        .click();
      await page.getByRole("button", { name: quiz.title, exact: true }).click();
      page.once("dialog", (dialog) => dialog.accept());
      await page
        .getByRole("button", {
          name: pl ? "Usuń lokalną kopię" : "Remove Local Copy",
          exact: true,
        })
        .click();
      await expect
        .poll(() =>
          page.evaluate(
            (key) => JSON.parse(localStorage.getItem(key)!).queue.length,
            key,
          ),
        )
        .toBe(0);
      await page.goBack();
      await page.goBack();
      await expect(waiting).toHaveCount(0, { timeout: 2500 });
      await expect(
        page.getByRole("button", {
          name: pl ? "Synchronizuj" : "Sync Now",
          exact: true,
        }),
      ).toHaveCount(0);
    } finally {
      release();
    }
  });
}
