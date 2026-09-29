import { test, expect } from "@playwright/test";

for (const language of ["en", "pl"] as const) {
  test(`${language}: privacy saving keeps layout stable and a failed update leaves the old setting`, async ({
    page,
  }) => {
    await page.addInitScript((language) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "privacy-fixture", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
    }, language);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let writes = 0;
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      if (new URL(request.url()).pathname.endsWith("/user/")) {
        if (request.method() === "PATCH") {
          writes++;
          await gate;
          return route.fulfill({ status: 503, json: {} });
        }
        return route.fulfill({
          json: {
            id: "privacy-fixture",
            full_name: "Student",
            hide_profile: false,
          },
        });
      }
      return route.fulfill({ json: [] });
    });
    await page.goto("/account");
    const control = page.getByRole("switch", {
      name: language === "en" ? "Hide Profile" : "Ukryj profil",
      exact: true,
    });
    const apps = page.getByText(
      language === "en" ? "Connected Apps" : "Połączone aplikacje",
      { exact: true },
    );
    await expect(control).not.toBeChecked();
    const before = (await apps.boundingBox())!;
    await control.click();
    await expect(control).toBeDisabled();
    await expect.poll(() => writes).toBe(1);
    const saving = (await apps.boundingBox())!;
    expect(Math.abs(before.y - saving.y)).toBeLessThan(1);
    release();
    await expect(
      page.getByText(
        language === "en" ? "Change Not Saved" : "Nie zapisano zmiany",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(control).not.toBeChecked();
    await expect(control).toBeEnabled();
  });
}

for (const language of ["en", "pl"] as const) {
  test(`${language}: a confirmed privacy save survives an unavailable profile refresh`, async ({
    page,
  }) => {
    await page.addInitScript((language) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "privacy-fixture", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
    }, language);
    let saved = false;
    let readsAfterSave = 0;
    await page.route("**/api/**", async (route) => {
      if (new URL(route.request().url()).pathname.endsWith("/user/")) {
        if (route.request().method() === "PATCH") {
          saved = true;
          return route.fulfill({
            json: {
              id: "privacy-fixture",
              full_name: "Student",
              hide_profile: true,
            },
          });
        }
        if (saved) {
          readsAfterSave++;
          return route.fulfill({ status: 503, json: {} });
        }
        return route.fulfill({
          json: {
            id: "privacy-fixture",
            full_name: "Student",
            hide_profile: false,
          },
        });
      }
      return route.fulfill({ json: [] });
    });
    await page.goto("/account");
    const control = page.getByRole("switch", {
      name: language === "en" ? "Hide Profile" : "Ukryj profil",
      exact: true,
    });
    await expect(control).toBeEnabled();
    await control.click();
    await expect(control).toBeChecked();
    await expect(control).toBeEnabled();
    expect(readsAfterSave).toBe(0);
    await page.reload();
    await expect.poll(() => readsAfterSave).toBeGreaterThan(0);
    await expect(control).toBeChecked();
    await expect(
      page.getByText(
        language === "en" ? "Change Not Saved" : "Nie zapisano zmiany",
        { exact: true },
      ),
    ).toHaveCount(0);
  });
}

test("a device profile-cache failure does not undo a confirmed server setting", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({ access: "privacy-fixture", refresh: "fixture" }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "testownik.v1.last-user" && JSON.parse(value).hide_profile)
        throw new DOMException("Device cache is full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  let saved = false;
  await page.route("**/api/**", async (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/user/")) {
      if (route.request().method() === "PATCH")
        saved = route.request().postDataJSON().hide_profile;
      return route.fulfill({
        json: {
          id: "privacy-fixture",
          full_name: "Student",
          hide_profile: saved,
        },
      });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto("/account");
  const control = page.getByRole("switch", {
    name: "Hide Profile",
    exact: true,
  });
  await expect(control).not.toBeChecked();
  await control.click();
  await expect(control).toBeChecked();
  await expect(control).toBeEnabled();
  expect(saved).toBe(true);
  await expect(
    page.getByText("Privacy settings were not saved", { exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("testownik.v1.last-user")),
  ).toBe(null);
  // A missing optional cache must not prevent the next confirmed save from
  // updating the still-authenticated profile.
  await control.click();
  await expect(control).not.toBeChecked();
  await expect(control).toBeEnabled();
  expect(saved).toBe(false);
  await control.click();
  await expect(control).toBeChecked();
  await expect(control).toBeEnabled();
  expect(saved).toBe(true);
  await page.reload();
  await expect(control).toBeChecked();
});
