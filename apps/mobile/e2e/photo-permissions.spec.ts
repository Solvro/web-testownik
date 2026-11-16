import { expect, test, type Page } from "@playwright/test";

const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGPUSrnDgA0wYRUdtBIAHmEBemUPQqoAAAAASUVORK5CYII=",
  "base64",
);

async function fixture(page: Page, language: "en" | "pl", kind = "library") {
  await page.addInitScript(
    ({ language, kind }) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "permission-photo", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
      const original = window.fetch.bind(window);
      const state = window as unknown as {
        qaPhotoPending?: boolean;
        qaRejectPhoto?: () => void;
      };
      window.fetch = (input, init) => {
        const url = input instanceof Request ? input.url : String(input);
        if (
          !(kind === "library"
            ? url.startsWith("blob:")
            : url.includes("api.dicebear.com"))
        )
          return original(input, init);
        state.qaPhotoPending = true;
        return new Promise((_resolve, reject) => {
          state.qaRejectPhoto = () =>
            reject(new Error("Failed to read picked image"));
        });
      };
    },
    { language, kind },
  );
  const user = {
    id: "permission-photo",
    full_name: "Synthetic Permission QA",
    account_type: "permanent",
    hide_profile: false,
    photo: null,
    has_custom_photo: false,
  };
  let uploads = 0;
  await page.route("https://api.dicebear.com/**", (route) =>
    route.fulfill({ contentType: "image/png", body: image }),
  );
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/user/photo/")) {
      uploads++;
      return route.fulfill({ status: 500, json: {} });
    }
    return route.fulfill({ json: path.endsWith("/user/") ? user : [] });
  });
  const alerts: string[] = [];
  page.on("dialog", async (dialog) => {
    if (dialog.type() === "confirm") await dialog.accept();
    else {
      alerts.push(dialog.message());
      await dialog.dismiss();
    }
  });
  const t = (pl: string, en: string) => (language === "pl" ? pl : en);
  await page.goto("/profile");
  await page
    .getByRole("button", {
      name: t("Zmień zdjęcie", "Change Photo"),
      exact: true,
    })
    .first()
    .click();
  return { alerts, t, uploads: () => uploads };
}

async function choose(page: Page, label: string, cancel = false) {
  const ready = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: label, exact: true }).click();
  const chooser = await ready;
  await chooser.setFiles(
    cancel ? [] : { name: "fixture.png", mimeType: "image/png", buffer: image },
  );
}

async function pending(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { qaPhotoPending?: boolean }).qaPhotoPending,
      ),
    )
    .toBe(true);
}

async function reject(page: Page) {
  await page.evaluate(() =>
    (window as unknown as { qaRejectPhoto: () => void }).qaRejectPhoto(),
  );
}

for (const language of ["en", "pl"] as const) {
  for (const kind of ["library", "avatar"] as const) {
    test(`${language}: disposed ${kind} photo error stays silent after sign-out`, async ({
      page,
    }) => {
      const f = await fixture(page, language, kind);
      if (kind === "library")
        await choose(page, f.t("Wybierz z Galerii", "Choose from Photos"));
      else {
        await page
          .getByRole("radio", {
            name: f.t("Awatar 1", "Avatar 1"),
            exact: true,
          })
          .click();
        await page
          .getByRole("button", {
            name: f.t("Zapisz zdjęcie", "Save Photo"),
            exact: true,
          })
          .click();
      }
      await pending(page);
      if (kind === "avatar")
        await expect(
          page.getByRole("button", {
            name: f.t("Zapisz zdjęcie", "Save Photo"),
            exact: true,
          }),
        ).toHaveAttribute("aria-busy", "true");
      await page.goBack();
      await expect(page).toHaveURL(/\/profile$/);
      await page
        .getByRole("button", {
          name: f.t("Wyloguj się", "Sign Out"),
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("button", {
          name: f.t("Zaloguj się do Testownika", "Sign in to Testownik"),
          exact: true,
        }),
      ).toBeVisible();
      await reject(page);
      await page.waitForTimeout(250);
      expect(f.uploads()).toBe(0);
      expect(f.alerts).toEqual([]);
    });
  }

  test(`${language}: active photo error retains selection and keeps retry usable`, async ({
    page,
  }) => {
    const f = await fixture(page, language);
    const avatar = page.getByRole("radio", {
      name: f.t("Awatar 1", "Avatar 1"),
      exact: true,
    });
    await avatar.click();
    await choose(page, f.t("Wybierz z Galerii", "Choose from Photos"));
    await pending(page);
    await reject(page);
    await expect.poll(() => f.alerts.length).toBe(1);
    expect(f.alerts[0]).toContain(
      f.t("Nie zmieniono zdjęcia", "Couldn’t Update Photo"),
    );
    await expect(page).toHaveURL(/\/photo$/);
    await expect(avatar).toBeChecked();
    await expect(
      page.getByRole("button", {
        name: f.t("Wybierz z Galerii", "Choose from Photos"),
        exact: true,
      }),
    ).toBeEnabled();
    expect(f.uploads()).toBe(0);
  });

  test(`${language}: cancel photo selection preserves avatar and sends no upload`, async ({
    page,
  }) => {
    const f = await fixture(page, language);
    const avatar = page.getByRole("radio", {
      name: f.t("Awatar 1", "Avatar 1"),
      exact: true,
    });
    await avatar.click();
    await choose(page, f.t("Wybierz z Galerii", "Choose from Photos"), true);
    await expect(
      page.getByRole("button", {
        name: f.t("Wybierz z Galerii", "Choose from Photos"),
        exact: true,
      }),
    ).toBeEnabled();
    await expect(avatar).toBeChecked();
    await expect(
      page.getByRole("button", {
        name: f.t("Zapisz zdjęcie", "Save Photo"),
        exact: true,
      }),
    ).toBeEnabled();
    expect(f.uploads()).toBe(0);
    expect(f.alerts).toEqual([]);
  });
}
