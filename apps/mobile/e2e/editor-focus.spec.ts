import { test, expect } from "@playwright/test";
const questions = ["First question", "Current question"].map((text, i) => ({
  id: `q${i}`,
  text,
  order: i + 1,
  multiple: false,
  answers: [{ id: `a${i}`, text: "Yes", is_correct: true, order: 1 }],
}));
const quiz = {
  id: "focus",
  title: "Server quiz",
  description: "",
  version: 1,
  can_edit: true,
  questions,
  current_session: {
    id: "session",
    current_question: "q1",
    answers: [],
    study_time: 0,
  },
};
for (const language of ["en", "pl"] as const)
  test(`${language}: edit-current-question retains the full draft and opens the target`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ language, quiz }) => {
        sessionStorage.setItem(
          "testownik.oauth-session.v2",
          JSON.stringify({ access: "focus-fixture", refresh: "fixture" }),
        );
        localStorage.setItem("testownik.v1.language", JSON.stringify(language));
        localStorage.setItem(
          "testownik.v1.draft.focus-fixture.focus",
          JSON.stringify({
            ...quiz,
            title: "Unsaved quiz title",
            questions: quiz.questions.map((question, i) =>
              i === 1
                ? { ...question, text: "Unsaved current question" }
                : question,
            ),
          }),
        );
      },
      { language, quiz },
    );
    let writes = 0;
    await page.route("**/api/**", (route) => {
      if (route.request().method() !== "GET") writes++;
      const path = new URL(route.request().url()).pathname;
      return route.fulfill({
        json: path.endsWith("/user/")
          ? { id: "focus-fixture", is_guest: false }
          : path.includes("/quizzes/")
            ? quiz
            : [],
      });
    });
    await page.goto("/quiz/focus");
    await page
      .getByRole("button", {
        name: language === "en" ? "Edit This Question" : "Edytuj to pytanie",
        exact: true,
      })
      .click();
    const field = page.getByRole("textbox", {
      name: language === "en" ? "Question text" : "Treść pytania",
      exact: true,
    });
    await expect(field).toHaveValue("Unsaved current question");
    await expect(
      page.getByRole("textbox", {
        name: language === "en" ? "Quiz title" : "Tytuł quizu",
        exact: true,
      }),
    ).toHaveValue("Unsaved quiz title");
    await page
      .getByRole("button", {
        name: language === "en" ? "Previous Question" : "Poprzednie pytanie",
        exact: true,
      })
      .click();
    await expect(field).toHaveValue("First question");
    expect(writes).toBe(0);
  });
test("missing target opens question selection without discarding the draft", async ({
  page,
}) => {
  await page.addInitScript((quiz) => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({ access: "focus-fixture", refresh: "fixture" }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
    localStorage.setItem(
      "testownik.v1.draft.focus-fixture.focus",
      JSON.stringify({ ...quiz, questions: [quiz.questions[0]] }),
    );
  }, quiz);
  await page.route("**/api/**", (route) =>
    route.fulfill({
      json: new URL(route.request().url()).pathname.endsWith("/user/")
        ? { id: "focus-fixture", is_guest: false }
        : [],
    }),
  );
  await page.goto("/editor?id=focus&question=q1");
  await expect(
    page.getByText(
      "This question is no longer in the draft. Choose another question from the list.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /First question/ }),
  ).toBeVisible();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("testownik.v1.draft.focus-fixture.focus")!),
  );
  expect(stored.questions).toHaveLength(1);
  expect(stored.questions[0].text).toBe("First question");
});
