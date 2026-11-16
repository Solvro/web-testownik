import { expect, test } from "@playwright/test";

const owner = "recovery-ux-fixture";
const quizId = "11111111-1111-4111-8111-111111111111";
const draft = {
  title: "Restored local work",
  description: "",
  questions: [
    {
      id: "question-fixture",
      text: "Question",
      order: 1,
      multiple: false,
      answers: [
        { id: "answer-fixture", text: "Answer", order: 1, is_correct: true },
      ],
    },
  ],
};

for (const language of ["en", "pl"] as const) {
  const copy =
    language === "en"
      ? {
          title: "Quiz title",
          options: "Editor options",
          discard: "Discard Changes",
          notice: "A draft was restored from this device.",
          search: "Find a person",
          transfer: "Transfer them to someone",
          hint: "Enter at least 3 characters to find a person.",
          retry: "Try Again",
          change: "Change",
          remove: "Delete Account",
        }
      : {
          title: "Tytuł quizu",
          options: "Opcje edytora",
          discard: "Odrzuć zmiany",
          notice: "Przywrócono szkic z tego urządzenia.",
          search: "Znajdź osobę",
          transfer: "Przekaż je innej osobie",
          hint: "Wpisz co najmniej 3 znaki, aby znaleźć osobę.",
          retry: "Spróbuj ponownie",
          change: "Zmień",
          remove: "Usuń konto",
        };

  test(`${language}: restored drafts can be discarded and later edits still survive reopening`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ owner, language, draft }) => {
        sessionStorage.setItem(
          "testownik.oauth-session.v2",
          JSON.stringify({ access: owner, refresh: "fixture" }),
        );
        localStorage.setItem("testownik.v1.language", JSON.stringify(language));
        if (!sessionStorage.getItem("draft-seeded")) {
          localStorage.setItem(
            `testownik.v1.draft.${owner}.new`,
            JSON.stringify(draft),
          );
          sessionStorage.setItem("draft-seeded", "yes");
        }
      },
      { owner, language, draft },
    );
    let writes = 0;
    await page.route("**/api/**", async (route) => {
      if (route.request().method() !== "GET") writes++;
      await route.fulfill({
        json: new URL(route.request().url()).pathname.endsWith("/user/")
          ? { id: owner, is_guest: false }
          : [],
      });
    });
    await page.goto("/editor");
    const title = page.getByRole("textbox", { name: copy.title, exact: true });
    await expect(title).toHaveValue(draft.title);
    await expect(page.getByText(copy.notice, { exact: false })).toBeVisible();
    await page.getByRole("button", { name: copy.options, exact: true }).click();
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: copy.discard, exact: true }).click();
    await expect(title).toHaveValue(draft.title);
    await page.getByRole("button", { name: copy.options, exact: true }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: copy.discard, exact: true }).click();
    await expect(title).toHaveValue("");
    await expect(page.getByText(copy.notice, { exact: false })).toHaveCount(0);
    expect(
      await page.evaluate(
        (owner) => localStorage.getItem(`testownik.v1.draft.${owner}.new`),
        owner,
      ),
    ).toBeNull();
    await title.fill("New work after discard");
    await expect
      .poll(() =>
        page.evaluate(
          (owner) =>
            JSON.parse(
              localStorage.getItem(`testownik.v1.draft.${owner}.new`) ?? "null",
            )?.title,
          owner,
        ),
      )
      .toBe("New work after discard");
    await page.reload();
    await expect(title).toHaveValue("New work after discard");
    expect(writes).toBe(0);
  });

  test(`${language}: transfer search explains short input and recovers without losing input or selection`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ owner, language }) => {
        sessionStorage.setItem(
          "testownik.oauth-session.v2",
          JSON.stringify({ access: owner, refresh: "fixture" }),
        );
        localStorage.setItem("testownik.v1.language", JSON.stringify(language));
      },
      { owner, language },
    );
    let failSearch = true,
      searches = 0,
      writes = 0;
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() !== "GET") writes++;
      if (path.endsWith("/users/")) {
        searches++;
        return route.fulfill(
          failSearch
            ? { status: 503, json: {} }
            : { json: [{ id: "recipient", full_name: "Recipient Fixture" }] },
        );
      }
      return route.fulfill({
        json: path.endsWith("/user/")
          ? { id: owner, is_guest: false }
          : path.endsWith("/account/deletion/")
            ? {
                quizzes: 1,
                public_quizzes: 0,
                shared_people: 0,
                shared_groups: 0,
                recent_learners: 0,
                sessions: 0,
                ai_conversations: 0,
              }
            : [],
      });
    });
    await page.goto("/delete-account");
    await page.getByRole("radio", { name: copy.transfer, exact: true }).click();
    const field = page.getByRole("textbox", { name: copy.search, exact: true });
    const remove = page.getByRole("button", { name: copy.remove, exact: true });
    await expect(page.getByText(copy.hint, { exact: true })).toBeVisible();
    await field.fill("Re");
    await page.waitForTimeout(400);
    expect(searches).toBe(0);
    await expect(remove).toBeDisabled();
    await field.fill("Recipient");
    await expect(
      page.getByRole("button", { name: copy.retry, exact: true }),
    ).toBeVisible();
    await expect(field).toHaveValue("Recipient");
    failSearch = false;
    await page.getByRole("button", { name: copy.retry, exact: true }).click();
    const recipient = page.getByRole("button", {
      name: "Recipient Fixture",
      exact: true,
    });
    await expect(recipient).toBeVisible();
    await field.fill("Re");
    await expect(recipient).toHaveCount(0);
    await expect(page.getByText(copy.hint, { exact: true })).toBeVisible();
    await field.fill("Recipient");
    await recipient.click();
    await expect(remove).toBeEnabled();
    await page.getByRole("button", { name: copy.change, exact: true }).click();
    await expect(field).toHaveValue("Recipient");
    await expect(recipient).toBeVisible();
    expect(writes).toBe(0);
  });
}

test("discarding an existing quiz keeps the local draft when the server version is unavailable", async ({
  page,
}) => {
  await page.addInitScript(
    ({ owner, quizId, draft }) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: owner, refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
      localStorage.setItem(
        `testownik.v1.draft.${owner}.${quizId}`,
        JSON.stringify(draft),
      );
    },
    { owner, quizId, draft },
  );
  let fail = true;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes(quizId))
      return route.fulfill(
        fail
          ? { status: 503, json: {} }
          : { json: { ...draft, id: quizId, title: "Saved server version" } },
      );
    return route.fulfill({
      json: path.endsWith("/user/") ? { id: owner, is_guest: false } : [],
    });
  });
  await page.goto(`/editor?id=${quizId}`);
  const title = page.getByRole("textbox", { name: "Quiz title", exact: true });
  await expect(title).toHaveValue(draft.title);
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Editor options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Discard Changes", exact: true })
    .click();
  await expect(title).toHaveValue(draft.title);
  expect(
    await page.evaluate(
      ({ owner, quizId }) =>
        JSON.parse(
          localStorage.getItem(`testownik.v1.draft.${owner}.${quizId}`) ??
            "null",
        )?.title,
      { owner, quizId },
    ),
  ).toBe(draft.title);
  fail = false;
  await page
    .getByRole("button", { name: "Editor options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Discard Changes", exact: true })
    .click();
  await expect(title).toHaveValue("Saved server version");
  expect(
    await page.evaluate(
      ({ owner, quizId }) =>
        localStorage.getItem(`testownik.v1.draft.${owner}.${quizId}`),
      { owner, quizId },
    ),
  ).toBeNull();
});

test("a failed draft discard keeps saving subsequent edits on the device", async ({
  page,
}) => {
  await page.addInitScript(
    ({ owner, draft }) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: owner, refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
      const key = `testownik.v1.draft.${owner}.new`;
      localStorage.setItem(key, JSON.stringify(draft));
      const remove = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function (candidate) {
        if (candidate === key) throw new Error("Fixture storage unavailable");
        return remove.call(this, candidate);
      };
    },
    { owner, draft },
  );
  await page.route("**/api/**", (route) =>
    route.fulfill({
      json: new URL(route.request().url()).pathname.endsWith("/user/")
        ? { id: owner, is_guest: false }
        : [],
    }),
  );
  await page.goto("/editor");
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
  await expect.poll(() => alerts).toBe(1);
  await expect(title).toHaveValue(draft.title);
  await title.fill("Protected after failed discard");
  await expect
    .poll(() =>
      page.evaluate(
        (owner) =>
          JSON.parse(
            localStorage.getItem(`testownik.v1.draft.${owner}.new`) ?? "null",
          )?.title,
        owner,
      ),
    )
    .toBe("Protected after failed discard");
});

test("leaving a delayed discard does not erase a newer draft for the same quiz", async ({
  page,
}) => {
  await page.addInitScript(
    ({ owner, quizId, draft }) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: owner, refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
      localStorage.setItem(
        `testownik.v1.draft.${owner}.${quizId}`,
        JSON.stringify(draft),
      );
    },
    { owner, quizId, draft },
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reads = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes(quizId)) {
      reads++;
      if (reads === 1)
        return route.fulfill({ json: { ...draft, id: quizId, version: 1 } });
      await gate;
      return route.fulfill({
        json: { ...draft, id: quizId, title: "Saved version" },
      });
    }
    return route.fulfill({
      json: path.endsWith("/user/") ? { id: owner, is_guest: false } : [],
    });
  });
  await page.goto(`/editor?id=${quizId}`);
  await expect(
    page.getByRole("textbox", { name: "Quiz title", exact: true }),
  ).toHaveValue(draft.title);
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Editor options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Discard Changes", exact: true })
    .click();
  await expect.poll(() => reads).toBe(2);
  await page.getByRole("link", { name: /back/i }).click();
  await expect(page).not.toHaveURL(/\/editor/);
  await page.evaluate(
    ({ owner, quizId, draft }) =>
      localStorage.setItem(
        `testownik.v1.draft.${owner}.${quizId}`,
        JSON.stringify({ ...draft, title: "Newer work" }),
      ),
    { owner, quizId, draft },
  );
  const response = page.waitForResponse((response) =>
    new URL(response.url()).pathname.includes(quizId),
  );
  release();
  await (await response).finished();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(
    await page.evaluate(
      ({ owner, quizId }) =>
        JSON.parse(
          localStorage.getItem(`testownik.v1.draft.${owner}.${quizId}`) ??
            "null",
        )?.title,
      { owner, quizId },
    ),
  ).toBe("Newer work");
  await expect(page).not.toHaveURL(/\/editor/);
});
