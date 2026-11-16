import { expect, test, type BrowserContext } from "@playwright/test";

const owner = "profile-context-A";
const draft = `testownik.v1.draft.${owner}.new`;
const profile = "testownik.v1.last-user";
const token = "testownik.oauth-session.v2";
async function fixture(context: BrowserContext) {
  await context.addInitScript(
    ({ owner, draft, profile, token }) => {
      if (!sessionStorage.getItem(token))
        sessionStorage.setItem(
          token,
          JSON.stringify({ access: owner, refresh: "fixture-A" }),
        );
      if (!localStorage.getItem("qa.profile-context.seeded")) {
        localStorage.setItem("qa.profile-context.seeded", "true");
        localStorage.setItem("testownik.v1.language", '"en"');
        localStorage.setItem(
          profile,
          JSON.stringify({
            id: owner,
            is_guest: false,
            full_name: "Disposable A",
          }),
        );
        localStorage.setItem(
          draft,
          JSON.stringify({
            schemaVersion: 1,
            title: "A private editor title",
            description: "",
            questions: [
              {
                id: "question-A",
                order: 0,
                text: "A private question",
                multiple: false,
                answers: [
                  {
                    id: "answer-A",
                    order: 0,
                    text: "A private answer",
                    is_correct: true,
                  },
                ],
              },
            ],
          }),
        );
      }
    },
    { owner, draft, profile, token },
  );
  let failA = false,
    bRequests = 0;
  await context.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/oauth/token/"))
      return route.fulfill({
        json: {
          access_token: "profile-context-B",
          refresh_token: "fixture-B",
          token_type: "Bearer",
        },
      });
    if (path.endsWith("/user/")) {
      if (
        route.request().headers().authorization?.includes("profile-context-B")
      ) {
        bRequests++;
        return route.fulfill({
          status: 503,
          json: { detail: "Synthetic unavailable profile transport" },
        });
      }
      return failA
        ? route.fulfill({
            status: 503,
            json: { detail: "Synthetic A unavailable transport" },
          })
        : route.fulfill({
            json: { id: owner, is_guest: false, full_name: "Disposable A" },
          });
    }
    return route.fulfill({ json: [] });
  });
  return {
    failA: () => {
      failA = true;
    },
    bRequests: () => bRequests,
  };
}

test("fresh B credentials cannot hydrate A private editor from the legacy shared cached profile", async ({
  context,
  page,
}) => {
  const f = await fixture(context);
  await page.goto("/editor");
  await expect(
    page.getByRole("textbox", { name: "Quiz title", exact: true }),
  ).toHaveValue("A private editor title");
  const before = await page.evaluate(
    (draft) => localStorage.getItem(draft),
    draft,
  );
  const b = await context.newPage();
  await b.addInitScript(
    (token) =>
      sessionStorage.setItem(
        token,
        JSON.stringify({ access: "profile-context-B", refresh: "fixture-B" }),
      ),
    token,
  );
  await b.goto("/editor");
  await expect(
    b.getByText("Couldn’t Open Testownik", { exact: true }),
  ).toBeVisible();
  expect(f.bRequests()).toBe(1);
  await expect(
    b.getByRole("textbox", { name: "Quiz title", exact: true }),
  ).toHaveCount(0);
  expect(await b.evaluate((draft) => localStorage.getItem(draft), draft)).toBe(
    before,
  );
  expect(
    await b.evaluate((profile) => sessionStorage.getItem(profile), profile),
  ).toBeNull();
  await expect(
    page.getByRole("textbox", { name: "Quiz title", exact: true }),
  ).toHaveValue("A private editor title");
});

test("a validated same-tab A profile survives reload and unavailable profile transport", async ({
  context,
  page,
}) => {
  const f = await fixture(context);
  await page.goto("/editor");
  await expect(
    page.getByRole("textbox", { name: "Quiz title", exact: true }),
  ).toHaveValue("A private editor title");
  await expect
    .poll(() =>
      page.evaluate(
        (profile) => JSON.parse(sessionStorage.getItem(profile) ?? "null")?.id,
        profile,
      ),
    )
    .toBe(owner);
  f.failA();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Quiz title", exact: true }),
  ).toHaveValue("A private editor title");
  await expect(
    page.getByText("Couldn’t Open Testownik", { exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      (profile) => JSON.parse(sessionStorage.getItem(profile) ?? "null")?.id,
      profile,
    ),
  ).toBe(owner);
});

test("a real OAuth account change clears A tab profile before unavailable B startup", async ({
  context,
  page,
}) => {
  const f = await fixture(context);
  await page.goto("/editor");
  await expect(
    page.getByRole("textbox", { name: "Quiz title", exact: true }),
  ).toHaveValue("A private editor title");
  await expect
    .poll(() =>
      page.evaluate(
        (profile) => JSON.parse(sessionStorage.getItem(profile) ?? "null")?.id,
        profile,
      ),
    )
    .toBe(owner);
  const before = await page.evaluate(
    (draft) => localStorage.getItem(draft),
    draft,
  );
  await page.evaluate(() =>
    sessionStorage.setItem(
      "testownik.oauth.v1",
      JSON.stringify({ state: "fixture-B", verifier: "fixture-verifier-B" }),
    ),
  );
  await page.goto("/auth?code=fixture-B&state=fixture-B");
  await expect(
    page.getByText("Couldn’t Open Testownik", { exact: true }),
  ).toBeVisible();
  expect(f.bRequests()).toBe(1);
  expect(
    await page.evaluate((profile) => sessionStorage.getItem(profile), profile),
  ).toBeNull();
  expect(
    await page.evaluate(
      (token) => JSON.parse(sessionStorage.getItem(token) ?? "null")?.access,
      token,
    ),
  ).toBe("profile-context-B");
  await expect(
    page.getByRole("textbox", { name: "Quiz title", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate((draft) => localStorage.getItem(draft), draft),
  ).toBe(before);
});
