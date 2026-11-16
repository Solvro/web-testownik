import { expect, test, type Page } from "@playwright/test";

const quizId = "sharing-recovery";
async function navigate(page: Page, path: string) {
  await page.evaluate((path) => {
    history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

for (const language of ["en", "pl"] as const)
  for (const scenario of [
    "grant",
    "role",
    "remove",
    "invite",
    "invite-refresh-error",
    "search",
    "offline-share",
    "offline-invite",
    "missing-share",
    "missing-invite",
    "target-size",
    "invite-malformed",
  ] as const)
    test(`${language}: sharing recovery ${scenario}`, async ({ page }) => {
      const pl = language === "pl";
      await page.addInitScript((language) => {
        sessionStorage.setItem(
          "testownik.oauth-session.v2",
          JSON.stringify({ access: "sharing-recovery", refresh: "fixture" }),
        );
        localStorage.setItem("testownik.v1.language", JSON.stringify(language));
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
        (window as unknown as { sharingOffline: () => void }).sharingOffline =
          () => {
            online = false;
            window.dispatchEvent(new Event("offline"));
          };
        window.confirm = () => true;
        window.alert = () => undefined;
      }, language);
      const recipient = { id: "recipient", full_name: "Recipient Fixture" };
      const group = { id: "group", name: "Fixture Group" };
      const other = { id: "other", name: "Other Group" };
      const quiz = {
        id: quizId,
        title: "Sharing Recovery",
        can_edit: true,
        visibility: 1,
        allow_anonymous: false,
        is_anonymous: false,
      };
      type Entry = {
        id: string;
        user: typeof recipient | null;
        group: typeof group | null;
        allow_edit: boolean;
      };
      let entries: Entry[] =
        scenario === "role" || scenario === "remove"
          ? [{ id: "entry", user: recipient, group: null, allow_edit: false }]
          : [];
      let writes = 0,
        sharesGets = 0,
        sensitiveReads = 0,
        offline = false;
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const heldRefresh = ["grant", "role", "remove", "invite"].includes(
        scenario,
      );
      await page.route("**/api/**", async (route) => {
        const req = route.request(),
          path = new URL(req.url()).pathname,
          method = req.method();
        if (path.endsWith("/user/"))
          return route.fulfill({
            json: {
              id: "owner",
              full_name: "Owner",
              account_type: "student",
              account_level: "basic",
              is_guest: false,
            },
          });
        if (path.includes("/quizzes/") || path.includes("/shared-quizzes/"))
          sensitiveReads++;
        if (offline) return route.abort("internetdisconnected");
        if (path.includes("/quizzes/")) return route.fulfill({ json: quiz });
        if (path.endsWith("/study-groups/"))
          return route.fulfill({ json: [group, other] });
        if (path.endsWith("/users/"))
          return route.fulfill({ json: [recipient] });
        if (path.includes("/shared-quizzes/")) {
          if (method === "POST") {
            writes++;
            const body = req.postDataJSON();
            const entry = {
              id: `entry-${writes}`,
              user: body.user_id ? recipient : null,
              group: body.study_group_id ? group : null,
              allow_edit: !!body.allow_edit,
            };
            entries.push(entry);
            return route.fulfill({
              status: 201,
              json: scenario === "invite-malformed" ? {} : entry,
            });
          }
          if (method === "PATCH") {
            writes++;
            entries[0] = { ...entries[0], ...req.postDataJSON() };
            return route.fulfill({ json: entries[0] });
          }
          if (method === "DELETE") {
            writes++;
            entries = [];
            return route.fulfill({ status: 204 });
          }
          sharesGets++;
          if (sharesGets > 1 && heldRefresh) await gate;
          if (
            sharesGets > 1 &&
            (scenario === "invite-refresh-error" ||
              scenario === "invite-malformed")
          )
            return route.fulfill({ status: 503, json: {} });
          return route.fulfill({ json: entries });
        }
        return route.fulfill({ json: [] });
      });
      const invitePage =
        scenario.includes("invite") ||
        scenario === "search" ||
        scenario === "target-size";
      const path = invitePage ? "/share-invite" : "/share";
      const addGroup = page.getByRole("button", {
        name: pl ? "Dodaj: Fixture Group" : "Add Fixture Group",
        exact: true,
      });
      try {
        if (scenario.startsWith("offline")) {
          await page.goto("/");
          await expect(
            page.getByRole("button", {
              name: pl ? "Nowy quiz" : "New Quiz",
              exact: true,
            }),
          ).toBeVisible();
          offline = true;
          await page.evaluate(() =>
            (
              window as unknown as { sharingOffline: () => void }
            ).sharingOffline(),
          );
          await navigate(page, `${path}?id=${quizId}`);
          await expect(
            page
              .getByRole("button", {
                name: pl ? "Spróbuj ponownie" : "Try Again",
                exact: true,
              })
              .first(),
          ).toBeVisible();
        } else if (scenario.startsWith("missing")) {
          await page.goto(path);
          await expect(
            page.getByRole("button", {
              name: pl ? "Przeglądaj bibliotekę" : "Browse Library",
              exact: true,
            }),
          ).toBeVisible();
          expect(sensitiveReads).toBe(0);
        } else if (scenario === "search") {
          await page.clock.install();
          await page.goto(`${path}?id=${quizId}`);
          const field = page.getByRole("textbox", {
            name: pl
              ? "Osoba, numer indeksu lub grupa"
              : "Name, student number or group",
            exact: true,
          });
          await field.fill("Recipient");
          await page.clock.runFor(400);
          const add = page.getByRole("button", {
            name: pl ? "Dodaj: Recipient Fixture" : "Add Recipient Fixture",
            exact: true,
          });
          await expect(add).toBeVisible();
          await field.fill("Different");
          await expect(add).toHaveCount(0);
        } else if (scenario === "target-size") {
          await page.goto(`${path}?id=${quizId}`);
          await expect(addGroup).toBeVisible();
          const bounds = (await addGroup.boundingBox())!;
          expect(bounds.height).toBeGreaterThanOrEqual(48);
          expect(bounds.width).toBeGreaterThanOrEqual(48);
        } else if (invitePage) {
          await page.goto(`${path}?id=${quizId}`);
          await addGroup.click();
          await expect.poll(() => writes).toBe(1);
          await expect.poll(() => sharesGets).toBeGreaterThan(1);
          if (scenario === "invite-malformed") {
            await expect(
              page
                .getByRole("button", {
                  name: pl ? "Spróbuj ponownie" : "Try Again",
                  exact: true,
                })
                .first(),
            ).toBeVisible();
            await expect(addGroup).toBeDisabled();
          } else
            await expect(
              page.getByText(pl ? "Dodano" : "Added", { exact: true }),
            ).toBeVisible();
          await expect(
            page.getByRole("button", {
              name: pl ? "Dodaj: Other Group" : "Add Other Group",
              exact: true,
            }),
          ).toBeEnabled();
        } else {
          await page.goto(`${path}?id=${quizId}`);
          const hide = page.getByRole("switch", {
            name: pl ? "Ukryj autora quizu" : "Hide Quiz Author",
            exact: true,
          });
          await expect(hide).toBeVisible();
          if (scenario === "grant") {
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
            await page
              .getByRole("button", {
                name: pl
                  ? "Dodaj: Recipient Fixture"
                  : "Add: Recipient Fixture",
                exact: true,
              })
              .click();
          } else {
            await page
              .getByRole("button", {
                name: pl
                  ? "Opcje dostępu: Recipient Fixture"
                  : "Access options: Recipient Fixture",
                exact: true,
              })
              .click();
            await page
              .getByRole("button", {
                name:
                  scenario === "role"
                    ? pl
                      ? "Zezwól na edycję"
                      : "Allow Editing"
                    : pl
                      ? "Odbierz dostęp"
                      : "Remove Access",
                exact: true,
              })
              .click();
          }
          await expect.poll(() => writes).toBe(1);
          await expect.poll(() => sharesGets).toBeGreaterThan(1);
          if (scenario === "role")
            await expect(
              page.getByText(pl ? "Może edytować" : "Can edit", {
                exact: true,
              }),
            ).toBeVisible();
          if (scenario === "remove")
            await expect(
              page.getByRole("button", {
                name: pl
                  ? "Opcje dostępu: Recipient Fixture"
                  : "Access options: Recipient Fixture",
                exact: true,
              }),
            ).toHaveCount(0);
          await expect(hide).toBeEnabled();
        }
      } finally {
        release();
      }
    });
