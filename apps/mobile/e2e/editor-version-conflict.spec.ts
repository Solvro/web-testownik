import { expect, test } from "@playwright/test";

const owner = "version-fixture";
const id = "22222222-2222-4222-8222-222222222222";
const content = {
  title: "Local work",
  description: "",
  questions: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      text: "Question",
      order: 1,
      multiple: false,
      answers: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          text: "Answer",
          order: 1,
          is_correct: true,
        },
      ],
    },
  ],
};

for (const language of ["en", "pl"] as const) {
  const copy =
    language === "en"
      ? {
          title: "Quiz title",
          save: "Save Quiz",
          changed: "The saved quiz changed since this draft was started.",
          unknown: "The original quiz version for this older draft is unknown.",
          load: "Load Saved Version",
          export: "Export Draft",
        }
      : {
          title: "Tytuł quizu",
          save: "Zapisz quiz",
          changed: "Zapisany quiz zmienił się od rozpoczęcia tego szkicu.",
          unknown:
            "Nie znamy wersji quizu, na której powstał ten starszy szkic.",
          load: "Wczytaj zapisaną wersję",
          export: "Eksportuj szkic",
        };

  for (const known of [true, false]) {
    test(`${language}: restored ${known ? "stale" : "unknown-version"} draft keeps local edits until confirmed reload`, async ({
      page,
    }) => {
      await page.addInitScript(
        ({ owner, id, content, language, known }) => {
          sessionStorage.setItem(
            "testownik.oauth-session.v2",
            JSON.stringify({ access: owner, refresh: "fixture" }),
          );
          localStorage.setItem(
            "testownik.v1.language",
            JSON.stringify(language),
          );
          localStorage.setItem(
            `testownik.v1.draft.${owner}.${id}`,
            JSON.stringify({ ...content, ...(known ? { version: 1 } : {}) }),
          );
        },
        { owner, id, content, language, known },
      );
      const writes: unknown[] = [];
      await page.route("**/api/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (route.request().method() !== "GET")
          writes.push(route.request().postDataJSON());
        return route.fulfill({
          json: path.endsWith("/user/")
            ? { id: owner, is_guest: false }
            : path.includes(id)
              ? { ...content, id, version: 2, title: "Current server work" }
              : [],
        });
      });
      await page.goto(`/editor?id=${id}`);
      const title = page.getByRole("textbox", {
        name: copy.title,
        exact: true,
      });
      await expect(title).toHaveValue(content.title);
      await expect(
        page.getByText(known ? copy.changed : copy.unknown, { exact: false }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: copy.save, exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: copy.export, exact: true }),
      ).toBeEnabled();
      page.once("dialog", (dialog) => dialog.dismiss());
      await page.getByRole("button", { name: copy.load, exact: true }).click();
      await expect(title).toHaveValue(content.title);
      expect(
        await page.evaluate(
          ({ owner, id }) =>
            JSON.parse(
              localStorage.getItem(`testownik.v1.draft.${owner}.${id}`) ??
                "null",
            )?.title,
          { owner, id },
        ),
      ).toBe(content.title);
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: copy.load, exact: true }).click();
      await expect(title).toHaveValue("Current server work");
      await expect(
        page.getByRole("button", { name: copy.save, exact: true }),
      ).toBeEnabled();
      expect(
        await page.evaluate(
          ({ owner, id }) =>
            localStorage.getItem(`testownik.v1.draft.${owner}.${id}`),
          { owner, id },
        ),
      ).toBeNull();
      expect(writes).toEqual([]);
    });
  }

  test(`${language}: a save race returns a recoverable conflict and preserves the draft`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ owner, language }) => {
        sessionStorage.setItem(
          "testownik.oauth-session.v2",
          JSON.stringify({ access: owner, refresh: "fixture" }),
        );
        localStorage.setItem("testownik.v1.language", JSON.stringify(language));
      },
      { owner, language },
    );
    const patches: Record<string, unknown>[] = [];
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.includes(id) && route.request().method() === "PATCH") {
        patches.push(route.request().postDataJSON());
        return route.fulfill({
          status: 409,
          json: { code: "quiz_version_conflict", detail: "The quiz changed" },
        });
      }
      return route.fulfill({
        json: path.endsWith("/user/")
          ? { id: owner, is_guest: false }
          : path.includes(id)
            ? { ...content, id, version: 1 }
            : [],
      });
    });
    await page.goto(`/editor?id=${id}`);
    const title = page.getByRole("textbox", { name: copy.title, exact: true });
    await expect(title).toHaveValue(content.title);
    await title.fill("Unsaved phone edits");
    await expect
      .poll(() =>
        page.evaluate(
          ({ owner, id }) =>
            JSON.parse(
              localStorage.getItem(`testownik.v1.draft.${owner}.${id}`) ??
                "null",
            )?.title,
          { owner, id },
        ),
      )
      .toBe("Unsaved phone edits");
    await page.getByRole("button", { name: copy.save, exact: true }).click();
    await expect(page.getByText(copy.changed, { exact: false })).toBeVisible();
    await expect(title).toHaveValue("Unsaved phone edits");
    await expect(
      page.getByRole("button", { name: copy.save, exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: copy.load, exact: true }),
    ).toBeEnabled();
    expect(patches).toHaveLength(1);
    expect(patches[0]).toMatchObject({
      expected_version: 1,
      title: "Unsaved phone edits",
    });
    expect(
      await page.evaluate(
        ({ owner, id }) =>
          JSON.parse(
            localStorage.getItem(`testownik.v1.draft.${owner}.${id}`) ?? "null",
          ),
        { owner, id },
      ),
    ).toMatchObject({
      schemaVersion: 1,
      baseVersion: 1,
      title: "Unsaved phone edits",
    });
    await expect(page).toHaveURL(new RegExp(`/editor\\?id=${id}`));
  });
}
