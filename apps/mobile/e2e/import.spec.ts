import { test, expect } from "@playwright/test";
for (const language of ["en", "pl"] as const)
  test(`${language}: import validates before upload, previews privately and retries without losing content`, async ({
    page,
  }) => {
    await page.addInitScript((language) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "import-fixture", refresh: "import-refresh" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
    }, language);
    let writes = 0;
    await page.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON();
        expect((body.quiz ?? body).visibility).toBe(0);
        writes++;
        return route.fulfill({ status: 503, json: {} });
      }
      return route.fulfill({
        json: path.endsWith("/user/")
          ? { id: "import-fixture", full_name: "Fixture", is_guest: false }
          : [],
      });
    });
    const c =
      language === "en"
        ? {
            paste: "Paste JSON",
            field: "Quiz JSON",
            preview: "Preview Quiz",
            invalid: "Invalid JSON. Check the file contents or pasted text.",
            save: "Import and Start Studying",
            retry: "Retry Import",
            private: "The quiz will be added to your library as private.",
            fail: "Couldn’t Import Quiz",
            answer: "Question 1: mark at least one correct answer.",
          }
        : {
            paste: "Wklej JSON",
            field: "JSON quizu",
            preview: "Sprawdź quiz",
            invalid:
              "Nieprawidłowy JSON. Sprawdź zawartość pliku lub wklejony tekst.",
            save: "Importuj i rozpocznij naukę",
            retry: "Ponów import",
            private: "Quiz zostanie dodany do Twojej biblioteki jako prywatny.",
            fail: "Nie udało się zaimportować quizu",
            answer: "Pytanie 1: zaznacz przynajmniej jedną poprawną odpowiedź.",
          };
    await page.goto("/import");
    await page.getByRole("button", { name: c.paste, exact: true }).click();
    const field = page.getByRole("textbox", { name: c.field, exact: true });
    await field.fill("broken JSON");
    await page.getByRole("button", { name: c.preview, exact: true }).click();
    await expect(page.getByText(c.invalid, { exact: true })).toBeVisible();
    expect(writes).toBe(0);
    const quiz = {
      title: "Preview fixture",
      questions: [
        {
          text: "Question",
          image_url: "data:image/png;base64,YQ==",
          answers: [{ text: "Yes", is_correct: false }],
        },
      ],
    };
    await field.fill(JSON.stringify(quiz));
    await page.getByRole("button", { name: c.preview, exact: true }).click();
    await expect(page.getByText(c.answer, { exact: true })).toBeVisible();
    expect(writes).toBe(0);
    quiz.questions[0].answers[0].is_correct = true;
    quiz.questions[0].image_url = "";
    await field.fill(JSON.stringify(quiz));
    await page.getByRole("button", { name: c.preview, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Preview fixture", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(c.private, { exact: true })).toBeVisible();
    expect(writes).toBe(0);
    await page.getByRole("button", { name: c.save, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: c.fail, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Preview fixture", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: c.retry, exact: true }).click();
    expect(writes).toBe(2);
  });
