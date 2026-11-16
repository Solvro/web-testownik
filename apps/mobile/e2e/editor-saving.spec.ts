import { quizCreateResponse } from "./quiz-create-response";
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

for (const preserveNewer of [true, false])
  test(`a delayed save locks edits and ${preserveNewer ? "preserves newer work" : "clears its unchanged committed draft"} after leaving`, async ({
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
    let posts = 0;
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/quizzes/") && route.request().method() === "POST") {
        posts++;
        submitted =
          route.request().postDataJSON().quiz ?? route.request().postDataJSON();
        await gate;
        await route.fulfill({
          json: quizCreateResponse(route.request().postDataJSON(), {
            ...draft,
            id: quizId,
          }),
        });
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
    const title = page.getByRole("textbox", {
      name: "Quiz title",
      exact: true,
    });
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
    if (preserveNewer)
      await page.evaluate(
        (value) =>
          localStorage.setItem(
            "testownik.v1.draft.editor-saving-fixture.new",
            JSON.stringify(value),
          ),
        { ...draft, title: "Newer local work" },
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
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(
              localStorage.getItem(
                "testownik.v1.draft.editor-saving-fixture.new",
              ) ?? "null",
            )?.title ?? null,
        ),
      )
      .toBe(preserveNewer ? "Newer local work" : null);
    expect(submitted).toMatchObject({ title: draft.title });
    expect(posts).toBe(1);
    if (!preserveNewer) {
      await page
        .getByRole("button", { name: "Add to Library", exact: true })
        .click();
      await page.getByRole("button", { name: "New Quiz", exact: true }).click();
      await expect(title).toHaveValue("");
      expect(posts).toBe(1);
    }
  });

for (const failed of [false, true])
  test(`reopening waits for its earlier save and ${failed ? "recovers a failed request" : "does not restore committed content"}`, async ({
    page,
  }) => {
    await page.addInitScript((draft) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "reopened-save-fixture", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
      if (!sessionStorage.getItem("draft-seeded")) {
        localStorage.setItem(
          "testownik.v1.draft.reopened-save-fixture.new",
          JSON.stringify(draft),
        );
        sessionStorage.setItem("draft-seeded", "true");
      }
    }, draft);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let posts = 0;
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/quizzes/") && route.request().method() === "POST") {
        posts++;
        await gate;
        return route.fulfill(
          failed && posts === 1
            ? { status: 503, json: {} }
            : {
                json: quizCreateResponse(route.request().postDataJSON(), {
                  ...draft,
                  id: quizId,
                }),
              },
        );
      }
      return route.fulfill({
        json: path.endsWith("/user/")
          ? { id: "reopened-save-fixture", is_guest: false }
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
    const openEditor = async () => {
      await page
        .getByRole("button", { name: "Add to Library", exact: true })
        .click();
      await page.getByRole("button", { name: "New Quiz", exact: true }).click();
    };
    await openEditor();
    await expect(
      page.getByRole("textbox", { name: "Quiz title", exact: true }),
    ).toHaveValue(draft.title);
    await page.getByRole("button", { name: "Save Quiz", exact: true }).click();
    await expect.poll(() => posts).toBe(1);
    await page.getByRole("link", { name: /back/i }).click();
    await expect(page).toHaveURL(/\/library$/);
    await openEditor();
    await expect(page).toHaveURL(/\/editor$/);
    await expect(
      page.getByRole("textbox", { name: "Quiz title", exact: true }),
    ).not.toBeVisible();
    expect(posts).toBe(1);
    release();
    if (failed) {
      await expect(
        page.getByRole("textbox", { name: "Quiz title", exact: true }),
      ).toHaveValue(draft.title);
      await page
        .getByRole("button", { name: "Save Quiz", exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`/quiz/${quizId}$`));
      expect(posts).toBe(2);
      return;
    }
    await expect(
      page.getByRole("textbox", { name: "Quiz title", exact: true }),
    ).toHaveValue("");
    await expect(page).toHaveURL(/\/editor$/);
    expect(posts).toBe(1);
    expect(
      await page.evaluate(() =>
        localStorage.getItem("testownik.v1.draft.reopened-save-fixture.new"),
      ),
    ).toBeNull();
  });
