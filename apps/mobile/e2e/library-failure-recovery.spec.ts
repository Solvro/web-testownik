import { expect, test, type Page } from "@playwright/test";

const owner = "library-failure-fixture";
async function session(page: Page, language: "en" | "pl") {
  await page.addInitScript(
    ({ language }) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "fixture", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
      let online = true;
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        get: () => online,
      });
      for (const key of ["connection", "mozConnection", "webkitConnection"])
        Object.defineProperty(navigator, key, {
          configurable: true,
          value: undefined,
        });
      (
        window as unknown as { qaConnectivity: (value: boolean) => void }
      ).qaConnectivity = (value) => {
        online = value;
        window.dispatchEvent(new Event(value ? "online" : "offline"));
      };
    },
    { language },
  );
}
const metadata = (id: string, title: string) => ({
  id,
  title,
  creator: { id: "other" },
  can_edit: false,
  question_count: 1,
  last_used_at: "2026-10-10T12:00:00Z",
});
for (const language of ["en", "pl"] as const) {
  test(`${language}: a forged Trash route never offers deletion of live quizzes`, async ({
    page,
  }) => {
    await session(page, language);
    const deletes: string[] = [];
    await page.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() === "DELETE") {
        deletes.push(path);
        return route.fulfill({ status: 204 });
      }
      return route.fulfill({
        json: path.endsWith("/user/")
          ? { id: owner, account_type: "email" }
          : path.endsWith("/library/regular/")
            ? {
                path: [
                  { id: "root", name: "Library" },
                  { id: "regular", name: "Regular" },
                ],
                can_create_folder: true,
                items: [
                  {
                    id: "live",
                    name: "Live owned quiz",
                    type: "quiz",
                    can_edit: true,
                    can_manage: true,
                    deleted_at: null,
                  },
                ],
              }
            : [],
      });
    });
    await page.goto("/library/regular?kind=trash");
    await expect(
      page.getByRole("button", { name: "Live owned quiz", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: language === "en" ? "Trash Options" : "Opcje kosza",
        exact: true,
      }),
    ).toHaveCount(0);
    expect(deletes).toEqual([]);
  });
  test(`${language}: Empty Trash deletes only server-confirmed owned trash entries`, async ({
    page,
  }) => {
    await session(page, language);
    const remaining = new Set([
        "owned",
        "live",
        "foreign",
        "shortcut",
        "missing-date",
        "invalid-date",
        "missing-owner",
        "invalid-owner",
      ]),
      deletes: string[] = [];
    await page.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() === "DELETE") {
        const id = path.split("/").filter(Boolean).at(-1)!;
        deletes.push(id);
        remaining.delete(id);
        return route.fulfill({ status: 204 });
      }
      return route.fulfill({
        json: path.endsWith("/user/")
          ? { id: owner, account_type: "email" }
          : path.endsWith("/library/trash/")
            ? {
                path: [
                  { id: "root", name: "Library" },
                  { id: "trash", name: "Trash" },
                ],
                can_create_folder: false,
                items: [...remaining].map((id) => ({
                  id,
                  name: `${id} quiz`,
                  type: "quiz",
                  can_edit: true,
                  can_manage:
                    id === "missing-owner"
                      ? undefined
                      : id === "invalid-owner"
                        ? "true"
                        : id !== "foreign",
                  shortcut_id: id === "shortcut" ? "link" : undefined,
                  deleted_at:
                    id === "live"
                      ? null
                      : id === "missing-date"
                        ? undefined
                        : id === "invalid-date"
                          ? "not-a-date"
                          : "2026-10-11T12:00:00Z",
                })),
              }
            : [],
      });
    });
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto("/library/trash?kind=trash");
    await page
      .getByRole("button", {
        name: language === "en" ? "Trash Options" : "Opcje kosza",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: language === "en" ? "Empty Trash" : "Opróżnij kosz",
        exact: true,
      })
      .click();
    await expect.poll(() => deletes).toEqual(["owned"]);
    await expect(
      page.getByRole("button", { name: "owned quiz", exact: true }),
    ).toHaveCount(0);
    expect([...remaining]).toEqual([
      "live",
      "foreign",
      "shortcut",
      "missing-date",
      "invalid-date",
      "missing-owner",
      "invalid-owner",
    ]);
  });
}
for (const language of ["en", "pl"] as const) {
  for (const scope of ["shared", "recent"] as const)
    test(`${language}: Library ${scope} error retries its displayed query`, async ({
      page,
    }) => {
      await session(page, language);
      let available = false,
        scopedReads = 0,
        baseReads = 0;
      const target =
        scope === "shared" ? "/shared-quizzes/" : "/last-used-quizzes/";
      await page.route("**/api/**", (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith("/user/"))
          return route.fulfill({ json: { id: owner, account_type: "email" } });
        if (path.endsWith(target)) {
          scopedReads++;
          return route.fulfill(
            available
              ? {
                  json:
                    scope === "shared"
                      ? [
                          {
                            id: "grant",
                            quiz: metadata(
                              "recovered",
                              "Recovered library quiz",
                            ),
                          },
                        ]
                      : [metadata("recovered", "Recovered library quiz")],
                }
              : { status: 503, json: {} },
          );
        }
        if (path.endsWith("/library/")) {
          baseReads++;
          return route.fulfill({
            json: {
              path: [{ id: "root", name: "Library" }],
              can_create_folder: false,
              items: [],
            },
          });
        }
        return route.fulfill({ json: [] });
      });
      await page.goto("/library");
      await page
        .getByRole("radio", {
          name:
            scope === "shared"
              ? language === "en"
                ? "Shared"
                : "Udostępnione"
              : language === "en"
                ? "Recent"
                : "Ostatnie",
          exact: true,
        })
        .click();
      const retry = page.getByRole("button", {
        name: language === "en" ? "Try Again" : "Spróbuj ponownie",
        exact: true,
      });
      await expect(retry).toBeVisible();
      const before = scopedReads,
        baseBefore = baseReads;
      available = true;
      await retry.click();
      await expect.poll(() => scopedReads).toBeGreaterThan(before);
      await expect(
        page.getByRole("button", {
          name: "Recovered library quiz",
          exact: true,
        }),
      ).toBeVisible();
      expect(baseReads).toBe(baseBefore);
    });

  for (const staleList of [false, true])
    test(`${language}: Empty Trash reconciles a partial failure before retrying remaining quizzes${staleList ? " with an already deleted404 entry" : ""}`, async ({
      page,
    }) => {
      await session(page, language);
      const remaining = new Set(["first", "second"]),
        deletes: string[] = [];
      let failSecond = true,
        reads = 0;
      await page.route("**/api/**", (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith("/user/"))
          return route.fulfill({ json: { id: owner, account_type: "email" } });
        if (route.request().method() === "DELETE") {
          const id = path.split("/").filter(Boolean).at(-1)!;
          deletes.push(id);
          if (!remaining.has(id))
            return route.fulfill({ status: 404, json: {} });
          if (id === "second" && failSecond)
            return route.fulfill({ status: 503, json: {} });
          remaining.delete(id);
          return route.fulfill({ status: 204 });
        }
        if (path.endsWith("/library/trash/")) {
          reads++;
          return route.fulfill({
            json: {
              path: [
                { id: "root", name: "Library" },
                { id: "trash", name: "Trash", folder_type: "trash" },
              ],
              can_create_folder: false,
              items: (staleList && failSecond
                ? ["first", "second"]
                : [...remaining]
              ).map((id) => ({
                id,
                name: `${id} trashed quiz`,
                type: "quiz",
                can_edit: true,
                can_manage: true,
                deleted_at: "2026-10-11T12:00:00Z",
              })),
            },
          });
        }
        return route.fulfill({ json: [] });
      });
      const dialogs: string[] = [];
      page.on("dialog", async (dialog) => {
        dialogs.push(dialog.type());
        await dialog.accept();
      });
      await page.goto("/library/trash?kind=trash");
      await expect(
        page.getByRole("button", { name: "first trashed quiz", exact: true }),
      ).toBeVisible();
      const empty = async () => {
        await page
          .getByRole("button", {
            name: language === "en" ? "Trash Options" : "Opcje kosza",
            exact: true,
          })
          .click();
        await page
          .getByRole("button", {
            name: language === "en" ? "Empty Trash" : "Opróżnij kosz",
            exact: true,
          })
          .click();
      };
      const before = reads;
      await empty();
      await expect
        .poll(() => dialogs.filter((kind) => kind === "alert").length)
        .toBe(1);
      await expect.poll(() => reads).toBeGreaterThan(before);
      await expect(
        page.getByRole("button", { name: "first trashed quiz", exact: true }),
      ).toHaveCount(staleList ? 1 : 0);
      await expect(
        page.getByRole("button", { name: "second trashed quiz", exact: true }),
      ).toBeVisible();
      failSecond = false;
      await empty();
      await expect(
        page.getByRole("button", { name: "second trashed quiz", exact: true }),
      ).toHaveCount(0);
      expect(deletes).toEqual(
        staleList
          ? ["first", "second", "first", "second"]
          : ["first", "second", "second"],
      );
      expect(remaining.size).toBe(0);
    });

  test(`${language}: question search retains cached questions on a transient refresh failure`, async ({
    page,
  }) => {
    await session(page, language);
    let fail = false,
      reads = 0;
    await page.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/user/"))
        return route.fulfill({ json: { id: owner, account_type: "email" } });
      if (path.endsWith("/quizzes/quiz/")) {
        reads++;
        return route.fulfill(
          fail
            ? { status: 503, json: {} }
            : {
                json: {
                  id: "quiz",
                  title: "Unsaved search quiz",
                  questions: [
                    {
                      id: "q",
                      text: "Preserved search question",
                      multiple: false,
                      answers: [{ id: "a", text: "Answer", is_correct: true }],
                    },
                  ],
                },
              },
        );
      }
      return route.fulfill({ json: [] });
    });
    await page.goto("/search-quiz?id=quiz");
    const field = page.getByRole("textbox", {
      name:
        language === "en"
          ? "Question, answer or explanation"
          : "Pytanie, odpowiedź lub wyjaśnienie",
      exact: true,
    });
    const row = page.getByRole("button", {
      name:
        language === "en"
          ? "Question 1: Preserved search question"
          : "Pytanie 1: Preserved search question",
      exact: true,
    });
    await expect(row).toBeVisible();
    await field.fill("Preserved");
    await row.click();
    fail = true;
    const before = reads;
    await page.evaluate(() =>
      (
        window as unknown as { qaConnectivity: (value: boolean) => void }
      ).qaConnectivity(false),
    );
    await page.evaluate(() =>
      (
        window as unknown as { qaConnectivity: (value: boolean) => void }
      ).qaConnectivity(true),
    );
    await expect.poll(() => reads).toBeGreaterThan(before);
    await expect(
      page.getByRole("button", {
        name: language === "en" ? "Try Again" : "Spróbuj ponownie",
        exact: true,
      }),
    ).toBeVisible();
    await expect(row).toBeVisible();
    await expect(
      page
        .locator("iframe")
        .first()
        .contentFrame()
        .getByText("Answer", { exact: true }),
    ).toBeVisible();
    await expect(field).toHaveValue("Preserved");
    fail = false;
    await page
      .getByRole("button", {
        name: language === "en" ? "Try Again" : "Spróbuj ponownie",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name: language === "en" ? "Try Again" : "Spróbuj ponownie",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page
        .locator("iframe")
        .first()
        .contentFrame()
        .getByText("Answer", { exact: true }),
    ).toBeVisible();
  });
}

for (const status of [401, 403, 404])
  test(`question search hides cached questions after HTTP${status} access failure`, async ({
    page,
  }) => {
    await session(page, "en");
    let fail = false,
      reads = 0;
    await page.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/user/"))
        return route.fulfill({ json: { id: owner, account_type: "email" } });
      if (path.endsWith("/quizzes/quiz/")) {
        reads++;
        return route.fulfill(
          fail
            ? { status, json: {} }
            : {
                json: {
                  id: "quiz",
                  title: "Permission-controlled quiz",
                  questions: [
                    {
                      id: "q",
                      text: "Protected search question",
                      multiple: false,
                      answers: [],
                    },
                  ],
                },
              },
        );
      }
      return route.fulfill({ json: [] });
    });
    await page.goto("/search-quiz?id=quiz");
    const row = page.getByRole("button", {
      name: "Question 1: Protected search question",
      exact: true,
    });
    await expect(row).toBeVisible();
    fail = true;
    const before = reads;
    await page.evaluate(() =>
      (
        window as unknown as { qaConnectivity: (value: boolean) => void }
      ).qaConnectivity(false),
    );
    await page.evaluate(() =>
      (
        window as unknown as { qaConnectivity: (value: boolean) => void }
      ).qaConnectivity(true),
    );
    await expect.poll(() => reads).toBeGreaterThan(before);
    await expect(row).toHaveCount(0);
  });
