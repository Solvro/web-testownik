import { expect, test } from "@playwright/test";

for (const language of ["en", "pl"] as const) {
  for (const state of [
    "no-profile",
    "deleted-profile",
    "deleted-profile-with-tokens",
    "corrupt-profile",
    "other-account",
  ] as const) {
    test(`${language}: pending deletion recovers on startup with ${state}`, async ({
      page,
    }) => {
      const deleted = "startup-deleted-fixture";
      const other = "startup-retained-fixture";
      await page.addInitScript(
        ({ language, state, deleted, other }) => {
          localStorage.setItem(
            "testownik.v1.language",
            JSON.stringify(language),
          );
          localStorage.setItem(
            `testownik.v1.account-deletion.${deleted}`,
            "true",
          );
          localStorage.setItem(
            `testownik.v1.draft.${deleted}.new`,
            JSON.stringify({ title: "Deleted owner draft" }),
          );
          localStorage.setItem(
            `testownik.v1.chat-draft.${deleted}.quiz.question`,
            JSON.stringify("Deleted owner prompt"),
          );
          localStorage.setItem(
            `testownik.v1.draft.${other}.new`,
            JSON.stringify({ title: "Keep other account work" }),
          );
          if (state !== "no-profile") {
            const profile = JSON.stringify({
              id: state === "other-account" ? other : deleted,
              is_guest: false,
              full_name: "Fixture",
            });
            localStorage.setItem("testownik.v1.last-user", profile);
            sessionStorage.setItem("testownik.v1.last-user", profile);
          }
          if (state === "corrupt-profile") {
            localStorage.setItem("testownik.v1.last-user", "{broken");
            sessionStorage.setItem("testownik.v1.last-user", "{broken");
          }
          if (
            state === "other-account" ||
            state === "deleted-profile-with-tokens"
          ) {
            sessionStorage.setItem(
              "testownik.oauth-session.v2",
              JSON.stringify({
                access: "other-access",
                refresh: "other-refresh",
              }),
            );
          }
          const remove = Storage.prototype.removeItem;
          let fail = state !== "other-account";
          Storage.prototype.removeItem = function (key) {
            if (key === `testownik.v1.draft.${deleted}.new` && fail) {
              fail = false;
              throw new Error("Fixture cleanup failed once");
            }
            return remove.call(this, key);
          };
        },
        { language, state, deleted, other },
      );
      const mutations: string[] = [];
      await page.route("**/api/**", (route) => {
        if (route.request().method() !== "GET")
          mutations.push(route.request().url());
        return route.fulfill({
          json: new URL(route.request().url()).pathname.endsWith("/user/")
            ? { id: other, full_name: "Fixture", is_guest: false }
            : [],
        });
      });
      await page.goto("/login");
      if (state !== "other-account") {
        await expect(
          page.getByText("Fixture cleanup failed once", { exact: true }),
        ).toBeVisible();
        await page
          .getByRole("button", {
            name:
              language === "en"
                ? "Clear Device Data"
                : "Wyczyść dane urządzenia",
            exact: true,
          })
          .click();
      }
      await expect
        .poll(() =>
          page.evaluate(
            (deleted) =>
              localStorage.getItem(`testownik.v1.account-deletion.${deleted}`),
            deleted,
          ),
        )
        .toBeNull();
      const saved = await page.evaluate(
        ({ deleted, other }) => ({
          draft: localStorage.getItem(`testownik.v1.draft.${deleted}.new`),
          chat: localStorage.getItem(
            `testownik.v1.chat-draft.${deleted}.quiz.question`,
          ),
          otherDraft: localStorage.getItem(`testownik.v1.draft.${other}.new`),
          user: localStorage.getItem("testownik.v1.last-user"),
          tokens: sessionStorage.getItem("testownik.oauth-session.v2"),
        }),
        { deleted, other },
      );
      expect(saved.draft).toBeNull();
      expect(saved.chat).toBeNull();
      expect(JSON.parse(saved.otherDraft!)).toEqual({
        title: "Keep other account work",
      });
      if (state === "other-account") {
        expect(JSON.parse(saved.tokens!)).toEqual({
          access: "other-access",
          refresh: "other-refresh",
        });
        expect(JSON.parse(saved.user!).id).toBe(other);
      } else {
        expect(saved.tokens).toBeNull();
        expect(saved.user).toBeNull();
        await expect(
          page.getByRole("button", {
            name:
              language === "en"
                ? "Sign in to Testownik"
                : "Zaloguj się do Testownika",
            exact: true,
          }),
        ).toBeEnabled();
      }
      expect(mutations).toEqual([]);
    });
  }
}

for (const language of ["en", "pl"] as const) {
  test(`${language}: failed credential cleanup at startup offers retry and never opens deleted owner content`, async ({
    page,
  }) => {
    await page.addInitScript((language) => {
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
      localStorage.setItem(
        "testownik.v1.account-deletion.credential-fixture",
        "true",
      );
      localStorage.setItem(
        "testownik.v1.last-user",
        JSON.stringify({
          id: "credential-fixture",
          full_name: "Deleted Fixture",
          is_guest: false,
        }),
      );
      sessionStorage.setItem(
        "testownik.v1.last-user",
        JSON.stringify({
          id: "credential-fixture",
          full_name: "Deleted Fixture",
          is_guest: false,
        }),
      );
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({
          access: "deleted-fixture",
          refresh: "deleted-fixture",
        }),
      );
      const remove = Storage.prototype.removeItem;
      let fail = true;
      Storage.prototype.removeItem = function (key) {
        if (key === "testownik.oauth-session.v2" && fail) {
          fail = false;
          throw new Error("Fixture credential cleanup failed once");
        }
        return remove.call(this, key);
      };
    }, language);
    const requests: string[] = [];
    await page.route("**/api/**", (route) => {
      requests.push(route.request().url());
      return route.fulfill({ status: 403, json: {} });
    });
    await page.goto("/");
    await expect(
      page.getByText("Fixture credential cleanup failed once", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => localStorage.getItem("testownik.v1.last-user")),
    ).toContain("credential-fixture");
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
    await expect
      .poll(() =>
        page.evaluate(() =>
          localStorage.getItem(
            "testownik.v1.account-deletion.credential-fixture",
          ),
        ),
      )
      .toBeNull();
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("testownik.oauth-session.v2"),
      ),
    ).toBeNull();
    expect(requests).toEqual([]);
  });
}

for (const language of ["en", "pl"] as const) {
  for (const cachedProfile of [true, false]) {
    test(`${language}: persistent cleanup failure preserves another account with ${cachedProfile ? "cached" : "fresh"} profile and its profile saves`, async ({
      page,
    }) => {
      await page.addInitScript(
        ({ language, cachedProfile }) => {
          localStorage.setItem(
            "testownik.v1.language",
            JSON.stringify(language),
          );
          localStorage.setItem(
            "testownik.v1.account-deletion.orphan-deleted",
            "true",
          );
          localStorage.setItem(
            "testownik.v1.draft.orphan-deleted.new",
            JSON.stringify({ title: "Keep until cleanup succeeds" }),
          );
          localStorage.setItem(
            "testownik.v1.draft.active-fixture.new",
            JSON.stringify({ title: "Another owner work" }),
          );
          if (cachedProfile)
            sessionStorage.setItem(
              "testownik.v1.last-user",
              JSON.stringify({
                id: "active-fixture",
                full_name: "Active Fixture",
                is_guest: false,
              }),
            );
          sessionStorage.setItem(
            "testownik.oauth-session.v2",
            JSON.stringify({ access: "active-fixture", refresh: "fixture" }),
          );
          const remove = Storage.prototype.removeItem;
          Storage.prototype.removeItem = function (key) {
            if (key === "testownik.v1.draft.orphan-deleted.new")
              throw new Error("Fixture cleanup remains unavailable");
            return remove.call(this, key);
          };
        },
        { language, cachedProfile },
      );
      const mutations: string[] = [];
      await page.route("**/api/**", (route) => {
        if (route.request().method() !== "GET")
          mutations.push(route.request().url());
        return route.fulfill({
          json: new URL(route.request().url()).pathname.endsWith("/user/")
            ? {
                id: "active-fixture",
                full_name: "Active Fixture",
                is_guest: false,
                hide_profile: route.request().method() === "PATCH",
              }
            : [],
        });
      });
      await page.goto("/");
      await expect(
        page.getByText(
          language === "en" ? "No Quizzes Yet" : "Nie masz jeszcze quizów",
          { exact: true },
        ),
      ).toBeVisible();
      const saved = await page.evaluate(() => ({
        marker: localStorage.getItem(
          "testownik.v1.account-deletion.orphan-deleted",
        ),
        draft: localStorage.getItem("testownik.v1.draft.orphan-deleted.new"),
        other: localStorage.getItem("testownik.v1.draft.active-fixture.new"),
        tokens: sessionStorage.getItem("testownik.oauth-session.v2"),
      }));
      expect(saved.marker).toBe("true");
      expect(JSON.parse(saved.draft!)).toEqual({
        title: "Keep until cleanup succeeds",
      });
      expect(JSON.parse(saved.other!)).toEqual({ title: "Another owner work" });
      expect(JSON.parse(saved.tokens!).access).toBe("active-fixture");
      expect(mutations).toEqual([]);
      await page.goto("/account");
      const privacy = page.getByRole("switch", {
        name: language === "en" ? "Hide Profile" : "Ukryj profil",
      });
      await expect(privacy).toBeEnabled();
      await privacy.click();
      await expect(privacy).toBeChecked();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              JSON.parse(sessionStorage.getItem("testownik.v1.last-user")!)
                .hide_profile,
          ),
        )
        .toBe(true);
      expect(mutations).toHaveLength(1);
      expect(new URL(mutations[0]).pathname).toBe("/api/user/");
      await expect(
        page.getByText("Fixture cleanup remains unavailable", { exact: true }),
      ).toHaveCount(0);
    });
  }
}
