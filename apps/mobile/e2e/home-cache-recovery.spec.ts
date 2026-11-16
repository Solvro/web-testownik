import { expect, test } from "@playwright/test";

for (const language of ["pl", "en"] as const) {
  test(`${language}: a saved-library read failure shows retry and recovers the saved quiz`, async ({
    page,
  }) => {
    await page.addInitScript((language) => {
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "fixture", refresh: "fixture" }),
      );
      localStorage.setItem(
        "testownik.v1.offline.cache-fixture",
        JSON.stringify({
          quizzes: {
            saved: {
              id: "saved",
              title: "Saved revision",
              questions: [],
              current_session: null,
            },
          },
          queue: [],
          errors: {},
        }),
      );
      const get = Storage.prototype.getItem;
      let fail = true;
      window.addEventListener("testownik:storage-restored", () => {
        fail = false;
      });
      Storage.prototype.getItem = function (key) {
        if (fail && key === "testownik.v1.offline.cache-fixture")
          throw new TypeError("Network request failed");
        return get.call(this, key);
      };
    }, language);
    await page.route("**/api/**", (route) =>
      route.fulfill({
        json: new URL(route.request().url()).pathname.endsWith("/user/")
          ? { id: "cache-fixture", full_name: "Fixture", is_guest: false }
          : [],
      }),
    );
    await page.goto("/");
    await expect(
      page
        .getByText(
          language === "en"
            ? "Check your connection and try again."
            : "Sprawdź połączenie i spróbuj ponownie.",
          { exact: true },
        )
        .first(),
    ).toBeVisible();
    await expect(
      page.getByText(
        language === "en" ? "No Quizzes Yet" : "Nie masz jeszcze quizów",
        { exact: true },
      ),
    ).toHaveCount(0);
    const retry = page.getByRole("button", {
      name: language === "en" ? "Try Again" : "Spróbuj ponownie",
      exact: true,
    });
    // Wait for the query’s automatic retry to settle before restoring storage.
    await expect(retry).toBeVisible();
    await page.evaluate(() =>
      window.dispatchEvent(new Event("testownik:storage-restored")),
    );
    await retry.click();
    await expect(
      page.getByRole("button", {
        name: `${language === "en" ? "Continue" : "Kontynuuj"}: Saved revision`,
        exact: true,
      }),
    ).toBeVisible();
  });
}
