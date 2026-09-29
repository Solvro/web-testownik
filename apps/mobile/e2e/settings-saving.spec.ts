import { test, expect } from "@playwright/test";

for (const language of ["en", "pl"] as const) {
  test(`${language}: settings save automatically and an edit made during a slow save is kept and saved`, async ({
    page,
  }) => {
    const t = (pl: string, en: string) => (language === "pl" ? pl : en);
    await page.addInitScript((language) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "settings-fixture", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
    }, language);
    const settings = {
      initial_reoccurrences: 1,
      wrong_answer_reoccurrences: 1,
      max_question_reoccurrences: 5,
      ai_disabled: false,
      default_ai_model: null,
      notify_quiz_shared: true,
      notify_bug_reported: true,
      notify_marketing: false,
    };
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const submissions: number[] = [];
    await page.route("**/api/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith("/user/"))
        return route.fulfill({
          json: {
            id: "settings-fixture",
            full_name: "Student",
            account_level: "basic",
          },
        });
      if (pathname.endsWith("/ai/models/"))
        return route.fulfill({ json: { models: [] } });
      if (pathname.endsWith("/settings/")) {
        if (route.request().method() === "PATCH") {
          const submitted = route.request().postDataJSON();
          submissions.push(submitted.initial_reoccurrences);
          if (submissions.length === 1) await gate;
          return route.fulfill({ json: submitted });
        }
        return route.fulfill({ json: settings });
      }
      return route.fulfill({ json: [] });
    });
    await page.goto("/settings");
    const increment = page
      .getByRole("button", { name: "+", exact: true })
      .first();
    const value = (n: number) =>
      page.getByText(t(`Do opanowania: ${n}`, `To Master: ${n}`), {
        exact: true,
      });
    // No Save button: the change is sent after a short pause.
    await increment.click();
    await expect.poll(() => submissions).toEqual([2]);
    // Edit again while the first save is still pending.
    await increment.click();
    await expect(value(3)).toBeVisible();
    release();
    await expect.poll(() => submissions).toEqual([2, 3]);
    await expect(value(3)).toBeVisible();
  });
}
