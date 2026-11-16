import { expect, test, type Page, type Route } from "@playwright/test";
import { quizCreateResponse } from "./quiz-create-response";

const owner = "durable-editor-fixture";
const draftKey = `testownik.v1.draft.${owner}.new`;
const operationKey = `testownik.v1.quiz-create.${owner}.new`;
const quizId = "77777777-7777-4777-8777-777777777777";
const questionId = "88888888-8888-4888-8888-888888888888";
const answerId = "99999999-9999-4999-8999-999999999999";
const serverQuestion = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const serverAnswer = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const initial = {
  schemaVersion: 1,
  title: "Original durable quiz",
  description: "",
  questions: [
    {
      id: questionId,
      order: 0,
      text: "Original durable question",
      multiple: false,
      answers: [{ id: answerId, order: 0, text: "Answer", is_correct: true }],
    },
  ],
};
async function seed(page: Page, guest = false, source = initial) {
  await page.addInitScript(
    ({ initial, draftKey }) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({
          access: "durable-fixture",
          refresh: "durable-fixture-refresh",
        }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
      if (!localStorage.getItem("durable-fixture-seeded")) {
        localStorage.setItem(draftKey, JSON.stringify(initial));
        localStorage.setItem("durable-fixture-seeded", "true");
      }
    },
    { initial: source, draftKey },
  );
  let quiz = {
    ...source,
    id: quizId,
    version: 1,
    can_edit: true,
    questions: [
      {
        ...source.questions[0],
        id: serverQuestion,
        answers: [{ ...source.questions[0].answers[0], id: serverAnswer }],
      },
    ],
  };
  const posts: Record<string, any>[] = [],
    patches: Record<string, any>[] = [];
  let legacy = 0;
  let handle:
    | ((route: Route, body: Record<string, any>) => Promise<void>)
    | null = null;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/user/"))
      return route.fulfill({
        json: {
          id: owner,
          account_type: guest ? "guest" : "email",
          full_name: "Fixture",
        },
      });
    if (
      path.endsWith("/mobile/quizzes/") &&
      route.request().method() === "POST"
    ) {
      const body = route.request().postDataJSON();
      posts.push(body);
      if (handle) return handle(route, body);
      return route.fulfill({ json: quizCreateResponse(body, quiz) });
    }
    if (path.endsWith("/quizzes/") && route.request().method() === "POST") {
      legacy++;
      return route.fulfill({ json: quiz });
    }
    if (path.includes(`/quizzes/${quizId}/`)) {
      if (route.request().method() === "PATCH") {
        const body = route.request().postDataJSON();
        patches.push(body);
        quiz = { ...quiz, ...body, version: quiz.version + 1 };
      }
      return route.fulfill({ json: quiz });
    }
    return route.fulfill({
      json: path.endsWith("/library/")
        ? {
            path: [{ id: "root", name: "Library" }],
            items: [],
            can_create_folder: true,
          }
        : [],
    });
  });
  return {
    posts,
    patches,
    legacy: () => legacy,
    setVersion: (version: number) => {
      quiz = { ...quiz, version };
    },
    intercept: (callback: typeof handle) => {
      handle = callback;
    },
    response: (body: Record<string, any>) => quizCreateResponse(body, quiz),
  };
}
const save = (page: Page) =>
  page.getByRole("button", { name: "Save Quiz", exact: true });
const title = (page: Page) =>
  page.getByRole("textbox", { name: "Quiz title", exact: true });
const read = (page: Page, key: string) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), key);

test("lost201 + restart replays the same original operation, then maps later edits to a version-guarded PATCH", async ({
  page,
}) => {
  const f = await seed(page);
  f.intercept(async (route, body) => {
    if (f.posts.length === 1) return route.abort("failed");
    return route.fulfill({ json: f.response(body) });
  });
  await page.goto("/editor");
  await save(page).click();
  await expect(page.getByText(/previous save result is unknown/)).toBeVisible();
  await title(page).fill("Later durable edit");
  await expect
    .poll(() => read(page, draftKey))
    .toMatchObject({ title: "Later durable edit" });
  await page.reload();
  await expect(title(page)).toHaveValue("Later durable edit");
  await save(page).click();
  await expect(page.getByText(/original quiz is saved/)).toBeVisible();
  expect(f.posts).toHaveLength(2);
  expect(f.posts[1]).toEqual(f.posts[0]);
  expect(f.posts[1].quiz.title).toBe(initial.title);
  await expect(title(page)).toHaveValue("Later durable edit");
  await save(page).click();
  await expect(page).toHaveURL(new RegExp(`/quiz/${quizId}`));
  expect(f.patches).toHaveLength(1);
  expect(f.patches[0]).toMatchObject({
    title: "Later durable edit",
    expected_version: 1,
    questions: [{ id: serverQuestion, answers: [{ id: serverAnswer }] }],
  });
  expect(f.legacy()).toBe(0);
  expect(await read(page, operationKey)).toBeNull();
  expect(await read(page, draftKey)).toBeNull();
});

test("an old backend404 keeps its immutable operation and never falls back to legacy create", async ({
  page,
}) => {
  const f = await seed(page);
  f.intercept((route) => route.fulfill({ status: 404, json: {} }));
  await page.goto("/editor");
  await save(page).click();
  await expect(page.getByText(/previous save result is unknown/)).toBeVisible();
  await save(page).click();
  await expect(save(page)).toBeEnabled();
  expect(f.posts).toHaveLength(2);
  expect(f.posts[1]).toEqual(f.posts[0]);
  expect(f.legacy()).toBe(0);
  expect(await read(page, operationKey)).toMatchObject({ state: "pending" });
  await expect(title(page)).toHaveValue(initial.title);
});

test("storage failure before the journal write blocks POST and retains the draft", async ({
  page,
}) => {
  const f = await seed(page);
  await page.addInitScript((operationKey) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === operationKey) throw new Error("Fixture disk full");
      return set.call(this, key, value);
    };
  }, operationKey);
  await page.goto("/editor");
  await save(page).click();
  await expect(save(page)).toBeEnabled();
  expect(f.posts).toHaveLength(0);
  expect(f.legacy()).toBe(0);
  await expect(title(page)).toHaveValue(initial.title);
  expect(await read(page, draftKey)).toMatchObject({ title: initial.title });
});

for (const failedKey of [draftKey, operationKey])
  test(`known201 survives restart when cleanup of ${failedKey === draftKey ? "draft" : "receipt"} fails`, async ({
    page,
  }) => {
    const f = await seed(page);
    await page.addInitScript((failedKey) => {
      const remove = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function (key) {
        if (
          key === failedKey &&
          !sessionStorage.getItem("durable-cleanup-blocked")
        ) {
          sessionStorage.setItem("durable-cleanup-blocked", "true");
          throw new Error("Fixture cleanup interrupted");
        }
        return remove.call(this, key);
      };
    }, failedKey);
    await page.goto("/editor");
    await save(page).click();
    await expect(
      page.getByRole("heading", { name: "Quiz Saved", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Quiz Saved", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Clear Saved Draft", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/quiz/${quizId}`));
    expect(f.posts).toHaveLength(1);
    expect(await read(page, operationKey)).toBeNull();
    expect(await read(page, draftKey)).toBeNull();
  });

test("durable rejection permits an edited fresh request without deleting the local draft", async ({
  page,
}) => {
  const f = await seed(page);
  f.intercept(async (route, body) => {
    if (f.posts.length === 1)
      return route.fulfill({
        status: 400,
        json: {
          request_id: body.request_id,
          status: "rejected",
          code: "validation_failed",
          errors: { title: ["Fixture rejection"] },
        },
      });
    return route.fulfill({ json: f.response(body) });
  });
  await page.goto("/editor");
  await save(page).click();
  await expect(
    page.getByText(/server rejected the original save/),
  ).toBeVisible();
  await title(page).fill("Fixed durable quiz");
  await save(page).click();
  await expect(page).toHaveURL(new RegExp(`/quiz/${quizId}`));
  expect(f.posts).toHaveLength(2);
  expect(f.posts[1].request_id).not.toBe(f.posts[0].request_id);
  expect(f.posts[1].quiz.title).toBe("Fixed durable quiz");
});

test("a deleted receipt never triggers another create and offers retained draft recovery", async ({
  page,
}) => {
  const f = await seed(page);
  f.intercept((route, body) =>
    route.fulfill({
      status: 410,
      json: {
        request_id: body.request_id,
        status: "deleted",
        quiz_id: quizId,
        created_version: 1,
        id_map: {
          questions: { [questionId]: serverQuestion },
          answers: { [answerId]: serverAnswer },
        },
      },
    }),
  );
  let quizReads = 0;
  await page.route(`**/api/quizzes/${quizId}/**`, (route) => {
    quizReads++;
    return route.fulfill({ status: 503, json: {} });
  });
  await page.goto("/editor");
  await save(page).click();
  await expect(
    page.getByRole("button", { name: "Export Draft", exact: true }),
  ).toBeVisible();
  await expect(save(page)).toBeDisabled();
  await expect(title(page)).toHaveValue(initial.title);
  expect(await read(page, operationKey)).toMatchObject({ state: "deleted" });
  expect(f.posts).toHaveLength(1);
  await expect(
    page.getByRole("button", { name: "Remove Local Draft", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check Again", exact: true }),
  ).toHaveCount(0);
  expect(quizReads).toBe(0);
});

test("damaged recovery records preserve an exportable draft and block duplicate creation", async ({
  page,
}) => {
  const f = await seed(page);
  await page.addInitScript(
    (operationKey) =>
      localStorage.setItem(operationKey, '{"schemaVersion":99}'),
    operationKey,
  );
  await page.goto("/editor");
  await expect(title(page)).toHaveValue(initial.title);
  await expect(save(page)).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Export Draft", exact: true }),
  ).toBeVisible();
  expect(await read(page, operationKey)).toEqual({ schemaVersion: 99 });
  expect(f.posts).toHaveLength(0);
});

test("guest editor saves use durable create without legacy duplication", async ({
  page,
}) => {
  const f = await seed(page, true);
  await page.goto("/");
  await page.getByRole("button", { name: "New Quiz", exact: true }).click();
  await save(page).click();
  await expect(page).toHaveURL(new RegExp(`/quiz/${quizId}`));
  expect(f.posts).toHaveLength(1);
  expect(f.legacy()).toBe(0);
  expect(await read(page, operationKey)).toBeNull();
});

test("matching lost-access receipt releases the editor only after confirmed local removal", async ({
  page,
}) => {
  const f = await seed(page);
  f.intercept((route, body) =>
    route.fulfill({
      status: 403,
      json: {
        request_id: body.request_id,
        code: "create_access_lost",
        detail: "Original quiz is no longer editable.",
      },
    }),
  );
  await page.goto("/editor");
  await save(page).click();
  const remove = page.getByRole("button", {
    name: "Remove Local Draft",
    exact: true,
  });
  await expect(remove).toBeVisible();
  await expect(save(page)).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Check Again", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Export Draft", exact: true }),
  ).toBeVisible();
  expect(await read(page, operationKey)).toMatchObject({
    state: "access-lost",
  });
  await page.reload();
  await expect(remove).toBeVisible();
  expect(f.posts).toHaveLength(1);
  page.once("dialog", (dialog) => dialog.dismiss());
  await remove.click();
  expect(await read(page, draftKey)).toMatchObject({ title: initial.title });
  page.once("dialog", (dialog) => dialog.accept());
  await remove.click();
  await expect(page).toHaveURL(/\/library$/);
  expect(await read(page, operationKey)).toBeNull();
  expect(await read(page, draftKey)).toBeNull();
  expect(f.posts).toHaveLength(1);
});

for (const code of ["quiz_changed", "request_id_reused"])
  test(`${code}409 retains the original operation and can never mint a replacement`, async ({
    page,
  }) => {
    const f = await seed(page);
    f.intercept((route, body) =>
      route.fulfill({
        status: 409,
        json: {
          request_id: body.request_id,
          code,
          detail: "Retry the original operation.",
        },
      }),
    );
    await page.goto("/editor");
    await save(page).click();
    await expect(
      page.getByText(/previous save result is unknown/),
    ).toBeVisible();
    await title(page).fill("Later retained title");
    await save(page).click();
    await expect(save(page)).toBeEnabled();
    expect(f.posts).toHaveLength(2);
    expect(f.posts[1]).toEqual(f.posts[0]);
    expect(await read(page, operationKey)).toMatchObject({ state: "pending" });
    expect(f.legacy()).toBe(0);
  });

for (const laterEdit of [false, true])
  test(`newer nullable-description replay ${laterEdit ? "retains later edits at original CAS version" : "cleans unchanged acknowledged draft"}`, async ({
    page,
  }) => {
    const f = await seed(page);
    f.intercept((route, body) => {
      if (f.posts.length === 1) return route.abort("failed");
      const receipt = f.response(body);
      f.setVersion(3);
      return route.fulfill({
        json: {
          ...receipt,
          created_version: 1,
          quiz: {
            ...receipt.quiz,
            description: null,
            version: 3,
            questions: [],
          },
        },
      });
    });
    await page.goto("/editor");
    await save(page).click();
    await expect(
      page.getByText(/previous save result is unknown/),
    ).toBeVisible();
    if (laterEdit) await title(page).fill("Later protected edit");
    await save(page).click();
    if (laterEdit) {
      await expect(
        page.getByText(/saved quiz changed since this draft/),
      ).toBeVisible();
      await expect(save(page)).toBeDisabled();
      await expect(title(page)).toHaveValue("Later protected edit");
      expect(await read(page, draftKey)).toMatchObject({
        baseVersion: 1,
        questions: [{ id: serverQuestion }],
      });
    } else {
      await expect(page).toHaveURL(new RegExp(`/quiz/${quizId}`));
      expect(await read(page, operationKey)).toBeNull();
      expect(await read(page, draftKey)).toBeNull();
    }
    expect(f.patches).toHaveLength(0);
    expect(f.posts).toHaveLength(2);
  });

for (const failedKey of [draftKey, operationKey])
  test(`known PATCH acknowledgement survives restart after ${failedKey === draftKey ? "draft" : "receipt"} cleanup failure`, async ({
    page,
  }) => {
    const f = await seed(page);
    f.intercept((route, body) =>
      f.posts.length === 1
        ? route.abort("failed")
        : route.fulfill({ json: f.response(body) }),
    );
    await page.goto("/editor");
    await save(page).click();
    await expect(
      page.getByText(/previous save result is unknown/),
    ).toBeVisible();
    await title(page).fill("Later PATCH acknowledged title");
    await save(page).click();
    await expect(page.getByText(/original quiz is saved/)).toBeVisible();
    await page.evaluate((failedKey) => {
      const remove = Storage.prototype.removeItem;
      let failed = false;
      Storage.prototype.removeItem = function (key) {
        if (key === failedKey && !failed) {
          failed = true;
          throw new Error("Fixture cleanup after PATCH");
        }
        return remove.call(this, key);
      };
    }, failedKey);
    await save(page).click();
    await expect(
      page.getByRole("heading", { name: "Quiz Saved", exact: true }),
    ).toBeVisible();
    expect(await read(page, operationKey)).toMatchObject({
      acknowledged: {
        quiz: { version: 2 },
        snapshot: { title: "Later PATCH acknowledged title", baseVersion: 2 },
      },
    });
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Quiz Saved", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Clear Saved Draft", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/quiz/${quizId}`));
    expect(f.posts).toHaveLength(2);
    expect(f.patches).toHaveLength(1);
    expect(await read(page, operationKey)).toBeNull();
    expect(await read(page, draftKey)).toBeNull();
  });

test("large create ACK stays within Android journal cap and reopens without duplicate POST", async ({
  page,
}) => {
  const large = { ...initial, description: "x".repeat(2 * 1024 * 1024) };
  const f = await seed(page, false, large);
  // Isolate the operation from Chromium's smaller per-origin localStorage quota;
  // enforce Android's real per-value cap, while retaining it across page reloads.
  await page.addInitScript(
    ({ operationKey, draftKey }) => {
      const get = Storage.prototype.getItem,
        set = Storage.prototype.setItem,
        remove = Storage.prototype.removeItem;
      Storage.prototype.getItem = function (key) {
        return get.call(
          this === localStorage && key === operationKey ? sessionStorage : this,
          key,
        );
      };
      Storage.prototype.setItem = function (key, value) {
        if (this === localStorage && key === operationKey) {
          if (new TextEncoder().encode(value).length > 8 * 1024 * 1024)
            throw new Error("Fixture Android journal8MiB limit");
          return set.call(sessionStorage, key, value);
        }
        return set.call(this, key, value);
      };
      Storage.prototype.removeItem = function (key) {
        if (
          this === localStorage &&
          key === draftKey &&
          !get.call(sessionStorage, "large-cleanup-blocked")
        ) {
          set.call(sessionStorage, "large-cleanup-blocked", "true");
          throw new Error("Fixture interrupted cleanup");
        }
        return remove.call(
          this === localStorage && key === operationKey ? sessionStorage : this,
          key,
        );
      };
    },
    { operationKey, draftKey },
  );
  await page.goto("/editor");
  await save(page).click();
  await expect(
    page.getByRole("heading", { name: "Quiz Saved", exact: true }),
  ).toBeVisible();
  const journal = await read(page, operationKey);
  expect(journal.schemaVersion).toBe(2);
  expect(journal).not.toHaveProperty("payload");
  expect(journal.result.quiz).toEqual({ id: quizId, version: 1 });
  expect(new TextEncoder().encode(JSON.stringify(journal)).length).toBeLessThan(
    3 * 1024 * 1024,
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Quiz Saved", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear Saved Draft", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/quiz/${quizId}`));
  expect(f.posts).toHaveLength(1);
  expect(f.patches).toHaveLength(0);
  expect(await read(page, operationKey)).toBeNull();
});

test("guest lost201 + restart replays the same original operation, then maps later edits to a version-guarded PATCH", async ({
  page,
}) => {
  const f = await seed(page, true);
  f.intercept(async (route, body) => {
    if (f.posts.length === 1) return route.abort("failed");
    return route.fulfill({ json: f.response(body) });
  });
  await page.goto("/editor");
  await save(page).click();
  await expect(page.getByText(/previous save result is unknown/)).toBeVisible();
  await title(page).fill("Later durable edit");
  await expect
    .poll(() => read(page, draftKey))
    .toMatchObject({ title: "Later durable edit" });
  await page.reload();
  await expect(title(page)).toHaveValue("Later durable edit");
  await save(page).click();
  await expect(page.getByText(/original quiz is saved/)).toBeVisible();
  expect(f.posts).toHaveLength(2);
  expect(f.posts[1]).toEqual(f.posts[0]);
  expect(f.posts[1].quiz.title).toBe(initial.title);
  await expect(title(page)).toHaveValue("Later durable edit");
  await save(page).click();
  await expect(page).toHaveURL(new RegExp(`/quiz/${quizId}`));
  expect(f.patches).toHaveLength(1);
  expect(f.patches[0]).toMatchObject({
    title: "Later durable edit",
    expected_version: 1,
    questions: [{ id: serverQuestion, answers: [{ id: serverAnswer }] }],
  });
  expect(f.legacy()).toBe(0);
  expect(await read(page, operationKey)).toBeNull();
  expect(await read(page, draftKey)).toBeNull();
});

test("guest old-backend denial retains its immutable journal after restart without legacy fallback", async ({
  page,
}) => {
  const f = await seed(page, true);
  f.intercept((route) =>
    route.fulfill({
      status: 403,
      json: { code: "permanent_account_required" },
    }),
  );
  await page.goto("/editor");
  await save(page).click();
  await expect(page.getByText(/previous save result is unknown/)).toBeVisible();
  await page.reload();
  await save(page).click();
  await expect(save(page)).toBeEnabled();
  expect(f.posts).toHaveLength(2);
  expect(f.posts[1]).toEqual(f.posts[0]);
  expect(f.legacy()).toBe(0);
  expect(await read(page, operationKey)).toMatchObject({ state: "pending" });
  await expect(title(page)).toHaveValue(initial.title);
});

test("two editor tabs share one durable operation when both save before either claim commits", async ({
  page,
  context,
}, info) => {
  const first = await seed(page);
  const other = await context.newPage();
  const second = await seed(other);
  first.intercept((route) => route.abort("failed"));
  second.intercept((route) => route.abort("failed"));
  await page.goto("/editor");
  await other.goto("/editor");
  await expect(save(page)).toBeEnabled();
  await expect(save(other)).toBeEnabled();
  await page.evaluate(() => {
    const qa = window as unknown as { held: boolean; release: () => void };
    void navigator.locks.request(
      "testownik.quiz-create.v1.durable-editor-fixture",
      async () => {
        qa.held = true;
        await new Promise<void>((resolve) => {
          qa.release = resolve;
        });
      },
    );
  });
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { held: boolean }).held),
    )
    .toBe(true);
  await Promise.all([save(page).click(), save(other).click()]);
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (await navigator.locks.query()).pending?.filter(
            (lock) =>
              lock.name === "testownik.quiz-create.v1.durable-editor-fixture",
          ).length,
      ),
    )
    .toBe(2);
  await page.evaluate(() =>
    (window as unknown as { release: () => void }).release(),
  );
  await expect.poll(() => first.posts.length + second.posts.length).toBe(2);
  const requests = [...first.posts, ...second.posts];
  await info.attach("cross-tab-create-identities", {
    body: JSON.stringify({
      requestIds: requests.map((body) => body.request_id),
      retainedRequestId: (await read(page, operationKey))?.requestId,
    }),
    contentType: "application/json",
  });
  expect(new Set(requests.map((body) => body.request_id)).size).toBe(1);
  expect(first.legacy() + second.legacy()).toBe(0);
});

test("a blocked cross-tab create claim times out without POST and can be retried after release", async ({
  page,
}) => {
  const f = await seed(page);
  await page.goto("/editor");
  await expect(save(page)).toBeEnabled();
  await page.evaluate(() => {
    const qa = window as unknown as { held: boolean; release: () => void };
    void navigator.locks.request(
      "testownik.quiz-create.v1.durable-editor-fixture",
      async () => {
        qa.held = true;
        await new Promise<void>((resolve) => {
          qa.release = resolve;
        });
      },
    );
  });
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { held: boolean }).held),
    )
    .toBe(true);
  await save(page).click();
  await expect(
    page.getByText(/Could not confirm safe storage across browser tabs/),
  ).toBeVisible({ timeout: 12000 });
  expect(f.posts).toHaveLength(0);
  expect(await read(page, operationKey)).toBeNull();
  await expect(title(page)).toHaveValue(initial.title);
  await page.evaluate(() =>
    (window as unknown as { release: () => void }).release(),
  );
  await save(page).click();
  await expect(page).toHaveURL(new RegExp(`/quiz/${quizId}`));
  expect(f.posts).toHaveLength(1);
  expect(f.legacy()).toBe(0);
});

test("a stale create reply never writes over another tab's newer acknowledged draft", async ({
  page,
}) => {
  const f = await seed(page);
  let newer: Record<string, unknown> = {};
  f.intercept(async (route, body) => {
    const confirmed = f.response(body);
    newer = {
      ...initial,
      title: "Newer acknowledged work",
      baseVersion: 2,
      questions: [
        {
          ...initial.questions[0],
          id: serverQuestion,
          answers: [{ ...initial.questions[0].answers[0], id: serverAnswer }],
        },
      ],
    };
    await page.evaluate(
      ({ operationKey, draftKey, owner, body, confirmed, newer }) => {
        localStorage.setItem(
          operationKey,
          JSON.stringify({
            schemaVersion: 2,
            owner,
            requestId: body.request_id,
            state: "created",
            result: {
              ...confirmed,
              quiz: { id: confirmed.quiz.id, version: 1 },
            },
            mapped: { questions: 1, answers: 1 },
            acknowledged: {
              quiz: { id: confirmed.quiz.id, version: 2 },
              snapshot: newer,
            },
          }),
        );
        localStorage.setItem(draftKey, JSON.stringify(newer));
      },
      { operationKey, draftKey, owner, body, confirmed, newer },
    );
    f.setVersion(2);
    return route.fulfill({ json: confirmed });
  });
  await page.goto("/editor");
  await save(page).click();
  await expect(
    page.getByText(/The saved quiz changed since this draft was started/),
  ).toBeVisible();
  expect(await read(page, draftKey)).toEqual(newer);
  await expect(title(page)).toHaveValue(initial.title);
  await expect(save(page)).toBeDisabled();
  expect(f.posts).toHaveLength(1);
  expect(f.patches).toHaveLength(0);
  await expect(
    page.getByRole("button", { name: "Export Draft", exact: true }),
  ).toBeVisible();
});

for (const status of [403, 410])
  test(`late HTTP${status} proof preserves recovery after another tab settled the create`, async ({
    page,
  }) => {
    const f = await seed(page);
    f.intercept(async (route, body) => {
      const confirmed = f.response(body);
      // Model a second context settling the same operation while this request
      // remains in flight. Its initial receipt is older than this terminal proof.
      await page.evaluate(
        ({ operationKey, owner, confirmed, initial }) => {
          localStorage.setItem(
            operationKey,
            JSON.stringify({
              schemaVersion: 2,
              owner,
              requestId: confirmed.request_id,
              state: "created",
              snapshot: initial,
              result: {
                ...confirmed,
                quiz: { id: confirmed.quiz.id, version: 1 },
              },
              mapped: { questions: 1, answers: 1 },
            }),
          );
        },
        { operationKey, owner, confirmed, initial },
      );
      await route.fulfill({
        status,
        json:
          status === 403
            ? { request_id: body.request_id, code: "create_access_lost" }
            : {
                request_id: body.request_id,
                status: "deleted",
                quiz_id: quizId,
                created_version: 1,
                id_map: confirmed.id_map,
              },
      });
    });
    await page.goto("/editor");
    await save(page).click();
    await expect(
      page.getByRole("button", { name: "Export Draft", exact: true }),
    ).toBeVisible();
    await expect(save(page)).toBeDisabled();
    await expect(page).toHaveURL(/\/editor$/);
    await expect(title(page)).toHaveValue(initial.title);
    expect(await read(page, draftKey)).toEqual(initial);
    expect(await read(page, operationKey)).toMatchObject({
      state: status === 403 ? "access-lost" : "deleted",
      snapshot: initial,
    });
    expect(f.posts).toHaveLength(1);
    expect(f.patches).toHaveLength(0);
  });

test("a completed create cleared by another tab never enables a second creation", async ({
  page,
}) => {
  const f = await seed(page);
  f.intercept(async (route, body) => {
    // The other tab completed this request and removed its matching journal and
    // draft in finishSave before this tab receives the same acknowledgement.
    await page.evaluate(
      ({ operationKey, draftKey }) => {
        localStorage.removeItem(operationKey);
        localStorage.removeItem(draftKey);
      },
      { operationKey, draftKey },
    );
    await route.fulfill({ json: f.response(body) });
  });
  await page.goto("/editor");
  await save(page).click();
  await expect(
    page
      .getByText(
        /Could not confirm the previous save|completed or replaced in another tab/,
      )
      .first(),
  ).toBeVisible();
  await expect(save(page)).toBeDisabled();
  await expect(
    page.getByText(/completed or replaced in another tab/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export Draft", exact: true }),
  ).toBeVisible();
  await expect(title(page)).toHaveValue(initial.title);
  expect(await read(page, operationKey)).toBeNull();
  expect(await read(page, draftKey)).toBeNull();
  await title(page).fill("Retained only for export");
  await expect(title(page)).toHaveValue("Retained only for export");
  await page
    .getByRole("button", { name: "Back to Library", exact: true })
    .click();
  await expect(page).toHaveURL(/\/library$/);
  expect(await read(page, draftKey)).toBeNull();
  expect(f.posts).toHaveLength(1);
  expect(f.patches).toHaveLength(0);
});
