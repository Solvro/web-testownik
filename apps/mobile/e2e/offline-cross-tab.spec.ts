import { expect, test, type BrowserContext, type Page } from "@playwright/test";
async function fixture(context: BrowserContext, language = "en", ack = false) {
  const owner = "offline-cross-tab-owner",
    key = `testownik.v1.offline.${owner}`;
  const quizzes = Object.fromEntries(
    ["bank-A", "bank-B"].map((id) => [
      id,
      {
        id,
        title: id,
        version: 1,
        user_settings: { default_ai_model: null },
        questions: [
          {
            id: `question-${id}`,
            text: `Question ${id}`,
            multiple: false,
            answers: [
              { id: `correct-${id}`, text: `Correct ${id}`, is_correct: true },
              { id: `wrong-${id}`, text: `Wrong ${id}`, is_correct: false },
            ],
          },
        ],
        current_session: {
          id: `session-${id}`,
          current_question: `question-${id}`,
          study_time: 0,
          answers: [],
        },
      },
    ]),
  );
  await context.addInitScript(
    ({ owner, key, quizzes, language }) => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        get: () =>
          sessionStorage.getItem("qa.offline-cross-tab.online") === "true",
      });
      for (const name of ["connection", "mozConnection", "webkitConnection"])
        Object.defineProperty(navigator, name, {
          configurable: true,
          value: undefined,
        });
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: owner, refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
      if (!localStorage.getItem("qa.offline-cross-tab.seeded")) {
        localStorage.setItem("qa.offline-cross-tab.seeded", "true");
        localStorage.setItem(
          key,
          JSON.stringify({ quizzes, queue: [], errors: {} }),
        );
      }
    },
    { owner, key, quizzes, language },
  );
  let posts = 0;
  const requestIds: string[] = [];
  await context.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/user/"))
      return route.fulfill({ json: { id: owner, is_guest: false } });
    if (route.request().method() === "POST") {
      posts++;
      if (path.endsWith("/answer/"))
        requestIds.push(route.request().postDataJSON().request_id);
      if (ack && path.endsWith("/answer/")) {
        const payload = route.request().postDataJSON();
        const record = {
          id: `server-${payload.request_id}`,
          question: payload.question_id,
          selected_answers: payload.selected_answers,
          was_correct: false,
          answered_at: "2026-10-12T03:00:00Z",
        };
        const target = quizzes["bank-A"];
        (target.current_session.answers as object[]).push(record);
        target.current_session.current_question = payload.next_question;
        return route.fulfill({ json: record });
      }
    }
    return path.includes("/quizzes/")
      ? route.fulfill({
          status: 503,
          json: { detail: "Synthetic offline transport" },
        })
      : route.fulfill({ json: [] });
  });
  return {
    key,
    posts: () => posts,
    requestIds: () => [...requestIds],
    original: JSON.parse(JSON.stringify(quizzes["bank-A"])),
    serverQuiz: () => JSON.parse(JSON.stringify(quizzes["bank-A"])),
  };
}
async function hold(page: Page, name: string) {
  await page.evaluate((name) => {
    const state = window as unknown as {
      qaLockHeld: boolean;
      qaRelease: () => void;
    };
    void navigator.locks.request(name, async () => {
      state.qaLockHeld = true;
      await new Promise<void>((resolve) => {
        state.qaRelease = resolve;
      });
    });
  }, name);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { qaLockHeld: boolean }).qaLockHeld,
      ),
    )
    .toBe(true);
}
async function release(page: Page) {
  await page.evaluate(() =>
    (window as unknown as { qaRelease: () => void }).qaRelease(),
  );
}
test("two existing offline study tabs preserve both independently queued answers", async ({
  context,
  page,
}, info) => {
  const { key, posts } = await fixture(context);
  await page.goto("/quiz/bank-A");
  const b = await context.newPage();
  await b.goto("/quiz/bank-B");
  await expect(
    page.getByRole("radio", { name: "Correct bank-A", exact: true }),
  ).toBeVisible();
  await expect(
    b.getByRole("radio", { name: "Correct bank-B", exact: true }),
  ).toBeVisible();
  await hold(page, "testownik.account-data.v1");
  await page
    .getByRole("radio", { name: "Correct bank-A", exact: true })
    .click();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await b.getByRole("radio", { name: "Correct bank-B", exact: true }).click();
  await b.getByRole("button", { name: "Check", exact: true }).click();
  // Both contexts are waiting to commit: one at the leaf, one before its read.
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (await navigator.locks.query()).pending?.filter((lock) =>
            ["testownik.account-data.v1", "testownik.offline-data.v1"].includes(
              lock.name ?? "",
            ),
          ).length,
      ),
    )
    .toBe(2);
  await release(page);
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toBeVisible();
  await expect(
    b.getByRole("button", { name: "Next", exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    key,
  );
  await info.attach("offline-cross-tab-proof", {
    body: JSON.stringify(
      {
        posts: posts(),
        queue: saved.queue.map((answer: { quiz_id: string }) => answer.quiz_id),
        answers: Object.fromEntries(
          Object.entries(saved.quizzes).map(([id, quiz]) => [
            id,
            (quiz as { current_session: { answers: unknown[] } })
              .current_session.answers.length,
          ]),
        ),
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  expect(posts()).toBe(2);
  expect(
    saved.queue.map((answer: { quiz_id: string }) => answer.quiz_id).sort(),
  ).toEqual(["bank-A", "bank-B"]);
});

test("offline transaction acquisition timeout preserves answer selection and saved bytes for an explicit retry", async ({
  context,
  page,
}) => {
  const { key, posts } = await fixture(context);
  await page.goto("/quiz/bank-A");
  await expect(
    page.getByRole("radio", { name: "Correct bank-A", exact: true }),
  ).toBeVisible();
  const bytes = await page.evaluate((key) => localStorage.getItem(key), key);
  await hold(page, "testownik.offline-data.v1");
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });
  await page
    .getByRole("radio", { name: "Correct bank-A", exact: true })
    .click();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect.poll(() => dialogs.length, { timeout: 12000 }).toBe(1);
  expect(dialogs[0]).toContain("Couldn’t Save Answer");
  expect(dialogs[0]).toContain(
    "Could not confirm safe storage across browser tabs",
  );
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
    bytes,
  );
  expect(posts()).toBe(0);
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Check", exact: true }),
  ).toBeEnabled();
  await release(page);
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    key,
  );
  expect(
    saved.queue.map((answer: { quiz_id: string }) => answer.quiz_id),
  ).toEqual(["bank-A"]);
  expect(
    saved.quizzes["bank-A"].current_session.answers[0].selected_answers,
  ).toEqual(["correct-bank-A"]);
});

async function reconnect(page: Page) {
  await page.evaluate(() => {
    sessionStorage.setItem("qa.offline-cross-tab.online", "true");
    window.dispatchEvent(new Event("online"));
  });
}

for (const screen of ["study", "history"] as const) {
  test(`${screen}: an old GET cannot hide another tab's acknowledged answer`, async ({
    context,
    page,
  }, info) => {
    const { key, original, serverQuiz } = await fixture(context, "en", true);
    const b = await context.newPage();
    await b.goto("/quiz/bank-A");
    await expect(
      b.getByRole("radio", { name: "Wrong bank-A", exact: true }),
    ).toBeVisible();
    await page.goto(screen === "study" ? "/quiz/bank-A" : "/history?id=bank-A");
    if (screen === "study")
      await expect(
        page.getByRole("radio", { name: "Wrong bank-A", exact: true }),
      ).toBeVisible();
    else
      await expect(
        page.getByText("No Answers Yet", { exact: true }),
      ).toBeVisible();
    let started = false,
      gets = 0,
      releaseGet!: () => void;
    const held = new Promise<void>((resolve) => {
      releaseGet = resolve;
    });
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (
        route.request().method() === "GET" &&
        path.endsWith("/quizzes/bank-A/")
      ) {
        gets++;
        if (gets === 1) {
          started = true;
          await held;
          return route.fulfill({ json: original });
        }
        return route.fulfill({
          json: { ...serverQuiz(), title: "Fresh authoritative title" },
        });
      }
      return route.fallback();
    });
    await reconnect(page);
    await expect.poll(() => started).toBe(true);
    await b.getByRole("radio", { name: "Wrong bank-A", exact: true }).click();
    await b.getByRole("button", { name: "Check", exact: true }).click();
    await expect
      .poll(() =>
        b.evaluate((key) => {
          const state = JSON.parse(localStorage.getItem(key)!);
          return (
            state.queue.length === 0 &&
            state.quizzes["bank-A"].current_session.answers[0]?.id.startsWith(
              "server-",
            )
          );
        }, key),
      )
      .toBe(true);
    releaseGet();
    if (screen === "history")
      await expect(
        page.getByRole("button", { name: /Incorrect: Question bank-A/ }),
      ).toBeVisible();
    else
      await expect(
        page.getByRole("radio", { name: "Wrong bank-A", exact: true }),
      ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          (key) =>
            JSON.parse(localStorage.getItem(key)!).quizzes["bank-A"]
              .current_session.answers.length,
          key,
        ),
      )
      .toBe(1);
    const retained = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      key,
    );
    expect(retained.queue).toEqual([]);
    expect(retained.quizzes["bank-A"].current_session.answers[0].id).toMatch(
      /^server-/,
    );
    // A separate fresh request can still apply an authoritative update.
    await page.reload();
    await expect.poll(() => gets).toBe(2);
    if (screen === "study")
      await expect
        .poll(() =>
          page.evaluate(
            (key) =>
              JSON.parse(localStorage.getItem(key)!).quizzes["bank-A"].title,
            key,
          ),
        )
        .toBe("Fresh authoritative title");
    else
      await expect(
        page.getByRole("button", { name: /Incorrect: Question bank-A/ }),
      ).toBeVisible();
    await info.attach("stale-get-retained-acknowledgement", {
      body: JSON.stringify({
        screen,
        gets,
        answer: retained.quizzes["bank-A"].current_session.answers[0].id,
        generation: retained.generations["bank-A"],
      }),
      contentType: "application/json",
    });
  });
}

for (const language of ["en", "pl"] as const) {
  test(`${language}: a stale same-quiz submit preserves choices and reloads saved progress before a deliberate retry`, async ({
    context,
    page,
  }) => {
    const { key, requestIds } = await fixture(context, language);
    await page.goto("/quiz/bank-A");
    const b = await context.newPage();
    await b.goto("/quiz/bank-A");
    const check = language === "en" ? "Check" : "Sprawdź",
      next = language === "en" ? "Next" : "Dalej";
    await expect(
      page.getByRole("radio", { name: "Wrong bank-A", exact: true }),
    ).toBeVisible();
    await expect(
      b.getByRole("radio", { name: "Wrong bank-A", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("radio", { name: "Wrong bank-A", exact: true })
      .click();
    await page.getByRole("button", { name: check, exact: true }).click();
    await expect(
      page.getByRole("button", { name: next, exact: true }),
    ).toBeVisible();
    await expect.poll(() => requestIds().length).toBeGreaterThan(0);
    const bytes = await page.evaluate((key) => localStorage.getItem(key), key),
      initialRequest = requestIds()[0];
    const messages: string[] = [];
    b.on("dialog", async (dialog) => {
      messages.push(dialog.message());
      await dialog.accept();
    });
    const choice = b.getByRole("radio", { name: "Wrong bank-A", exact: true });
    await choice.click();
    await b.getByRole("button", { name: check, exact: true }).click();
    await expect.poll(() => messages.length).toBe(1);
    expect(messages[0]).toContain(
      language === "en"
        ? "Progress for this quiz changed elsewhere"
        : "Postęp tego quizu zmienił się w innym miejscu",
    );
    expect(await b.evaluate((key) => localStorage.getItem(key), key)).toBe(
      bytes,
    );
    expect(new Set(requestIds())).toEqual(new Set([initialRequest]));
    await expect(
      b.getByRole("button", { name: next, exact: true }),
    ).toHaveCount(0);
    await expect(
      b.getByRole("button", { name: check, exact: true }),
    ).toBeEnabled();
    await expect(choice).toBeChecked();
    // The automatic refresh only reloads saved progress. A second explicit tap
    // is required to create an answer from that updated history.
    await b.getByRole("button", { name: check, exact: true }).click();
    await expect(
      b.getByRole("button", { name: next, exact: true }),
    ).toBeVisible();
    const saved = await b.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      key,
    );
    expect(saved.queue).toHaveLength(2);
    expect(saved.quizzes["bank-A"].current_session.answers).toHaveLength(2);
    expect(saved.quizzes["bank-A"].current_session.answers[0].id).toBe(
      JSON.parse(bytes!).quizzes["bank-A"].current_session.answers[0].id,
    );
  });
}
