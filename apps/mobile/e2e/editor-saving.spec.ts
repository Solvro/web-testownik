import { test, expect } from "@playwright/test";
const quizId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const draft = {
  title: "Delayed save fixture",
  description: "",
  questions: [
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      order: 1,
      text: "Original question",
      multiple: false,
      answers: [
        {
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          order: 1,
          text: "Yes",
          is_correct: true,
        },
        {
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          order: 2,
          text: "No",
          is_correct: false,
        },
      ],
    },
  ],
};

test("a delayed save locks edits and does not navigate or erase a newer draft after leaving", async ({
  page,
}) => {
  await page.addInitScript((draft) => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({
        access: "editor-saving-fixture",
        refresh: "editor-saving-refresh",
      }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
    localStorage.setItem(
      "testownik.v1.draft.editor-saving-fixture.new",
      JSON.stringify(draft),
    );
  }, draft);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let submitted: unknown;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/quizzes/") && route.request().method() === "POST") {
      submitted = route.request().postDataJSON();
      await gate;
      await route.fulfill({ json: { ...draft, id: quizId } });
      return;
    }
    await route.fulfill({
      json: path.endsWith("/user/")
        ? { id: "editor-saving-fixture", is_guest: false }
        : path.endsWith("/library/")
          ? {
              path: [{ id: "root", name: "Library" }],
              can_create_folder: true,
              items: [],
            }
          : [],
    });
  });
  await page.goto("/library");
  await page
    .getByRole("button", { name: "Add to Library", exact: true })
    .click();
  await page.getByRole("button", { name: "New Quiz", exact: true }).click();
  const title = page.getByRole("textbox", { name: "Quiz title", exact: true });
  await expect(title).toHaveValue(draft.title);
  await page.getByRole("button", { name: "Save Quiz", exact: true }).click();
  await expect.poll(() => submitted).toBeTruthy();
  await expect(title).not.toBeEditable();
  await expect(
    page.getByRole("textbox", { name: "Answer 1", exact: true }),
  ).not.toBeEditable();
  await expect(
    page.getByRole("button", { name: "Add Question", exact: true }),
  ).toBeDisabled();
  await page.getByRole("link", { name: /back/i }).click();
  await expect(page).toHaveURL(/\/library$/);
  const newer = { ...draft, title: "Newer local work" };
  await page.evaluate(
    (value) =>
      localStorage.setItem(
        "testownik.v1.draft.editor-saving-fixture.new",
        JSON.stringify(value),
      ),
    newer,
  );
  const response = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      new URL(r.url()).pathname.endsWith("/quizzes/"),
  );
  release();
  await (await response).finished();
  // Let the settled fetch continuation and React navigation commit run before asserting no late redirect.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page).toHaveURL(/\/library$/);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem(
            "testownik.v1.draft.editor-saving-fixture.new",
          ) ?? "null",
        ).title,
    ),
  ).toBe("Newer local work");
  expect(submitted).toMatchObject({ title: draft.title });
});
