import { expect, test } from "@playwright/test";

for (const language of ["en", "pl"] as const) {
  for (const scenario of [
    "leave",
    "stay",
    "logout",
    "reopen",
    "offline",
    "double",
    "success",
    "success-after-leave",
  ] as const)
    test(`${language}: profile visibility save handles ${scenario} without losing feedback or crossing logout`, async ({
      page,
    }) => {
      const pl = language === "pl";
      await page.addInitScript((language) => {
        sessionStorage.setItem(
          "testownik.oauth-session.v2",
          JSON.stringify({ access: "privacy-recovery", refresh: "fixture" }),
        );
        localStorage.setItem("testownik.v1.language", JSON.stringify(language));
        (window as unknown as { privacyAlerts: string[] }).privacyAlerts = [];
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
        (window as unknown as { privacyOffline: () => void }).privacyOffline =
          () => {
            online = false;
            window.dispatchEvent(new Event("offline"));
          };
        window.confirm = () => true;
        window.alert = (message) =>
          (window as unknown as { privacyAlerts: string[] }).privacyAlerts.push(
            String(message),
          );
      }, language);
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let patches = 0;
      await page.route("**/api/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith("/user/")) {
          if (route.request().method() === "PATCH") {
            patches++;
            if (scenario === "offline")
              return route.abort("internetdisconnected");
            await gate;
            return scenario === "success" || scenario === "success-after-leave"
              ? route.fulfill({
                  json: {
                    id: "privacy-recovery",
                    full_name: "Student",
                    account_type: "permanent",
                    account_level: "basic",
                    hide_profile: true,
                  },
                })
              : route.fulfill({ status: 503, json: {} });
          }
          return route.fulfill({
            json: {
              id: "privacy-recovery",
              full_name: "Student",
              account_type: "permanent",
              account_level: "basic",
              hide_profile: false,
            },
          });
        }
        return route.fulfill({ json: [] });
      });
      try {
        await page.goto("/account");
        await expect(
          page.getByRole("switch", {
            name: pl ? "Ukryj profil" : "Hide Profile",
            exact: true,
          }),
        ).toBeVisible();
        if (scenario === "offline")
          await page.evaluate(() =>
            (
              window as unknown as { privacyOffline: () => void }
            ).privacyOffline(),
          );
        const privacySwitch = page.getByRole("switch", {
          name: pl ? "Ukryj profil" : "Hide Profile",
          exact: true,
        });
        if (scenario === "double")
          await privacySwitch.evaluate((node) => {
            (node as HTMLInputElement).click();
            (node as HTMLInputElement).click();
          });
        else await privacySwitch.click();
        await expect.poll(() => patches).toBe(1);
        if (
          scenario === "leave" ||
          scenario === "reopen" ||
          scenario === "success-after-leave"
        ) {
          await page.evaluate(() => {
            history.pushState({}, "", "/");
            window.dispatchEvent(new PopStateEvent("popstate"));
          });
          await expect(
            page.getByRole("button", {
              name: pl ? "Nowy quiz" : "New Quiz",
              exact: true,
            }),
          ).toBeVisible();
          if (scenario === "reopen") {
            await page.evaluate(() => {
              history.pushState({}, "", "/account");
              window.dispatchEvent(new PopStateEvent("popstate"));
            });
            await expect(
              page.getByRole("switch", {
                name: pl ? "Ukryj profil" : "Hide Profile",
                exact: true,
              }),
            ).toBeDisabled();
          }
        } else if (scenario === "logout") {
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
        }
        release();
        if (scenario === "success" || scenario === "success-after-leave") {
          if (scenario === "success-after-leave")
            await expect(
              page.getByRole("button", {
                name: pl ? "Nowy quiz" : "New Quiz",
                exact: true,
              }),
            ).toBeVisible();
          expect(
            await page.evaluate(
              () =>
                (window as unknown as { privacyAlerts: string[] })
                  .privacyAlerts,
            ),
          ).toEqual([]);
        } else if (scenario === "leave" || scenario === "reopen") {
          await expect
            .poll(() =>
              page.evaluate(
                () =>
                  (window as unknown as { privacyAlerts: string[] })
                    .privacyAlerts,
              ),
            )
            .toEqual([
              expect.stringContaining(
                pl ? "Nie zapisano zmiany" : "Change Not Saved",
              ),
            ]);
        } else if (
          scenario === "stay" ||
          scenario === "offline" ||
          scenario === "double"
        ) {
          await expect(
            page.getByText(pl ? "Nie zapisano zmiany" : "Change Not Saved", {
              exact: true,
            }),
          ).toBeVisible();
          expect(
            await page.evaluate(
              () =>
                (window as unknown as { privacyAlerts: string[] })
                  .privacyAlerts,
            ),
          ).toEqual([]);
        } else {
          await page.waitForTimeout(200);
          expect(
            await page.evaluate(
              () =>
                (window as unknown as { privacyAlerts: string[] })
                  .privacyAlerts,
            ),
          ).toEqual([]);
        }
        if (scenario !== "logout") {
          await page.evaluate(() => {
            history.pushState({}, "", "/account");
            window.dispatchEvent(new PopStateEvent("popstate"));
          });
          const currentSwitch = page.getByRole("switch", {
            name: pl ? "Ukryj profil" : "Hide Profile",
            exact: true,
          });
          if (scenario === "success" || scenario === "success-after-leave")
            await expect(currentSwitch).toBeChecked();
          else await expect(currentSwitch).not.toBeChecked();
          await expect(currentSwitch).toBeEnabled();
        }
        expect(patches).toBe(1);
      } finally {
        release();
      }
    });
}
