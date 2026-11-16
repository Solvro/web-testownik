import { expect, test, type Page } from "@playwright/test";

const owner = "library-offline-owner";
const bank = {
  quizzes: {
    saved: {
      id: "saved",
      title: "Retained offline bank",
      questions: [
        {
          id: "question",
          text: "Retained question",
          multiple: false,
          answers: [
            { id: "answer", text: "Retained answer", is_correct: true },
          ],
        },
      ],
    },
  },
  queue: [],
  errors: {},
};
const stored = JSON.stringify(bank);
const metadata = {
  id: "fresh",
  title: "Fresh server quiz",
  creator: { id: "another-owner" },
  can_edit: false,
  question_count: 1,
};
async function setup(page: Page, language: "en" | "pl", deniedStatus?: number) {
  await page.addInitScript(
    ({ owner, bank, language }) => {
      if (window.top !== window) return;
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
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: owner, refresh: "synthetic" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
      localStorage.setItem(
        `testownik.v1.offline.${owner}`,
        JSON.stringify(bank),
      );
    },
    { owner, bank, language },
  );
  let available = false;
  const reads: string[] = [],
    writes: string[] = [];
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (route.request().method() !== "GET") writes.push(path);
    if (path.endsWith("/user/"))
      return route.fulfill({ json: { id: owner, account_type: "email" } });
    // The Home request is distinct from Library's Recent scope.
    if (
      path.endsWith("/last-used-quizzes/") &&
      url.searchParams.get("limit") === "8"
    )
      return route.fulfill({ json: [] });
    const target = [
      "/library/",
      "/shared-quizzes/",
      "/last-used-quizzes/",
      "/search-quizzes/",
    ].find((target) => path.endsWith(target));
    if (!target) return route.fulfill({ json: [] });
    reads.push(target);
    if (!available) return route.abort("internetdisconnected");
    if (deniedStatus && target === "/library/")
      return route.fulfill({ status: deniedStatus, json: {} });
    return route.fulfill({
      json:
        target === "/library/"
          ? {
              path: [{ id: "root", name: "Library" }],
              can_create_folder: false,
              items: [{ ...metadata, name: metadata.title, type: "quiz" }],
            }
          : target === "/shared-quizzes/"
            ? [{ id: "grant", quiz: metadata }]
            : target === "/last-used-quizzes/"
              ? [metadata]
              : { user_quizzes: [metadata] },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", {
      name: `${language === "en" ? "Continue" : "Kontynuuj"}: Retained offline bank`,
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(() =>
    (
      window as unknown as { qaConnectivity: (value: boolean) => void }
    ).qaConnectivity(false),
  );
  await page
    .getByRole("tab", {
      name: language === "en" ? "Library" : "Biblioteka",
      exact: true,
    })
    .click();
  return {
    reads,
    writes,
    recover: () => {
      available = true;
    },
  };
}
async function unchanged(page: Page) {
  expect(
    await page.evaluate(
      (owner) => localStorage.getItem(`testownik.v1.offline.${owner}`),
      owner,
    ),
  ).toBe(stored);
}
for (const language of ["en", "pl"] as const) {
  const retryName = language === "en" ? "Try Again" : "Spróbuj ponownie";
  for (const scope of ["mine", "shared", "recent", "search"] as const)
    test(`${language}: offline-first Library ${scope} explains failure and refreshes after reconnect`, async ({
      page,
    }) => {
      const fixture = await setup(page, language);
      if (scope === "search")
        await page
          .getByRole("textbox", {
            name: language === "en" ? "Search quizzes" : "Szukaj quizu",
            exact: true,
          })
          .fill("fresh");
      else if (scope !== "mine")
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
      await expect(
        page.getByRole("button", { name: retryName, exact: true }),
      ).toBeVisible();
      if (scope === "mine")
        await expect(
          page.getByRole("button", {
            name: "Retained offline bank",
            exact: true,
          }),
        ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name:
            language === "en"
              ? "Your Library Starts Here"
              : "Tu zaczyna się Twoja biblioteka",
          exact: true,
        }),
      ).toHaveCount(0);
      if (scope === "shared" || scope === "recent")
        await expect(
          page.getByRole("heading", {
            name:
              scope === "shared"
                ? language === "en"
                  ? "Nothing Shared Yet"
                  : "Nic nie udostępniono"
                : language === "en"
                  ? "No Recent Quizzes"
                  : "Brak ostatnich quizów",
            exact: true,
          }),
        ).toHaveCount(0);
      if (scope === "search")
        await expect(
          page.getByRole("heading", {
            name: language === "en" ? "No Results" : "Brak wyników",
            exact: true,
          }),
        ).toHaveCount(0);
      await unchanged(page);
      const target =
        scope === "mine"
          ? "/library/"
          : scope === "shared"
            ? "/shared-quizzes/"
            : scope === "recent"
              ? "/last-used-quizzes/"
              : "/search-quizzes/";
      await expect
        .poll(() => fixture.reads.filter((path) => path === target).length)
        .toBeGreaterThan(0);
      const before = fixture.reads.filter((path) => path === target).length;
      fixture.recover();
      await page.evaluate(() =>
        (
          window as unknown as { qaConnectivity: (value: boolean) => void }
        ).qaConnectivity(true),
      );
      await expect(
        page.getByRole("button", { name: "Fresh server quiz", exact: true }),
      ).toBeVisible();
      await expect
        .poll(() => fixture.reads.filter((path) => path === target).length)
        .toBeGreaterThan(before);
      await expect(
        page.getByRole("button", { name: retryName, exact: true }),
      ).toHaveCount(0);
      await unchanged(page);
      expect(fixture.writes).toEqual([]);
    });
  test(`${language}: offline-first Library explicitly retries without losing its saved bank`, async ({
    page,
  }) => {
    const fixture = await setup(page, language);
    const retry = page.getByRole("button", { name: retryName, exact: true });
    await expect(retry).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Retained offline bank", exact: true }),
    ).toBeVisible();
    await unchanged(page);
    const before = fixture.reads.length;
    fixture.recover();
    await retry.click();
    await expect(
      page.getByRole("button", { name: "Fresh server quiz", exact: true }),
    ).toBeVisible();
    await expect.poll(() => fixture.reads.length).toBeGreaterThan(before);
    await unchanged(page);
    expect(fixture.writes).toEqual([]);
  });
}

for (const language of ["en", "pl"] as const)
  for (const status of [403, 404])
    test(`${language}: Library HTTP${status} never exposes its saved fallback`, async ({
      page,
    }) => {
      const fixture = await setup(page, language, status);
      await expect(
        page.getByRole("button", {
          name: "Retained offline bank",
          exact: true,
        }),
      ).toBeVisible();
      const before = fixture.reads.filter(
        (path) => path === "/library/",
      ).length;
      fixture.recover();
      await page.evaluate(() =>
        (
          window as unknown as { qaConnectivity: (value: boolean) => void }
        ).qaConnectivity(true),
      );
      await expect(
        page.getByRole("heading", {
          name:
            status === 403
              ? language === "en"
                ? "No Access"
                : "Brak dostępu"
              : language === "en"
                ? "Not Available"
                : "Niedostępne",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: "Retained offline bank",
          exact: true,
        }),
      ).toHaveCount(0);
      expect(fixture.reads.filter((path) => path === "/library/").length).toBe(
        before + 1,
      );
      await unchanged(page);
      expect(fixture.writes).toEqual([]);
    });

for (const language of ["en", "pl"] as const)
  for (const scope of ["folder", "shared", "recent", "search"] as const)
    for (const status of [401, 403, 404, 503])
      test(`${language}: cached Library ${scope} HTTP${status} ${status === 503 ? "retains" : "hides"} server rows`, async ({
        page,
      }) => {
        await page.clock.install();
        await page.addInitScript(
          ({ owner, bank, language }) => {
            if (window.top !== window) return;
            let online = true;
            Object.defineProperty(navigator, "onLine", {
              configurable: true,
              get: () => online,
            });
            for (const key of [
              "connection",
              "mozConnection",
              "webkitConnection",
            ])
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
            sessionStorage.setItem(
              "testownik.oauth-session.v2",
              JSON.stringify({ access: owner, refresh: "synthetic" }),
            );
            localStorage.setItem(
              "testownik.v1.language",
              JSON.stringify(language),
            );
            localStorage.setItem(
              `testownik.v1.offline.${owner}`,
              JSON.stringify(bank),
            );
          },
          { owner, bank, language },
        );
        let failure = false,
          reads = 0,
          refreshes = 0;
        const writes: string[] = [];
        const target =
          scope === "folder"
            ? "/library/private/"
            : scope === "shared"
              ? "/shared-quizzes/"
              : scope === "recent"
                ? "/last-used-quizzes/"
                : "/search-quizzes/";
        await page.route("**/api/**", (route) => {
          const url = new URL(route.request().url()),
            path = url.pathname;
          if (path.endsWith("/oauth/token/")) {
            refreshes++;
            return route.fulfill({
              json: {
                access_token: "refreshed-fixture",
                refresh_token: "refreshed-fixture-refresh",
                token_type: "Bearer",
              },
            });
          }
          if (route.request().method() !== "GET") writes.push(path);
          if (path.endsWith("/user/"))
            return route.fulfill({
              json: { id: owner, account_type: "email" },
            });
          if (path.endsWith(target)) {
            reads++;
            if (failure) return route.fulfill({ status, json: {} });
            const cached = { ...metadata, title: "Cached private quiz" };
            return route.fulfill({
              json:
                scope === "folder"
                  ? {
                      path: [
                        { id: "root", name: "Library" },
                        { id: "private", name: "Sensitive folder" },
                      ],
                      can_create_folder: true,
                      items: [{ ...cached, name: cached.title, type: "quiz" }],
                    }
                  : scope === "shared"
                    ? [{ id: "grant", quiz: cached }]
                    : scope === "recent"
                      ? [cached]
                      : { user_quizzes: [cached] },
            });
          }
          return route.fulfill({
            json: path.endsWith("/library/")
              ? {
                  path: [{ id: "root", name: "Library" }],
                  items: [],
                  can_create_folder: false,
                }
              : [],
          });
        });
        await page.goto(scope === "folder" ? "/library/private" : "/library");
        if (scope === "shared" || scope === "recent")
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
        if (scope === "search")
          await page
            .getByRole("textbox", {
              name: language === "en" ? "Search quizzes" : "Szukaj quizu",
              exact: true,
            })
            .fill("cached");
        const row = page.getByRole("button", {
          name: "Cached private quiz",
          exact: true,
        });
        await expect(row).toBeVisible();
        await unchanged(page);
        await page.clock.fastForward(31000);
        failure = true;
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
        const heading =
          status === 401
            ? language === "en"
              ? "Session Expired"
              : "Sesja wygasła"
            : status === 403
              ? language === "en"
                ? "No Access"
                : "Brak dostępu"
              : status === 404
                ? language === "en"
                  ? "Not Available"
                  : "Niedostępne"
                : language === "en"
                  ? "Down for Maintenance"
                  : "Przerwa techniczna";
        await expect(
          page.getByRole("heading", { name: heading, exact: true }),
        ).toBeVisible();
        if (status === 503) await expect(row).toBeVisible();
        else {
          await expect(row).toHaveCount(0);
          if (scope === "folder")
            await expect(
              page.getByRole("heading", {
                name: "Sensitive folder",
                exact: true,
              }),
            ).toHaveCount(0);
        }
        await unchanged(page);
        expect(writes).toEqual([]);
        expect(refreshes).toBe(status === 401 ? 1 : 0);
        expect(reads).toBeGreaterThanOrEqual(2);
      });

for (const language of ["en", "pl"] as const)
  for (const status of [401, 403, 404, 503])
    test(`${language}: changing search after HTTP${status} ${status === 503 ? "retains temporary" : "does not resurrect denied"} placeholder rows`, async ({
      page,
    }) => {
      await page.clock.install();
      const fixture = await setup(page, language);
      fixture.recover();
      await page.evaluate(() =>
        (
          window as unknown as { qaConnectivity: (value: boolean) => void }
        ).qaConnectivity(true),
      );
      await expect(
        page.getByRole("button", { name: "Fresh server quiz", exact: true }),
      ).toBeVisible();
      let failure = false,
        nextReads = 0,
        refreshes = 0,
        release = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/api/oauth/token/", (route) => {
        refreshes++;
        return route.fulfill({
          json: {
            access_token: "rotated-search",
            refresh_token: "rotated-search-refresh",
            token_type: "Bearer",
          },
        });
      });
      await page.route("**/api/search-quizzes/**", async (route) => {
        const url = new URL(route.request().url());
        if (route.request().method() !== "GET")
          fixture.writes.push(url.pathname);
        if (url.searchParams.get("query") === "next") {
          nextReads++;
          await gate;
          return route.fulfill({
            json: {
              user_quizzes: [
                {
                  id: "next",
                  title: "New authorized search result",
                  question_count: 1,
                },
              ],
            },
          });
        }
        return route.fulfill(
          failure
            ? { status, json: {} }
            : {
                json: {
                  user_quizzes: [
                    {
                      id: "old",
                      title: "Previous search result",
                      question_count: 1,
                    },
                  ],
                },
              },
        );
      });
      try {
        const input = page.getByRole("textbox", {
          name: language === "en" ? "Search quizzes" : "Szukaj quizu",
          exact: true,
        });
        await input.fill("cached");
        const previous = page.getByRole("button", {
          name: "Previous search result",
          exact: true,
        });
        await expect(previous).toBeVisible();
        await page.clock.fastForward(31000);
        failure = true;
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
        const heading =
          status === 401
            ? language === "en"
              ? "Session Expired"
              : "Sesja wygasła"
            : status === 403
              ? language === "en"
                ? "No Access"
                : "Brak dostępu"
              : status === 404
                ? language === "en"
                  ? "Not Available"
                  : "Niedostępne"
                : language === "en"
                  ? "Down for Maintenance"
                  : "Przerwa techniczna";
        await expect(
          page.getByRole("heading", { name: heading, exact: true }),
        ).toBeVisible();
        if (status === 503) await expect(previous).toBeVisible();
        else await expect(previous).toHaveCount(0);
        await input.fill("next");
        await expect.poll(() => nextReads).toBe(1);
        if (status === 503) await expect(previous).toBeVisible();
        else await expect(previous).toHaveCount(0);
        await expect(
          page.getByRole("heading", {
            name: language === "en" ? "No Results" : "Brak wyników",
            exact: true,
          }),
        ).toHaveCount(0);
        await unchanged(page);
        release();
        await expect(
          page.getByRole("button", {
            name: "New authorized search result",
            exact: true,
          }),
        ).toBeVisible();
        await expect(previous).toHaveCount(0);
        await unchanged(page);
        expect(refreshes).toBe(status === 401 ? 1 : 0);
        expect(fixture.writes).toEqual([]);
      } finally {
        release();
      }
    });

for (const language of ["en", "pl"] as const)
  for (const status of [401, 403, 404, 503])
    test(`${language}: three-term search after HTTP${status} ${status === 503 ? "retains temporary" : "does not resurrect denied"} placeholder rows`, async ({
      page,
    }) => {
      await page.clock.install();
      const fixture = await setup(page, language);
      fixture.recover();
      await page.evaluate(() =>
        (
          window as unknown as { qaConnectivity: (value: boolean) => void }
        ).qaConnectivity(true),
      );
      await expect(
        page.getByRole("button", { name: "Fresh server quiz", exact: true }),
      ).toBeVisible();
      let nextReads = 0,
        laterReads = 0,
        releaseLater = () => {},
        refreshes = 0,
        release = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const laterGate = new Promise<void>((resolve) => {
        releaseLater = resolve;
      });
      await page.route("**/api/oauth/token/", (route) => {
        refreshes++;
        return route.fulfill({
          json: {
            access_token: "rotated-search",
            refresh_token: "rotated-search-refresh",
            token_type: "Bearer",
          },
        });
      });
      await page.route("**/api/search-quizzes/**", async (route) => {
        const url = new URL(route.request().url());
        if (route.request().method() !== "GET")
          fixture.writes.push(url.pathname);
        if (url.searchParams.get("query") === "later") {
          laterReads++;
          await laterGate;
          return route.fulfill({ json: { user_quizzes: [] } });
        }
        if (url.searchParams.get("query") === "next") {
          nextReads++;
          await gate;
          return route.fulfill({
            json: {
              user_quizzes: [
                {
                  id: "next",
                  title: "New authorized search result",
                  question_count: 1,
                },
              ],
            },
          });
        }
        return route.fulfill(
          url.searchParams.get("query") === "blocked"
            ? { status, json: {} }
            : {
                json: {
                  user_quizzes: [
                    {
                      id: "old",
                      title: "Previous search result",
                      question_count: 1,
                    },
                  ],
                },
              },
        );
      });
      try {
        const input = page.getByRole("textbox", {
          name: language === "en" ? "Search quizzes" : "Szukaj quizu",
          exact: true,
        });
        await input.fill("cached");
        const previous = page.getByRole("button", {
          name: "Previous search result",
          exact: true,
        });
        await expect(previous).toBeVisible();
        await input.fill("blocked");
        const heading =
          status === 401
            ? language === "en"
              ? "Session Expired"
              : "Sesja wygasła"
            : status === 403
              ? language === "en"
                ? "No Access"
                : "Brak dostępu"
              : status === 404
                ? language === "en"
                  ? "Not Available"
                  : "Niedostępne"
                : language === "en"
                  ? "Down for Maintenance"
                  : "Przerwa techniczna";
        await expect(
          page.getByRole("heading", { name: heading, exact: true }),
        ).toBeVisible();
        if (status !== 503) await expect(previous).toHaveCount(0);
        await input.fill("next");
        await expect.poll(() => nextReads).toBe(1);
        if (status === 503) await expect(previous).toBeVisible();
        else await expect(previous).toHaveCount(0);
        await expect(
          page.getByRole("heading", {
            name: language === "en" ? "No Results" : "Brak wyników",
            exact: true,
          }),
        ).toHaveCount(0);
        await unchanged(page);
        release();
        await expect(
          page.getByRole("button", {
            name: "New authorized search result",
            exact: true,
          }),
        ).toBeVisible();
        await expect(previous).toHaveCount(0);
        await input.fill("later");
        await expect.poll(() => laterReads).toBe(1);
        await expect(
          page.getByRole("button", {
            name: "New authorized search result",
            exact: true,
          }),
        ).toBeVisible();
        await expect(previous).toHaveCount(0);
        await unchanged(page);
        expect(refreshes).toBe(status === 401 ? 1 : 0);
        expect(fixture.writes).toEqual([]);
      } finally {
        release();
        releaseLater();
      }
    });
