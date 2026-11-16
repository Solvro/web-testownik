import { expect, test, type Page } from "@playwright/test";

const ownComment = {
  id: "comment-recovery-own",
  content: "An acknowledged comment",
  author: { id: "community-recovery", full_name: "Synthetic Student" },
  created_at: "2026-10-11T18:00:00Z",
};

async function fixture(page: Page, language: "en" | "pl") {
  await page.addInitScript((language) => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({ access: "community-recovery", refresh: "fixture" }),
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
            id: "community-recovery",
            full_name: "Synthetic Student",
            account_level: "basic",
            is_guest: false,
          }
        : [],
    }),
  );
}

for (const language of ["en", "pl"] as const) {
  const pl = language === "pl";
  const inputName = pl ? "Twój komentarz" : "Your comment";
  const postName = pl ? "Wyślij komentarz" : "Post comment";
  const deleteName = pl ? "Usuń komentarz" : "Delete comment";

  test(`${language}: uncached offline community exposes recovery`, async ({
    page,
  }) => {
    await fixture(page, language);
    await page.route("**/api/comments/**", (route) =>
      route.abort("internetdisconnected"),
    );
    await page.route("**/api/quiz-ratings/**", (route) =>
      route.abort("internetdisconnected"),
    );
    await page.goto("/");
    await expect(
      page.getByRole("button", {
        name: pl ? "Nowy quiz" : "New Quiz",
        exact: true,
      }),
    ).toBeVisible();
    await page.evaluate(() => {
      (window as unknown as { qaOnline: (value: boolean) => void }).qaOnline(
        false,
      );
      history.pushState({}, "", "/community?id=community-fixture");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    const retry = page.getByRole("button", {
      name: pl ? "Spróbuj ponownie" : "Try Again",
      exact: true,
    });
    await expect(retry.first()).toBeVisible({ timeout: 4000 });
    await page.unroute("**/api/comments/**");
    await page.unroute("**/api/quiz-ratings/**");
    await page.evaluate(() =>
      (window as unknown as { qaOnline: (value: boolean) => void }).qaOnline(
        true,
      ),
    );
    if (await retry.first().isVisible()) await retry.first().click();
    await expect(
      page.getByRole("textbox", { name: inputName, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        pl
          ? "Nie ma jeszcze komentarzy. Podziel się wskazówką do nauki."
          : "No comments yet. Share a study tip.",
        { exact: true },
      ),
    ).toBeVisible();
  });

  test(`${language}: comment acknowledgement remains visible while refresh stalls`, async ({
    page,
  }) => {
    await fixture(page, language);
    let posted = false;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/comments/**", async (route) => {
      if (route.request().method() === "POST") {
        posted = true;
        return route.fulfill({ status: 201, json: ownComment });
      }
      if (posted) await gate;
      return route.fulfill({ json: posted ? [ownComment] : [] });
    });
    try {
      await page.goto("/community?id=community-fixture");
      const input = page.getByRole("textbox", { name: inputName, exact: true });
      await input.fill(ownComment.content);
      await page.getByRole("button", { name: postName, exact: true }).click();
      await expect(input).toHaveValue("");
      await expect(
        page.getByText(ownComment.content, { exact: true }),
      ).toBeVisible({ timeout: 3000 });
      await input.fill("A separate unsent draft");
      await expect(
        page.getByRole("button", { name: postName, exact: true }),
      ).toBeEnabled();
    } finally {
      release();
    }
  });

  test(`${language}: posting before an initial thread failure confirms only the accepted comment`, async ({
    page,
  }) => {
    await fixture(page, language);
    let posted = false;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/comments/**", async (route) => {
      if (route.request().method() === "POST") {
        posted = true;
        return route.fulfill({ status: 201, json: ownComment });
      }
      if (!posted) await gate;
      return route.fulfill({ status: 503, json: {} });
    });
    try {
      await page.goto("/community?id=community-fixture");
      const input = page.getByRole("textbox", { name: inputName, exact: true });
      await input.fill(ownComment.content);
      await page.getByRole("button", { name: postName, exact: true }).click();
      await expect(input).toHaveValue("");
      await expect(
        page.getByText(pl ? "Komentarz został dodany." : "Comment posted.", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText(
          pl
            ? "Nie ma jeszcze komentarzy. Podziel się wskazówką do nauki."
            : "No comments yet. Share a study tip.",
          { exact: true },
        ),
      ).not.toBeVisible();
      await expect(
        page.getByRole("button", {
          name: pl ? "Spróbuj ponownie" : "Try Again",
          exact: true,
        }),
      ).toBeVisible();
      await input.fill("Another unsent draft");
      await expect(
        page.getByRole("button", { name: postName, exact: true }),
      ).toBeEnabled();
    } finally {
      release();
    }
  });

  test(`${language}: acknowledged comment deletion survives a failed refresh`, async ({
    page,
  }) => {
    await fixture(page, language);
    let removed = false;
    await page.route("**/api/comments/**", (route) => {
      if (route.request().method() === "DELETE") {
        removed = true;
        return route.fulfill({ status: 204 });
      }
      return route.fulfill(
        removed ? { status: 503, json: {} } : { json: [ownComment] },
      );
    });
    await page.goto("/community?id=community-fixture");
    await expect(
      page.getByText(ownComment.content, { exact: true }),
    ).toBeVisible();
    const remove = page.getByRole("button", { name: deleteName, exact: true });
    page.once("dialog", (dialog) => dialog.accept());
    await remove.click();
    await expect.poll(() => removed).toBe(true);
    await expect(
      page.getByText(ownComment.content, { exact: true }),
    ).not.toBeVisible({ timeout: 3000 });
    await expect(
      page.getByRole("button", {
        name: pl ? "Spróbuj ponownie" : "Try Again",
        exact: true,
      }),
    ).toBeVisible();
  });

  test(`${language}: comment delete control has a full touch target`, async ({
    page,
  }) => {
    await fixture(page, language);
    await page.route("**/api/comments/**", (route) =>
      route.fulfill({ json: [ownComment] }),
    );
    await page.goto("/community?id=community-fixture");
    const remove = page.getByRole("button", { name: deleteName, exact: true });
    await expect(remove).toBeVisible();
    const bounds = await remove.boundingBox();
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
  });

  test(`${language}: a pending comment deletion cannot alert after sign-out`, async ({
    page,
  }) => {
    await fixture(page, language);
    let deleting = false;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const alerts: string[] = [];
    page.on("dialog", async (dialog) => {
      if (dialog.type() === "alert") alerts.push(dialog.message());
      await dialog.accept();
    });
    await page.route("**/api/comments/**", async (route) => {
      if (route.request().method() === "DELETE") {
        deleting = true;
        await gate;
        return route.fulfill({ status: 503, json: {} });
      }
      return route.fulfill({ json: [ownComment] });
    });
    try {
      await page.goto("/community?id=community-fixture");
      await page.getByRole("button", { name: deleteName, exact: true }).click();
      await expect.poll(() => deleting).toBe(true);
      await page.evaluate(() => {
        history.pushState({}, "", "/profile");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      await page
        .getByRole("button", {
          name: pl ? "Wyloguj się" : "Sign Out",
          exact: true,
        })
        .click();
      await expect
        .poll(() =>
          page.evaluate(() =>
            sessionStorage.getItem("testownik.oauth-session.v2"),
          ),
        )
        .toBeNull();
      release();
      await expect(
        page.getByRole("button", {
          name: pl ? "Zaloguj się do Testownika" : "Sign in to Testownik",
          exact: true,
        }),
      ).toBeVisible();
      await page.waitForTimeout(250);
      expect(alerts).toEqual([]);
    } finally {
      release();
    }
  });

  test(`${language}: a failed comment post retains the draft`, async ({
    page,
  }) => {
    await fixture(page, language);
    await page.route("**/api/comments/**", (route) =>
      route.fulfill(
        route.request().method() === "POST"
          ? { status: 503, json: {} }
          : { json: [] },
      ),
    );
    page.once("dialog", (dialog) => dialog.accept());
    await page.goto("/community?id=community-fixture");
    const input = page.getByRole("textbox", { name: inputName, exact: true });
    await input.fill("Keep this failed synthetic draft");
    await page.getByRole("button", { name: postName, exact: true }).click();
    await expect(input).toHaveValue("Keep this failed synthetic draft");
    await expect(
      page.getByRole("button", { name: postName, exact: true }),
    ).toBeEnabled();
  });
}
