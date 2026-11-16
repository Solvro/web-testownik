import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, language: "pl" | "en") {
  await page.addInitScript((language) => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({ access: "qa", refresh: "qa" }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify(language));
  }, language);
}

for (const language of ["pl", "en"] as const) {
  test(`${language}: group failures recover and access loading cannot grant duplicate invitations`, async ({
    page,
  }) => {
    await login(page, language);
    let failGroups = true,
      failShares = true,
      posts = 0;
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/user/"))
        return route.fulfill({
          json: { id: "owner", account_type: "student" },
        });
      if (path.endsWith("/study-groups/"))
        return route.fulfill(
          failGroups ? { status: 503, json: {} } : { json: [] },
        );
      if (path.endsWith("/users/"))
        return route.fulfill({
          json: [{ id: "recipient", full_name: "Recipient Fixture" }],
        });
      if (path.includes("shared-quizzes")) {
        if (route.request().method() === "POST") {
          posts++;
          return route.fulfill({ status: 201, json: {} });
        }
        return route.fulfill(
          failShares ? { status: 503, json: {} } : { json: [] },
        );
      }
      return route.fulfill({ json: [] });
    });
    await page.goto("/share-invite?id=qa-quiz");
    const retry = page.getByRole("button", {
      name: language === "pl" ? "Spróbuj ponownie" : "Try Again",
      exact: true,
    });
    await expect(retry).toHaveCount(2);
    await page.getByRole("textbox").fill("Recipient");
    const add = page.getByRole("button", {
      name:
        language === "pl"
          ? "Dodaj: Recipient Fixture"
          : "Add Recipient Fixture",
      exact: true,
    });
    await expect(add).toBeVisible();
    await expect(add).toBeDisabled();
    expect(posts).toBe(0);
    failGroups = false;
    await retry.nth(1).click();
    await expect(retry).toHaveCount(1);
    failShares = false;
    await retry.click();
    await expect(add).toBeEnabled();
    await add.click();
    await expect.poll(() => posts).toBe(1);
  });

  test(`${language}: profile AI usage shows a loader and recoverable failure`, async ({
    page,
  }) => {
    await login(page, language);
    let fail = true;
    const window = { used: "1", limit: "10", remaining: "9", resets_at: null };
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/user/"))
        return route.fulfill({
          json: {
            id: "owner",
            full_name: "QA Fixture",
            account_type: "student",
          },
        });
      if (path.includes("/ai/usage/")) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return route.fulfill(
          fail
            ? { status: 503, json: {} }
            : { json: { session: window, weekly: window, exhausted: false } },
        );
      }
      return route.fulfill({ json: [] });
    });
    await page.goto("/profile");
    await expect(
      page.getByLabel(
        language === "pl" ? "Wczytuję wykorzystanie AI" : "Loading AI Usage",
        { exact: true },
      ),
    ).toBeVisible();
    const retry = page.getByRole("button", {
      name: language === "pl" ? "Spróbuj ponownie" : "Try Again",
      exact: true,
    });
    await expect(retry).toBeVisible();
    fail = false;
    await retry.click();
    await expect(
      page.getByText(language === "pl" ? "Limit 5-godzinny" : "5-Hour Limit", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(retry).toHaveCount(0);
    await expect(page.getByText(/Antoni Czaplicki/)).toBeVisible();
  });
}

test("a late notification failure preserves another row's confirmed read state", async ({
  page,
  context,
}) => {
  await login(page, "en");
  const rows = ["one", "two"].map((id) => ({
    id,
    title: `Notification ${id}`,
    content: "Fixture",
    is_read: false,
    link: `https://example.org/${id}`,
  }));
  let firstStarted = false,
    reads = 0;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  page.on("dialog", (dialog) => void dialog.accept());
  await context.route("https://example.org/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "Fixture" }),
  );
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (path.endsWith("/user/"))
      return route.fulfill({ json: { id: "owner" } });
    if (path.includes("/notifications")) {
      if (request.method() === "PATCH") {
        if (path.includes("/one/")) {
          firstStarted = true;
          await held;
          return route.fulfill({ status: 503, json: {} });
        }
        rows[1].is_read = true;
        return route.fulfill({ json: {} });
      }
      reads++;
      return route.fulfill({ json: rows });
    }
    return route.fulfill({ json: [] });
  });
  try {
    await page.goto("/notifications");
    const open = page.getByRole("button", { name: "Open", exact: true });
    await expect(open).toHaveCount(2);
    const [first] = await Promise.all([
      context.waitForEvent("page"),
      open.nth(0).click(),
    ]);
    await first.close();
    await expect.poll(() => firstStarted).toBe(true);
    const [second] = await Promise.all([
      context.waitForEvent("page"),
      open.nth(1).click(),
    ]);
    await second.close();
    await expect.poll(() => rows[1].is_read).toBe(true);
    await expect(
      page.getByText("All caught up", { exact: true }),
    ).toBeVisible();
    release();
    await expect.poll(() => reads).toBeGreaterThanOrEqual(2);
    await expect(page.getByText("Unread: 1", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Mark as Unread", exact: true }),
    ).toHaveCount(1);
  } finally {
    release();
  }
});
