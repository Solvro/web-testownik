import { test, expect } from "@playwright/test";

for (const language of ["en", "pl"] as const) {
  test(`${language}: avatar failure keeps the selection and late success does not navigate away`, async ({
    page,
  }) => {
    const t = (pl: string, en: string) => (language === "pl" ? pl : en);
    await page.addInitScript((language) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "photo-fixture", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
    }, language);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let uploads = 0;
    const user = {
      id: "photo-fixture",
      full_name: "Student",
      hide_profile: false,
      photo: null,
      has_custom_photo: false,
    };
    await page.route("https://api.dicebear.com/**", (route) =>
      route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGPUSrnDgA0wYRUdtBIAHmEBemUPQqoAAAAASUVORK5CYII=",
          "base64",
        ),
      }),
    );
    await page.route("**/api/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith("/user/photo/")) {
        uploads++;
        if (uploads === 1) return route.fulfill({ status: 503, json: {} });
        await gate;
        return route.fulfill({
          json: {
            ...user,
            has_custom_photo: true,
            photo: "https://api.dicebear.com/fixture.png",
          },
        });
      }
      return route.fulfill({ json: pathname.endsWith("/user/") ? user : [] });
    });
    let error = "";
    page.on("dialog", async (dialog) => {
      error = dialog.message();
      await dialog.dismiss();
    });
    await page.goto("/profile");
    await page
      .getByRole("button", {
        name: t("Zmień zdjęcie", "Change Photo"),
        exact: true,
      })
      .first()
      .click();
    const avatar = page.getByRole("radio", {
      name: t("Awatar 1", "Avatar 1"),
      exact: true,
    });
    await avatar.click();
    const save = page.getByRole("button", {
      name: t("Zapisz zdjęcie", "Save Photo"),
      exact: true,
    });
    await save.click();
    await expect
      .poll(() => error)
      .toContain(t("Przerwa techniczna", "temporarily"));
    await expect(save).toBeEnabled();
    await save.click();
    await expect.poll(() => uploads).toBe(2);
    await page.goBack();
    await expect(page).toHaveURL(/\/profile$/);
    await page
      .getByRole("button", {
        name: t("Konto i prywatność", "Account & Privacy"),
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/\/account$/);
    release();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("testownik.v1.last-user") ?? "{}")
              .has_custom_photo,
        ),
      )
      .toBe(true);
    await expect(page).toHaveURL(/\/account$/);
    await expect(
      page.getByRole("switch", {
        name: t("Ukryj profil", "Hide Profile"),
        exact: true,
      }),
    ).toBeVisible();
  });
}
