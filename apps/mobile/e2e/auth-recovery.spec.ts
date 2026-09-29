import { test, expect } from "@playwright/test";

for (const language of ["en", "pl"] as const) {
  test(`${language}: OAuth cancellation, stale state and temporary token failure have a clear way back`, async ({
    page,
  }) => {
    await page.addInitScript((language) => {
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
    }, language);
    await page.route("**/api/**", (route) =>
      route.fulfill({ status: 503, json: {} }),
    );
    const back = language === "en" ? "Back to Sign In" : "Wróć do logowania";
    await page.goto("/auth?error=access_denied");
    await expect(
      page.getByText(
        language === "en"
          ? "Sign-in was cancelled."
          : "Logowanie zostało anulowane.",
        { exact: true },
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: back, exact: true }).click();
    await expect(
      page.getByRole("button", {
        name:
          language === "en"
            ? "Sign in to Testownik"
            : "Zaloguj się do Testownika",
        exact: true,
      }),
    ).toBeVisible();
    await page.goto("/auth?code=invalid&state=stale");
    await expect(
      page.getByText(
        language === "en"
          ? "This sign-in session is no longer valid. Please start again."
          : "Nieprawidłowa sesja logowania. Zacznij ponownie.",
        { exact: true },
      ),
    ).toBeVisible();
    await page.evaluate(() =>
      sessionStorage.setItem("testownik.oauth.v1", "broken-json"),
    );
    await page.goto("/auth?code=damaged&state=damaged");
    await expect(
      page.getByText(
        language === "en"
          ? "This sign-in session is no longer valid. Please start again."
          : "Nieprawidłowa sesja logowania. Zacznij ponownie.",
        { exact: true },
      ),
    ).toBeVisible();
    await page.evaluate(() =>
      sessionStorage.setItem(
        "testownik.oauth.v1",
        JSON.stringify({ state: "fixture", verifier: "fixture-verifier" }),
      ),
    );
    await page.goto("/auth?code=fixture&state=fixture");
    await expect(
      page.getByText(
        language === "en"
          ? "The service is temporarily unavailable. Please try again later."
          : "Przerwa techniczna. Spróbuj ponownie później.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: back, exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("testownik.oauth-session.v2"),
      ),
    ).toBeNull();
  });
}
