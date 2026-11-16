import { expect, test } from "@playwright/test";

const quiz = {
  id: "cached-startup-fixture",
  title: "Saved quiz on a slow connection",
  version: 1,
  user_settings: {},
  questions: [
    {
      id: "cached-question",
      text: "Which planet is red?",
      multiple: false,
      answers: [
        { id: "mars", text: "Mars", is_correct: true },
        { id: "venus", text: "Venus", is_correct: false },
      ],
    },
  ],
  current_session: {
    id: "cached-session",
    current_question: "cached-question",
    answers: [],
    study_time: 0,
  },
};

for (const language of ["en", "pl"] as const) {
  test(`${language}: a hanging quiz refresh releases the saved quiz promptly and preserves an offline answer`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ language, quiz }) => {
        sessionStorage.setItem(
          "testownik.oauth-session.v2",
          JSON.stringify({ access: "cached-owner", refresh: "fixture" }),
        );
        localStorage.setItem("testownik.v1.language", JSON.stringify(language));
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
    let release!: () => void;
    const hanging = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/user/"))
        return route.fulfill({ json: { id: "cached-owner", is_guest: false } });
      if (
        path.includes(`/quizzes/${quiz.id}/`) &&
        route.request().method() === "GET"
      ) {
        await hanging;
        return route.abort().catch(() => undefined);
      }
      if (path.endsWith("/answer/")) return route.abort();
      return route.fulfill({ json: [] });
    });
    try {
      await page.goto(`/quiz/${quiz.id}`);
      await expect(
        page
          .frameLocator(
            language === "en"
              ? 'iframe[title="Question content"]'
              : 'iframe[title="Treść pytania"]',
          )
          .first()
          .getByText("Which planet is red?", { exact: true }),
      ).toBeVisible({ timeout: 6500 });
      await page.getByRole("radio", { name: "Venus", exact: true }).click();
      await page
        .getByRole("button", {
          name: language === "en" ? "Check" : "Sprawdź",
          exact: true,
        })
        .click();
      await expect
        .poll(() =>
          page.evaluate(() => {
            const saved = JSON.parse(
              localStorage.getItem("testownik.v1.offline.cached-owner")!,
            );
            return {
              count: saved.queue.length,
              answers:
                saved.quizzes["cached-startup-fixture"].current_session.answers
                  .length,
            };
          }),
        )
        .toEqual({ count: 1, answers: 1 });
    } finally {
      release();
    }
  });
}
