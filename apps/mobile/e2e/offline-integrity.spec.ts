import { expect, test } from "@playwright/test";

const answer = {
  id: "local-answer",
  question: "question",
  selected_answers: ["wrong"],
  was_correct: false,
  answered_at: "2026-10-11T18:00:00Z",
};
const quiz = {
  id: "offline-integrity",
  title: "Offline integrity fixture",
  version: 1,
  user_settings: { default_ai_model: null },
  questions: [
    {
      id: "question",
      text: "Which planet is red?",
      multiple: false,
      answers: [
        { id: "correct", text: "Mars", is_correct: true },
        { id: "wrong", text: "Venus", is_correct: false },
      ],
    },
  ],
  current_session: {
    id: "session",
    current_question: "question",
    study_time: 12,
    answers: [answer],
  },
};
const queued = {
  request_id: answer.id,
  quiz_id: quiz.id,
  session_id: "session",
  version: 1,
  question_id: "question",
  selected_answers: answer.selected_answers,
  elapsed_seconds: 12,
  next_question: "question",
  local: answer,
};
for (const language of ["en", "pl"] as const) {
  test(`${language}: rejected answers block further answers and require confirmed recovery`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ language, quiz, queued }) => {
        sessionStorage.setItem(
          "testownik.oauth-session.v2",
          JSON.stringify({ access: "offline-owner", refresh: "fixture" }),
        );
        localStorage.setItem("testownik.v1.language", JSON.stringify(language));
        localStorage.setItem(
          "testownik.v1.offline.offline-owner",
          JSON.stringify({
            quizzes: { [quiz.id]: quiz },
            queue: [queued],
            errors: { [quiz.id]: "Session changed" },
          }),
        );
      },
      { language, quiz, queued },
    );
    let submissions = 0,
      fetches = 0;
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/user/"))
        return route.fulfill({
          json: { id: "offline-owner", is_guest: false },
        });
      if (path.endsWith("/answer/")) {
        submissions++;
        return route.fulfill({
          status: 409,
          json: { detail: "Session changed" },
        });
      }
      if (path.includes(`/quizzes/${quiz.id}/`)) {
        fetches++;
        return route.fulfill({
          json: {
            ...quiz,
            current_session: { ...quiz.current_session, answers: [] },
          },
        });
      }
      return route.fulfill({ json: [] });
    });
    const pl = language === "pl";
    await page.goto(`/quiz/${quiz.id}`);
    await expect(
      page.getByText(
        pl ? "Odpowiedzi wymagają uwagi" : "Answers Need Attention",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: pl ? "Sprawdź" : "Check", exact: true }),
    ).toBeDisabled();
    const retries = submissions;
    await page
      .getByRole("button", {
        name: pl ? "Ponów synchronizację" : "Retry Sync",
        exact: true,
      })
      .click();
    await expect.poll(() => submissions).toBeGreaterThan(retries);
    expect(fetches).toBe(0);
    const saved = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("testownik.v1.offline.offline-owner")!),
      );
    expect((await saved()).queue).toHaveLength(1);
    page.once("dialog", (dialog) => dialog.dismiss());
    await page
      .getByRole("button", {
        name: pl ? "Usuń lokalną kopię" : "Remove Local Copy",
        exact: true,
      })
      .click();
    expect((await saved()).queue).toHaveLength(1);
    expect(fetches).toBe(0);
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", {
        name: pl ? "Usuń lokalną kopię" : "Remove Local Copy",
        exact: true,
      })
      .click();
    await expect(
      page.getByText(
        pl ? "Odpowiedzi wymagają uwagi" : "Answers Need Attention",
        { exact: true },
      ),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: pl ? "Sprawdź" : "Check", exact: true }),
    ).toBeEnabled();
    const recovered = await saved();
    expect(recovered.queue).toEqual([]);
    expect(recovered.errors).toEqual({});
    expect(recovered.quizzes[quiz.id].current_session).toEqual({
      ...quiz.current_session,
      answers: [],
    });
    // The explicit refresh and pending-answer recovery can both refresh the bank.
    // Neither path may download before confirmation or cause a refresh loop.
    expect(fetches).toBeGreaterThanOrEqual(1);
    expect(fetches).toBeLessThanOrEqual(2);
  });

  test(`${language}: cancelling New Session preserves active progress without DELETE`, async ({
    page,
  }) => {
    await page.addInitScript((language) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "restart-owner", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
    }, language);
    let deletes = 0;
    await page.route("**/api/**", async (route) => {
      if (route.request().method() === "DELETE") deletes++;
      return route.fulfill({
        json: new URL(route.request().url()).pathname.endsWith("/user/")
          ? { id: "restart-owner", is_guest: false }
          : quiz,
      });
    });
    const pl = language === "pl";
    await page.goto(`/quiz/${quiz.id}`);
    await page
      .getByRole("button", {
        name: pl ? "Opcje quizu" : "Quiz options",
        exact: true,
      })
      .click();
    const dialog = page.waitForEvent("dialog").then(async (prompt) => {
      const message = prompt.message();
      await prompt.dismiss();
      return message;
    });
    await page
      .getByRole("button", {
        name: pl ? "Nowa sesja" : "New Session",
        exact: true,
      })
      .click();
    expect(await dialog).toContain(
      pl ? "Rozpocząć nową sesję?" : "Start a New Session?",
    );
    expect(deletes).toBe(0);
    const cached = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("testownik.v1.offline.restart-owner")!),
    );
    expect(cached.quizzes[quiz.id].current_session.answers).toHaveLength(1);
  });
}

test("a rejection arriving during study immediately blocks the next answer", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({ access: "live-conflict", refresh: "fixture" }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
  });
  let submissions = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/user/"))
      return route.fulfill({ json: { id: "live-conflict", is_guest: false } });
    if (path.endsWith("/answer/")) {
      submissions++;
      return route.fulfill({
        status: 409,
        json: { detail: "Session changed" },
      });
    }
    if (path.includes(`/quizzes/${quiz.id}/`))
      return route.fulfill({
        json: {
          ...quiz,
          current_session: { ...quiz.current_session, answers: [] },
        },
      });
    return route.fulfill({ json: [] });
  });
  await page.goto(`/quiz/${quiz.id}`);
  await page.getByRole("radio", { name: "Venus", exact: true }).click();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(
    page.getByText("Answers Need Attention", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Check", exact: true }),
  ).toBeDisabled();
  expect(submissions).toBe(1);
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("testownik.v1.offline.live-conflict")!),
  );
  expect(stored.queue).toHaveLength(1);
  await page.screenshot({
    path: testInfo.outputPath("conflict-recovery.png"),
    fullPage: true,
  });
});

for (const currentQuestion of [null, "removed-question"]) {
  test(`pins ${currentQuestion ?? "null"} current question before the first selection`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "pin-owner", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
    });
    const questions = [
      ...quiz.questions,
      {
        id: "question-two",
        text: "What is two plus two?",
        multiple: false,
        answers: [
          { id: "four", text: "Four", is_correct: true },
          { id: "five", text: "Five", is_correct: false },
        ],
      },
    ];
    await page.route("**/api/**", (route) =>
      route.fulfill({
        json: new URL(route.request().url()).pathname.endsWith("/user/")
          ? { id: "pin-owner", is_guest: false }
          : {
              ...quiz,
              questions,
              current_session: {
                ...quiz.current_session,
                current_question: currentQuestion,
                answers: [],
              },
            },
      }),
    );
    await page.goto(`/quiz/${quiz.id}`);
    await expect(page.getByRole("radio").first()).toBeVisible();
    const pinned = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("testownik.v1.offline.pin-owner")!)
          .quizzes["offline-integrity"].current_session.current_question,
    );
    expect(questions.map((question) => question.id)).toContain(pinned);
    const displayed = questions.find((question) => question.id === pinned)!;
    for (let attempt = 0; attempt < 4; attempt++) {
      await page
        .getByRole("radio")
        .nth(attempt % 2)
        .click();
      await expect(
        page
          .frameLocator('iframe[title="Question content"]')
          .first()
          .getByText(displayed.text, { exact: true }),
      ).toBeVisible();
    }
  });
}

test("completed Start Again starts one new session without a confirmation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({ access: "complete-owner", refresh: "fixture" }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
  });
  let deletes = 0,
    dialogs = 0;
  page.on("dialog", async (dialog) => {
    dialogs++;
    await dialog.dismiss();
  });
  const unexpected: string[] = [];
  await page.route("**/api/**", (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET" && path === "/api/user/")
      return route.fulfill({ json: { id: "complete-owner", is_guest: false } });
    if (
      request.method() === "GET" &&
      ["/api/last-used-quizzes/", "/api/quiz-ratings/me/"].includes(path)
    )
      return route.fulfill({ json: [] });
    if (
      request.method() === "DELETE" &&
      path === `/api/quizzes/${quiz.id}/progress/`
    ) {
      deletes++;
      return route.fulfill({ status: 204, body: "" });
    }
    if (request.method() === "GET" && path === `/api/quizzes/${quiz.id}/`)
      return route.fulfill({
        json: {
          ...quiz,
          current_session: {
            ...quiz.current_session,
            current_question: deletes ? "question" : null,
            answers: deletes
              ? []
              : [
                  {
                    ...answer,
                    selected_answers: ["correct"],
                    was_correct: true,
                  },
                ],
          },
        },
      });
    unexpected.push(`${request.method()} ${path}`);
    return route.fulfill({
      status: 501,
      json: { detail: "Unexpected QA request" },
    });
  });
  await page.goto(`/quiz/${quiz.id}`);
  await page.getByRole("button", { name: "Start Again", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Check", exact: true }),
  ).toBeEnabled();
  expect(deletes).toBe(1);
  expect(dialogs).toBe(0);
  expect(unexpected).toEqual([]);
});
