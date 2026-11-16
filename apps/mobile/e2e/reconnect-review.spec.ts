import { expect, test } from "@playwright/test";

const quiz = {
  id: "reconnect-review",
  title: "Reconnect fixture",
  version: 1,
  user_settings: { default_ai_model: null },
  questions: [
    {
      id: "question",
      text: "Saved question text",
      multiple: false,
      answers: [
        { id: "correct", text: "Correct answer", is_correct: true },
        { id: "wrong", text: "Wrong answer", is_correct: false },
      ],
    },
  ],
  current_session: {
    id: "session",
    current_question: "question",
    study_time: 0,
    answers: [
      {
        id: "answer",
        question: "question",
        selected_answers: ["wrong"],
        was_correct: false,
        answered_at: "2026-10-11T20:00:00Z",
      },
    ],
  },
};

for (const language of ["en", "pl"] as const) {
  for (const surface of ["history", "search-quiz", "quiz"] as const) {
    test(`${language}: ${surface} refreshes saved data on reconnect and preserves review state`, async ({
      page,
    }) => {
      await page.addInitScript(
        ({ quiz, language }) => {
          let online = false;
          Object.defineProperty(navigator, "onLine", {
            configurable: true,
            get: () => online,
          });
          for (const name of [
            "connection",
            "mozConnection",
            "webkitConnection",
          ])
            Object.defineProperty(navigator, name, {
              configurable: true,
              value: undefined,
            });
          (
            window as unknown as { qaConnectivity: (value: boolean) => void }
          ).qaConnectivity = (value) => {
            online = value;
            window.dispatchEvent(new Event(value ? "online" : "offline"));
          };
          sessionStorage.setItem(
            "testownik.oauth-session.v2",
            JSON.stringify({ access: "reconnect-owner", refresh: "fixture" }),
          );
          localStorage.setItem(
            "testownik.v1.language",
            JSON.stringify(language),
          );
          localStorage.setItem(
            "testownik.v1.last-user",
            JSON.stringify({ id: "reconnect-owner", is_guest: false }),
          );
          localStorage.setItem(
            "testownik.v1.offline.reconnect-owner",
            JSON.stringify({
              quizzes: { [quiz.id]: quiz },
              queue: [],
              errors: {},
            }),
          );
        },
        { quiz, language },
      );
      let available = false,
        fetches = 0;
      await page.route("**/api/**", (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith("/user/"))
          return route.fulfill({
            json: { id: "reconnect-owner", is_guest: false },
          });
        if (path.includes(`/quizzes/${quiz.id}/`)) {
          fetches++;
          return available
            ? route.fulfill({
                json: {
                  ...quiz,
                  version: 2,
                  questions: [
                    { ...quiz.questions[0], text: "Refreshed question text" },
                  ],
                },
              })
            : route.fulfill({ status: 500, json: {} });
        }
        return route.fulfill({ json: [] });
      });
      const pl = language === "pl";
      await page.goto(
        surface === "quiz" ? `/quiz/${quiz.id}` : `/${surface}?id=${quiz.id}`,
      );
      const row = (text: string) =>
        page.getByRole("button", {
          name: new RegExp(
            `${surface === "history" ? (pl ? "Niepoprawnie" : "Incorrect") : pl ? "Pytanie 1" : "Question 1"}: ${text}`,
          ),
        });
      if (surface === "quiz") {
        await expect(
          page
            .frameLocator(
              `iframe[title="${pl ? "Treść pytania" : "Question content"}"]`,
            )
            .first()
            .getByText("Saved question text", { exact: true }),
        ).toBeVisible();
      } else {
        await expect(row("Saved question text")).toBeVisible();
        if (surface === "history") await row("Saved question text").click();
        else {
          await page.getByRole("textbox").fill("question");
          await row("Saved question text").click();
        }
        await expect(
          page.getByLabel(pl ? "Poprawna odpowiedź" : "Correct answer", {
            exact: true,
          }),
        ).toBeVisible();
        if (surface === "history")
          await expect(
            page.getByLabel(pl ? "Niepoprawna odpowiedź" : "Incorrect answer", {
              exact: true,
            }),
          ).toBeVisible();
      }
      await expect(
        page
          .getByText(
            surface === "search-quiz"
              ? pl
                ? "Na tym urządzeniu"
                : "On This Device"
              : pl
                ? "Tryb offline — odpowiedzi zapisujemy na urządzeniu."
                : "You’re offline. Answers are saved on this device.",
            { exact: true },
          )
          .filter({ visible: true }),
      ).toBeVisible();
      const before = fetches;
      available = true;
      await page.evaluate(() =>
        (
          window as unknown as { qaConnectivity: (value: boolean) => void }
        ).qaConnectivity(true),
      );
      await expect.poll(() => fetches).toBeGreaterThan(before);
      if (surface === "quiz")
        await expect(
          page
            .frameLocator(
              `iframe[title="${pl ? "Treść pytania" : "Question content"}"]`,
            )
            .first()
            .getByText("Refreshed question text", { exact: true }),
        ).toBeVisible();
      else {
        await expect(row("Refreshed question text")).toBeVisible();
        if (surface === "history")
          await expect(
            page.getByText(pl ? "Twój wybór" : "Your choice", { exact: true }),
          ).toBeVisible();
        else await expect(page.getByRole("textbox")).toHaveValue("question");
      }
      await expect(
        page.getByText(
          pl
            ? "Zapisana kopia. Nie udało się odświeżyć quizu."
            : "Saved copy. Couldn’t refresh this quiz.",
          { exact: true },
        ),
      ).toHaveCount(0);
      const state = await page.evaluate(() =>
        JSON.parse(
          localStorage.getItem("testownik.v1.offline.reconnect-owner")!,
        ),
      );
      expect(state.queue).toEqual([]);
      expect(state.quizzes[quiz.id].current_session.answers).toEqual(
        quiz.current_session.answers,
      );
      if (surface !== "quiz") expect(state.quizzes[quiz.id]).toEqual(quiz);
    });
  }
}

test("history refreshes when its answer syncs even while another quiz stays rejected", async ({
  page,
}) => {
  const a = { ...quiz, id: "conflicted-quiz" };
  const pending = (id: string) => ({
    request_id: `${id}-request`,
    quiz_id: id,
    session_id: quiz.current_session.id,
    version: 1,
    question_id: "question",
    selected_answers: ["wrong"],
    elapsed_seconds: 0,
    next_question: "question",
    local: quiz.current_session.answers[0],
  });
  await page.addInitScript(
    ({ quiz, a, queue }) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "drain-owner", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
      localStorage.setItem(
        "testownik.v1.offline.drain-owner",
        JSON.stringify({
          quizzes: { [quiz.id]: quiz, [a.id]: a },
          queue,
          errors: { [a.id]: "Other quiz conflict" },
        }),
      );
    },
    { quiz, a, queue: [pending(a.id), pending(quiz.id)] },
  );
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false,
    fetches = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/user/"))
      return route.fulfill({ json: { id: "drain-owner", is_guest: false } });
    if (path.includes(`/${a.id}/answer/`))
      return route.fulfill({
        status: 409,
        json: { detail: "Other quiz conflict" },
      });
    if (path.includes(`/${quiz.id}/answer/`)) {
      started = true;
      await held;
      return route.fulfill({ json: quiz.current_session.answers[0] });
    }
    if (path.includes(`/quizzes/${quiz.id}/`)) {
      fetches++;
      return route.fulfill({
        json: {
          ...quiz,
          version: 2,
          questions: [
            { ...quiz.questions[0], text: "Refreshed question text" },
          ],
        },
      });
    }
    return route.fulfill({ json: [] });
  });
  try {
    await page.goto(`/history?id=${quiz.id}`);
    await expect.poll(() => started).toBe(true);
    await expect(
      page.getByRole("button", { name: /Incorrect: Saved question text/ }),
    ).toBeVisible();
    await expect(
      page
        .getByText("Answers waiting to sync: 2.", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    expect(fetches).toBe(0);
    release();
    await expect(
      page.getByRole("button", { name: /Incorrect: Refreshed question text/ }),
    ).toBeVisible();
    expect(fetches).toBe(1);
    const state = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("testownik.v1.offline.drain-owner")!),
    );
    expect(
      state.queue.map((item: { quiz_id: string }) => item.quiz_id),
    ).toEqual([a.id]);
    expect(state.quizzes[quiz.id].current_session.answers).toEqual(
      quiz.current_session.answers,
    );
  } finally {
    release();
  }
});

test("a delayed refresh preserves the selected answer checked while its GET was in flight", async ({
  page,
}) => {
  const saved = {
    ...quiz,
    current_session: { ...quiz.current_session, answers: [] },
  };
  await page.addInitScript((quiz) => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({ access: "feedback-owner", refresh: "fixture" }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
    localStorage.setItem(
      "testownik.v1.offline.feedback-owner",
      JSON.stringify({ quizzes: { [quiz.id]: quiz }, queue: [], errors: {} }),
    );
  }, saved);
  let fetches = 0,
    started = false;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/user/"))
      return route.fulfill({ json: { id: "feedback-owner", is_guest: false } });
    if (path.endsWith("/answer/")) return route.abort("failed");
    if (path.includes(`/quizzes/${quiz.id}/`)) {
      if (++fetches === 1) return route.fulfill({ status: 500, json: {} });
      started = true;
      await held;
      return route.fulfill({ json: saved });
    }
    return route.fulfill({ json: [] });
  });
  try {
    await page.goto(`/quiz/${quiz.id}`);
    const selected = page.getByRole("radio", {
      name: "Correct answer",
      exact: true,
    });
    await expect(selected).toBeVisible();
    await page
      .getByRole("button", { name: "Retry Updates", exact: true })
      .click();
    await expect.poll(() => started).toBe(true);
    await selected.click();
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await expect(page.getByText("Correct!", { exact: true })).toBeVisible();
    await expect(selected).toBeChecked();
    const response = page.waitForResponse(
      (response) =>
        response.url().includes(`/quizzes/${quiz.id}/?`) &&
        response.status() === 200,
    );
    release();
    await response;
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect.poll(() => fetches).toBe(2);
    // Check feedback remains pinned after the background GET settles.
    await expect(
      page.getByRole("button", { name: "Next", exact: true }),
    ).toBeEnabled();
    await expect(selected).toBeChecked();
    await expect(selected).toBeDisabled();
    const state = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("testownik.v1.offline.feedback-owner")!),
    );
    expect(state.queue).toHaveLength(1);
    expect(state.queue[0].selected_answers).toEqual(["correct"]);
    expect(
      state.quizzes[quiz.id].current_session.answers[0].selected_answers,
    ).toEqual(["correct"]);
  } finally {
    release();
  }
});
