import { test, expect } from "@playwright/test";
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="blue"/></svg>';
for (const language of ["en", "pl"] as const)
  test(`${language}: study media loads trusted images and explains external sources`, async ({
    page,
  }) => {
    await page.addInitScript((language) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "image-fixture", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
    }, language);
    let externalRequests = 0,
      answerAttempts = 0;
    await page.route("https://outside.invalid/**", async (route) => {
      externalRequests++;
      await route.fulfill({ contentType: "image/svg+xml", body: svg });
    });
    await page.route("**/media/answer.svg", async (route) => {
      answerAttempts++;
      await route.fulfill(
        answerAttempts === 1
          ? { status: 503, body: "unavailable" }
          : { contentType: "image/svg+xml", body: svg },
      );
    });
    await page.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      return route.fulfill({
        json: path.endsWith("/user/")
          ? { id: "image-fixture", is_guest: false }
          : path.includes("/quizzes/")
            ? {
                id: "images",
                title: "Image fixture",
                questions: [
                  {
                    id: "question",
                    text: "Question ![diagram](https://outside.invalid/inline.svg)",
                    image: "https://outside.invalid/question.svg",
                    multiple: false,
                    answers: [
                      {
                        id: "answer",
                        text: "Answer",
                        image: "https://s3.b.solvro.pl/media/answer.svg",
                        is_correct: true,
                      },
                    ],
                  },
                ],
              }
            : [],
      });
    });
    const c =
      language === "en"
        ? {
            allow: "Hidden images",
            reload: "Reload: Answer image",
            answer: "Answer image",
            check: "Check",
          }
        : {
            allow: "Ukryte obrazy",
            reload: "Wczytaj ponownie: Ilustracja odpowiedzi",
            answer: "Ilustracja odpowiedzi",
            check: "Sprawdź",
          };
    await page.goto("/quiz/images");
    await expect(
      page.getByRole("button", { name: c.allow, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: c.reload, exact: true }),
    ).toBeVisible();
    expect(externalRequests).toBe(0);
    await page.getByRole("button", { name: c.reload, exact: true }).click();
    await expect.poll(() => answerAttempts).toBe(2);
    await expect(
      page.getByRole("img", { name: c.answer, exact: true }),
    ).toBeVisible();
    // Checking with nothing selected is allowed; some questions have no correct answer.
    await expect(
      page.getByRole("button", { name: c.check, exact: true }),
    ).toBeEnabled();
    // The banner opens a dialog naming the websites before anything loads.
    const dialog = page.waitForEvent("dialog").then(async (shown) => {
      const message = shown.message();
      await shown.accept();
      return message;
    });
    await page.getByRole("button", { name: c.allow, exact: true }).click();
    expect(await dialog).toContain("outside.invalid");
    await expect.poll(() => externalRequests).toBeGreaterThanOrEqual(2);
    await expect(
      page.getByRole("button", { name: c.allow, exact: true }),
    ).toHaveCount(0);
  });
