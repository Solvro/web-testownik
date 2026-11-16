import { expect, test, type Page } from "@playwright/test";

const sessionKey = "testownik.oauth-session.v2";

test("a consumed duplicate callback preserves an existing account and returns to the app", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        access: "synthetic-existing-account",
        refresh: "synthetic-existing-refresh",
      }),
    );
    localStorage.setItem("testownik.v1.language", '"en"');
  }, sessionKey);
  let tokenRequests = 0;
  let profileRequests = 0;
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/oauth/token/")) {
      tokenRequests += 1;
      return route.abort();
    }
    if (path.endsWith("/user/")) {
      profileRequests += 1;
      return route.fulfill({
        json: {
          id: "synthetic-existing-account",
          full_name: "Disposable Existing QA",
          is_guest: false,
        },
      });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto(
    "/auth?code=already-consumed-code&state=already-consumed-state",
  );
  await expect.poll(() => profileRequests).toBeGreaterThan(0);
  expect(tokenRequests).toBe(0);
  expect(
    await page.evaluate(
      (key) => JSON.parse(sessionStorage.getItem(key) ?? "null"),
      sessionKey,
    ),
  ).toEqual({
    access: "synthetic-existing-account",
    refresh: "synthetic-existing-refresh",
  });
  await expect(page).not.toHaveURL(/\/auth(?:\?|$)/);
  await expect(
    page.getByRole("tab", { name: "Library", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Couldn’t Sign In", { exact: true })).toHaveCount(
    0,
  );
});

const flowKey = "testownik.oauth.v1";
const existingTokens = {
  access: "synthetic-existing-account",
  refresh: "synthetic-existing-refresh",
};
const newerFlow = { state: "newer-flow", verifier: "newer-verifier" };

async function callbackFixture(
  page: Page,
  options: {
    signedIn: boolean;
    flow?: typeof newerFlow;
  },
) {
  await page.addInitScript(
    ({ options, sessionKey, flowKey, existingTokens }) => {
      localStorage.setItem("testownik.v1.language", '"en"');
      if (options.signedIn)
        sessionStorage.setItem(sessionKey, JSON.stringify(existingTokens));
      if (options.flow)
        sessionStorage.setItem(flowKey, JSON.stringify(options.flow));
    },
    { options, sessionKey, flowKey, existingTokens },
  );
  let tokenRequests = 0;
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/oauth/token/")) {
      tokenRequests++;
      return route.fulfill({
        status: 503,
        json: { detail: "Synthetic token service unavailable" },
      });
    }
    if (path.endsWith("/user/"))
      return route.fulfill({
        json: {
          id: "synthetic-existing-account",
          full_name: "Disposable Existing QA",
          is_guest: false,
        },
      });
    return route.fulfill({ json: [] });
  });
  return { tokenRequests: () => tokenRequests };
}

test("a stale callback preserves the newer owned PKCE flow and established account", async ({
  page,
}) => {
  const f = await callbackFixture(page, { signedIn: true, flow: newerFlow });
  await page.goto("/auth?code=old-code&state=old-state");
  await expect(page).not.toHaveURL(/\/auth(?:\?|$)/);
  await expect(
    page.getByRole("tab", { name: "Library", exact: true }),
  ).toBeVisible();
  expect(f.tokenRequests()).toBe(0);
  expect(
    await page.evaluate(
      (key) => JSON.parse(sessionStorage.getItem(key) ?? "null"),
      flowKey,
    ),
  ).toEqual(newerFlow);
  expect(
    await page.evaluate(
      (key) => JSON.parse(sessionStorage.getItem(key) ?? "null"),
      sessionKey,
    ),
  ).toEqual(existingTokens);
});

test("a signed-out stale callback keeps its sign-in recovery and never exchanges credentials", async ({
  page,
}) => {
  const f = await callbackFixture(page, { signedIn: false });
  await page.goto("/auth?code=old-code&state=old-state");
  await expect(
    page.getByText("Couldn’t Sign In", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "This sign-in session is no longer valid. Please start again.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Back to Sign In", exact: true }),
  ).toBeVisible();
  expect(f.tokenRequests()).toBe(0);
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), sessionKey),
  ).toBeNull();
});

test("an explicit OAuth cancellation still shows recovery for an existing account and preserves newer PKCE", async ({
  page,
}) => {
  const f = await callbackFixture(page, { signedIn: true, flow: newerFlow });
  await page.goto("/auth?error=access_denied");
  await expect(
    page.getByText("Couldn’t Sign In", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Sign-in was cancelled.", { exact: true }),
  ).toBeVisible();
  expect(f.tokenRequests()).toBe(0);
  expect(
    await page.evaluate(
      (key) => JSON.parse(sessionStorage.getItem(key) ?? "null"),
      flowKey,
    ),
  ).toEqual(newerFlow);
  expect(
    await page.evaluate(
      (key) => JSON.parse(sessionStorage.getItem(key) ?? "null"),
      sessionKey,
    ),
  ).toEqual(existingTokens);
});

test("a matching fresh flow token failure stays visible and retains the existing account and PKCE", async ({
  page,
}) => {
  const f = await callbackFixture(page, { signedIn: true, flow: newerFlow });
  await page.goto("/auth?code=new-code&state=newer-flow");
  await expect(
    page.getByText("Couldn’t Sign In", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Synthetic token service unavailable", { exact: true }),
  ).toBeVisible();
  expect(f.tokenRequests()).toBe(1);
  expect(
    await page.evaluate(
      (key) => JSON.parse(sessionStorage.getItem(key) ?? "null"),
      flowKey,
    ),
  ).toEqual(newerFlow);
  expect(
    await page.evaluate(
      (key) => JSON.parse(sessionStorage.getItem(key) ?? "null"),
      sessionKey,
    ),
  ).toEqual(existingTokens);
});

for (const profileStatus of [200, 503]) {
  test(`a duplicate after token redemption follows delayed profile ${profileStatus} startup`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ flowKey, newerFlow }) => {
        localStorage.setItem("testownik.v1.language", '"en"');
        if (!sessionStorage.getItem("qa.callback.seeded")) {
          sessionStorage.setItem("qa.callback.seeded", "true");
          sessionStorage.setItem(flowKey, JSON.stringify(newerFlow));
        }
      },
      { flowKey, newerFlow },
    );
    let tokenRequests = 0,
      profileRequests = 0;
    let release!: () => void;
    const delayedProfile = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/oauth/token/")) {
        tokenRequests++;
        return route.fulfill({
          json: {
            access_token: "synthetic-redeemed-account",
            refresh_token: "synthetic-redeemed-refresh",
            token_type: "Bearer",
          },
        });
      }
      if (path.endsWith("/user/")) {
        profileRequests++;
        await delayedProfile;
        return route.fulfill({
          status: profileStatus,
          json:
            profileStatus === 200
              ? {
                  id: "synthetic-redeemed-account",
                  full_name: "Disposable Redeemed QA",
                  is_guest: false,
                }
              : { detail: "Synthetic profile unavailable" },
        });
      }
      return route.fulfill({ json: [] });
    });
    try {
      await page.goto("/auth?code=redeemed-code&state=newer-flow");
      await expect.poll(() => profileRequests).toBe(1);
      expect(
        await page.evaluate((key) => sessionStorage.getItem(key), flowKey),
      ).toBeNull();
      // A second callback after redemption starts with stored tokens but no PKCE.
      await page.goto("/auth?code=redeemed-code&state=newer-flow");
      await expect.poll(() => profileRequests).toBe(2);
      await expect(
        page.getByText("Couldn’t Sign In", { exact: true }),
      ).toHaveCount(0);
      expect(tokenRequests).toBe(1);
      release();
      if (profileStatus === 200) {
        await expect(page).not.toHaveURL(/\/auth(?:\?|$)/);
        await expect(
          page.getByRole("tab", { name: "Library", exact: true }),
        ).toBeVisible();
      } else {
        await expect(
          page.getByText("Couldn’t Open Testownik", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Try Again", exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText("Couldn’t Sign In", { exact: true }),
        ).toHaveCount(0);
      }
      expect(tokenRequests).toBe(1);
      expect(
        await page.evaluate(
          (key) => JSON.parse(sessionStorage.getItem(key) ?? "null"),
          sessionKey,
        ),
      ).toEqual({
        access: "synthetic-redeemed-account",
        refresh: "synthetic-redeemed-refresh",
      });
    } finally {
      release();
    }
  });
}
