import { expect, test } from "@playwright/test";

for (const language of ["en", "pl"] as const) {
  for (const routeName of ["history", "search-quiz"]) {
    test(`${language}: /${routeName} without quiz context offers a library route`, async ({
      page,
    }) => {
      await page.addInitScript((language) => {
        sessionStorage.setItem(
          "testownik.oauth-session.v2",
          JSON.stringify({ access: "context-fixture", refresh: "fixture" }),
        );
        localStorage.setItem("testownik.v1.language", JSON.stringify(language));
      }, language);
      let quizRequests = 0;
      await page.route("**/api/**", (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.includes("/quizzes/")) quizRequests++;
        return route.fulfill({
          json: path.endsWith("/user/")
            ? { id: "context-fixture", is_guest: false }
            : [],
        });
      });
      await page.goto(`/${routeName}`);
      await expect(
        page.getByText(language === "pl" ? "Wybierz quiz" : "Choose a Quiz", {
          exact: true,
        }),
      ).toBeVisible();
      const browse = page.getByRole("button", {
        name: language === "pl" ? "Przeglądaj bibliotekę" : "Browse Library",
        exact: true,
      });
      await expect(browse).toBeVisible();
      expect(quizRequests).toBe(0);
      await browse.click();
      await expect(page).toHaveURL(/\/library$/);
      await expect(
        page.getByText(
          /No Answers Yet|No Questions Yet|Jeszcze bez odpowiedzi|Brak pytań/,
        ),
      ).toHaveCount(0);
    });
  }
}
