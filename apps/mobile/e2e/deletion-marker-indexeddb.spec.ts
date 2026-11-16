import { expect, test, type BrowserContext, type Page } from "@playwright/test";
const database = "testownik.account-deletion-markers.v1";
const owner = "indexeddb-confirmed-deleted";
const draft = `testownik.v1.draft.${owner}.new`;
const other = "testownik.v1.draft.retained-owner.new";
const otherBytes = '{"title":"Other owner exact saved work"}';
async function fixture(
  context: BrowserContext,
  mode: "normal" | "abort" | "enumeration" = "normal",
) {
  await context.addInitScript(
    ({ owner, draft, other, otherBytes, database, mode }) => {
      if (!localStorage.getItem("qa.marker-seeded")) {
        localStorage.setItem("qa.marker-seeded", "true");
        localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
        localStorage.setItem(draft, '{"title":"Hold until durable cleanup"}');
        localStorage.setItem(other, otherBytes);
        localStorage.setItem(
          "testownik.v1.last-user",
          JSON.stringify({
            id: owner,
            full_name: "Disposable Marker Fixture",
            is_guest: false,
          }),
        );
        sessionStorage.setItem(
          "testownik.oauth-session.v2",
          JSON.stringify({ access: owner, refresh: "fixture" }),
        );
        localStorage.setItem(
          "qa.hold-owner-cleanup",
          mode === "abort" ? "false" : "true",
        );
        localStorage.setItem(
          "qa.fail-enumeration",
          mode === "enumeration" ? "true" : "false",
        );
      }
      const set = Storage.prototype.setItem,
        remove = Storage.prototype.removeItem;
      Storage.prototype.setItem = function (key, value) {
        if (
          this === localStorage &&
          key === `testownik.v1.account-deletion.${owner}`
        )
          throw new Error("Synthetic generic primary marker failure");
        return set.call(this, key, value);
      };
      Storage.prototype.removeItem = function (key) {
        if (
          this === localStorage &&
          key === draft &&
          localStorage.getItem("qa.hold-owner-cleanup") === "true"
        )
          throw new Error("Synthetic held owner cleanup");
        return remove.call(this, key);
      };
      const length = Object.getOwnPropertyDescriptor(
        Storage.prototype,
        "length",
      )!;
      Object.defineProperty(Storage.prototype, "length", {
        ...length,
        get() {
          if (
            this === localStorage &&
            localStorage.getItem("qa.fail-enumeration") === "true"
          )
            throw new Error("Synthetic primary enumeration unavailable");
          return length.get!.call(this);
        },
      });
      if (mode === "abort") {
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (
          ...args: Parameters<typeof put>
        ) {
          const request = put.apply(this, args);
          if (this.transaction.db.name === database) {
            request.addEventListener(
              "success",
              () => {
                (
                  window as unknown as { qaAbortedMarker: boolean }
                ).qaAbortedMarker = true;
                this.transaction.abort();
              },
              { once: true },
            );
          }
          return request;
        };
      }
    },
    { owner, draft, other, otherBytes, database, mode },
  );
  let posts = 0;
  await context.route("**/api/**", (route) => {
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
      json: path.endsWith("/user/")
        ? { id: owner, full_name: "Disposable Marker Fixture", is_guest: false }
        : [],
    });
  });
  return () => posts;
}
async function markers(page: Page) {
  return page.evaluate(async (database) => {
    if (!(await indexedDB.databases()).some((entry) => entry.name === database))
      return [];
    return new Promise<string[]>((resolve, reject) => {
      const opening = indexedDB.open(database);
      opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => {
        const db = opening.result;
        if (!db.objectStoreNames.contains("pending")) {
          db.close();
          resolve([]);
          return;
        }
        const tx = db.transaction("pending", "readonly"),
          request = tx.objectStore("pending").getAllKeys();
        tx.oncomplete = () => {
          db.close();
          resolve(request.result.map(String));
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
  }, database);
}
async function seedMarker(page: Page) {
  await page.evaluate(
    ({ database, owner }) =>
      new Promise<void>((resolve, reject) => {
        const opening = indexedDB.open(database);
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
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
    { database, owner },
  );
}
async function deleteAccount(page: Page) {
  await page.goto("/delete-account");
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete Account", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Clear Device Data", exact: true }),
  ).toBeVisible();
}

test("web durable marker survives reload and closed tab without restoring deleted owner", async ({
  page,
  context,
}) => {
  const posts = await fixture(context);
  await deleteAccount(page);
  expect(posts()).toBe(1);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const opening = indexedDB.open("qa.unrelated-application", 1);
        opening.onupgradeneeded = () =>
          opening.result.createObjectStore("saved");
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
          const db = opening.result,
            tx = db.transaction("saved", "readwrite");
          tx.objectStore("saved").put("Unrelated exact bytes", "work");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
  );
  await expect.poll(() => markers(page)).toContain(owner);
  expect(
    await page.evaluate((draft) => localStorage.getItem(draft), draft),
  ).not.toBeNull();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Clear Device Data", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto("/");
  expect(
    await reopened.evaluate(() =>
      sessionStorage.getItem("testownik.oauth-session.v2"),
    ),
  ).toBeNull();
  await expect(
    reopened.getByRole("button", { name: "Clear Device Data", exact: true }),
  ).toBeVisible();
  await expect(reopened.getByRole("tab")).toHaveCount(0);
  expect(await markers(reopened)).toContain(owner);
  await reopened.evaluate(() =>
    localStorage.setItem("qa.hold-owner-cleanup", "false"),
  );
  await reopened
    .getByRole("button", { name: "Clear Device Data", exact: true })
    .click();
  await expect(
    reopened.getByRole("button", { name: "Sign in to Testownik", exact: true }),
  ).toBeVisible();
  expect(await markers(reopened)).not.toContain(owner);
  expect(
    await reopened.evaluate((draft) => localStorage.getItem(draft), draft),
  ).toBeNull();
  expect(
    await reopened.evaluate((other) => localStorage.getItem(other), other),
  ).toBe(otherBytes);
  expect(posts()).toBe(1);
  expect(
    await reopened.evaluate(
      () =>
        new Promise<string>((resolve, reject) => {
          const opening = indexedDB.open("qa.unrelated-application", 1);
          opening.onerror = () => reject(opening.error);
          opening.onsuccess = () => {
            const db = opening.result,
              tx = db.transaction("saved", "readonly"),
              request = tx.objectStore("saved").get("work");
            tx.oncomplete = () => {
              db.close();
              resolve(request.result);
            };
            tx.onabort = () => {
              db.close();
              reject(tx.error);
            };
          };
        }),
    ),
  ).toBe("Unrelated exact bytes");
});

test("web IDB transaction abort after request success cannot acknowledge deletion intent", async ({
  page,
  context,
}) => {
  const posts = await fixture(context, "abort");
  await deleteAccount(page);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { qaAbortedMarker?: boolean }).qaAbortedMarker,
    ),
  ).toBe(true);
  expect(await markers(page)).not.toContain(owner);
  expect(
    await page.evaluate((draft) => localStorage.getItem(draft), draft),
  ).not.toBeNull();
  expect(
    await page.evaluate((other) => localStorage.getItem(other), other),
  ).toBe(otherBytes);
  expect(posts()).toBe(1);
  await expect(page.getByRole("tab")).toHaveCount(0);
});

test("web known secondary intent stays guarded through primary enumeration failure and recovery", async ({
  page,
  context,
}) => {
  const posts = await fixture(context, "enumeration");
  await page.goto("/");
  await seedMarker(page);
  await page.reload();
  await expect(
    page.getByText("Couldn’t Open Testownik", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
  expect(await markers(page)).toContain(owner);
  await page.evaluate(() =>
    localStorage.setItem("qa.fail-enumeration", "false"),
  );
  await page.getByRole("button", { name: "Try Again", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Clear Device Data", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "New Quiz", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate((other) => localStorage.getItem(other), other),
  ).toBe(otherBytes);
  expect(await markers(page)).toContain(owner);
  expect(posts()).toBe(0);
});
