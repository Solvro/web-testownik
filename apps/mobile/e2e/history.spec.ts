import { expect, test } from "@playwright/test";
const quiz = {
  id: "history-quiz",
  title: "History fixture",
  version: 1,
  questions: [
    {
      id: "q1",
      text: "Which number?",
      answers: [
        { id: "a1", text: "Four", is_correct: true },
        { id: "a2", text: "Five", is_correct: false },
      ],
    },
  ],
  current_session: {
    id: "history-session",
    current_question: "q1",
    study_time: 12,
    answers: [
      {
        id: "older",
        question: "removed",
        selected_answers: [],
        was_correct: true,
        answered_at: "2026-09-26T08:00:00Z",
      },
      {
        id: "newer",
        question: "q1",
        selected_answers: ["a2"],
        was_correct: false,
        answered_at: "2026-09-26T09:00:00Z",
      },
    ],
  },
};
for (const language of ["en", "pl"] as const) {
  test(`${language}: review history preserves selected versus correct answers and recovers failure`, async ({
    page,
  }) => {
    await page.addInitScript((language) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "history-fixture", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
    }, language);
    let fails = true,
      empty = false,
      writes = 0;
    await page.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() !== "GET") writes++;
      if (path.endsWith("/user/"))
        return route.fulfill({
          json: { id: "history-fixture", is_guest: false },
        });
      if (path.includes("/quizzes/"))
        return route.fulfill(
          fails
            ? { status: 503, json: {} }
            : {
                json: empty
                  ? { ...quiz, current_session: null }
                  : {
                      ...quiz,
                      current_session: {
                        answers:
                          language === "en"
                            ? [...quiz.current_session.answers].reverse()
                            : quiz.current_session.answers,
                      },
                    },
              },
        );
      return route.fulfill({ json: [] });
    });
    await page.goto("/history?id=history-quiz");
    const english = language === "en";
    const retry = page.getByRole("button", {
      name: english ? "Try Again" : "Spróbuj ponownie",
      exact: true,
    });
    await expect(retry).toBeVisible();
    fails = false;
    await retry.click();
    await expect(
      page.getByText(
        english
          ? "Current session · 1 of 2 correct"
          : "Bieżąca sesja · 1 z 2 poprawnie",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page
        .getByRole("button", {
          name: english
            ? /^(Incorrect|Correct):/
            : /^(Niepoprawnie|Poprawnie):/,
        })
        .first(),
    ).toHaveAccessibleName(
      new RegExp(
        `^${english ? "Incorrect" : "Niepoprawnie"}: Which number\\?, ${english ? "Question" : "Pytanie"} 1, .+`,
      ),
    );
    await page
      .getByRole("button", {
        name: `${english ? "Incorrect" : "Niepoprawnie"}: Which number?`,
        exact: false,
      })
      .click();
    // Your choice and the correct answer are told apart by text, not only color.
    await expect(
      page.getByText(english ? "Your choice" : "Twój wybór", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel(english ? "Correct answer" : "Poprawna odpowiedź", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.frameLocator("iframe").nth(2).getByText("Five", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: english
          ? "Correct: Question unavailable"
          : "Poprawnie: Pytanie niedostępne",
        exact: false,
      })
      .click();
    await expect(
      page.getByText(
        english
          ? "This question may have been removed from the quiz. Your answer result is retained."
          : "To pytanie mogło zostać usunięte z quizu. Zachowaliśmy wynik odpowiedzi.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(writes).toBe(0);
    empty = true;
    await page.reload();
    await expect(
      page.getByText(english ? "No Answers Yet" : "Jeszcze bez odpowiedzi", {
        exact: true,
      }),
    ).toBeVisible();
  });
}
test("unsynced local answers remain reviewable without replacing them with the server copy", async ({
  page,
}) => {
  await page.addInitScript((quiz) => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({ access: "history-fixture", refresh: "fixture" }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
    localStorage.setItem(
      "testownik.v1.offline.history-fixture",
      JSON.stringify({
        quizzes: { [quiz.id]: quiz },
        queue: [
          {
            request_id: "newer",
            quiz_id: quiz.id,
            session_id: "history-session",
            version: 1,
            question_id: "q1",
            selected_answers: ["a2"],
            elapsed_seconds: 12,
            next_question: "q1",
            local: quiz.current_session.answers[1],
          },
        ],
        errors: {},
      }),
    );
  }, quiz);
  let quizRequests = 0;
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/user/"))
      return route.fulfill({
        json: { id: "history-fixture", is_guest: false },
      });
    if (
      path.includes("/quizzes/") &&
      new URL(route.request().url()).searchParams.get("include") ===
        "current_session"
    )
      quizRequests++;
    return route.fulfill({ status: 503, json: {} });
  });
  await page.goto("/history?id=history-quiz");
  await expect(
    page.getByRole("button", {
      name: /Incorrect: Which number\?/,
      exact: false,
    }),
  ).toBeVisible();
  expect(quizRequests).toBe(0);
});
