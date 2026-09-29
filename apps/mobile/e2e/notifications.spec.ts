import { test, expect } from "@playwright/test";
for (const language of ["en", "pl"] as const)
  test(`${language}: notifications recover loading and mutation failures without losing read state`, async ({
    page,
    context,
  }) => {
    await page.addInitScript((language) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "inbox-fixture", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
    }, language);
    let loadFails = true,
      patchFails = true,
      mutationCount = 0;
    const rows = [
      {
        id: "one",
        title: "Shared quiz",
        content: "A **new** quiz is available.",
        is_read: false,
        created_at: "2026-09-26T08:00:00Z",
      },
      {
        id: "two",
        title: "Account update",
        content:
          'Your account is ready. [Read the guide](https://example.org/student-guide). <a href="javascript:alert(1)">Unsafe link</a>',
        is_read: true,
      },
    ];
    await page.route("**/api/**", async (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      if (path.endsWith("/user/"))
        return route.fulfill({
          json: { id: "inbox-fixture", is_guest: false },
        });
      if (path.includes("/notifications")) {
        if (request.method() === "PATCH") {
          mutationCount++;
          if (patchFails) return route.fulfill({ status: 503, json: {} });
          if (path.includes("mark-all-read"))
            rows.forEach((row) => (row.is_read = true));
          else
            rows.find((row) => path.endsWith(`/${row.id}/`))!.is_read =
              request.postDataJSON().is_read;
          return route.fulfill({ json: {} });
        }
        return route.fulfill(
          loadFails ? { status: 503, json: {} } : { json: rows },
        );
      }
      return route.fulfill({ json: [] });
    });
    const c =
      language === "en"
        ? {
            retry: "Try Again",
            empty: "No Notifications Yet",
            unread: "Unread: 1",
            read: "Mark as Read",
            markUnread: "Mark as Unread",
            all: "Mark All as Read",
            caught: "All caught up",
          }
        : {
            retry: "Spróbuj ponownie",
            empty: "Nie masz jeszcze powiadomień",
            unread: "Nieprzeczytane: 1",
            read: "Oznacz jako przeczytane",
            markUnread: "Oznacz jako nieprzeczytane",
            all: "Oznacz wszystkie jako przeczytane",
            caught: "Wszystko przeczytane",
          };
    await page.goto("/notifications");
    await expect(
      page.getByRole("button", { name: c.retry, exact: true }),
    ).toBeVisible();
    await expect(page.getByText(c.empty, { exact: true })).toHaveCount(0);
    loadFails = false;
    await page.getByRole("button", { name: c.retry, exact: true }).click();
    await expect(page.getByText(c.unread, { exact: true })).toBeVisible();
    await expect(
      page.getByText("A new quiz is available.", { exact: true }),
    ).toBeVisible();
    await context.route("https://example.org/student-guide", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<h1>Guide fixture</h1>",
      }),
    );
    const [guide] = await Promise.all([
      context.waitForEvent("page"),
      page
        .getByRole("link", {
          name: "https://example.org/student-guide",
          exact: true,
        })
        .click(),
    ]);
    await expect(
      guide.getByRole("heading", { name: "Guide fixture" }),
    ).toBeVisible();
    expect(mutationCount).toBe(0);
    expect(rows[0].is_read).toBe(false);
    await guide.close();
    await expect(page.getByRole("link", { name: "Unsafe link" })).toHaveCount(
      0,
    );
    await Promise.all([
      page.waitForEvent("dialog").then((dialog) => dialog.accept()),
      page.getByRole("button", { name: c.read, exact: true }).click(),
    ]);
    expect(rows[0].is_read).toBe(false);
    await expect(page.getByText(c.unread, { exact: true })).toBeVisible();
    patchFails = false;
    await page.getByRole("button", { name: c.read, exact: true }).click();
    await expect(page.getByText(c.caught, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: c.all, exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: c.markUnread, exact: true })
      .first()
      .click();
    await expect(page.getByText(c.unread, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: c.all, exact: true }).click();
    await expect(page.getByText(c.caught, { exact: true })).toBeVisible();
    expect(rows.every((row) => row.is_read)).toBe(true);
  });
