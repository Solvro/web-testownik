import { test, expect } from "@playwright/test";
for (const language of ["en", "pl"] as const) {
  for (const outcome of ["validation", "deadline"] as const) {
    test(`${language}: completed avatar download preserves upload ${outcome} error`, async ({
      page,
    }) => {
      const pl = language === "pl";
      await page.addInitScript((language) => {
        sessionStorage.setItem(
          "testownik.oauth-session.v2",
          JSON.stringify({
            access: "photo-long-upload-fixture",
            refresh: "fixture",
          }),
        );
        localStorage.setItem("testownik.v1.language", JSON.stringify(language));
        AbortSignal.timeout = (ms) => {
          const c = new AbortController();
          setTimeout(
            () => c.abort(new DOMException("Timed out", "TimeoutError")),
            ms,
          );
          return c.signal;
        };
      }, language);
      const user = {
        id: "photo-long-upload-fixture",
        full_name: "Synthetic Student",
        photo: null,
        has_custom_photo: false,
      };
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let uploads = 0,
        error = "";
      page.on("dialog", async (dialog) => {
        error = dialog.message();
        await dialog.dismiss();
      });
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
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith("/user/photo/")) {
          uploads++;
          await gate;
          return route
            .fulfill({
              status: 400,
              json: { detail: "The uploaded image is not supported." },
            })
            .catch(() => undefined);
        }
        return route.fulfill({ json: path.endsWith("/user/") ? user : [] });
      });
      await page.goto("/profile");
      await page
        .getByRole("button", {
          name: pl ? "Zmień zdjęcie" : "Change Photo",
          exact: true,
        })
        .first()
        .click();
      const avatar = page.getByRole("radio", {
        name: pl ? "Awatar 1" : "Avatar 1",
        exact: true,
      });
      await avatar.click();
      const save = page.getByRole("button", {
        name: pl ? "Zapisz zdjęcie" : "Save Photo",
        exact: true,
      });
      await page.clock.install();
      await save.click();
      await expect.poll(() => uploads).toBe(1);
      await page.clock.runFor(31000);
      expect(error).toBe(""); // Download's expired timer must not terminate the active upload.
      if (outcome === "validation") {
        release();
        await expect
          .poll(() => error)
          .toContain("The uploaded image is not supported.");
      } else {
        await page.clock.runFor(90001);
        await expect
          .poll(() => error)
          .toContain(pl ? "zbyt długo" : "too long");
        release();
      }
      await expect(avatar).toBeChecked();
      await expect(save).toBeEnabled();
      expect(uploads).toBe(1);
    });
  }
}
