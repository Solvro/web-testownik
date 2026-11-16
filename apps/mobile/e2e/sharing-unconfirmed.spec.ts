import { expect, test } from "@playwright/test";

for (const language of ["en", "pl"] as const)
  for (const screen of ["share", "share-invite"] as const)
    for (const ack of ["malformed", "invalid-json", "lost-ack"] as const)
      test(`${language}: ${screen} holds an unconfirmed ${ack} grant through reopen and refresh`, async ({
        page,
      }) => {
        const pl = language === "pl";
        await page.addInitScript((language) => {
          sessionStorage.setItem(
            "testownik.oauth-session.v2",
            JSON.stringify({
              access: "unconfirmed-sharing",
              refresh: "fixture",
            }),
          );
          localStorage.setItem(
            "testownik.v1.language",
            JSON.stringify(language),
          );
          window.alert = () => undefined;
        }, language);
        let writes = 0,
          gets = 0,
          recover = false;
        const person = { id: "recipient", full_name: "Recipient Fixture" };
        const group = { id: "group", name: "Fixture Group" };
        const row = {
          id: "entry",
          user: screen === "share" ? person : null,
          group: screen === "share-invite" ? group : null,
          allow_edit: false,
        };
        await page.route("**/api/**", (route) => {
          const request = route.request(),
            path = new URL(request.url()).pathname;
          if (path.endsWith("/user/"))
            return route.fulfill({
              json: {
                id: "owner",
                full_name: "Owner",
                account_type: "student",
                is_guest: false,
              },
            });
          if (path.includes("/quizzes/"))
            return route.fulfill({
              json: {
                id: "unconfirmed-sharing",
                title: "Unconfirmed Sharing",
                can_edit: true,
                visibility: 1,
                allow_anonymous: false,
                is_anonymous: false,
              },
            });
          if (path.endsWith("/users/"))
            return route.fulfill({ json: [person] });
          if (path.endsWith("/study-groups/"))
            return route.fulfill({
              json: [group, { id: "other", name: "Other Group" }],
            });
          if (path.includes("/shared-quizzes/")) {
            if (request.method() === "POST") {
              writes++;
              if (ack === "invalid-json")
                return route.fulfill({
                  status: 201,
                  contentType: "application/json",
                  body: "truncated",
                });
              if (ack === "lost-ack")
                return route.fulfill({ status: 503, json: {} });
              return route.fulfill({ status: 201, json: {} });
            }
            gets++;
            return gets > 1 && !recover
              ? route.fulfill({ status: 503, json: {} })
              : route.fulfill({ json: writes ? [row] : [] });
          }
          return route.fulfill({ json: [] });
        });
        const openSearch = async () => {
          await page
            .getByRole("button", {
              name: pl ? "Dodaj osoby lub grupy" : "Add People or Groups",
              exact: true,
            })
            .click();
          await page
            .getByRole("textbox", {
              name: pl ? "Znajdź osobę lub grupę" : "Find a person or group",
              exact: true,
            })
            .fill("Recipient");
          await page
            .getByRole("button", {
              name: pl ? "Szukaj" : "Search",
              exact: true,
            })
            .click();
        };
        const url = `/${screen}?id=unconfirmed-sharing`;
        await page.goto(url);
        if (screen === "share") await openSearch();
        const add = page.getByRole("button", {
          name:
            screen === "share"
              ? pl
                ? "Dodaj: Recipient Fixture"
                : "Add: Recipient Fixture"
              : pl
                ? "Dodaj: Fixture Group"
                : "Add Fixture Group",
          exact: true,
        });
        await add.click();
        await expect.poll(() => writes).toBe(1);
        const retry = page
          .getByRole("button", {
            name: pl ? "Spróbuj ponownie" : "Try Again",
            exact: true,
          })
          .first();
        await expect(retry).toBeVisible();
        await expect(add).toBeDisabled();
        if (ack === "malformed" && test.info().project.name === "phone")
          await page.screenshot({
            path: `.local/overnight-2026-10-11/sharing-${language}-${screen}-unconfirmed.png`,
            fullPage: true,
          });
        await add.evaluate((node) => (node as HTMLButtonElement).click());
        expect(writes).toBe(1);
        if (screen === "share-invite")
          await expect(
            page.getByRole("button", {
              name: pl ? "Dodaj: Other Group" : "Add Other Group",
              exact: true,
            }),
          ).toBeEnabled();
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
        await page.evaluate((url) => {
          history.pushState({}, "", url);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }, url);
        if (screen === "share") await openSearch();
        await expect(add).toBeDisabled();
        recover = true;
        await retry.click();
        if (screen === "share")
          await expect(
            page.getByRole("button", {
              name: pl
                ? "Recipient Fixture — dodano"
                : "Recipient Fixture — added",
              exact: true,
            }),
          ).toBeDisabled();
        else
          await expect(
            page.getByText(pl ? "Dodano" : "Added", { exact: true }),
          ).toBeVisible();
        expect(writes).toBe(1);
      });
