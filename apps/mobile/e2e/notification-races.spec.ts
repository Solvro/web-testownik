import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({ access: "inbox-race-fixture", refresh: "fixture" }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
  });
});

test("notification read controls unlock after PATCH while the confirming GET is still pending", async ({
  page,
}) => {
  let read = false;
  let confirmReads = 0;
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes("/notifications")) {
      if (route.request().method() === "PATCH") {
        read = route.request().postDataJSON().is_read;
        return route.fulfill({ json: {} });
      }
      if (read) {
        confirmReads++;
        await gate;
      }
      return route.fulfill({
        json: [
          {
            id: "slow",
            title: "Read-state fixture",
            content: "Fixture notification",
            is_read: read,
          },
        ],
      });
    }
    return route.fulfill({
      json: path.endsWith("/user/")
        ? { id: "inbox-race-fixture", is_guest: false }
        : [],
    });
  });
  await page.goto("/notifications");
  await page.getByRole("button", { name: "Mark as Read", exact: true }).click();
  await expect.poll(() => confirmReads).toBe(1);
  await expect(
    page.getByRole("button", { name: "Mark as Unread", exact: true }),
  ).toBeEnabled();
  finish();
  await expect(page.getByText("All caught up", { exact: true })).toBeVisible();
});

test("opening a notification does not show a read-state failure alert over its destination", async ({
  page,
}) => {
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes("/notifications")) {
      if (route.request().method() === "PATCH") {
        await gate;
        return route.fulfill({ status: 503, json: {} });
      }
      return route.fulfill({
        json: [
          {
            id: "open",
            title: "Open your profile",
            content: "Fixture navigation",
            is_read: false,
            link: "/profile",
          },
        ],
      });
    }
    return route.fulfill({
      json: path.endsWith("/user/")
        ? { id: "inbox-race-fixture", is_guest: false }
        : [],
    });
  });
  await page.goto("/notifications");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  const response = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().includes("/notifications/"),
  );
  finish();
  await response;
  await page.goBack();
  await expect(page.getByText("Unread: 1", { exact: true })).toBeVisible();
  expect(dialogs).toEqual([]);
});

test("a stale refresh during a read write cannot hide its acknowledgement", async ({
  page,
}) => {
  await page.clock.install();
  let reads = 0;
  let acknowledged = false;
  let releaseWrite!: () => void;
  let releaseConfirm!: () => void;
  const writing = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  const confirming = new Promise<void>((resolve) => {
    releaseConfirm = resolve;
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes("/notifications")) {
      if (route.request().method() === "PATCH") {
        await writing;
        acknowledged = true;
        return route.fulfill({ json: {} });
      }
      reads++;
      if (acknowledged) await confirming;
      return route.fulfill({
        json: [
          {
            id: "stale-read",
            title: "An acknowledged read",
            content: "Synthetic notification",
            is_read: acknowledged,
          },
        ],
      });
    }
    return route.fulfill({
      json: path.endsWith("/user/")
        ? { id: "inbox-race-fixture", is_guest: false }
        : [],
    });
  });
  try {
    await page.goto("/notifications");
    await page
      .getByRole("button", { name: "Mark as Read", exact: true })
      .click();
    await expect(
      page.getByText("All caught up", { exact: true }),
    ).toBeVisible();
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
    await expect(page.getByText("Unread: 1", { exact: true })).toBeVisible();
    releaseWrite();
    await expect.poll(() => reads).toBe(3);
    await expect(
      page.getByRole("button", { name: "Mark as Unread", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByText("All caught up", { exact: true }),
    ).toBeVisible();
  } finally {
    releaseWrite();
    releaseConfirm();
  }
});

test("a failed concurrent notification write retains another row's acknowledgement", async ({
  page,
}) => {
  await page.clock.install();
  let reads = 0;
  const writes: string[] = [];
  let releaseFirst!: () => void;
  let releaseSecond!: () => void;
  let releaseConfirm!: () => void;
  const first = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const second = new Promise<void>((resolve) => {
    releaseSecond = resolve;
  });
  const confirm = new Promise<void>((resolve) => {
    releaseConfirm = resolve;
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes("/notifications")) {
      if (route.request().method() === "PATCH") {
        writes.push(path);
        if (path.endsWith("/first/")) {
          await first;
          return route.fulfill({ json: {} });
        }
        await second;
        return route.fulfill({ status: 503, json: {} });
      }
      if (++reads > 2) await confirm;
      return route.fulfill({
        json: ["first", "second"].map((id) => ({
          id,
          title: `Synthetic ${id}`,
          content: "Concurrent read fixture",
          is_read: false,
          link: "javascript:void(0)",
        })),
      });
    }
    return route.fulfill({
      json: path.endsWith("/user/")
        ? { id: "inbox-race-fixture", is_guest: false }
        : [],
    });
  });
  try {
    await page.goto("/notifications");
    // Unsupported links stay in the inbox, while opening still marks each row.
    const open = page.getByRole("button", { name: "Open", exact: true });
    await open.nth(0).click();
    await expect.poll(() => writes.length).toBe(1);
    await open.nth(1).click();
    await expect.poll(() => writes.length).toBe(2);
    const firstAcknowledged = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        response.url().endsWith("/first/"),
    );
    releaseFirst();
    await firstAcknowledged;
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
    await expect(page.getByText("Unread: 2", { exact: true })).toBeVisible();
    releaseSecond();
    await expect.poll(() => reads).toBe(3);
    await expect(
      page.getByRole("button", { name: "Mark as Unread", exact: true }),
    ).toBeEnabled();
    await expect(page.getByText("Unread: 1", { exact: true })).toBeVisible();
  } finally {
    releaseFirst();
    releaseSecond();
    releaseConfirm();
  }
});
