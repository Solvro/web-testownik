import { test, expect } from "@playwright/test";
for (const language of ["en", "pl"] as const)
  test(`${language}: question search recovers failures and finds answers without accents`, async ({
    page,
  }) => {
    await page.addInitScript((language) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "search-fixture", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
    }, language);
    let fail = true;
    await page.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/user/"))
        return route.fulfill({
          json: { id: "search-fixture", is_guest: false },
        });
      if (path.includes("/quizzes/"))
        return route.fulfill(
          fail
            ? { status: 503, json: {} }
            : {
                json: {
                  id: "quiz",
                  title: "Search fixture",
                  questions: [
                    {
                      id: "q1",
                      text: "Żółć i łódź",
                      explanation: "Szczegółowe wyjaśnienie",
                      answers: [
                        { id: "a", text: "Źródło energii", is_correct: true },
                      ],
                      multiple: false,
                    },
                    {
                      id: "q2",
                      text: "Another question",
                      answers: [],
                      multiple: false,
                    },
                  ],
                },
              },
        );
      return route.fulfill({ json: [] });
    });
    const c =
      language === "en"
        ? {
            field: "Question, answer or explanation",
            retry: "Try Again",
            two: "Results: 2",
            one: "Results: 1",
            none: "No Results for “missing-phrase”",
            clear: "Clear Search",
            row: "Question 1: Żółć i łódź",
            correct: "Źródło energii, Correct answer",
          }
        : {
            field: "Pytanie, odpowiedź lub wyjaśnienie",
            retry: "Spróbuj ponownie",
            two: "Wyniki: 2",
            one: "Wyniki: 1",
            none: "Brak wyników dla „missing-phrase”",
            clear: "Wyczyść wyszukiwanie",
            row: "Pytanie 1: Żółć i łódź",
            correct: "Źródło energii, Poprawna odpowiedź",
          };
    await page.goto("/search-quiz?id=quiz");
    await expect(
      page.getByRole("button", { name: c.retry, exact: true }),
    ).toBeVisible();
    fail = false;
    await page.getByRole("button", { name: c.retry, exact: true }).click();
    await expect(page.getByText(c.two, { exact: true })).toBeVisible();
    const field = page.getByRole("textbox", { name: c.field, exact: true });
    await field.fill("lodz zrodlo");
    await expect(page.getByText(c.one, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: c.row, exact: true }).click();
    await expect(page.getByLabel(c.correct)).toBeVisible();
    await field.fill("missing-phrase");
    await expect(page.getByText(c.none, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: c.clear, exact: true }).click();
    await expect(field).toHaveValue("");
    await expect(page.getByText(c.two, { exact: true })).toBeVisible();
  });
