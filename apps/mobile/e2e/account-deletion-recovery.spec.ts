import { expect, test } from "@playwright/test";

for (const language of ["en", "pl"] as const) {
  for (const transfer of [false, true]) {
    test(`${language}: ${transfer ? "transfer" : "delete"} cleanup retries without repeating account deletion`, async ({
      page,
    }) => {
      const owner = "deletion-recovery-fixture";
      const draftKey = `testownik.v1.draft.${owner}.new`;
      await page.addInitScript(
        ({ language, owner, draftKey }) => {
          sessionStorage.setItem(
            "testownik.oauth-session.v2",
            JSON.stringify({ access: owner, refresh: "fixture" }),
          );
          localStorage.setItem(
            "testownik.v1.language",
            JSON.stringify(language),
          );
          localStorage.setItem(
            draftKey,
            JSON.stringify({ title: "Owned fixture work" }),
          );
          const remove = Storage.prototype.removeItem;
          let fail = true;
          Storage.prototype.removeItem = function (key) {
            if (key === draftKey && fail) {
              fail = false;
              throw new Error(
                "Fixture device storage is temporarily unavailable",
              );
            }
            return remove.call(this, key);
          };
        },
        { language, owner, draftKey },
      );
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const posts: unknown[] = [];
      await page.route("**/api/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith("/account/deletion/")) {
          if (route.request().method() === "POST") {
            posts.push(route.request().postDataJSON());
            await gate;
            return route.fulfill({ status: 204 });
          }
          return route.fulfill({
            json: {
              quizzes: 1,
              public_quizzes: 0,
              shared_people: 0,
              shared_groups: 0,
              recent_learners: 0,
              sessions: 0,
              ai_conversations: 0,
            },
          });
        }
        return route.fulfill({
          json: path.endsWith("/user/")
            ? { id: owner, is_guest: false }
            : path.endsWith("/users/")
              ? [{ id: "recipient", full_name: "Recipient Fixture" }]
              : [],
        });
      });
      const copy =
        language === "en"
          ? {
              transfer: "Transfer them to someone",
              search: "Find a person",
              change: "Change",
              remove: "Delete Account",
              retry: "Clear Device Data",
              failure: "Your account has been deleted.",
            }
          : {
              transfer: "Przekaż je innej osobie",
              search: "Znajdź osobę",
              change: "Zmień",
              remove: "Usuń konto",
              retry: "Wyczyść dane urządzenia",
              failure: "Konto zostało usunięte.",
            };
      await page.goto("/delete-account");
      if (transfer) {
        await page
          .getByRole("radio", { name: copy.transfer, exact: true })
          .click();
        await page
          .getByRole("textbox", { name: copy.search, exact: true })
          .fill("Recipient");
        await page
          .getByRole("button", { name: "Recipient Fixture", exact: true })
          .click();
      }
      page.on("dialog", (dialog) => dialog.accept());
      await page
        .getByRole("button", { name: copy.remove, exact: true })
        .click();
      await expect.poll(() => posts.length).toBe(1);
      await expect(
        page.getByRole("radio", { name: copy.transfer, exact: true }),
      ).toBeDisabled();
      if (transfer)
        await expect(
          page.getByRole("button", { name: copy.change, exact: true }),
        ).toBeDisabled();
      release();
      await expect(
        page.getByText(copy.failure, { exact: false }),
      ).toBeVisible();
      await expect(page.getByRole("radio")).toHaveCount(0);
      const retry = page.getByRole("button", { name: copy.retry, exact: true });
      await expect(retry).toBeEnabled();
      expect(
        await page.evaluate((key) => localStorage.getItem(key), draftKey),
      ).not.toBeNull();
      await retry.click();
      await expect
        .poll(() =>
          page.evaluate(() =>
            sessionStorage.getItem("testownik.oauth-session.v2"),
          ),
        )
        .toBeNull();
      expect(
        await page.evaluate((key) => localStorage.getItem(key), draftKey),
      ).toBeNull();
      await expect
        .poll(() =>
          page.evaluate(
            (owner) =>
              localStorage.getItem(`testownik.v1.account-deletion.${owner}`),
            owner,
          ),
        )
        .toBeNull();
      expect(posts).toEqual([
        transfer ? { transfer_to_user_id: "recipient" } : {},
      ]);
    });
  }
}

for (const language of ["en", "pl"] as const) {
  test(`${language}: deleted account credential failure exits protected content and retries only device cleanup`, async ({
    page,
  }) => {
    const owner = "credential-deletion-owner";
    await page.addInitScript(
      ({ language, owner }) => {
        localStorage.setItem("testownik.v1.language", JSON.stringify(language));
        sessionStorage.setItem(
          "testownik.oauth-session.v2",
          JSON.stringify({ access: owner, refresh: "fixture" }),
        );
        const remove = Storage.prototype.removeItem;
        let fail = true;
        Storage.prototype.removeItem = function (key) {
          if (key === "testownik.oauth-session.v2" && fail) {
            fail = false;
            throw new Error("Fixture secure cleanup failed once");
          }
          return remove.call(this, key);
        };
      },
      { language, owner },
    );
    let posts = 0;
    await page.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/account/deletion/")) {
        if (route.request().method() === "POST") {
          posts++;
          return route.fulfill({ status: 204 });
        }
        return route.fulfill({
          json: {
            quizzes: 0,
            public_quizzes: 0,
            shared_people: 0,
            shared_groups: 0,
            recent_learners: 0,
            sessions: 0,
            ai_conversations: 0,
          },
        });
      }
      return route.fulfill({
        json: path.endsWith("/user/") ? { id: owner, is_guest: false } : [],
      });
    });
    await page.goto("/delete-account");
    page.on("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", {
        name: language === "en" ? "Delete Account" : "Usuń konto",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Fixture secure cleanup failed once", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(0);
    await page
      .getByRole("button", {
        name:
          language === "en" ? "Clear Device Data" : "Wyczyść dane urządzenia",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name:
          language === "en"
            ? "Sign in to Testownik"
            : "Zaloguj się do Testownika",
        exact: true,
      }),
    ).toBeEnabled();
    expect(posts).toBe(1);
    await expect
      .poll(() =>
        page.evaluate(
          (owner) =>
            localStorage.getItem(`testownik.v1.account-deletion.${owner}`),
          owner,
        ),
      )
      .toBeNull();
  });
}
