import { expect, test } from "@playwright/test";

for (const language of ["en", "pl"] as const)
  for (const scenario of [
    "visibility",
    "visibility-error",
    "invite-reopen",
    "cancel-link",
    "copy-link",
  ] as const)
    test(`${language}: sharing race ${scenario}`, async ({ page }) => {
      const pl = language === "pl";
      await page.addInitScript(
        ({ language, scenario }) => {
          sessionStorage.setItem(
            "testownik.oauth-session.v2",
            JSON.stringify({ access: "sharing-races", refresh: "fixture" }),
          );
          localStorage.setItem(
            "testownik.v1.language",
            JSON.stringify(language),
          );
          const state = window as unknown as {
            sharingAlerts: string[];
            copiedLink: string;
          };
          state.sharingAlerts = [];
          state.copiedLink = "";
          window.alert = (text) => state.sharingAlerts.push(String(text));
          window.confirm = () => true;
          Object.defineProperty(navigator, "share", {
            configurable: true,
            value:
              scenario === "cancel-link"
                ? () =>
                    Promise.reject(new DOMException("Cancelled", "AbortError"))
                : undefined,
          });
          Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {
              writeText: async (text: string) => {
                state.copiedLink = text;
              },
            },
          });
        },
        { language, scenario },
      );
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let hold = false,
        quizGets = 0,
        posts = 0;
      let quiz = {
        id: "sharing-races",
        title: "Sharing Races",
        can_edit: true,
        visibility: 1,
        allow_anonymous: false,
        is_anonymous: false,
      };
      await page.route("**/api/**", async (route) => {
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
        if (path.includes("/quizzes/")) {
          if (request.method() === "PATCH") {
            quiz = { ...quiz, ...request.postDataJSON() };
            return route.fulfill({
              json: scenario === "visibility-error" ? {} : quiz,
            });
          }
          quizGets++;
          if (scenario === "visibility-error" && quizGets > 1)
            return route.fulfill({ status: 503, json: {} });
          const snapshot = { ...quiz };
          if (hold) await gate;
          return route.fulfill({ json: snapshot });
        }
        if (path.includes("/shared-quizzes/")) {
          if (request.method() === "POST") {
            posts++;
            await gate;
            return route.fulfill({
              status: 201,
              json: {
                id: "entry",
                user: null,
                group: { id: "group", name: "Fixture Group" },
                allow_edit: false,
              },
            });
          }
          return route.fulfill({ json: [] });
        }
        if (path.endsWith("/study-groups/"))
          return route.fulfill({
            json: [{ id: "group", name: "Fixture Group" }],
          });
        return route.fulfill({ json: [] });
      });
      const navigate = async (path: string) =>
        page.evaluate((path) => {
          history.pushState({}, "", path);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }, path);
      try {
        if (scenario === "invite-reopen") {
          await page.goto("/share-invite?id=sharing-races");
          const add = page.getByRole("button", {
            name: pl ? "Dodaj: Fixture Group" : "Add Fixture Group",
            exact: true,
          });
          await add.click();
          await expect.poll(() => posts).toBe(1);
          await navigate("/");
          await expect(
            page.getByRole("button", {
              name: pl ? "Nowy quiz" : "New Quiz",
              exact: true,
            }),
          ).toBeVisible();
          await navigate("/share-invite?id=sharing-races");
          await expect(add).toBeDisabled();
          expect(posts).toBe(1);
        } else {
          if (scenario === "visibility") await page.clock.install();
          await page.goto("/share?id=sharing-races");
          const hide = page.getByRole("switch", {
            name: pl ? "Ukryj autora quizu" : "Hide Quiz Author",
            exact: true,
          });
          await expect(hide).toBeVisible();
          if (scenario === "visibility-error") {
            await hide.click();
            await expect.poll(() => quiz.is_anonymous).toBe(true);
            await expect(
              page.getByRole("button", {
                name: pl ? "Spróbuj ponownie" : "Try Again",
                exact: true,
              }),
            ).toBeVisible();
            await expect(hide).toBeEnabled();
          } else if (scenario === "visibility") {
            await page.clock.runFor(31000);
            hold = true;
            await navigate("/");
            await expect(
              page.getByRole("button", {
                name: pl ? "Nowy quiz" : "New Quiz",
                exact: true,
              }),
            ).toBeVisible();
            await navigate("/share?id=sharing-races");
            await expect.poll(() => quizGets).toBeGreaterThan(1);
            await hide.click();
            await expect.poll(() => quiz.is_anonymous).toBe(true);
            await expect(hide).toBeChecked();
            release();
            await page.clock.runFor(200);
            await expect(hide).toBeChecked();
          } else {
            await page
              .getByRole("button", {
                name: pl ? "Wyślij link" : "Share Link",
                exact: true,
              })
              .click();
            if (scenario === "copy-link")
              await expect
                .poll(() =>
                  page.evaluate(
                    () =>
                      (window as unknown as { copiedLink: string }).copiedLink,
                  ),
                )
                .toMatch(/\/quiz\/sharing-races$/);
            else {
              await page.waitForTimeout(100);
              expect(
                await page.evaluate(
                  () =>
                    (window as unknown as { sharingAlerts: string[] })
                      .sharingAlerts,
                ),
              ).toEqual([]);
            }
          }
        }
      } finally {
        release();
      }
    });
