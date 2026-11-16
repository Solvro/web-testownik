import { expect, test, type Page } from "@playwright/test";

async function setup(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({
        access: "route-fixture",
        refresh: "route-fixture-refresh",
      }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
  });
  let posts = 0;
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "POST") posts++;
    return route.fulfill({
      json: path.endsWith("/user/")
        ? {
            id: "route-recovery-owner",
            account_type: "email",
            full_name: "Route Fixture",
          }
        : path.endsWith("/quizzes/fixture/")
          ? {
              id: "fixture",
              title: "Existing quiz",
              description: "",
              version: 1,
              can_edit: true,
              questions: [
                {
                  id: "11111111-1111-4111-8111-111111111111",
                  text: "Existing question",
                  order: 0,
                  multiple: false,
                  answers: [
                    {
                      id: "22222222-2222-4222-8222-222222222222",
                      text: "Answer",
                      order: 0,
                      is_correct: true,
                    },
                  ],
                },
              ],
            }
          : path.endsWith("/library/")
            ? { path: [], items: [], can_create_folder: true }
            : [],
    });
  });
  return () => posts;
}

test("an explicit empty edit ID does not become a new quiz editor", async ({
  page,
}) => {
  const posts = await setup(page);
  await page.goto("/editor?id=");
  await expect
    .poll(
      async () =>
        (await page
          .getByRole("textbox", { name: "Quiz title", exact: true })
          .isVisible()) ||
        (await page.getByText("Choose a Quiz", { exact: true }).isVisible()),
    )
    .toBe(true);
  await expect(
    page.getByRole("textbox", { name: "Quiz title", exact: true }),
  ).not.toBeVisible();
  await expect(page.getByText("Choose a Quiz", { exact: true })).toBeVisible();
  expect(posts()).toBe(0);
  await page
    .getByRole("button", { name: "Browse Library", exact: true })
    .click();
  await expect(page).toHaveURL(/\/library$/);
});

for (const target of [
  "/report",
  "/report?id=&question=",
  "/report?id=valid-quiz",
])
  test(`missing report target is recoverable before typing: ${target}`, async ({
    page,
  }) => {
    const posts = await setup(page);
    await page.goto(target);
    await expect
      .poll(
        async () =>
          (await page
            .getByRole("button", { name: "Send", exact: true })
            .isVisible()) ||
          (await page.getByText("Choose a Quiz", { exact: true }).isVisible()),
      )
      .toBe(true);
    await expect(
      page.getByRole("button", { name: "Send", exact: true }),
    ).not.toBeVisible();
    await expect(
      page.getByText("Choose a Quiz", { exact: true }),
    ).toBeVisible();
    expect(posts()).toBe(0);
    await page
      .getByRole("button", { name: "Browse Library", exact: true })
      .click();
    await expect(page).toHaveURL(/\/library$/);
  });

for (const target of ["/editor?id=one&id=two", "/editor?question=orphan"])
  test(`invalid edit link cannot create or touch existing drafts: ${target}`, async ({
    page,
  }) => {
    const posts = await setup(page);
    const keys = [
      "testownik.v1.draft.route-recovery-owner.new",
      "testownik.v1.quiz-create.route-recovery-owner.new",
    ];
    await page.addInitScript((keys) => {
      for (const key of keys)
        localStorage.setItem(
          key,
          JSON.stringify({ sentinel: "Keep the existing draft" }),
        );
      const reads: string[] = [];
      (globalThis as unknown as { routeDraftReads: string[] }).routeDraftReads =
        reads;
      const original = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) {
        if (keys.includes(key)) reads.push(key);
        return original.call(this, key);
      };
    }, keys);
    await page.goto(target);
    await expect(
      page.getByText("Choose a Quiz", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Quiz title", exact: true }),
    ).not.toBeVisible();
    expect(posts()).toBe(0);
    expect(
      await page.evaluate(
        () =>
          (globalThis as unknown as { routeDraftReads: string[] })
            .routeDraftReads,
      ),
    ).toEqual([]);
    for (const key of keys)
      expect(
        await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)!),
          key,
        ),
      ).toEqual({ sentinel: "Keep the existing draft" });
  });

for (const suffix of ["", "?question=", "?question=one&question=two"])
  test(`valid edit ID remains usable with optional invalid question: ${suffix}`, async ({
    page,
  }) => {
    const posts = await setup(page);
    await page.goto(`/editor?id=fixture${suffix.replace("?", "&")}`);
    await expect(
      page.getByRole("textbox", { name: "Quiz title", exact: true }),
    ).toHaveValue("Existing quiz");
    expect(posts()).toBe(0);
  });

test("new editor without route IDs still opens normally", async ({ page }) => {
  const posts = await setup(page);
  await page.goto("/editor");
  await expect(
    page.getByRole("textbox", { name: "Quiz title", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Choose a Quiz", { exact: true }),
  ).not.toBeVisible();
  expect(posts()).toBe(0);
});

for (const target of [
  "/report?id=one&id=two&question=question",
  "/report?id=quiz&question=one&question=two",
])
  test(`array report targets cannot enable send: ${target}`, async ({
    page,
  }) => {
    const posts = await setup(page);
    await page.goto(target);
    await expect(
      page.getByText("Choose a Quiz", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send", exact: true }),
    ).not.toBeVisible();
    expect(posts()).toBe(0);
  });

for (const target of ["/editor?id=%20%20", "/editor?question="])
  test(`incomplete edit parameters offer a library recovery: ${target}`, async ({
    page,
  }) => {
    const posts = await setup(page);
    await page.goto(target);
    await expect(
      page.getByText("Choose a Quiz", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Quiz title", exact: true }),
    ).not.toBeVisible();
    expect(posts()).toBe(0);
  });

test("an unknown question in a valid quiz keeps the quiz and shows its existing recovery notice", async ({
  page,
}) => {
  const posts = await setup(page);
  await page.goto("/editor?id=fixture&question=unknown");
  await expect(
    page.getByRole("textbox", { name: "Quiz title", exact: true }),
  ).toHaveValue("Existing quiz");
  await expect(
    page.getByText(
      "This question is no longer in the draft. Choose another question from the list.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(posts()).toBe(0);
});
