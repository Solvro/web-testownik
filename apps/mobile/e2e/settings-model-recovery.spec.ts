import { expect, test, type Page } from "@playwright/test";

const settings = {
  initial_reoccurrences: 1,
  wrong_answer_reoccurrences: 1,
  max_question_reoccurrences: 5,
  ai_disabled: false,
  default_ai_model: "fixture/first",
  notify_quiz_shared: true,
  notify_bug_reported: true,
  notify_marketing: false,
};
async function fixture(page: Page, language: "en" | "pl") {
  await page.addInitScript((language) => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({ access: "picker-recovery", refresh: "fixture" }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify(language));
    let online = true;
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => online,
    });
    for (const name of ["connection", "mozConnection", "webkitConnection"])
      Object.defineProperty(navigator, name, {
        configurable: true,
        value: undefined,
      });
    (
      window as unknown as { pickerOnline: (value: boolean) => void }
    ).pickerOnline = (value) => {
      online = value;
      window.dispatchEvent(new Event(value ? "online" : "offline"));
    };
  }, language);
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json: path.endsWith("/user/")
        ? {
            id: "picker-recovery",
            full_name: "Student",
            account_type: "permanent",
            account_level: "gold",
            hide_profile: false,
          }
        : path.endsWith("/settings/")
          ? settings
          : path.endsWith("/ai/models/")
            ? {
                models: [
                  { model: "fixture/first", label: "First Model" },
                  { model: "fixture/second", label: "Second Model" },
                ],
                default_model: "fixture/first",
              }
            : [],
    });
  });
}
async function navigate(page: Page, path: string) {
  await page.evaluate((path) => {
    history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}
for (const language of ["en", "pl"] as const) {
  const pl = language === "pl";
  test(`${language}: an uncached offline model picker exposes retry`, async ({
    page,
  }) => {
    await fixture(page, language);
    await page.route("**/api/ai/models/", (route) =>
      route.abort("internetdisconnected"),
    );
    await page.goto("/");
    await expect(
      page.getByRole("button", {
        name: pl ? "Nowy quiz" : "New Quiz",
        exact: true,
      }),
    ).toBeVisible();
    await page.evaluate(() =>
      (
        window as unknown as { pickerOnline: (value: boolean) => void }
      ).pickerOnline(false),
    );
    await navigate(page, "/settings-model");
    await expect(
      page.getByRole("button", {
        name: pl ? "Spróbuj ponownie" : "Try Again",
        exact: true,
      }),
    ).toBeVisible();
    await page.unroute("**/api/ai/models/");
    await page.evaluate(() =>
      (
        window as unknown as { pickerOnline: (value: boolean) => void }
      ).pickerOnline(true),
    );
    await page
      .getByRole("button", {
        name: pl ? "Spróbuj ponownie" : "Try Again",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("radio", { name: "Second Model", exact: true }),
    ).toBeVisible();
  });
  test(`${language}: opening the account model picker directly saves the selection`, async ({
    page,
  }) => {
    await fixture(page, language);
    const submissions: unknown[] = [];
    await page.route("**/api/settings/", (route) => {
      if (route.request().method() === "PATCH") {
        const body = route.request().postDataJSON();
        submissions.push(body);
        return route.fulfill({ json: body });
      }
      return route.fulfill({ json: settings });
    });
    await page.goto("/settings-model");
    await page
      .getByRole("radio", { name: "Second Model", exact: true })
      .click();
    await expect
      .poll(() => submissions)
      .toEqual([{ ...settings, default_ai_model: "fixture/second" }]);
  });
  test(`${language}: model selection shares pending settings edits across screen visits`, async ({
    page,
  }) => {
    await fixture(page, language);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const submissions: (typeof settings)[] = [];
    await page.route("**/api/settings/", async (route) => {
      if (route.request().method() !== "PATCH")
        return route.fulfill({ json: settings });
      const body = route.request().postDataJSON();
      submissions.push(body);
      if (submissions.length === 1) await gate;
      return route.fulfill({ json: body });
    });
    try {
      await page.goto("/settings");
      await page
        .getByRole("button", { name: "+", exact: true })
        .first()
        .click();
      await expect.poll(() => submissions.length).toBe(1);
      await navigate(page, "/settings-model");
      await page
        .getByRole("radio", { name: "Second Model", exact: true })
        .click();
      await page.waitForTimeout(750);
      release();
      await expect
        .poll(() => submissions)
        .toEqual([
          { ...settings, initial_reoccurrences: 2 },
          {
            ...settings,
            initial_reoccurrences: 2,
            default_ai_model: "fixture/second",
          },
        ]);
    } finally {
      release();
    }
  });

  test(`${language}: a failed direct model save exposes retry and preserves its selection`, async ({
    page,
  }) => {
    await fixture(page, language);
    const submissions: (typeof settings)[] = [];
    await page.route("**/api/settings/", (route) => {
      if (route.request().method() !== "PATCH")
        return route.fulfill({ json: settings });
      const body = route.request().postDataJSON();
      submissions.push(body);
      return submissions.length === 1
        ? route.fulfill({ status: 503, json: {} })
        : route.fulfill({ json: body });
    });
    await page.goto("/settings-model");
    await page
      .getByRole("radio", { name: "Second Model", exact: true })
      .click();
    await expect(
      page.getByText(pl ? "Nie zapisano zmian" : "Changes Not Saved", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: pl ? "Spróbuj ponownie" : "Try Again",
        exact: true,
      })
      .click();
    await expect
      .poll(() => submissions)
      .toEqual([
        { ...settings, default_ai_model: "fixture/second" },
        { ...settings, default_ai_model: "fixture/second" },
      ]);
    await expect(
      page.getByText(pl ? "Nie zapisano zmian" : "Changes Not Saved", {
        exact: true,
      }),
    ).toHaveCount(0);
  });
}
