import { test, expect } from "@playwright/test";

for (const language of ["en", "pl"] as const) {
  test(`${language}: study collections, library sorting, search and offline navigation`, async ({
    page,
  }) => {
    await page.addInitScript((language) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({
          access: "collections-fixture",
          refresh: "collections-refresh",
        }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
      localStorage.setItem(
        "testownik.v1.offline.collections-fixture",
        JSON.stringify({
          quizzes: {
            saved: {
              id: "saved",
              title: "Saved quiz",
              questions: [
                {
                  id: "q1",
                  text: "Saved question",
                  multiple: false,
                  answers: [],
                },
              ],
            },
          },
          queue: [],
          errors: {},
        }),
      );
    }, language);
    const writes: string[] = [];
    const quizzes = [
      {
        id: "z",
        title: "Zoology",
        question_count: 24,
        last_used_at: "2026-09-25T12:00:00Z",
      },
      {
        id: "a",
        title: "Algebra",
        question_count: 12,
        last_used_at: "2026-09-24T12:00:00Z",
      },
    ];
    await page.route("**/api/**", (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() !== "GET") writes.push(url.pathname);
      return route.fulfill({
        json: url.pathname.endsWith("/user/")
          ? {
              id: "collections-fixture",
              is_guest: false,
              account_type: "student",
            }
          : url.pathname.includes("last-used-quizzes")
            ? quizzes
            : url.pathname.includes("search-quizzes")
              ? {
                  user_quizzes:
                    url.searchParams.get("query") === "Algebra"
                      ? [quizzes[1]]
                      : [],
                }
              : url.pathname.endsWith("/library/")
                ? {
                    path: [{ id: "root", name: "Library" }],
                    can_create_folder: true,
                    items: [
                      {
                        id: "archive",
                        name: "Archive",
                        type: "folder",
                        folder_type: "archive",
                        can_edit: false,
                      },
                      {
                        id: "folder",
                        name: "Semester 1",
                        type: "folder",
                        folder_type: "regular",
                        can_edit: true,
                      },
                      {
                        id: "trash",
                        name: "Trash",
                        type: "folder",
                        folder_type: "trash",
                        can_edit: false,
                      },
                      ...quizzes.map((q) => ({
                        ...q,
                        name: q.title,
                        type: "quiz",
                        can_edit: true,
                        can_manage: true,
                      })),
                    ],
                  }
                : [],
      });
    });
    const pl = language === "pl";
    await page.goto("/");
    await expect(
      page.getByRole("button", {
        name: pl ? "Kontynuuj: Zoology" : "Continue: Zoology",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(pl ? "24 pytania" : "24 questions", { exact: false }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: pl ? "Zapisane offline" : "Saved Offline",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", { name: "Saved quiz", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(pl ? "1 pytanie" : "1 question", { exact: true }),
    ).toBeVisible();
    await page.goto("/library");
    await expect(
      page.getByRole("button", { name: "Semester 1", exact: true }),
    ).toBeVisible();
    const quiz = (name: string) =>
      page.getByRole("button", { name, exact: true });
    await expect(quiz("Zoology")).toBeVisible();
    let zoology = await quiz("Zoology").boundingBox(),
      algebra = await quiz("Algebra").boundingBox();
    expect(zoology!.y).toBeLessThan(algebra!.y);
    await page
      .getByRole("button", { name: pl ? "Sortuj" : "Sort", exact: true })
      .click();
    const byName = pl ? "Nazwa A–Z" : "Name A–Z";
    await page.getByRole("button", { name: byName, exact: true }).click();
    await expect(
      page.getByRole("button", { name: byName, exact: true }),
    ).toBeHidden();
    await expect
      .poll(
        async () =>
          (await quiz("Algebra").boundingBox())!.y <
          (await quiz("Zoology").boundingBox())!.y,
      )
      .toBe(true);
    await page.getByRole("textbox").fill("Algebra");
    await expect(
      page.getByText(pl ? "Twoje quizy" : "Your Quizzes", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(quiz("Zoology")).toHaveCount(0);
    await expect(quiz("Algebra")).toBeVisible();
    await page.getByRole("textbox").fill("No matching quiz");
    await expect(quiz("Algebra")).toHaveCount(0);
    await expect(
      page.getByText(pl ? "Brak wyników" : "No Results", { exact: true }),
    ).toBeVisible();
    await page.getByRole("textbox").fill("");
    await expect(quiz("Zoology")).toBeVisible();
    await page.screenshot({
      path: `test-results/library-${language}-${test.info().project.name}.png`,
    });
    expect(writes).toEqual([]);
  });
}

for (const language of ["en", "pl"] as const) {
  test(`${language}: Continue shows matching cached session progress without extra requests`, async ({
    page,
  }) => {
    await page.addInitScript((language) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "summary-fixture", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
      if (!localStorage.getItem("testownik.v1.offline.summary-fixture"))
        localStorage.setItem(
          "testownik.v1.offline.summary-fixture",
          JSON.stringify({
            queue: [],
            errors: {},
            quizzes: {
              quiz: {
                id: "quiz",
                title: "Algorithms",
                version: 3,
                questions: [
                  {
                    id: "one",
                    text: "First saved question",
                    multiple: false,
                    answers: [
                      { id: "one-a", text: "First answer", is_correct: true },
                    ],
                  },
                  {
                    id: "two",
                    text: "Second saved question",
                    multiple: false,
                    answers: [
                      { id: "two-a", text: "Second answer", is_correct: true },
                    ],
                  },
                ],
                user_settings: {
                  initial_reoccurrences: 1,
                  wrong_answer_reoccurrences: 1,
                  max_question_reoccurrences: null,
                },
                current_session: {
                  id: "summary-session",
                  is_active: true,
                  ended_at: null,
                  answers: [
                    {
                      id: "summary-answer-one",
                      question: "one",
                      selected_answers: ["one-a"],
                      was_correct: true,
                      answered_at: "2026-09-26T10:00:00Z",
                    },
                  ],
                },
              },
            },
          }),
        );
    }, language);
    const calls: string[] = [];
    await page.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      calls.push(`${route.request().method()} ${path}`);
      return route.fulfill({
        json: path.endsWith("/user/")
          ? { id: "summary-fixture", is_guest: false }
          : path.includes("last-used-quizzes")
            ? [
                {
                  id: "quiz",
                  title: "Algorithms",
                  version: 3,
                  question_count: 2,
                },
              ]
            : [],
      });
    });
    await page.goto("/");
    await expect(
      page.getByText(
        language === "pl" ? "Opanowane: 1 z 2" : "1 of 2 mastered",
        { exact: true },
      ),
    ).toBeVisible();
    expect(calls.every((call) => call.startsWith("GET "))).toBe(true);
    expect(calls.some((call) => call.includes("/quizzes/quiz/"))).toBe(false);
    await page.evaluate(() => {
      const key = "testownik.v1.offline.summary-fixture";
      const state = JSON.parse(localStorage.getItem(key)!);
      state.quizzes.quiz.version = 2;
      localStorage.setItem(key, JSON.stringify(state));
    });
    await page.reload();
    await expect(
      page.getByText(language === "pl" ? "2 pytania" : "2 questions", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        language === "pl" ? "Opanowane: 1 z 2" : "1 of 2 mastered",
        { exact: true },
      ),
    ).toHaveCount(0);
  });
}
