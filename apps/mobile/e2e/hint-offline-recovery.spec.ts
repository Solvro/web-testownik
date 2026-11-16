import { expect, test, type Page } from "@playwright/test";

const owner = "hint-recovery-owner";
const key = `testownik.v1.offline.${owner}`;
const question = {
  id: "question",
  text: "Synthetic saved question?",
  multiple: false,
  answers: [{ id: "answer", text: "Synthetic answer", is_correct: true }],
};
const quiz = {
  id: "hint-recovery",
  title: "Synthetic hint recovery quiz",
  version: 1,
  questions: [question],
  current_session: {
    id: "retained-session",
    current_question: "question",
    study_time: 12,
    answers: [
      {
        id: "retained-answer",
        question: "question",
        selected_answers: ["answer"],
        was_correct: true,
        answered_at: "2026-10-12T05:00:00Z",
      },
    ],
  },
};

async function fixture(
  page: Page,
  language: "en" | "pl",
  saved: "current" | "older" | "none",
) {
  await page.addInitScript(
    ({ owner, key, language, quiz, saved }) => {
      if (window.top !== window) return;
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: owner, refresh: "synthetic" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
      localStorage.setItem(
        key,
        JSON.stringify({
          quizzes:
            saved === "none"
              ? {}
              : {
                  [quiz.id]:
                    saved === "older"
                      ? {
                          ...quiz,
                          questions: [
                            { ...quiz.questions[0], id: "old-question" },
                          ],
                        }
                      : quiz,
                },
          queue: [],
          errors: {},
        }),
      );
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
    },
    { owner, key, language, quiz, saved },
  );
  const calls = { quiz: 0, ai: 0, writes: 0, online: true, hasQuestion: true };
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") calls.writes++;
    if (path.endsWith(`/quizzes/${quiz.id}/`)) calls.quiz++;
    if (!calls.online) return route.abort("internetdisconnected");
    return route.fulfill({
      json: path.endsWith("/user/")
        ? { id: owner, full_name: "Synthetic Hint Student", is_guest: false }
        : path.endsWith("/settings/")
          ? { default_ai_model: "synthetic/model", ai_disabled: false }
          : path.endsWith(`/quizzes/${quiz.id}/`)
            ? calls.hasQuestion
              ? quiz
              : { ...quiz, questions: [] }
            : [],
    });
  });
  await page.route("**/ai/hint", (route) => {
    calls.ai++;
    return calls.online
      ? route.fulfill({
          contentType: "text/plain",
          body: "<general_hint>Synthetic recovered hint.</general_hint>",
        })
      : route.abort("internetdisconnected");
  });
  await page.goto("/profile");
  await expect(
    page.getByText("Synthetic Hint Student", { exact: true }),
  ).toBeVisible();
  return calls;
}

async function navigate(page: Page, online: boolean) {
  await page.evaluate(
    ({ online, id }) => {
      (window as unknown as { qaOnline: (value: boolean) => void }).qaOnline(
        online,
      );
      history.pushState({}, "", `/hint?id=${id}&question=question&mode=hint`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
    { online, id: quiz.id },
  );
}

for (const language of ["en", "pl"] as const) {
  const retryName = language === "pl" ? "Spróbuj ponownie" : "Try Again";
  for (const saved of ["current", "none"] as const)
    test(`${language}: offline standalone hint with ${saved} bank offers explicit recovery`, async ({
      page,
    }) => {
      const calls = await fixture(page, language, saved);
      const before = await page.evaluate(
        (key) => localStorage.getItem(key),
        key,
      );
      calls.online = false;
      await navigate(page, false);
      const retry = page.getByRole("button", { name: retryName, exact: true });
      await expect(retry).toBeVisible({ timeout: 8000 });
      if (saved === "current") {
        await expect(
          page
            .frameLocator("iframe")
            .first()
            .getByText(question.text, { exact: true }),
        ).toBeVisible();
        expect(calls.quiz).toBe(0);
      } else {
        expect(calls.quiz).toBeGreaterThan(0);
        expect(calls.quiz).toBeLessThanOrEqual(2);
      }
      expect(calls.ai).toBe(0);
      expect(calls.writes).toBe(0);
      expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
        before,
      );
      calls.online = true;
      await page.evaluate(() =>
        (window as unknown as { qaOnline: (value: boolean) => void }).qaOnline(
          true,
        ),
      );
      await retry.click();
      await expect(page.getByTestId("hint-response")).toHaveAccessibleName(
        "Synthetic recovered hint.",
      );
      expect(calls.ai).toBe(1);
      if (saved === "current") expect(calls.quiz).toBe(0);
      else expect(calls.quiz).toBeLessThanOrEqual(3);
      expect(calls.writes).toBe(0);
      expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
        before,
      );
    });

  test(`${language}: online hint fetches requested question absent from older saved bank`, async ({
    page,
  }) => {
    const calls = await fixture(page, language, "older");
    const before = await page.evaluate((key) => localStorage.getItem(key), key);
    await navigate(page, true);
    await expect(page.getByTestId("hint-response")).toHaveAccessibleName(
      "Synthetic recovered hint.",
      { timeout: 5000 },
    );
    await expect(
      page
        .frameLocator("iframe")
        .first()
        .getByText(question.text, { exact: true }),
    ).toBeVisible();
    expect(calls.quiz).toBe(1);
    expect(calls.ai).toBe(1);
    expect(calls.writes).toBe(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
      before,
    );
  });

  test(`${language}: question absent from both copies offers retry without AI or cache writes`, async ({
    page,
  }) => {
    const calls = await fixture(page, language, "older");
    const before = await page.evaluate((key) => localStorage.getItem(key), key);
    calls.hasQuestion = false;
    await navigate(page, true);
    await expect(
      page.getByText(
        language === "pl"
          ? "To pytanie nie jest już dostępne."
          : "This question is no longer available.",
        { exact: true },
      ),
    ).toBeVisible();
    const failedGets = calls.quiz;
    expect(failedGets).toBeGreaterThanOrEqual(1);
    expect(failedGets).toBeLessThanOrEqual(2);
    expect(calls.ai).toBe(0);
    expect(calls.writes).toBe(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
      before,
    );
    calls.hasQuestion = true;
    await page.getByRole("button", { name: retryName, exact: true }).click();
    await expect(page.getByTestId("hint-response")).toHaveAccessibleName(
      "Synthetic recovered hint.",
    );
    expect(calls.quiz).toBe(failedGets + 1);
    expect(calls.ai).toBe(1);
    expect(calls.writes).toBe(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
      before,
    );
  });
}
