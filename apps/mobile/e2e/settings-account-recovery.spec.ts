import { expect, test, type Page } from "@playwright/test";

const settings = {
  initial_reoccurrences: 1,
  wrong_answer_reoccurrences: 1,
  max_question_reoccurrences: 5,
  ai_disabled: false,
  default_ai_model: null,
  notify_quiz_shared: true,
  notify_bug_reported: true,
  notify_marketing: false,
};
async function fixture(page: Page, language: "en" | "pl") {
  await page.addInitScript((language) => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({ access: "settings-recovery", refresh: "fixture" }),
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
    (window as unknown as { qaOnline: (value: boolean) => void }).qaOnline = (
      value,
    ) => {
      online = value;
      window.dispatchEvent(new Event(value ? "online" : "offline"));
    };
  }, language);
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/user/"))
      return route.fulfill({
        json: {
          id: "settings-recovery",
          full_name: "Student",
          account_level: "basic",
          is_guest: false,
        },
      });
    if (path.endsWith("/settings/")) return route.fulfill({ json: settings });
    return route.fulfill({ json: [] });
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
  test(`${language}: closing settings during save does not submit the same edit twice`, async ({
    page,
  }) => {
    await fixture(page, language);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const submissions: number[] = [];
    await page.route("**/api/settings/", async (route) => {
      if (route.request().method() !== "PATCH")
        return route.fulfill({ json: settings });
      const submitted = route.request().postDataJSON();
      submissions.push(submitted.initial_reoccurrences);
      if (submissions.length === 1) await gate;
      return route.fulfill({ json: submitted });
    });
    try {
      await page.goto("/settings");
      await page
        .getByRole("button", { name: "+", exact: true })
        .first()
        .click();
      await expect.poll(() => submissions).toEqual([2]);
      await navigate(page, "/account");
      await expect(
        page.getByText(pl ? "Twoje dane" : "Your Information", { exact: true }),
      ).toBeVisible();
      release();
      await page.waitForTimeout(500);
      expect(submissions).toEqual([2]);
    } finally {
      release();
    }
  });

  test(`${language}: a successful queued settings save clears the earlier failure`, async ({
    page,
  }) => {
    await fixture(page, language);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const submissions: number[] = [];
    await page.route("**/api/settings/", async (route) => {
      if (route.request().method() !== "PATCH")
        return route.fulfill({ json: settings });
      const submitted = route.request().postDataJSON();
      submissions.push(submitted.initial_reoccurrences);
      if (submissions.length === 1) {
        await gate;
        return route.fulfill({ status: 503, json: {} });
      }
      return route.fulfill({ json: submitted });
    });
    try {
      await page.goto("/settings");
      const increment = page
        .getByRole("button", { name: "+", exact: true })
        .first();
      await increment.click();
      await expect.poll(() => submissions).toEqual([2]);
      await increment.click();
      await page.waitForTimeout(800);
      release();
      await expect.poll(() => submissions).toEqual([2, 3]);
      await expect(
        page.getByText(pl ? "Do opanowania: 3" : "To Master: 3", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText(pl ? "Nie zapisano zmian" : "Changes Not Saved", {
          exact: true,
        }),
      ).toHaveCount(0);
    } finally {
      release();
    }
  });

  test(`${language}: late background settings GET cannot overwrite a saved value`, async ({
    page,
  }) => {
    await fixture(page, language);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let gets = 0;
    const submissions: (typeof settings)[] = [];
    await page.route("**/api/settings/", async (route) => {
      if (route.request().method() === "PATCH") {
        const submitted = route.request().postDataJSON();
        submissions.push(submitted);
        return route.fulfill({ json: submitted });
      }
      gets++;
      if (gets > 1) await gate;
      return route.fulfill({ json: settings });
    });
    try {
      await page.goto("/settings");
      await expect(
        page.getByText(pl ? "Do opanowania: 1" : "To Master: 1", {
          exact: true,
        }),
      ).toBeVisible();
      await page.clock.install();
      await page.clock.fastForward(31000);
      await navigate(page, "/account");
      await expect(
        page.getByText(pl ? "Twoje dane" : "Your Information", { exact: true }),
      ).toBeVisible();
      await navigate(page, "/settings");
      await expect.poll(() => gets).toBe(2);
      const increment = page.getByRole("button", { name: "+", exact: true });
      await increment.first().click();
      await page.clock.runFor(700);
      await expect.poll(() => submissions.length).toBe(1);
      release();
      await page.clock.runFor(200);
      await expect(
        page.getByText(pl ? "Do opanowania: 2" : "To Master: 2", {
          exact: true,
        }),
      ).toBeVisible();
      await increment.nth(1).click();
      await page.clock.runFor(700);
      await expect.poll(() => submissions.length).toBe(2);
      expect(submissions[1].initial_reoccurrences).toBe(2);
    } finally {
      release();
    }
  });

  for (const path of ["settings", "account"] as const) {
    test(`${language}: uncached offline ${path} exposes retry and recovers`, async ({
      page,
    }) => {
      await fixture(page, language);
      const endpoint =
        path === "settings" ? "settings/" : "oauth/authorized-apps/";
      await page.route(`**/api/${endpoint}`, (route) =>
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
        (window as unknown as { qaOnline: (value: boolean) => void }).qaOnline(
          false,
        ),
      );
      await navigate(page, `/${path}`);
      await expect(
        page.getByRole("button", {
          name: pl ? "Spróbuj ponownie" : "Try Again",
          exact: true,
        }),
      ).toBeVisible();
      await page.unroute(`**/api/${endpoint}`);
      await page.evaluate(() =>
        (window as unknown as { qaOnline: (value: boolean) => void }).qaOnline(
          true,
        ),
      );
      const retry = page.getByRole("button", {
        name: pl ? "Spróbuj ponownie" : "Try Again",
        exact: true,
      });
      if (await retry.isVisible()) await retry.click();
      await expect(
        page.getByText(
          path === "settings"
            ? pl
              ? "Do opanowania: 1"
              : "To Master: 1"
            : pl
              ? "Żadna dodatkowa aplikacja nie ma dostępu do Twojego konta."
              : "No other apps have access to your account.",
          { exact: true },
        ),
      ).toBeVisible();
    });
  }

  test(`${language}: successful app revoke removes its row even if refresh fails`, async ({
    page,
  }) => {
    await fixture(page, language);
    let revoked = false;
    await page.route("**/api/oauth/authorized-apps/**", (route) => {
      if (route.request().method() === "DELETE") {
        revoked = true;
        return route.fulfill({ status: 204 });
      }
      return revoked
        ? route.fulfill({ status: 503, json: {} })
        : route.fulfill({
            json: [
              {
                client_id: "other-app",
                client_name: "Fixture App",
                scopes: "quizzes:read",
              },
            ],
          });
    });
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto("/account");
    await page
      .getByRole("button", {
        name: pl ? "Opcje Fixture App" : "Options for Fixture App",
        exact: true,
      })
      .click();
    await page
      .getByText(pl ? "Odłącz aplikację" : "Disconnect App", { exact: true })
      .click();
    await expect.poll(() => revoked).toBe(true);
    await expect(page.getByText("Fixture App", { exact: true })).toHaveCount(0);
  });
}

for (const language of ["en", "pl"] as const) {
  const pl = language === "pl";
  const title = (n: number) => (pl ? `Do opanowania: ${n}` : `To Master: ${n}`);
  test(`${language}: reopening settings retains the pending edit and serializes the next edit`, async ({
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
      const submitted = route.request().postDataJSON();
      submissions.push(submitted);
      if (submissions.length === 1) await gate;
      return route.fulfill({ json: submitted });
    });
    try {
      await page.goto("/settings");
      await page
        .getByRole("button", { name: "+", exact: true })
        .first()
        .click();
      await expect.poll(() => submissions.length).toBe(1);
      await navigate(page, "/account");
      await expect(
        page.getByText(pl ? "Twoje dane" : "Your Information", { exact: true }),
      ).toBeVisible();
      await navigate(page, "/settings");
      await expect(page.getByText(title(2), { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "+", exact: true }).nth(1).click();
      await page.waitForTimeout(800);
      expect(submissions).toHaveLength(1);
      release();
      await expect.poll(() => submissions.length).toBe(2);
      expect(submissions[1]).toMatchObject({
        initial_reoccurrences: 2,
        wrong_answer_reoccurrences: 2,
      });
      await expect(page.getByText(title(2), { exact: true })).toBeVisible();
    } finally {
      release();
    }
  });

  test(`${language}: settings failure after leaving retains the draft and retry on reopen`, async ({
    page,
  }) => {
    await fixture(page, language);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let submissions = 0,
      error = "",
      available = false;
    await page.route("**/api/settings/", async (route) => {
      if (route.request().method() !== "PATCH")
        return route.fulfill({ json: settings });
      submissions++;
      if (!available) {
        await gate;
        return route.fulfill({ status: 503, json: {} });
      }
      return route.fulfill({ json: route.request().postDataJSON() });
    });
    page.on("dialog", async (dialog) => {
      error = dialog.message();
      await dialog.dismiss();
    });
    try {
      await page.goto("/settings");
      await page
        .getByRole("button", { name: "+", exact: true })
        .first()
        .click();
      await expect.poll(() => submissions).toBe(1);
      await navigate(page, "/account");
      await expect(
        page.getByText(pl ? "Twoje dane" : "Your Information", { exact: true }),
      ).toBeVisible();
      release();
      await expect
        .poll(() => error)
        .toContain(pl ? "Nie zapisano zmian" : "Changes Not Saved");
      await navigate(page, "/settings");
      await expect(page.getByText(title(2), { exact: true })).toBeVisible();
      await expect(
        page.getByText(pl ? "Nie zapisano zmian" : "Changes Not Saved", {
          exact: true,
        }),
      ).toBeVisible();
      available = true;
      await page
        .getByRole("button", {
          name: pl ? "Spróbuj ponownie" : "Try Again",
          exact: true,
        })
        .click();
      await expect.poll(() => submissions).toBe(2);
      await expect(
        page.getByText(pl ? "Nie zapisano zmian" : "Changes Not Saved", {
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(page.getByText(title(2), { exact: true })).toBeVisible();
    } finally {
      release();
    }
  });

  test(`${language}: superseded settings failure after leaving does not raise a false alert`, async ({
    page,
  }) => {
    await fixture(page, language);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const submissions: number[] = [],
      errors: string[] = [];
    await page.route("**/api/settings/", async (route) => {
      if (route.request().method() !== "PATCH")
        return route.fulfill({ json: settings });
      const submitted = route.request().postDataJSON();
      submissions.push(submitted.initial_reoccurrences);
      if (submissions.length === 1) {
        await gate;
        return route.fulfill({ status: 503, json: {} });
      }
      return route.fulfill({ json: submitted });
    });
    page.on("dialog", async (dialog) => {
      errors.push(dialog.message());
      await dialog.dismiss();
    });
    try {
      await page.goto("/settings");
      const increment = page
        .getByRole("button", { name: "+", exact: true })
        .first();
      await increment.click();
      await expect.poll(() => submissions).toEqual([2]);
      await increment.click();
      await navigate(page, "/account");
      await expect(
        page.getByText(pl ? "Twoje dane" : "Your Information", { exact: true }),
      ).toBeVisible();
      release();
      await expect.poll(() => submissions).toEqual([2, 3]);
      await page.waitForTimeout(100);
      expect(errors).toEqual([]);
      await navigate(page, "/settings");
      await expect(page.getByText(title(3), { exact: true })).toBeVisible();
    } finally {
      release();
    }
  });
}

for (const language of ["en", "pl"] as const) {
  test(`${language}: backgrounding flushes an edit before its debounce expires`, async ({
    page,
  }) => {
    await fixture(page, language);
    const submissions: number[] = [];
    await page.route("**/api/settings/", (route) => {
      if (route.request().method() !== "PATCH")
        return route.fulfill({ json: settings });
      const submitted = route.request().postDataJSON();
      submissions.push(submitted.initial_reoccurrences);
      return route.fulfill({ json: submitted });
    });
    await page.goto("/settings");
    await page.clock.install();
    await page.getByRole("button", { name: "+", exact: true }).first().click();
    expect(submissions).toEqual([]);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    // Browser timers are frozen: the 600ms debounce has not elapsed.
    await expect.poll(() => submissions).toEqual([2]);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: false,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(
      page.getByText(language === "pl" ? "Do opanowania: 2" : "To Master: 2", {
        exact: true,
      }),
    ).toBeVisible();
  });
}
