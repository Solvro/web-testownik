import { expect, test } from "@playwright/test";

const owner = "unavailable-draft-fixture";
const id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const key = `testownik.v1.draft.${owner}.${id}`;
const draft = {
  schemaVersion: 1,
  baseVersion: 1,
  title: "Retained local work",
  description: "Private draft description",
  questions: [
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      text: "Draft question",
      order: 1,
      multiple: false,
      answers: [
        {
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          text: "Draft answer",
          order: 1,
          is_correct: true,
        },
      ],
    },
  ],
};
for (const language of ["en", "pl"] as const)
  for (const status of [403, 404])
    test(`${language}: ${status} retains exportable draft until confirmed local removal`, async ({
      page,
    }) => {
      await page.addInitScript(
        ({ owner, key, draft, language }) => {
          sessionStorage.setItem(
            "testownik.oauth-session.v2",
            JSON.stringify({ access: owner, refresh: "fixture" }),
          );
          localStorage.setItem(
            "testownik.v1.language",
            JSON.stringify(language),
          );
          localStorage.setItem(key, JSON.stringify(draft));
        },
        { owner, key, draft, language },
      );
      let quizGets = 0;
      const writes: string[] = [];
      await page.route("**/api/**", (route) => {
        const path = new URL(route.request().url()).pathname;
        if (route.request().method() !== "GET")
          writes.push(route.request().method());
        if (path.includes(`/quizzes/${id}/`)) {
          quizGets++;
          return route.fulfill({ status, json: {} });
        }
        return route.fulfill({
          json: path.endsWith("/user/")
            ? { id: owner, is_guest: false }
            : path.endsWith("/library/")
              ? {
                  path: [{ id: "root", name: "Library" }],
                  can_create_folder: true,
                  items: [],
                }
              : [],
        });
      });
      const c =
        language === "en"
          ? {
              title: "Quiz title",
              save: "Save Quiz",
              unavailable: "The saved quiz can’t be found",
              export: "Export Draft",
              remove: "Remove Local Draft",
            }
          : {
              title: "Tytuł quizu",
              save: "Zapisz quiz",
              unavailable: "Nie można znaleźć zapisanego quizu",
              export: "Eksportuj szkic",
              remove: "Usuń lokalny szkic",
            };
      await page.goto(`/editor?id=${id}`);
      const title = page.getByRole("textbox", { name: c.title, exact: true });
      await expect(title).toHaveValue(draft.title);
      await expect(
        page.getByText(c.unavailable, { exact: false }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: c.save, exact: true }),
      ).toBeDisabled();
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: c.export, exact: true }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe(`${draft.title}.json`);
      const exported = await download.createReadStream();
      let content = "";
      for await (const chunk of exported!) content += chunk.toString();
      expect(JSON.parse(content)).toMatchObject(draft);
      page.once("dialog", (d) => d.dismiss());
      await page.getByRole("button", { name: c.remove, exact: true }).click();
      await expect(title).toHaveValue(draft.title);
      expect(
        await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)!),
          key,
        ),
      ).toMatchObject(draft);
      await title.fill("More local edits");
      await expect
        .poll(() =>
          page.evaluate(
            (key) => JSON.parse(localStorage.getItem(key)!).title,
            key,
          ),
        )
        .toBe("More local edits");
      const beforeRemove = quizGets;
      page.once("dialog", (d) => d.accept());
      await page.getByRole("button", { name: c.remove, exact: true }).click();
      await expect(page).toHaveURL(/\/library$/);
      expect(
        await page.evaluate((key) => localStorage.getItem(key), key),
      ).toBeNull();
      expect(quizGets).toBe(beforeRemove);
      expect(writes).toEqual([]);
    });

test("failed local removal retains edits and retry clears only the draft", async ({
  page,
}) => {
  await page.addInitScript(
    ({ owner, key, draft }) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: owner, refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
      localStorage.setItem(key, JSON.stringify(draft));
      const remove = Storage.prototype.removeItem;
      let failed = false;
      Storage.prototype.removeItem = function (candidate) {
        if (candidate === key && !failed) {
          failed = true;
          throw new Error("Fixture remove failed");
        }
        return remove.call(this, candidate);
      };
    },
    { owner, key, draft },
  );
  let gets = 0;
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes(`/quizzes/${id}/`)) {
      gets++;
      return route.fulfill({ status: 404, json: {} });
    }
    return route.fulfill({
      json: path.endsWith("/user/")
        ? { id: owner, is_guest: false }
        : path.endsWith("/library/")
          ? {
              path: [{ id: "root", name: "Library" }],
              can_create_folder: true,
              items: [],
            }
          : [],
    });
  });
  await page.goto(`/editor?id=${id}`);
  const remove = page.getByRole("button", {
    name: "Remove Local Draft",
    exact: true,
  });
  await expect(remove).toBeVisible();
  let alerts = 0;
  page.on("dialog", (dialog) => {
    if (dialog.type() === "alert") alerts++;
    return dialog.accept();
  });
  await remove.click();
  await expect.poll(() => alerts).toBe(1);
  const title = page.getByRole("textbox", { name: "Quiz title", exact: true });
  await expect(title).toHaveValue(draft.title);
  await title.fill("Protected after failed removal");
  await expect
    .poll(() =>
      page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).title, key),
    )
    .toBe("Protected after failed removal");
  const before = gets;
  await remove.click();
  await expect(page).toHaveURL(/\/library$/);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), key),
  ).toBeNull();
  expect(gets).toBe(before);
});

test("checking restored access retains an older draft without discarding it", async ({
  page,
}) => {
  await page.addInitScript(
    ({ owner, key, draft }) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: owner, refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
      const { baseVersion: _baseVersion, ...older } = draft;
      localStorage.setItem(key, JSON.stringify(older));
    },
    { owner, key, draft },
  );
  let unavailable = true,
    writes = 0;
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") writes++;
    if (path.includes(`/quizzes/${id}/`))
      return route.fulfill(
        unavailable
          ? { status: 403, json: {} }
          : { json: { ...draft, id, version: 2, title: "Server title" } },
      );
    return route.fulfill({
      json: path.endsWith("/user/") ? { id: owner, is_guest: false } : [],
    });
  });
  await page.goto(`/editor?id=${id}`);
  await expect(
    page.getByRole("button", { name: "Remove Local Draft", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Load Saved Version", exact: true }),
  ).toHaveCount(0);
  unavailable = false;
  await page.getByRole("button", { name: "Check Again", exact: true }).click();
  await expect(
    page.getByText(
      "The original quiz version for this older draft is unknown.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Quiz title", exact: true }),
  ).toHaveValue(draft.title);
  await expect(
    page.getByRole("button", { name: "Remove Local Draft", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).title,
      key,
    ),
  ).toBe(draft.title);
  expect(writes).toBe(0);
});

test("access lost during confirmed reload retains the draft and reveals local recovery", async ({
  page,
}) => {
  await page.addInitScript(
    ({ owner, key, draft }) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: owner, refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
      localStorage.setItem(key, JSON.stringify(draft));
    },
    { owner, key, draft },
  );
  let gets = 0;
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes(`/quizzes/${id}/`)) {
      gets++;
      return route.fulfill(
        gets > 1
          ? { status: 404, json: {} }
          : { json: { ...draft, id, version: 1 } },
      );
    }
    return route.fulfill({
      json: path.endsWith("/user/") ? { id: owner, is_guest: false } : [],
    });
  });
  await page.goto(`/editor?id=${id}`);
  await expect.poll(() => gets).toBe(1);
  const title = page.getByRole("textbox", { name: "Quiz title", exact: true });
  await expect(title).toHaveValue(draft.title);
  let alerts = 0;
  page.on("dialog", (dialog) => {
    if (dialog.type() === "alert") alerts++;
    return dialog.accept();
  });
  await page
    .getByRole("button", { name: "Editor options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Discard Changes", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Remove Local Draft", exact: true }),
  ).toBeVisible();
  await expect(title).toHaveValue(draft.title);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).title,
      key,
    ),
  ).toBe(draft.title);
  expect(alerts).toBe(0);
});

test("explicit can_edit:false keeps a readable quiz draft in recoverable permission state", async ({
  page,
}) => {
  await page.addInitScript(
    ({ owner, key, draft }) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: owner, refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
      localStorage.setItem(key, JSON.stringify(draft));
    },
    { owner, key, draft },
  );
  let canEdit = false;
  let quizGets = 0;
  const writes: string[] = [];
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET")
      writes.push(route.request().method());
    if (path.includes(`/quizzes/${id}/`)) {
      quizGets++;
      return route.fulfill({
        json: {
          ...draft,
          id,
          version: 1,
          title: "Publicly readable server quiz",
          can_edit: canEdit,
        },
      });
    }
    return route.fulfill({
      json: path.endsWith("/user/") ? { id: owner, account_type: "email" } : [],
    });
  });
  await page.goto(`/editor?id=${id}`);
  const title = page.getByRole("textbox", { name: "Quiz title", exact: true });
  await expect(title).toHaveValue(draft.title);
  await expect.poll(() => quizGets).toBeGreaterThan(0);
  const save = page.getByRole("button", { name: "Save Quiz", exact: true });
  await expect(save).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Export Draft", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove Local Draft", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Check Again", exact: true }).click();
  await expect(save).toBeDisabled();
  await expect(title).toHaveValue(draft.title);
  canEdit = true;
  await page.getByRole("button", { name: "Check Again", exact: true }).click();
  await expect(save).toBeEnabled();
  await expect(title).toHaveValue(draft.title);
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key),
  ).toMatchObject(draft);
  expect(writes).toEqual([]);
});

test("fresh readable quiz with can_edit:false never enables a write after local typing", async ({
  page,
}) => {
  await page.addInitScript(
    ({ owner }) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: owner, refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
    },
    { owner },
  );
  let reads = 0;
  let writes = 0;
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") writes++;
    if (path.includes(`/quizzes/${id}/`)) {
      reads++;
      return route.fulfill({
        json: { ...draft, id, version: 1, can_edit: false },
      });
    }
    return route.fulfill({
      json: path.endsWith("/user/") ? { id: owner, account_type: "email" } : [],
    });
  });
  await page.goto(`/editor?id=${id}`);
  const title = page.getByRole("textbox", { name: "Quiz title", exact: true });
  await expect(title).toHaveValue(draft.title);
  await title.fill("Local edit without permission");
  await expect(
    page.getByRole("button", { name: "Save Quiz", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Export Draft", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) ?? "null"),
        key,
      ),
    )
    .toMatchObject({ title: "Local edit without permission" });
  expect(reads).toBe(1);
  expect(writes).toBe(0);
});
