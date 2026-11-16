import { test, expect } from "@playwright/test";

for (const language of ["en", "pl"] as const) {
  test(`${language}: failed session storage initialization offers retry instead of an endless spinner`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript((language) => {
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
      const remove = Storage.prototype.removeItem;
      let fail = true;
      Storage.prototype.removeItem = function (key) {
        if (key === "testownik.session.v1" && fail) {
          fail = false;
          throw new TypeError("Network request failed");
        }
        return remove.call(this, key);
      };
    }, language);
    await page.goto("/login");
    await expect(
      page.getByText(
        language === "en"
          ? "Couldn’t Open Testownik"
          : "Nie udało się otworzyć aplikacji",
        { exact: true },
      ),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: language === "en" ? "Try Again" : "Spróbuj ponownie",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name:
          language === "en"
            ? "Sign in to Testownik"
            : "Zaloguj się do Testownika",
        exact: true,
      }),
    ).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test(`${language}: sign-in preparation failure is shown and releases the sign-in button`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript((language) => {
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === "testownik.oauth.v1")
          throw new TypeError("Network request failed");
        return set.call(this, key, value);
      };
    }, language);
    await page.goto("/login");
    const button = page.getByRole("button", {
      name:
        language === "en"
          ? "Sign in to Testownik"
          : "Zaloguj się do Testownika",
      exact: true,
    });
    await button.click();
    await expect(
      page.getByText(
        language === "en"
          ? "Check your connection and try again."
          : "Sprawdź połączenie i spróbuj ponownie.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(button).toBeEnabled();
    expect(errors).toEqual([]);
  });

  for (const status of [403, 503]) {
    test(`${language}: valid credentials survive a temporary ${status} profile failure and can retry startup`, async ({
      page,
    }) => {
      const tokens = {
        access: "read-only-fixture",
        refresh: "read-only-fixture",
      };
      await page.addInitScript(
        ({ language, tokens }) => {
          localStorage.setItem(
            "testownik.v1.language",
            JSON.stringify(language),
          );
          sessionStorage.setItem(
            "testownik.oauth-session.v2",
            JSON.stringify(tokens),
          );
        },
        { language, tokens },
      );
      let fail = true;
      await page.route("**/api/**", (route) => {
        const user = new URL(route.request().url()).pathname.endsWith("/user/");
        return route.fulfill(
          user && fail
            ? { status, json: {} }
            : {
                json: user
                  ? {
                      id: "startup-fixture",
                      full_name: "Fixture",
                      is_guest: false,
                    }
                  : [],
              },
        );
      });
      await page.goto("/");
      await expect(
        page.getByText(
          language === "en"
            ? "Couldn’t Open Testownik"
            : "Nie udało się otworzyć aplikacji",
          { exact: true },
        ),
      ).toBeVisible();
      expect(
        await page.evaluate(() =>
          JSON.parse(
            sessionStorage.getItem("testownik.oauth-session.v2") ?? "null",
          ),
        ),
      ).toEqual(tokens);
      fail = false;
      await page
        .getByRole("button", {
          name: language === "en" ? "Try Again" : "Spróbuj ponownie",
          exact: true,
        })
        .click();
      await expect(
        page.getByText(
          language === "en" ? "No Quizzes Yet" : "Nie masz jeszcze quizów",
          { exact: true },
        ),
      ).toBeVisible();
    });
  }

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

for (const language of ["en", "pl"] as const) {
  test(`${language}: a permanent startup profile failure still permits signing out`, async ({
    page,
  }) => {
    await page.addInitScript((language) => {
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({
          access: "blocked-fixture",
          refresh: "blocked-fixture",
        }),
      );
    }, language);
    await page.route("**/api/**", (route) =>
      route.fulfill({ status: 403, json: {} }),
    );
    await page.goto("/");
    await expect(
      page.getByText(
        language === "en"
          ? "Couldn’t Open Testownik"
          : "Nie udało się otworzyć aplikacji",
        { exact: true },
      ),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: language === "en" ? "Sign Out" : "Wyloguj",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name:
          language === "en"
            ? "Sign in to Testownik"
            : "Zaloguj się do Testownika",
        exact: true,
      }),
    ).toBeEnabled();
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("testownik.oauth-session.v2"),
      ),
    ).toBeNull();
  });
}

for (const language of ["en", "pl"] as const) {
  test(`${language}: failed sign-out does not report success while credentials remain persisted`, async ({
    page,
  }) => {
    await page.addInitScript((language) => {
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({
          access: "blocked-fixture",
          refresh: "blocked-fixture",
        }),
      );
      const remove = Storage.prototype.removeItem;
      let fail = true;
      Storage.prototype.removeItem = function (key) {
        if (key === "testownik.oauth-session.v2" && fail) {
          fail = false;
          throw new Error("Fixture sign-out storage failed once");
        }
        return remove.call(this, key);
      };
    }, language);
    await page.route("**/api/**", (route) =>
      route.fulfill({ status: 403, json: {} }),
    );
    await page.goto("/");
    const signOut = page.getByRole("button", {
      name: language === "en" ? "Sign Out" : "Wyloguj",
      exact: true,
    });
    await signOut.click();
    await expect(
      page.getByText("Fixture sign-out storage failed once", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: language === "en" ? "Try Again" : "Spróbuj ponownie",
        exact: true,
      })
      .click();
    await expect(signOut).toBeVisible();
    await expect(
      page.getByRole("button", {
        name:
          language === "en"
            ? "Sign in to Testownik"
            : "Zaloguj się do Testownika",
        exact: true,
      }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("testownik.oauth-session.v2"),
      ),
    ).not.toBeNull();
    await signOut.click();
    await expect(
      page.getByRole("button", {
        name:
          language === "en"
            ? "Sign in to Testownik"
            : "Zaloguj się do Testownika",
        exact: true,
      }),
    ).toBeEnabled();
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("testownik.oauth-session.v2"),
      ),
    ).toBeNull();
  });
}
