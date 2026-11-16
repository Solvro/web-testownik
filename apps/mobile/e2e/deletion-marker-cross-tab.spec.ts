import { test, expect } from "@playwright/test";
for (const secondary of [false, true]) {
  for (const interference of [
    "normal",
    "dropped notification",
    "held queued writer",
  ] as const) {
    test(`${secondary ? "secondary IDB" : "primary localStorage"} ${interference}: deletion prevents an already-open tab from restoring private drafts`, async ({
      context,
      page,
    }, info) => {
      const owner = `cross-tab-deleted-${secondary}`,
        key = `testownik.v1.draft.${owner}.new`;
      await context.addInitScript(
        ({ owner, key, secondary }) => {
          sessionStorage.setItem(
            "testownik.oauth-session.v2",
            JSON.stringify({ access: owner, refresh: "fixture" }),
          );
          if (!localStorage.getItem("qa.cross-tab-seeded")) {
            localStorage.setItem("qa.cross-tab-seeded", "true");
            localStorage.setItem("testownik.v1.language", '"en"');
            localStorage.setItem(
              key,
              JSON.stringify({
                schemaVersion: 1,
                title: "Private before deletion",
                description: "",
                questions: [
                  {
                    id: "question",
                    order: 0,
                    text: "Private question",
                    multiple: false,
                    answers: [
                      {
                        id: "answer",
                        order: 0,
                        text: "Private answer",
                        is_correct: true,
                      },
                    ],
                  },
                ],
              }),
            );
            localStorage.setItem(
              "testownik.v1.last-user",
              JSON.stringify({
                id: owner,
                is_guest: false,
                full_name: "Disposable Cross Tab",
              }),
            );
            localStorage.setItem(
              "testownik.v1.draft.other-owner.new",
              '{"title":"Other exact bytes"}',
            );
          }
          if (secondary) {
            const set = Storage.prototype.setItem;
            Storage.prototype.setItem = function (key, value) {
              if (
                this === localStorage &&
                key === `testownik.v1.account-deletion.${owner}`
              )
                throw new Error("Synthetic generic marker write failure");
              return set.call(this, key, value);
            };
          }
        },
        { owner, key, secondary },
      );
      let deleted = false,
        posts = 0;
      await context.route("**/api/**", (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith("/account/deletion/")) {
          if (route.request().method() === "POST") {
            deleted = true;
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
        if (path.endsWith("/user/"))
          return deleted
            ? route.fulfill({
                status: 401,
                json: { detail: "Deleted fixture account" },
              })
            : route.fulfill({
                json: {
                  id: owner,
                  is_guest: false,
                  full_name: "Disposable Cross Tab",
                },
              });
        return route.fulfill({ json: [] });
      });
      await page.goto("/settings");
      const editing = await context.newPage();
      if (interference === "dropped notification")
        await editing.addInitScript(() => {
          const windowAdd = window.addEventListener.bind(window),
            documentAdd = document.addEventListener.bind(document);
          window.addEventListener = ((type: string, ...args: unknown[]) => {
            if (type === "storage" || type === "focus") return;
            return (windowAdd as (...args: unknown[]) => void)(type, ...args);
          }) as typeof window.addEventListener;
          document.addEventListener = ((type: string, ...args: unknown[]) => {
            if (type === "visibilitychange") return;
            return (documentAdd as (...args: unknown[]) => void)(type, ...args);
          }) as typeof document.addEventListener;
          window.BroadcastChannel = class {
            addEventListener() {}
            removeEventListener() {}
            postMessage() {}
            close() {}
          } as unknown as typeof BroadcastChannel;
        });
      await editing.goto("/editor");
      await expect(
        editing.getByRole("textbox", { name: "Quiz title", exact: true }),
      ).toHaveValue("Private before deletion");
      // Ensure the second JS context has completed its own cached marker scan.
      await editing
        .getByRole("textbox", { name: "Quiz title", exact: true })
        .fill("Saved before deletion");
      await expect
        .poll(() =>
          editing.evaluate(
            (key) => JSON.parse(localStorage.getItem(key) ?? "null")?.title,
            key,
          ),
        )
        .toBe("Saved before deletion");
      if (interference === "held queued writer") {
        await editing.evaluate(() => {
          const state = window as unknown as {
            qaLockHeld: boolean;
            qaReleaseLock: () => void;
          };
          void navigator.locks.request(
            "testownik.account-data.v1",
            async () => {
              state.qaLockHeld = true;
              await new Promise<void>((resolve) => {
                state.qaReleaseLock = resolve;
              });
            },
          );
        });
        await expect
          .poll(() =>
            editing.evaluate(
              () => (window as unknown as { qaLockHeld: boolean }).qaLockHeld,
            ),
          )
          .toBe(true);
        await editing
          .getByRole("textbox", { name: "Quiz title", exact: true })
          .fill("Writer queued before deletion");
      }
      await page.goto("/delete-account");
      page.on("dialog", (d) => d.accept());
      await page
        .getByRole("button", { name: "Delete Account", exact: true })
        .click();
      if (interference === "held queued writer") {
        await expect
          .poll(() =>
            page.evaluate(async (owner) => {
              if (
                localStorage.getItem(`testownik.v1.account-deletion.${owner}`)
              )
                return true;
              return new Promise<boolean>((resolve, reject) => {
                const opening = indexedDB.open(
                  "testownik.account-deletion-markers.v1",
                );
                opening.onerror = () => reject(opening.error);
                opening.onsuccess = () => {
                  const db = opening.result,
                    tx = db.transaction("pending", "readonly"),
                    result = tx.objectStore("pending").get(owner);
                  tx.oncomplete = () => {
                    db.close();
                    resolve(result.result !== undefined);
                  };
                };
              });
            }, owner),
          )
          .toBe(true);
        await editing.evaluate(() =>
          (window as unknown as { qaReleaseLock: () => void }).qaReleaseLock(),
        );
      }
      await expect(
        page.getByRole("button", { name: "Sign in to Testownik", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate((key) => localStorage.getItem(key), key),
      ).toBeNull();
      // Actual autosave from the second running application context, not a direct storage mutation.
      const field = editing.getByRole("textbox", {
        name: "Quiz title",
        exact: true,
      });
      if (await field.isVisible())
        await field.fill("Revived after confirmed deletion");
      await editing.waitForTimeout(500);
      const evidence = {
        posts,
        protectedEditorVisible: await field.isVisible(),
        restoredDraft: await editing.evaluate(
          (key) => localStorage.getItem(key),
          key,
        ),
        otherOwner: await editing.evaluate(() =>
          localStorage.getItem("testownik.v1.draft.other-owner.new"),
        ),
      };
      await info.attach("cross-tab-proof", {
        body: JSON.stringify(evidence, null, 2),
        contentType: "application/json",
      });
      expect(evidence.otherOwner).toBe('{"title":"Other exact bytes"}');
      expect(evidence.posts).toBe(1);
      expect(evidence.restoredDraft).toBeNull();
      await expect(field).toHaveCount(0);
    });
  }
}
