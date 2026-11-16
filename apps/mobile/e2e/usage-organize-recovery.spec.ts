import { expect, test, type Page } from "@playwright/test";

const allowance = {
  used: "20",
  limit: "100",
  remaining: "80",
  resets_at: null,
};
const summary = {
  session: allowance,
  weekly: allowance,
  limits_enabled: true,
  exhausted: false,
  blocked_until: null,
  fallback_resets_at: null,
  active_models: [],
  fallback_model: null,
  daily: [],
  by_model: [],
  by_scope: [],
};

async function fixture(page: Page, language: "en" | "pl") {
  await page.addInitScript((language) => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({ access: "usage-organize-fixture", refresh: "fixture" }),
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
  await page.route("**/api/**", (route) =>
    route.fulfill({
      json: new URL(route.request().url()).pathname.endsWith("/user/")
        ? {
            id: "usage-organize-fixture",
            full_name: "Synthetic Student",
            is_guest: false,
          }
        : [],
    }),
  );
}

for (const language of ["en", "pl"] as const) {
  const pl = language === "pl";
  const retryName = pl ? "Spróbuj ponownie" : "Try Again";
  for (const destination of ["usage", "organize"] as const) {
    test(`${language}: uncached offline ${destination} offers recovery`, async ({
      page,
    }) => {
      await fixture(page, language);
      const endpoint =
        destination === "usage" ? "**/api/ai/usage/me/**" : "**/api/library/**";
      let failed = true;
      await page.route(endpoint, (route) =>
        failed
          ? route.abort("internetdisconnected")
          : route.fulfill({
              json:
                destination === "usage"
                  ? summary
                  : {
                      path: [{ id: "root", name: "Library" }],
                      items: [],
                      can_create_folder: true,
                    },
            }),
      );
      await page.goto("/");
      await expect(
        page.getByRole("button", {
          name: pl ? "Nowy quiz" : "New Quiz",
          exact: true,
        }),
      ).toBeVisible();
      await page.evaluate((destination) => {
        (window as unknown as { qaOnline: (value: boolean) => void }).qaOnline(
          false,
        );
        history.pushState(
          {},
          "",
          destination === "usage"
            ? "/usage"
            : "/organize?action=move&id=quiz-fixture&type=quiz&name=Synthetic",
        );
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, destination);
      const retry = page.getByRole("button", { name: retryName, exact: true });
      await expect(retry).toBeVisible({ timeout: 4000 });
      failed = false;
      await page.evaluate(() =>
        (window as unknown as { qaOnline: (value: boolean) => void }).qaOnline(
          true,
        ),
      );
      if (await retry.isVisible()) await retry.click();
      if (destination === "usage")
        await expect(page.getByTestId("usage-session")).toContainText("20%");
      else
        await expect(
          page.getByRole("button", {
            name: pl ? "Przenieś tutaj" : "Move Here",
            exact: true,
          }),
        ).toBeEnabled();
    });
  }

  test(`${language}: failed usage refresh retains allowance and offers retry`, async ({
    page,
  }) => {
    await page.clock.install();
    await fixture(page, language);
    let fail = false;
    let reads = 0;
    await page.route("**/api/ai/usage/me/**", (route) => {
      reads++;
      return fail
        ? route.fulfill({ status: 503, json: {} })
        : route.fulfill({ json: summary });
    });
    await page.goto("/usage");
    await expect(page.getByTestId("usage-session")).toContainText("20%");
    fail = true;
    await page.evaluate(() =>
      (window as unknown as { qaOnline: (value: boolean) => void }).qaOnline(
        false,
      ),
    );
    await page.clock.fastForward(31_000);
    await page.evaluate(() =>
      (window as unknown as { qaOnline: (value: boolean) => void }).qaOnline(
        true,
      ),
    );
    await expect.poll(() => reads).toBeGreaterThan(1);
    await expect(page.getByTestId("usage-session")).toContainText("20%");
    const retry = page.getByRole("button", { name: retryName, exact: true });
    await expect(retry).toBeVisible();
    fail = false;
    await retry.click();
    await expect(retry).not.toBeVisible();
    await expect(page.getByTestId("usage-session")).toContainText("20%");
  });
}
