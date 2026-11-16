import { expect, test, type Page } from "@playwright/test";

const root = {
  path: [{ id: "root", name: "Library" }],
  can_create_folder: true,
  items: [
    {
      id: "blocked",
      name: "Selected Folder",
      type: "folder",
      folder_type: "regular",
      can_edit: true,
    },
    {
      id: "sibling",
      name: "Another Folder",
      type: "folder",
      folder_type: "regular",
      can_edit: true,
    },
  ],
};
function destination(id: string) {
  return {
    path: [
      ...root.path,
      { id, name: id === "blocked" ? "Selected Folder" : "Another Folder" },
    ],
    items: [],
    can_create_folder: true,
  };
}

async function fixture(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({
        access: "organize-destination-fixture",
        refresh: "fixture",
      }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
    let online = true;
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => online,
    });
    for (const name of ["connection", "mozConnection", "webkitConnection"])
      Object.defineProperty(navigator, name, {
        configurable: true,
        value: undefined,
      });
    (window as unknown as { qaOnline: (value: boolean) => void }).qaOnline = (
      value,
    ) => {
      online = value;
      window.dispatchEvent(new Event(value ? "online" : "offline"));
    };
  });
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json: path.endsWith("/user/")
        ? { id: "organize-destination-fixture", is_guest: false }
        : path.endsWith("/library/") || path.endsWith("/library/root/")
          ? root
          : path.endsWith("/library/sibling/")
            ? destination("sibling")
            : [],
    });
  });
}
const url =
  "/organize?action=move&id=source&type=quiz&name=Synthetic&parent=source-parent";
const move = (page: Page) =>
  page.getByRole("button", { name: "Move Here", exact: true });
const parent = (page: Page) =>
  page.getByRole("button", { name: "Parent Folder", exact: true });
const retry = (page: Page) =>
  page.getByRole("button", { name: "Try Again", exact: true });

// No server writes are permitted by any of these recovery proofs.
for (const status of [403, 404, 503]) {
  test(`${status}: failed child destination can return to its parent and choose a sibling without reopening`, async ({
    page,
  }) => {
    await fixture(page);
    const writes: string[] = [];
    await page.route("**/api/library/blocked/", (route) =>
      route.fulfill({ status, json: {} }),
    );
    await page.route("**/api/**/move/", (route) => {
      writes.push(route.request().url());
      return route.fulfill({ status: 503, json: {} });
    });
    await page.goto(url);
    await page
      .getByRole("button", { name: "Selected Folder", exact: true })
      .click();
    await expect(retry(page)).toBeVisible();
    await expect(move(page)).toBeDisabled();
    await expect(parent(page)).toBeVisible();
    await parent(page).click();
    await page
      .getByRole("button", { name: "Another Folder", exact: true })
      .click();
    await expect(move(page)).toBeEnabled();
    await expect(page).toHaveURL(/\/organize\?/);
    expect(writes).toEqual([]);
  });
}

for (const status of [403, 404]) {
  test(`${status}: cached destination permission loss disables Move and retains a way back`, async ({
    page,
  }) => {
    await page.clock.install();
    await fixture(page);
    let fail = false;
    let reads = 0;
    await page.route("**/api/library/blocked/", (route) => {
      reads++;
      return fail
        ? route.fulfill({
            status,
            json: { detail: "Destination access revoked." },
          })
        : route.fulfill({ json: destination("blocked") });
    });
    await page.goto(url);
    await page
      .getByRole("button", { name: "Selected Folder", exact: true })
      .click();
    await expect(move(page)).toBeEnabled();
    fail = true;
    await page.evaluate(() =>
      (window as unknown as { qaOnline: (value: boolean) => void }).qaOnline(
        false,
      ),
    );
    await page.clock.fastForward(31_000);
    await page.evaluate(() =>
      (window as unknown as { qaOnline: (value: boolean) => void }).qaOnline(
        true,
      ),
    );
    await expect.poll(() => reads).toBeGreaterThan(1);
    await expect(retry(page)).toBeVisible();
    await expect(move(page)).toBeDisabled();
    await expect(parent(page)).toBeVisible();
    await parent(page).click();
    await expect(
      page.getByRole("button", { name: "Another Folder", exact: true }),
    ).toBeVisible();
  });
}

test("retrying a failed destination keeps that selection and restores movement readiness", async ({
  page,
}) => {
  await fixture(page);
  let fail = true;
  const requested: string[] = [];
  await page.route("**/api/library/blocked/", (route) => {
    requested.push(new URL(route.request().url()).pathname);
    return fail
      ? route.fulfill({ status: 503, json: {} })
      : route.fulfill({ json: destination("blocked") });
  });
  await page.goto(url);
  await page
    .getByRole("button", { name: "Selected Folder", exact: true })
    .click();
  await expect(retry(page)).toBeVisible();
  await expect(move(page)).toBeDisabled();
  fail = false;
  await retry(page).click();
  await expect(retry(page)).not.toBeVisible();
  await expect(move(page)).toBeEnabled();
  await expect(parent(page)).toBeVisible();
  await expect(
    page.getByText("Library / Selected Folder", { exact: true }),
  ).toBeVisible();
  expect(requested.length).toBeGreaterThan(1);
  expect(new Set(requested)).toEqual(new Set(["/api/library/blocked/"]));
});

test("a hanging child destination can return to its parent and ignores the late old reply", async ({
  page,
}) => {
  await fixture(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested = false;
  let oldReplyAttempted = false;
  await page.route("**/api/library/blocked/", async (route) => {
    requested = true;
    await gate;
    oldReplyAttempted = true;
    await route.fulfill({ json: destination("blocked") });
  });
  try {
    await page.goto(url);
    await page
      .getByRole("button", { name: "Selected Folder", exact: true })
      .click();
    await expect.poll(() => requested).toBe(true);
    await expect(move(page)).toBeDisabled();
    await expect(parent(page)).toBeVisible();
    await parent(page).click();
    await page
      .getByRole("button", { name: "Another Folder", exact: true })
      .click();
    await expect(move(page)).toBeEnabled();
    const chosen = page.getByText("Library / Another Folder", { exact: true });
    await expect(chosen).toBeVisible();
    release();
    await expect.poll(() => oldReplyAttempted).toBe(true);
    await expect(chosen).toBeVisible();
    await expect(move(page)).toBeEnabled();
    await expect(
      page.getByText("Library / Selected Folder", { exact: true }),
    ).not.toBeVisible();
  } finally {
    release();
  }
});
