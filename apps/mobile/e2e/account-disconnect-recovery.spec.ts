import { expect, test } from "@playwright/test";

test("a pending connected-app disconnection cannot alert after sign-out", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({ access: "disposable-disconnect", refresh: "fixture" }),
    );
    localStorage.setItem("testownik.v1.language", '"en"');
  });
  const alerts: string[] = [];
  page.on("dialog", async (dialog) => {
    if (dialog.type() === "alert") alerts.push(dialog.message());
    await dialog.accept();
  });
  let deleting = false;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/user/"))
      return route.fulfill({
        json: {
          id: "disposable-disconnect",
          full_name: "Disposable Disconnect QA",
          is_guest: false,
          account_type: "permanent",
          hide_profile: false,
        },
      });
    if (path.endsWith("/oauth/authorized-apps/disposable-extra/")) {
      expect(route.request().method()).toBe("DELETE");
      deleting = true;
      await pending;
      return route.fulfill({ status: 503, json: {} });
    }
    if (path.endsWith("/oauth/authorized-apps/"))
      return route.fulfill({
        json: [
          {
            client_id: "disposable-extra",
            client_name: "Disposable Extra App",
            scopes: "quizzes:read",
            oauth_application_id: "synthetic-extra",
            client_uri: "https://example.invalid",
            logo_uri: "",
            created: "2026-10-12T00:00:00Z",
          },
        ],
      });
    return route.fulfill({ json: [] });
  });
  try {
    await page.goto("/account");
    await page
      .getByRole("button", {
        name: "Options for Disposable Extra App",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Disconnect App", exact: true })
      .click();
    await expect.poll(() => deleting).toBe(true);
    await page.evaluate(() => {
      history.pushState({}, "", "/profile");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.getByRole("button", { name: "Sign Out", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          sessionStorage.getItem("testownik.oauth-session.v2"),
        ),
      )
      .toBeNull();
    release();
    await expect(
      page.getByRole("button", { name: "Sign in to Testownik", exact: true }),
    ).toBeVisible();
    // Observe the canceled callback after the new signed-out screen has settled.
    await page.waitForTimeout(250);
    expect(alerts).toEqual([]);
  } finally {
    release();
  }
});

for (const outcome of ["failure", "ack-refresh-failure"] as const) {
  test(`connected-app disconnection preserves ${outcome} recovery`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "disposable-disconnect", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", '"en"');
    });
    const alerts: string[] = [];
    page.on("dialog", async (dialog) => {
      if (dialog.type() === "alert") alerts.push(dialog.message());
      await dialog.accept();
    });
    let gets = 0,
      deletes = 0;
    await page.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/user/"))
        return route.fulfill({
          json: {
            id: "disposable-disconnect",
            full_name: "Disposable Disconnect QA",
            is_guest: false,
            account_type: "permanent",
            hide_profile: false,
          },
        });
      if (path.endsWith("/oauth/authorized-apps/disposable-extra/")) {
        expect(route.request().method()).toBe("DELETE");
        deletes++;
        return outcome === "failure"
          ? route.fulfill({
              status: 503,
              json: { detail: "Synthetic disconnection unavailable" },
            })
          : route.fulfill({ status: 204 });
      }
      if (path.endsWith("/oauth/authorized-apps/")) {
        gets++;
        return gets > 1 && outcome === "ack-refresh-failure"
          ? route.fulfill({
              status: 503,
              json: { detail: "Synthetic permissions refresh unavailable" },
            })
          : route.fulfill({
              json: [
                {
                  client_id: "disposable-extra",
                  client_name: "Disposable Extra App",
                  scopes: "quizzes:read",
                  oauth_application_id: "synthetic-extra",
                  client_uri: "https://example.invalid",
                  logo_uri: "",
                  created: "2026-10-12T00:00:00Z",
                },
              ],
            });
      }
      return route.fulfill({ json: [] });
    });
    await page.goto("/account");
    await page
      .getByRole("button", {
        name: "Options for Disposable Extra App",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Disconnect App", exact: true })
      .click();
    await expect.poll(() => deletes).toBe(1);
    if (outcome === "failure") {
      await expect
        .poll(() => alerts)
        .toEqual(["Couldn’t Disconnect\nSynthetic disconnection unavailable"]);
      await expect(
        page.getByText("Disposable Extra App", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: "Options for Disposable Extra App",
          exact: true,
        }),
      ).toBeEnabled();
      expect(gets).toBe(1);
    } else {
      await expect.poll(() => gets).toBe(2);
      await expect(
        page.getByText("Synthetic permissions refresh unavailable", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Try Again", exact: true }),
      ).toBeEnabled();
      await expect(
        page.getByText("Disposable Extra App", { exact: true }),
      ).toHaveCount(0);
      expect(alerts).toEqual([]);
      expect(deletes).toBe(1);
    }
  });
}
