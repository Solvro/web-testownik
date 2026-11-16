import { expect, test } from "@playwright/test";

test("leaving a pending folder save does not pop the underlying library on late success", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({ access: "organize-fixture", refresh: "fixture" }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let saved = false;
  let writes = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/folders/") && route.request().method() === "POST") {
      writes++;
      await gate;
      saved = true;
      return route.fulfill({ json: { id: "new-folder" } });
    }
    if (path.endsWith("/library/"))
      return route.fulfill({
        json: {
          path: [{ id: "library-root", name: "My quizzes" }],
          items: saved
            ? [
                {
                  id: "new-folder",
                  name: "Folder fixture",
                  type: "folder",
                  folder_type: "regular",
                  can_edit: true,
                },
              ]
            : [],
          can_create_folder: true,
        },
      });
    return route.fulfill({
      json: path.endsWith("/user/")
        ? { id: "organize-fixture", full_name: "Fixture", is_guest: false }
        : [],
    });
  });
  await page.goto("/library");
  await page
    .getByRole("button", { name: "Add to Library", exact: true })
    .click();
  await page.getByRole("button", { name: "New Folder", exact: true }).click();
  const field = page.getByRole("textbox", { name: "Folder name", exact: true });
  await field.fill("Folder fixture");
  const save = page.getByRole("button", { name: "Create Folder", exact: true });
  await save.click();
  await expect.poll(() => writes).toBe(1);
  await expect(save).toBeDisabled();
  await page.goBack();
  // Browser history changes sit outside native remove prevention. A late
  // server response must still keep the screen the user navigated back to.
  await expect(page).toHaveURL(/\/library$/);
  release();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByText("Folder fixture", { exact: true })).toBeVisible();
  expect(writes).toBe(1);
});
