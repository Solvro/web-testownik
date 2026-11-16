import { expect, test } from "@playwright/test";

for (const language of ["en", "pl"] as const)
  for (const id of [
    "../user",
    "__proto__",
    ".",
    "..",
    "array",
    "question-array",
    "malformed",
  ])
    test(`${language}: malformed hint quiz ${id} stays within its encoded quiz endpoint`, async ({
      page,
    }) => {
      const owner = "synthetic-hint-route-owner";
      const key = `testownik.v1.offline.${owner}`;
      const calls: { path: string; method: string }[] = [];
      let aiCalls = 0;
      await page.addInitScript(
        ({ owner, key, language }) => {
          if (window.top !== window) return;
          sessionStorage.setItem(
            "testownik.oauth-session.v2",
            JSON.stringify({ access: owner, refresh: "synthetic" }),
          );
          localStorage.setItem(
            "testownik.v1.language",
            JSON.stringify(language),
          );
          localStorage.setItem(
            key,
            JSON.stringify({ quizzes: {}, queue: [], errors: {} }),
          );
        },
        { owner, key, language },
      );
      await page.route("**/api/**", (route) => {
        const path = new URL(route.request().url()).pathname;
        calls.push({ path, method: route.request().method() });
        if (path.endsWith("/user/"))
          return route.fulfill({
            json: {
              id: owner,
              full_name: "Synthetic Route Student",
              is_guest: false,
            },
          });
        if (path.includes("/quizzes/") && id === "malformed")
          return route.fulfill({ json: { id: "malformed", questions: null } });
        if (path.includes("/quizzes/"))
          return route.fulfill({
            status: 404,
            json: { detail: "Synthetic quiz not found." },
          });
        return route.fulfill({ json: [] });
      });
      await page.route("**/ai/hint", (route) => {
        aiCalls++;
        return route.abort("failed");
      });
      await page.goto("/profile");
      await expect(
        page.getByText("Synthetic Route Student", { exact: true }),
      ).toBeVisible();
      const bytes = await page.evaluate(
        (key) => localStorage.getItem(key),
        key,
      );
      await page.evaluate((id) => {
        history.pushState(
          {},
          "",
          id === "array"
            ? "/hint?id=a&id=b&question=x"
            : id === "question-array"
              ? "/hint?id=quiz&question=x&question=y"
              : `/hint?id=${encodeURIComponent(id)}&question=x`,
        );
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, id);
      await expect(
        page.getByRole("button", {
          name: language === "pl" ? "Spróbuj ponownie" : "Try Again",
          exact: true,
        }),
      ).toBeVisible();
      const invalid = [".", "..", "array", "question-array"].includes(id);
      const message =
        invalid || id === "malformed"
          ? language === "pl"
            ? "To pytanie nie jest już dostępne."
            : "This question is no longer available."
          : "Synthetic quiz not found.";
      await expect(page.getByText(message, { exact: true })).toBeVisible();
      const quizCalls = calls.filter((call) => call.path.includes("/quizzes/"));
      if (invalid) expect(quizCalls).toHaveLength(0);
      else {
        expect(quizCalls.length).toBeGreaterThan(0);
        expect(quizCalls.length).toBeLessThanOrEqual(2);
        expect(
          quizCalls.every(
            (call) => call.path === `/api/quizzes/${encodeURIComponent(id)}/`,
          ),
        ).toBe(true);
      }
      expect(calls.filter((call) => call.path === "/api/user/")).toHaveLength(
        1,
      );
      // Without the dot-dot guard, URL normalization targets the API root.
      expect(calls.filter((call) => call.path === "/api/")).toHaveLength(0);
      expect(calls.filter((call) => call.method !== "GET")).toHaveLength(0);
      expect(aiCalls).toBe(0);
      expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
        bytes,
      );
      await expect(page.getByText(/Cannot read properties/)).toHaveCount(0);
    });
