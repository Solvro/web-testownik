import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const owner = "coordination-deleted-A";
const draft = `testownik.v1.draft.${owner}.new`;
const bytes = JSON.stringify({
  schemaVersion: 1,
  title: "Saved private work",
  description: "",
  questions: [
    {
      id: "q",
      order: 0,
      text: "Private question",
      multiple: false,
      answers: [
        { id: "a", order: 0, text: "Private answer", is_correct: true },
      ],
    },
  ],
});
const database = "testownik.account-deletion-markers.v1";

async function fixture(context: BrowserContext, status = 204) {
  await context.addInitScript(
    ({ owner, draft, bytes }) => {
      if (!localStorage.getItem("qa.coordination.seeded")) {
        localStorage.setItem("qa.coordination.seeded", "true");
        localStorage.setItem("testownik.v1.language", '"en"');
        localStorage.setItem(draft, bytes);
        localStorage.setItem(
          "testownik.v1.last-user",
          JSON.stringify({
            id: owner,
            is_guest: false,
            full_name: "Disposable Coordination",
          }),
        );
      }
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: owner, refresh: "fixture" }),
      );
    },
    { owner, draft, bytes },
  );
  let posts = 0;
  await context.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/account/deletion/")) {
      if (route.request().method() === "POST") {
        posts++;
        return route.fulfill({
          status,
          json:
            status === 204
              ? undefined
              : { detail: "Synthetic unavailable response" },
        });
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
    if (path.endsWith("/user/")) {
      const id = route.request().headers().authorization?.includes("retained-B")
        ? "retained-B"
        : owner;
      return route.fulfill({
        json: { id, is_guest: false, full_name: "Disposable Coordination" },
      });
    }
    return route.fulfill({ json: [] });
  });
  return () => posts;
}

async function confirm(page: Page) {
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete Account", exact: true })
    .click();
}

for (const failure of ["locks", "idb"] as const) {
  test(`confirmed deletion retains saved bytes and pending intent when ${failure} becomes unavailable`, async ({
    context,
    page,
  }) => {
    const posts = await fixture(context);
    await page.goto("/delete-account");
    await expect(
      page.getByRole("button", { name: "Delete Account", exact: true }),
    ).toBeEnabled();
    await page.evaluate((failure) => {
      if (failure === "locks")
        Object.defineProperty(navigator, "locks", {
          value: undefined,
          configurable: true,
        });
      else
        indexedDB.open = () => {
          throw new Error("Synthetic IDB access failure");
        };
    }, failure);
    await confirm(page);
    await expect(
      page.getByRole("button", { name: "Clear Device Data", exact: true }),
    ).toBeVisible();
    expect(posts()).toBe(1);
    expect(
      await page.evaluate((draft) => localStorage.getItem(draft), draft),
    ).toBe(bytes);
    expect(
      await page.evaluate(
        (owner) =>
          localStorage.getItem(`testownik.v1.account-deletion.${owner}`),
        owner,
      ),
    ).toBe("true");
    await expect(page.getByText(/HTTPS|localhost/).first()).toBeVisible();
  });
}

test("an unacknowledged deletion response preserves work and creates no deletion guard", async ({
  context,
  page,
}) => {
  const posts = await fixture(context, 500);
  await page.goto("/delete-account");
  await confirm(page);
  await expect(
    page.getByRole("button", { name: "Delete Account", exact: true }),
  ).toBeEnabled();
  expect(posts()).toBe(1);
  expect(
    await page.evaluate((draft) => localStorage.getItem(draft), draft),
  ).toBe(bytes);
  expect(
    await page.evaluate(
      (owner) =>
        [...Array(localStorage.length)]
          .map((_, i) => localStorage.key(i))
          .filter(
            (key) => key?.includes("account-delet") && key.endsWith(owner),
          ),
      owner,
    ),
  ).toEqual([]);
  const guards = await page.evaluate(
    async (database) =>
      new Promise<string[]>((resolve, reject) => {
        const opening = indexedDB.open(database);
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
          const db = opening.result,
            tx = db.transaction(["pending", "deleted"], "readonly");
          const pending = tx.objectStore("pending").getAllKeys(),
            deleted = tx.objectStore("deleted").getAllKeys();
          tx.oncomplete = () => {
            db.close();
            resolve([...pending.result, ...deleted.result].map(String));
          };
        };
      }),
    database,
  );
  expect(guards).not.toContain(owner);
});

test("deleting A leaves an independently authenticated B tab editable and able to save", async ({
  context,
  page,
}) => {
  await fixture(context);
  await page.goto("/delete-account");
  const b = await context.newPage();
  await b.addInitScript(
    ({ bytes }) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "retained-B", refresh: "fixture-B" }),
      );
      localStorage.setItem("testownik.v1.draft.retained-B.new", bytes);
    },
    { bytes },
  );
  await b.goto("/editor");
  const title = b.getByRole("textbox", { name: "Quiz title", exact: true });
  await expect(title).toHaveValue("Saved private work");
  await expect
    .poll(() =>
      b.evaluate(
        () =>
          JSON.parse(sessionStorage.getItem("testownik.v1.last-user") ?? "null")
            ?.id,
      ),
    )
    .toBe("retained-B");
  await confirm(page);
  await expect(
    page.getByRole("button", { name: "Sign in to Testownik", exact: true }),
  ).toBeVisible();
  await title.fill("B remains independently saved");
  await expect
    .poll(() =>
      b.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("testownik.v1.draft.retained-B.new") ?? "null",
          )?.title,
      ),
    )
    .toBe("B remains independently saved");
  await expect(title).toHaveValue("B remains independently saved");
  expect(
    await b.evaluate((draft) => localStorage.getItem(draft), draft),
  ).toBeNull();
});

test("upgrading a v1 pending marker retains intent and atomically adds the completed guard", async ({
  context,
  page,
}) => {
  await fixture(context);
  await page.goto("/editor");
  await expect(
    page.getByRole("textbox", { name: "Quiz title", exact: true }),
  ).toHaveValue("Saved private work");
  await page.evaluate(
    async ({ database, owner }) => {
      await new Promise<void>((resolve, reject) => {
        const removing = indexedDB.deleteDatabase(database);
        removing.onsuccess = () => resolve();
        removing.onerror = () => reject(removing.error);
      });
      await new Promise<void>((resolve, reject) => {
        const opening = indexedDB.open(database, 1);
        opening.onupgradeneeded = () =>
          opening.result.createObjectStore("pending");
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
          const db = opening.result,
            tx = db.transaction("pending", "readwrite");
          tx.objectStore("pending").put(true, owner);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      });
      const remove = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function (key) {
        if (this === localStorage && key === `testownik.v1.draft.${owner}.new`)
          throw new Error("Synthetic held owner cleanup");
        return remove.call(this, key);
      };
      localStorage.setItem("qa.coordination.hold", "true");
    },
    { database, owner },
  );
  await page.addInitScript(
    ({ owner }) => {
      const remove = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function (key) {
        if (this === localStorage && key === `testownik.v1.draft.${owner}.new`)
          throw new Error("Synthetic held owner cleanup");
        return remove.call(this, key);
      };
    },
    { owner },
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Clear Device Data", exact: true }),
  ).toBeVisible();
  const markers = await page.evaluate(
    async (database) =>
      new Promise<{
        version: number;
        pending: IDBValidKey[];
        deleted: IDBValidKey[];
      }>((resolve, reject) => {
        const opening = indexedDB.open(database);
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
          const db = opening.result,
            tx = db.transaction(["pending", "deleted"], "readonly");
          const pending = tx.objectStore("pending").getAllKeys(),
            deleted = tx.objectStore("deleted").getAllKeys();
          tx.oncomplete = () => {
            const version = db.version;
            db.close();
            resolve({
              version,
              pending: pending.result,
              deleted: deleted.result,
            });
          };
        };
      }),
    database,
  );
  expect(markers).toEqual({ version: 2, pending: [owner], deleted: [owner] });
  expect(
    await page.evaluate((draft) => localStorage.getItem(draft), draft),
  ).toBe(bytes);
});
