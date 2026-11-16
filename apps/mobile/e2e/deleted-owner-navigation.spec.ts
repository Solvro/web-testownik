import { expect, test } from "@playwright/test";

for (const leaveDuringPost of [false, true]) {
  test(`confirmed deletion blocks protected navigation after ${leaveDuringPost ? "leaving during POST" : "device cleanup fails"}`, async ({
    page,
  }) => {
    const owner = "deleted-navigation-fixture";
    const draftKey = `testownik.v1.draft.${owner}.new`;
    await page.addInitScript(
      ({ owner, draftKey }) => {
        sessionStorage.setItem(
          "testownik.oauth-session.v2",
          JSON.stringify({ access: owner, refresh: "fixture" }),
        );
        localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
        localStorage.setItem(
          draftKey,
          JSON.stringify({ title: "Preserved until cleanup" }),
        );
        const remove = Storage.prototype.removeItem;
        let fail = true;
        Storage.prototype.removeItem = function (key) {
          if (key === draftKey && fail) {
            fail = false;
            throw new Error("Synthetic owner cleanup failed once");
          }
          return remove.call(this, key);
        };
      },
      { owner, draftKey },
    );
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let posts = 0;
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/account/deletion/")) {
        if (route.request().method() === "POST") {
          posts++;
          await gate;
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
          ? { id: owner, full_name: "Synthetic Student", is_guest: false }
          : [],
      });
    });
    await page.goto("/delete-account");
    page.on("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Delete Account", exact: true })
      .click();
    await expect.poll(() => posts).toBe(1);
    if (leaveDuringPost) {
      await page.evaluate(() => {
        history.pushState({}, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      await expect(
        page.getByRole("button", { name: "New Quiz", exact: true }),
      ).toBeVisible();
    }
    release();
    await expect(
      page.getByText("Your account has been deleted.", { exact: false }),
    ).toBeVisible();
    // Even browser navigation outside React Navigation cannot reopen deleted
    // owner content after the server's acknowledgement.
    await page.evaluate(() => {
      history.pushState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(
      page.getByRole("button", { name: "New Quiz", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("tab")).toHaveCount(0);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), draftKey),
    ).not.toBeNull();
    await page
      .getByRole("button", { name: "Clear Device Data", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Sign in to Testownik", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate((key) => localStorage.getItem(key), draftKey),
    ).toBeNull();
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("testownik.oauth-session.v2"),
      ),
    ).toBeNull();
    expect(posts).toBe(1);
  });
}

test("identified deleted owner clears credentials after an orphan cleanup first fails", async ({
  page,
}) => {
  const owner = "deleted-orphan-owner";
  await page.addInitScript((owner) => {
    if (!localStorage.getItem("qa.orphan-seeded")) {
      localStorage.setItem("qa.orphan-seeded", "true");
      localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
      localStorage.setItem(`testownik.v1.account-deletion.${owner}`, "true");
      localStorage.setItem(
        `testownik.v1.draft.${owner}.new`,
        JSON.stringify({ title: "Deleted owner's draft" }),
      );
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: owner, refresh: "fixture" }),
      );
    }
    const remove = Storage.prototype.removeItem;
    let fail = true;
    Storage.prototype.removeItem = function (key) {
      if (key === `testownik.v1.draft.${owner}.new` && fail) {
        fail = false;
        throw new Error("Synthetic first orphan cleanup failure");
      }
      return remove.call(this, key);
    };
  }, owner);
  await page.route("**/api/**", (route) =>
    route.fulfill({
      json: new URL(route.request().url()).pathname.endsWith("/user/")
        ? { id: owner, is_guest: false }
        : [],
    }),
  );
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(
        (owner) =>
          localStorage.getItem(`testownik.v1.account-deletion.${owner}`),
        owner,
      ),
    )
    .toBeNull();
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("testownik.oauth-session.v2"),
    ),
  ).toBeNull();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Sign in to Testownik", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
});

test("signed-out cleanup failure can return to sign-in without completing the deletion marker", async ({
  page,
}) => {
  const owner = "deleted-signedout-owner";
  await page.addInitScript((owner) => {
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
    localStorage.setItem(`testownik.v1.account-deletion.${owner}`, "true");
    localStorage.setItem(
      `testownik.v1.draft.${owner}.new`,
      JSON.stringify({ title: "Retain until cleanup succeeds" }),
    );
    const remove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      if (key === `testownik.v1.draft.${owner}.new`)
        throw new Error("Synthetic persistent device failure");
      return remove.call(this, key);
    };
  }, owner);
  let requests = 0;
  await page.route("**/api/**", (route) => {
    requests++;
    return route.fulfill({ status: 403, json: {} });
  });
  await page.goto("/");
  await expect(
    page.getByText("Synthetic persistent device failure", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Return to Sign In", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sign in to Testownik", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      (owner) => localStorage.getItem(`testownik.v1.account-deletion.${owner}`),
      owner,
    ),
  ).toBe("true");
  expect(
    await page.evaluate(
      (owner) => localStorage.getItem(`testownik.v1.draft.${owner}.new`),
      owner,
    ),
  ).not.toBeNull();
  await expect(page.getByRole("tab")).toHaveCount(0);
  expect(requests).toBe(0);
});
