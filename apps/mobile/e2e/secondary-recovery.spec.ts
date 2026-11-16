import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({ access: "secondary-fixture", refresh: "fixture" }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
  });
});

test("failed rating lookup requires recovery before any rating mutation", async ({
  page,
}) => {
  let recovered = false;
  const writes: string[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") {
      writes.push(path);
      return route.fulfill({ status: 503, json: {} });
    }
    if (path.endsWith("/quiz-ratings/me/"))
      return route.fulfill(
        recovered
          ? { json: [{ id: "existing-rating", score: 2 }] }
          : { status: 503, json: {} },
      );
    return route.fulfill({
      json: path.endsWith("/user/")
        ? { id: "secondary-fixture", full_name: "Fixture", is_guest: false }
        : [],
    });
  });
  await page.goto("/community?id=rating-fixture");
  const star = page.getByRole("button", {
    name: "Rate 4 out of 5",
    exact: true,
  });
  const retry = page.getByRole("button", { name: "Try Again", exact: true });
  await expect(retry).toBeVisible();
  await expect(star).toBeDisabled();
  expect(writes).toEqual([]);
  recovered = true;
  await retry.click();
  await expect(star).toBeEnabled();
  await star.click();
  await expect(
    page.getByText("Rating not saved. Tap a star to try again.", {
      exact: true,
    }),
  ).toBeVisible();
  // The previous saved score is restored; selecting it sends no extra write.
  await page
    .getByRole("button", { name: "Rate 2 out of 5", exact: true })
    .click();
  expect(writes).toHaveLength(1);
  await star.click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes).toEqual([
    "/api/quiz-ratings/existing-rating/",
    "/api/quiz-ratings/existing-rating/",
  ]);
});

test("leaving an import cannot redirect another screen after the create succeeds", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writes = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/quizzes/") && route.request().method() === "POST") {
      writes++;
      await gate;
      return route.fulfill({ json: { id: "imported-fixture" } });
    }
    if (path.endsWith("/library/"))
      return route.fulfill({
        json: {
          path: [{ id: "root", name: "Library" }],
          items: [],
          can_create_folder: true,
        },
      });
    return route.fulfill({
      json: path.endsWith("/user/")
        ? { id: "secondary-fixture", is_guest: false }
        : [],
    });
  });
  await page.goto("/library");
  await page
    .getByRole("button", { name: "Add to Library", exact: true })
    .click();
  await page.getByRole("button", { name: "Import Quiz", exact: true }).click();
  await page.getByRole("button", { name: "Paste JSON", exact: true }).click();
  await page.getByRole("textbox", { name: "Quiz JSON", exact: true }).fill(
    JSON.stringify({
      title: "Import recovery",
      questions: [
        { text: "Question", answers: [{ text: "Yes", is_correct: true }] },
      ],
    }),
  );
  await page.getByRole("button", { name: "Preview Quiz", exact: true }).click();
  await page
    .getByRole("button", { name: "Import and Start Studying", exact: true })
    .click();
  await expect.poll(() => writes).toBe(1);
  await page.goBack();
  await expect(page).toHaveURL(/\/library$/);
  release();
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/library$/);
  expect(writes).toBe(1);
});

test("a background rating failure keeps the known rating editable", async ({
  page,
}) => {
  await page.clock.install();
  let reads = 0;
  const writes: string[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/quiz-ratings/me/")) {
      reads++;
      return route.fulfill(
        reads === 1
          ? { json: [{ id: "known-rating", score: 2 }] }
          : { status: 503, json: {} },
      );
    }
    if (route.request().method() === "PATCH") {
      writes.push(path);
      return route.fulfill({ json: { id: "known-rating", score: 4 } });
    }
    return route.fulfill({
      json: path.endsWith("/user/")
        ? { id: "secondary-fixture", is_guest: false }
        : [],
    });
  });
  await page.goto("/community?id=rating-fixture");
  const star = page.getByRole("button", {
    name: "Rate 4 out of 5",
    exact: true,
  });
  await expect(star).toBeEnabled();
  await page.clock.setSystemTime(await page.evaluate(() => Date.now() + 31000));
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    window.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    window.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => reads).toBeGreaterThan(1);
  await page.clock.runFor(2000);
  await expect(
    page.getByRole("button", { name: "Try Again", exact: true }),
  ).toBeVisible();
  await expect(star).toBeEnabled();
  await star.click();
  await expect(
    page.getByText("Your rating: 4/5", { exact: true }),
  ).toBeVisible();
  expect(writes).toEqual(["/api/quiz-ratings/known-rating/"]);
});

test("a rating refetch started during save cannot replace the acknowledged score", async ({
  page,
}) => {
  await page.clock.install();
  let reads = 0;
  let writes = 0;
  let releaseWrite!: () => void;
  let releaseRead!: () => void;
  const writing = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  const reading = new Promise<void>((resolve) => {
    releaseRead = resolve;
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/quiz-ratings/me/")) {
      if (++reads > 1) await reading;
      return route.fulfill({ json: [{ id: "known-rating", score: 2 }] });
    }
    if (route.request().method() === "PATCH") {
      writes++;
      await writing;
      return route.fulfill({ json: { id: "known-rating", score: 4 } });
    }
    return route.fulfill({
      json: path.endsWith("/user/")
        ? { id: "secondary-fixture", is_guest: false }
        : [],
    });
  });
  try {
    await page.goto("/community?id=rating-fixture");
    const star = page.getByRole("button", {
      name: "Rate 4 out of 5",
      exact: true,
    });
    await expect(star).toBeEnabled();
    await star.click();
    await expect.poll(() => writes).toBe(1);
    await page.clock.setSystemTime(
      await page.evaluate(() => Date.now() + 31000),
    );
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      window.dispatchEvent(new Event("visibilitychange"));
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      window.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(() => reads).toBe(2);
    releaseWrite();
    await expect(star).toBeEnabled();
    releaseRead();
    await page.clock.runFor(1000);
    await expect(
      page.getByText("Your rating: 4/5", { exact: true }),
    ).toBeVisible();
    await star.click();
    expect(writes).toBe(1);
  } finally {
    releaseRead();
    releaseWrite();
  }
});

test("a pending move locks folder navigation until the server acknowledges it", async ({
  page,
}) => {
  let release!: () => void;
  let writes = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/move/")) {
      writes++;
      await gate;
      return route.fulfill({ json: {} });
    }
    if (path.includes("/library/"))
      return route.fulfill({
        json: {
          path: [
            { id: "root", name: "Library" },
            { id: "target", name: "Target" },
          ],
          can_create_folder: true,
          items: [
            {
              id: "child",
              name: "Child Folder",
              type: "folder",
              folder_type: "regular",
              can_edit: true,
            },
          ],
        },
      });
    return route.fulfill({
      json: path.endsWith("/user/")
        ? { id: "secondary-fixture", is_guest: false }
        : [],
    });
  });
  try {
    await page.goto(
      "/organize?action=move&id=source&type=quiz&name=Fixture&parent=other",
    );
    await page
      .getByRole("button", { name: "Child Folder", exact: true })
      .click();
    await page.getByRole("button", { name: "Move Here", exact: true }).click();
    await expect.poll(() => writes).toBe(1);
    for (const name of ["Parent Folder", "New Folder", "Child Folder"]) {
      await expect(
        page.getByRole("button", { name, exact: true }),
      ).toBeDisabled();
    }
    release();
    await expect(page).not.toHaveURL(/\/organize/);
  } finally {
    release();
  }
});

test("acknowledged folder creation exits without waiting for a hanging library refresh", async ({
  page,
}) => {
  let saved = false;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/folders/") && route.request().method() === "POST") {
      saved = true;
      return route.fulfill({ json: { id: "new-folder" } });
    }
    if (path.endsWith("/library/")) {
      if (saved) await gate;
      return route.fulfill({
        json: {
          path: [{ id: "root", name: "Library" }],
          items: [],
          can_create_folder: true,
        },
      });
    }
    return route.fulfill({
      json: path.endsWith("/user/")
        ? { id: "secondary-fixture", is_guest: false }
        : [],
    });
  });
  try {
    await page.goto("/library");
    await page
      .getByRole("button", { name: "Add to Library", exact: true })
      .click();
    await page.getByRole("button", { name: "New Folder", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Folder name", exact: true })
      .fill("Saved fixture");
    await page
      .getByRole("button", { name: "Create Folder", exact: true })
      .click();
    await expect(page).toHaveURL(/\/library$/, { timeout: 2000 });
  } finally {
    release();
  }
});
