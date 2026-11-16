import { expect, test, type Page } from "@playwright/test";
import { quizCreateResponse } from "./quiz-create-response";

const owner = "import-recovery-fixture";
const input = {
  title: "Durable imported quiz",
  description: "Private import fixture",
  questions: [
    {
      text: "Imported question",
      multiple: true,
      answers: [{ text: "Yes", is_correct: true }],
    },
  ],
};
const importKey = `testownik.v1.quiz-create.${owner}.import`;
const editorKey = `testownik.v1.quiz-create.${owner}.new`;
async function setup(
  page: Page,
  options: {
    guest?: boolean;
    owner?: string;
    abortFirst?: boolean;
    outcome?: "rejected" | "deleted" | "access-lost" | "changing";
  } = {},
) {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({
        access: "import-recovery-fixture",
        refresh: "fixture-refresh",
      }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
  });
  let uploads = 0;
  let creations = 0;
  let posts = 0;
  const receipts = new Map<string, Record<string, unknown>>();
  const bodies: Record<string, unknown>[] = [];
  let latest: Record<string, unknown> | null = null;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/user/"))
      return route.fulfill({
        json: {
          id: options.owner ?? owner,
          account_type: options.guest ? "guest" : "email",
          full_name: "Import Fixture",
        },
      });
    if (path.endsWith("/upload/") && route.request().method() === "POST") {
      uploads++;
      return route.fulfill({
        json: {
          id: `eeeeeeee-eeee-4eee-8eee-${String(uploads).padStart(12, "0")}`,
        },
      });
    }
    if (path.endsWith("/quizzes/") && route.request().method() === "POST") {
      posts++;
      const body = route.request().postDataJSON();
      bodies.push(body);
      const payload = body.quiz ?? body;
      expect(payload.visibility).toBe(0);
      expect(path.includes("/mobile/quizzes/")).toBe(true);
      expect(payload.questions[0].multiple).toBe(true);
      expect(payload.folder).toBeUndefined();
      const key = body.request_id;
      if (options.outcome) {
        const details =
          options.outcome === "rejected"
            ? {
                status: "rejected",
                code: "validation_failed",
                errors: { questions: ["Image expired"] },
              }
            : options.outcome === "deleted"
              ? {
                  status: "deleted",
                  quiz_id: "cccccccc-cccc-4ccc-8ccc-000000000001",
                  created_version: 1,
                  id_map: { questions: {}, answers: {} },
                }
              : {
                  code:
                    options.outcome === "changing"
                      ? "quiz_changed"
                      : "create_access_lost",
                };
        return route.fulfill({
          status:
            options.outcome === "rejected"
              ? 400
              : options.outcome === "deleted"
                ? 410
                : options.outcome === "changing"
                  ? 409
                  : 403,
          json: { request_id: key, ...details },
        });
      }
      if (!key || !receipts.has(key)) {
        creations++;
        latest = {
          ...payload,
          id: `cccccccc-cccc-4ccc-8ccc-${String(creations).padStart(12, "0")}`,
          version: 1,
          can_edit: true,
        };
        if (key) receipts.set(key, latest!);
      } else latest = receipts.get(key)!;
      if (posts === 1 && options.abortFirst !== false)
        return route.abort("failed");
      return route.fulfill({
        json: quizCreateResponse(body, latest!),
      });
    }
    if (path.includes("/quizzes/") && latest)
      return route.fulfill({ json: latest });
    return route.fulfill({ json: [] });
  });
  return {
    creations: () => creations,
    posts: () => posts,
    uploads: () => uploads,
    bodies,
  };
}
async function preview(page: Page, raw: unknown = input) {
  await page.goto("/import");
  await page.getByRole("button", { name: "Paste JSON", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Quiz JSON", exact: true })
    .fill(JSON.stringify(raw));
  await page.getByRole("button", { name: "Preview Quiz", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: input.title, exact: true }),
  ).toBeVisible();
}

test("a permanent import retry after lost acknowledgement creates one private quiz", async ({
  page,
}) => {
  const f = await setup(page);
  await preview(page);
  const save = saveButton(page);
  await save.click();
  await expect(
    page.getByRole("heading", { name: "Couldn’t Import Quiz", exact: true }),
  ).toBeVisible();
  await save.click();
  await expect(page).toHaveURL(/\/quiz\/cccccccc-cccc-4ccc-8ccc-/);
  expect(f.posts()).toBe(2);
  expect(f.creations()).toBe(1);
  expect(f.bodies[1]).toEqual(f.bodies[0]);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).state,
      importKey,
    ),
  ).toBe("created");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), editorKey),
  ).toBeNull();
});

const saveButton = (page: Page) =>
  page.getByRole("button", {
    name: /^(Import and Start Studying|Retry Import)$/,
  });
const record = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), importKey);

test("lost acknowledgement survives restart and a known receipt requires explicit next import", async ({
  page,
}) => {
  const f = await setup(page);
  await preview(page);
  await page.evaluate(
    (key) =>
      localStorage.setItem(
        key,
        JSON.stringify({ sentinel: "Separate editor operation" }),
      ),
    editorKey,
  );
  await saveButton(page).click();
  await expect(
    page.getByRole("heading", { name: "Confirm Previous Import", exact: true }),
  ).toBeVisible();
  const pending = await record(page);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: input.title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Choose File", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Paste JSON", exact: true }),
  ).toBeDisabled();
  expect(f.posts()).toBe(1);
  await saveButton(page).click();
  await expect(page).toHaveURL(/\/quiz\/cccccccc-/);
  expect(f.creations()).toBe(1);
  expect(f.bodies[0]).toEqual(f.bodies[1]);
  expect((await record(page)).requestId).toBe(pending.requestId);
  await page.goto("/import");
  await expect(
    page.getByRole("heading", { name: "Quiz Already Imported", exact: true }),
  ).toBeVisible();
  expect(f.posts()).toBe(2);
  await page.getByRole("button", { name: "Open Quiz", exact: true }).click();
  await expect(page).toHaveURL(/\/quiz\/cccccccc-/);
  expect(f.posts()).toBe(2);
  await page.goto("/import");
  await page
    .getByRole("button", { name: "Import Another Quiz", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Paste JSON", exact: true }),
  ).toBeEnabled();
  expect(await record(page)).toBeNull();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      editorKey,
    ),
  ).toEqual({ sentinel: "Separate editor operation" });
});

for (const outcome of ["rejected", "deleted", "access-lost"] as const)
  test(`${outcome} receipt survives restart without another POST and can be explicitly dismissed`, async ({
    page,
  }) => {
    const f = await setup(page, { outcome });
    await preview(page);
    await saveButton(page).click();
    await expect(
      page.getByRole("heading", {
        name: "Import Needs Attention",
        exact: true,
      }),
    ).toBeVisible();
    expect((await record(page)).state).toBe(outcome);
    expect(await record(page)).not.toHaveProperty("payload");
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "Import Needs Attention",
        exact: true,
      }),
    ).toBeVisible();
    expect(f.posts()).toBe(1);
    await expect(saveButton(page)).not.toBeVisible();
    await page
      .getByRole("button", { name: "Import Another Quiz", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Paste JSON", exact: true }),
    ).toBeEnabled();
    expect(await record(page)).toBeNull();
  });

test("temporary replay consistency conflict preserves the immutable import", async ({
  page,
}) => {
  const f = await setup(page, { outcome: "changing" });
  await preview(page);
  await saveButton(page).click();
  await expect(
    page.getByRole("heading", { name: "Couldn’t Import Quiz", exact: true }),
  ).toBeVisible();
  const pending = await record(page);
  await page.reload();
  await saveButton(page).click();
  await expect(
    page.getByRole("heading", { name: "Couldn’t Import Quiz", exact: true }),
  ).toBeVisible();
  expect(f.posts()).toBe(2);
  expect(f.bodies[0]).toEqual(f.bodies[1]);
  expect(await record(page)).toEqual(pending);
  await expect(
    page.getByRole("button", { name: "Import Another Quiz", exact: true }),
  ).not.toBeVisible();
});

test("a corrupt import record blocks new creation without touching the separate editor draft", async ({
  page,
}) => {
  const f = await setup(page);
  await page.addInitScript(
    ({ importKey, editorKey }) => {
      localStorage.setItem(
        importKey,
        JSON.stringify({ state: "pending", damaged: true }),
      );
      localStorage.setItem(editorKey, JSON.stringify({ sentinel: "Editor" }));
    },
    { importKey, editorKey },
  );
  await page.goto("/import");
  await expect(
    page.getByRole("heading", {
      name: "Previous Import Couldn’t Be Read",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Choose File", exact: true }),
  ).not.toBeVisible();
  expect(f.posts()).toBe(0);
  expect(await record(page)).toEqual({ state: "pending", damaged: true });
});

test("guest import uses the durable create contract", async ({ page }) => {
  const f = await setup(page, { guest: true, abortFirst: false });
  await preview(page);
  await saveButton(page).click();
  await expect(page).toHaveURL(/\/quiz\/cccccccc-/);
  expect(f.posts()).toBe(1);
  expect(f.bodies[0]).toHaveProperty("request_id");
  expect(await record(page)).toMatchObject({ state: "created" });
});

test("failed local journal storage sends no request and keeps the import available", async ({
  page,
}) => {
  const f = await setup(page, { abortFirst: false });
  await page.addInitScript((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, value) {
      if (k === key) throw new DOMException("full", "QuotaExceededError");
      return original.call(this, k, value);
    };
  }, importKey);
  await preview(page);
  await saveButton(page).click();
  await expect(
    page.getByRole("heading", { name: "Couldn’t Import Quiz", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: input.title, exact: true }),
  ).toBeVisible();
  expect(f.posts()).toBe(0);
  await expect(
    page.getByRole("button", { name: "Paste JSON", exact: true }),
  ).toBeEnabled();
});

test("failed removal retains the known receipt so choosing another file cannot duplicate it", async ({
  page,
}) => {
  const f = await setup(page, { abortFirst: false });
  await preview(page);
  await saveButton(page).click();
  await expect(page).toHaveURL(/\/quiz\/cccccccc-/);
  await page.goto("/import");
  await page.evaluate((key) => {
    const original = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (k) {
      if (k === key) throw new Error("locked");
      return original.call(this, k);
    };
  }, importKey);
  await page
    .getByRole("button", { name: "Import Another Quiz", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Couldn’t Import Quiz", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Quiz Already Imported", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Paste JSON", exact: true }),
  ).toBeDisabled();
  expect(f.posts()).toBe(1);
  expect((await record(page)).state).toBe("created");
});

const imageInput = {
  ...input,
  questions: [
    {
      ...input.questions[0],
      image_url: "data:image/png;base64,YQ==",
      answers: [
        {
          ...input.questions[0].answers[0],
          image_url: "data:image/png;base64,YQ==",
        },
      ],
    },
  ],
};
test("an image import replays persisted upload references after restart without reuploading", async ({
  page,
}) => {
  const f = await setup(page);
  await preview(page, imageInput);
  await saveButton(page).click();
  await expect(
    page.getByRole("heading", { name: "Confirm Previous Import", exact: true }),
  ).toBeVisible();
  expect(f.uploads()).toBe(1);
  expect((await record(page)).payload.questions[0]).toMatchObject({
    image_url: null,
    image_upload: "eeeeeeee-eeee-4eee-8eee-000000000001",
    answers: [
      { image_url: null, image_upload: "eeeeeeee-eeee-4eee-8eee-000000000001" },
    ],
  });
  await page.reload();
  await saveButton(page).click();
  await expect(page).toHaveURL(/\/quiz\/cccccccc-/);
  expect(f.uploads()).toBe(1);
  expect(f.creations()).toBe(1);
  expect(f.bodies[0]).toEqual(f.bodies[1]);
});

test("a rejected image import requires a new selection and uploads fresh references", async ({
  page,
}) => {
  const options: Parameters<typeof setup>[1] = {
    outcome: "rejected",
    abortFirst: false,
  };
  const f = await setup(page, options);
  await preview(page, imageInput);
  await saveButton(page).click();
  await expect(
    page.getByRole("heading", { name: "Import Needs Attention", exact: true }),
  ).toBeVisible();
  expect(f.uploads()).toBe(1);
  expect(f.creations()).toBe(0);
  await page.reload();
  await page
    .getByRole("button", { name: "Import Another Quiz", exact: true })
    .click();
  options.outcome = undefined;
  await page.getByRole("button", { name: "Paste JSON", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Quiz JSON", exact: true })
    .fill(JSON.stringify(imageInput));
  await page.getByRole("button", { name: "Preview Quiz", exact: true }).click();
  await saveButton(page).click();
  await expect(page).toHaveURL(/\/quiz\/cccccccc-/);
  expect(f.uploads()).toBe(2);
  expect(f.creations()).toBe(1);
  expect(f.bodies[0].request_id).not.toBe(f.bodies[1].request_id);
  expect(f.bodies[1]).toMatchObject({
    quiz: {
      questions: [{ image_upload: "eeeeeeee-eeee-4eee-8eee-000000000002" }],
    },
  });
});

test("a malformed success keeps the import pending with a localized retry explanation", async ({
  page,
}) => {
  await setup(page);
  const bodies: unknown[] = [];
  await page.route("**/api/mobile/quizzes/", (route) => {
    const body = route.request().postDataJSON();
    bodies.push(body);
    return route.fulfill({
      status: 201,
      json: {
        request_id: body.request_id,
        status: "created",
        quiz: { id: "damaged", version: 1 },
      },
    });
  });
  await preview(page);
  await saveButton(page).click();
  await expect(
    page.getByText(
      "The server response could not be confirmed. Retry to check the same import.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/Quiz create recovery|Import recovery:/),
  ).not.toBeVisible();
  expect((await record(page)).state).toBe("pending");
  await page.reload();
  await saveButton(page).click();
  await expect(
    page.getByText(
      "The server response could not be confirmed. Retry to check the same import.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toEqual(bodies[0]);
});

test("switching accounts isolates pending imports and recovers the original owner's receipt", async ({
  page,
}) => {
  const options: Parameters<typeof setup>[1] = { owner };
  const f = await setup(page, options);
  await preview(page);
  await saveButton(page).click();
  await expect(
    page.getByRole("heading", { name: "Confirm Previous Import", exact: true }),
  ).toBeVisible();
  const original = await record(page);
  options.owner = "second-import-owner";
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Paste JSON", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "Confirm Previous Import", exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Paste JSON", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Quiz JSON", exact: true })
    .fill(JSON.stringify(input));
  await page.getByRole("button", { name: "Preview Quiz", exact: true }).click();
  await saveButton(page).click();
  await expect(page).toHaveURL(/\/quiz\/cccccccc-/);
  expect(f.creations()).toBe(2);
  expect(await record(page)).toEqual(original);
  options.owner = owner;
  await page.goto("/import");
  await expect(
    page.getByRole("heading", { name: "Confirm Previous Import", exact: true }),
  ).toBeVisible();
  await saveButton(page).click();
  await expect(page).toHaveURL(/\/quiz\/cccccccc-/);
  expect(f.creations()).toBe(2);
  expect(f.posts()).toBe(3);
  expect(f.bodies[2]).toEqual(f.bodies[0]);
});

test("guest lost acknowledgement survives restart and a known receipt requires explicit next import", async ({
  page,
}) => {
  const f = await setup(page, { guest: true });
  await preview(page);
  await page.evaluate(
    (key) =>
      localStorage.setItem(
        key,
        JSON.stringify({ sentinel: "Separate editor operation" }),
      ),
    editorKey,
  );
  await saveButton(page).click();
  await expect(
    page.getByRole("heading", { name: "Confirm Previous Import", exact: true }),
  ).toBeVisible();
  const pending = await record(page);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: input.title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Choose File", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Paste JSON", exact: true }),
  ).toBeDisabled();
  expect(f.posts()).toBe(1);
  await saveButton(page).click();
  await expect(page).toHaveURL(/\/quiz\/cccccccc-/);
  expect(f.creations()).toBe(1);
  expect(f.bodies[0]).toEqual(f.bodies[1]);
  expect((await record(page)).requestId).toBe(pending.requestId);
  await page.goto("/import");
  await expect(
    page.getByRole("heading", { name: "Quiz Already Imported", exact: true }),
  ).toBeVisible();
  expect(f.posts()).toBe(2);
  await page.getByRole("button", { name: "Open Quiz", exact: true }).click();
  await expect(page).toHaveURL(/\/quiz\/cccccccc-/);
  expect(f.posts()).toBe(2);
  await page.goto("/import");
  await page
    .getByRole("button", { name: "Import Another Quiz", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Paste JSON", exact: true }),
  ).toBeEnabled();
  expect(await record(page)).toBeNull();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      editorKey,
    ),
  ).toEqual({ sentinel: "Separate editor operation" });
});

test("guest upgrade keeps the original journal isolated from a permanent account", async ({
  page,
}) => {
  const options: Parameters<typeof setup>[1] = { owner, guest: true };
  const f = await setup(page, options);
  await preview(page);
  await saveButton(page).click();
  await expect(
    page.getByRole("heading", { name: "Confirm Previous Import", exact: true }),
  ).toBeVisible();
  const original = await record(page);
  options.owner = "second-import-owner";
  options.guest = false;
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Paste JSON", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "Confirm Previous Import", exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Paste JSON", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Quiz JSON", exact: true })
    .fill(JSON.stringify(input));
  await page.getByRole("button", { name: "Preview Quiz", exact: true }).click();
  await saveButton(page).click();
  await expect(page).toHaveURL(/\/quiz\/cccccccc-/);
  expect(f.creations()).toBe(2);
  expect(await record(page)).toEqual(original);
  // A real upgrade deletes the guest principal. The new account must not
  // adopt or replay this retained owner-bound journal with its own token.
  expect(f.posts()).toBe(2);
  expect(f.bodies[1].request_id).not.toBe(f.bodies[0].request_id);
});

test("guest old-backend denial preserves its pending import across restart without legacy fallback", async ({
  page,
}) => {
  await setup(page, { guest: true });
  let durable = 0,
    legacy = 0;
  const bodies: unknown[] = [];
  await page.route("**/api/mobile/quizzes/", (route) => {
    durable++;
    bodies.push(route.request().postDataJSON());
    return route.fulfill({
      status: 403,
      json: { code: "permanent_account_required", detail: "Guest unsupported" },
    });
  });
  await page.route("**/api/quizzes/", (route) => {
    legacy++;
    return route.fulfill({ status: 500, json: {} });
  });
  await preview(page);
  await saveButton(page).click();
  await expect(
    page.getByRole("heading", { name: "Confirm Previous Import", exact: true }),
  ).toBeVisible();
  const original = await record(page);
  await page.reload();
  await expect(saveButton(page)).toBeEnabled();
  await saveButton(page).click();
  await expect(saveButton(page)).toBeEnabled();
  expect(durable).toBe(2);
  expect(legacy).toBe(0);
  expect(bodies[1]).toEqual(bodies[0]);
  expect(await record(page)).toEqual(original);
});

test("two import tabs cannot replace one another's pending durable claim", async ({
  page,
  context,
}) => {
  const first = await setup(page),
    other = await context.newPage(),
    second = await setup(other);
  await preview(page);
  await preview(other);
  await page.evaluate(() => {
    const qa = window as unknown as { held: boolean; release: () => void };
    void navigator.locks.request(
      "testownik.quiz-create.v1.import-recovery-fixture",
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
  await Promise.all([saveButton(page).click(), saveButton(other).click()]);
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (await navigator.locks.query()).pending?.filter(
            (lock) =>
              lock.name === "testownik.quiz-create.v1.import-recovery-fixture",
          ).length,
      ),
    )
    .toBe(2);
  await page.evaluate(() =>
    (window as unknown as { release: () => void }).release(),
  );
  await expect(
    page.getByRole("heading", { name: "Confirm Previous Import", exact: true }),
  ).toBeVisible();
  await expect(
    other.getByRole("heading", {
      name: "Confirm Previous Import",
      exact: true,
    }),
  ).toBeVisible();
  expect(first.posts() + second.posts()).toBe(1);
  const pending = await record(page);
  expect(pending).toMatchObject({
    state: "pending",
    payload: { title: input.title },
  });
  expect([...first.bodies, ...second.bodies][0].request_id).toBe(
    pending.requestId,
  );
  expect(
    await page.evaluate((key) => localStorage.getItem(key), editorKey),
  ).toBeNull();
});
