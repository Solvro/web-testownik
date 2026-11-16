import { expect, test } from "@playwright/test";

for (const action of ["create", "rename"] as const) {
  test(`pending ${action} preserves the submitted folder name by locking its field`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "organize-form-fixture", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
    });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const submitted: unknown[] = [];
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (
        (action === "create" &&
          path.endsWith("/folders/") &&
          request.method() === "POST") ||
        (action === "rename" &&
          path.endsWith("/folders/owned-folder/") &&
          request.method() === "PATCH")
      ) {
        submitted.push(request.postDataJSON());
        await gate;
        return route.fulfill({ json: { id: "owned-folder" } });
      }
      return route.fulfill({
        json: path.endsWith("/user/")
          ? { id: "organize-form-fixture", is_guest: false }
          : [],
      });
    });
    try {
      await page.goto(
        `/organize?action=${action}&id=owned-folder&name=Original`,
      );
      const field = page.getByRole("textbox", {
        name: "Folder name",
        exact: true,
      });
      await field.fill("Submitted Name");
      await page
        .getByRole("button", {
          name: action === "create" ? "Create Folder" : "Save Name",
          exact: true,
        })
        .click();
      await expect.poll(() => submitted.length).toBe(1);
      await expect(field).not.toBeEditable();
      expect(submitted).toEqual([{ name: "Submitted Name" }]);
      release();
      await expect(page).not.toHaveURL(/\/organize/);
      expect(submitted).toHaveLength(1);
    } finally {
      release();
    }
  });
}
