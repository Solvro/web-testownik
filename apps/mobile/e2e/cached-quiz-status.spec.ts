import { expect, test } from "@playwright/test";

const quiz = {
  id: "cached-status",
  title: "Saved quiz status fixture",
  version: 1,
  user_settings: { default_ai_model: null },
  questions: [
    {
      id: "question",
      text: "Saved question text",
      multiple: false,
      answers: [{ id: "correct", text: "Saved answer", is_correct: true }],
    },
  ],
  current_session: {
    id: "saved-session",
    current_question: "question",
    study_time: 0,
    answers: [],
  },
};

for (const language of ["en", "pl"] as const) {
  for (const failure of ["500", "timeout"] as const) {
    test(`${language}: ${failure} shows saved copy until an authoritative retry succeeds`, async ({
      page,
    }, testInfo) => {
      await page.addInitScript(
        ({ language, quiz }) => {
          sessionStorage.setItem(
            "testownik.oauth-session.v2",
            JSON.stringify({ access: "cached-owner", refresh: "fixture" }),
          );
          localStorage.setItem(
            "testownik.v1.language",
            JSON.stringify(language),
          );
          localStorage.setItem(
            "testownik.v1.offline.cached-owner",
            JSON.stringify({
              quizzes: { [quiz.id]: quiz },
              queue: [],
              errors: {},
            }),
          );
        },
        { language, quiz },
      );
      let available = false;
      let fetches = 0;
      await page.route("**/api/**", (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith("/user/"))
          return route.fulfill({
            json: { id: "cached-owner", is_guest: false },
          });
        if (path.includes(`/quizzes/${quiz.id}/`)) {
          fetches++;
          if (!available) {
            if (failure === "timeout") return;
            return route.fulfill({
              status: 500,
              json: { detail: "Unavailable" },
            });
          }
          // An identical payload must still clear query-only source metadata.
          return route.fulfill({ json: quiz });
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
      const retry = page.getByRole("button", {
        name: pl ? "Sprawdź aktualizacje" : "Retry Updates",
        exact: true,
      });
      await page.goto(`/quiz/${quiz.id}`);
      await expect(notice).toBeVisible({ timeout: 6500 });
      const question = page
        .frameLocator(
          `iframe[title="${pl ? "Treść pytania" : "Question content"}"]`,
        )
        .first();
      await expect(
        question.getByText("Saved question text", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(
          /You’re offline|Tryb offline|Answers waiting to sync|Odpowiedzi do synchronizacji/,
        ),
      ).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath("saved-copy.png") });
      // A failed retry keeps the useful quiz and its source notice in place.
      await retry.click();
      await expect.poll(() => fetches).toBe(2);
      await expect(retry).toBeEnabled({ timeout: 6500 });
      await expect(notice).toBeVisible();
      available = true;
      await retry.click();
      await expect(notice).toHaveCount(0);
      await expect(retry).toHaveCount(0);
      await expect(
        question.getByText("Saved question text", { exact: true }),
      ).toBeVisible();
      expect(fetches).toBe(3);
      const state = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("testownik.v1.offline.cached-owner")!),
      );
      expect(state.queue).toEqual([]);
      expect(state.quizzes[quiz.id].current_session.id).toBe("saved-session");
      expect(JSON.stringify(state)).not.toContain(
        "saved-copy-updates-unavailable",
      );
    });
  }
}
