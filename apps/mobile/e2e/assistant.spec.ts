import { expect, test } from "@playwright/test";

const quizId = "11111111-1111-4111-8111-111111111111";
const questionId = "22222222-2222-4222-8222-222222222222";
const reply =
  'data: {"type":"text-delta","delta":"Start with the definition."}\n\ndata: [DONE]\n\n';
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({
        access: "test-only-opaque-token",
        refresh: "test-only-refresh-token",
      }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith("/user/")
      ? {
          id: "assistant-fixture",
          username: "Fixture",
          first_name: "Fixture",
          is_guest: false,
        }
      : path.includes(`/quizzes/${quizId}/`)
        ? {
            id: quizId,
            title: "Assistant fixture",
            description: "",
            questions: [
              {
                id: questionId,
                text: "What is a derivative?",
                answers: [],
                multiple: false,
              },
              {
                id: "33333333-3333-4333-8333-333333333333",
                text: "What is an integral?",
                answers: [],
                multiple: false,
              },
            ],
          }
        : [];
    await route.fulfill({ json: body });
  });
});

test("stopping a partial stream preserves the submitted draft", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (!url.endsWith("/ai/chat")) return original(input, init);
      return Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  'data: {"type":"text-delta","delta":"Partial reply"}\n\n',
                ),
              );
              // Intentionally remain open and ignore fetch abort, to verify reader cancellation.
            },
            cancel() {
              sessionStorage.setItem("mock-stream-cancelled", "yes");
            },
          }),
          { headers: { "Content-Type": "text/event-stream" } },
        ),
      );
    };
  });
  await page.goto(`/ai?id=${quizId}&question=${questionId}`);
  const composer = page.getByRole("textbox", { name: "Message the assistant" });
  await composer.fill("Explain the derivative");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page
      .locator("iframe")
      .last()
      .contentFrame()
      .getByText("Partial reply", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Previous Conversations", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Stop response", exact: true })
    .click();
  await expect(composer).toBeEnabled();
  await expect(composer).toHaveValue("Explain the derivative");
  await expect(
    page.getByRole("button", { name: "Send message", exact: true }),
  ).toBeEnabled();
  await expect
    .poll(() =>
      page.evaluate(() => sessionStorage.getItem("mock-stream-cancelled")),
    )
    .toBe("yes");
  expect(
    await page.evaluate(() =>
      localStorage.getItem(
        "testownik.v1.chat.assistant-fixture.11111111-1111-4111-8111-111111111111",
      ),
    ),
  ).toBeNull();
});

test("failed request restores draft and retry commits exactly one exchange", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/ai/chat", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].parts[0].text).toBe("Explain the derivative");
    attempts++;
    await route.fulfill(
      attempts === 1
        ? { status: 503, json: { detail: "Temporarily unavailable" } }
        : { contentType: "text/event-stream", body: reply },
    );
  });
  await page.goto(`/ai?id=${quizId}&question=${questionId}`);
  const composer = page.getByRole("textbox", { name: "Message the assistant" });
  const send = page.getByRole("button", { name: "Send message", exact: true });
  await composer.fill("Explain the derivative");
  await send.click();
  await expect(composer).toHaveValue("Explain the derivative");
  await expect(send).toBeEnabled();
  await send.click();
  await expect(
    page
      .locator("iframe")
      .last()
      .contentFrame()
      .getByText("Start with the definition.", { exact: true }),
  ).toBeVisible();
  await expect(composer).toHaveValue("");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem(
              "testownik.v1.chat.assistant-fixture.11111111-1111-4111-8111-111111111111",
            ) ?? "[]",
          ).length,
      ),
    )
    .toBe(2);
  expect(attempts).toBe(2);
});

test("local save failure keeps the successful reply without restoring a duplicate prompt", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("testownik.v1.chat."))
        throw new DOMException("Storage full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.route("**/ai/chat", (route) =>
    route.fulfill({ contentType: "text/event-stream", body: reply }),
  );
  await page.goto(`/ai?id=${quizId}&question=${questionId}`);
  const composer = page.getByRole("textbox", { name: "Message the assistant" });
  await composer.fill("Explain the derivative");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText(
      "The response is available, but this conversation could not be saved on your device.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(composer).toHaveValue("");
  await expect(
    page
      .locator("iframe")
      .last()
      .contentFrame()
      .getByText("Start with the definition.", { exact: true }),
  ).toBeVisible();
});

test("drafts survive restart, stay isolated by question and account, and clear after success", async ({
  page,
}) => {
  const key = `testownik.v1.chat-draft.assistant-fixture.${quizId}.${questionId}`;
  const composer = page.getByRole("textbox", { name: "Message the assistant" });
  await page.goto(`/ai?id=${quizId}&question=${questionId}`);
  await expect(composer).toBeEnabled();
  await composer.fill("Keep my draft — Żółć");
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) ?? "null"),
        key,
      ),
    )
    .toBe("Keep my draft — Żółć");
  await page.reload();
  await expect(composer).toHaveValue("Keep my draft — Żółć");
  await page.goto(
    `/ai?id=${quizId}&question=33333333-3333-4333-8333-333333333333`,
  );
  await expect(composer).toHaveValue("");
  await expect(composer).toBeEnabled();
  await composer.fill("Separate question draft");
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(
          localStorage.getItem(
            "testownik.v1.chat-draft.assistant-fixture.11111111-1111-4111-8111-111111111111.33333333-3333-4333-8333-333333333333",
          ) ?? "null",
        ),
      ),
    )
    .toBe("Separate question draft");
  await page.route("**/api/user/", (route) =>
    route.fulfill({
      json: {
        id: "other-account",
        username: "Other",
        first_name: "Other",
        is_guest: false,
      },
    }),
  );
  await page.evaluate(() =>
    sessionStorage.removeItem("testownik.v1.last-user"),
  );
  await page.goto(`/ai?id=${quizId}&question=${questionId}`);
  await expect(composer).toBeEnabled();
  await expect(composer).toHaveValue("");
  await page.unroute("**/api/user/");
  await page.evaluate(() =>
    sessionStorage.removeItem("testownik.v1.last-user"),
  );
  await page.reload();
  await expect(composer).toHaveValue("Keep my draft — Żółć");
  await page.route("**/ai/chat", (route) =>
    route.fulfill({ contentType: "text/event-stream", body: reply }),
  );
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(composer).toHaveValue("");
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) ?? "null"),
        key,
      ),
    )
    .toBe("");
  await page.reload();
  await expect(composer).toBeEnabled();
  await expect(composer).toHaveValue("");
});

for (const language of ["en", "pl"] as const) {
  test(`${language}: contextual starters and history retain the question on each turn`, async ({
    page,
  }) => {
    await page.addInitScript(
      (language) =>
        localStorage.setItem("testownik.v1.language", JSON.stringify(language)),
      language,
    );
    const requests: Record<string, unknown>[] = [];
    await page.route("**/ai/chat", async (route) => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({ contentType: "text/event-stream", body: reply });
    });
    await page.goto(`/ai?id=${quizId}&question=${questionId}`);
    await page
      .getByRole("button", {
        name: language === "en" ? "Explain the Concept" : "Wyjaśnij pojęcie",
        exact: true,
      })
      .click();
    await expect.poll(() => requests.length).toBe(1);
    const first = requests[0] as {
      messages: { id: string }[];
      questionContextSnapshots: unknown[];
    };
    expect(first.questionContextSnapshots).toEqual([
      { messageId: first.messages[0].id, questionId },
    ]);
    const composer = page.getByRole("textbox", {
      name:
        language === "en" ? "Message the assistant" : "Wiadomość do asystenta",
    });
    await expect
      .poll(() =>
        page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key) ?? "[]").length,
          `testownik.v1.chat.assistant-fixture.${quizId}`,
        ),
      )
      .toBe(2);
    await page.goto(
      `/ai?id=${quizId}&question=33333333-3333-4333-8333-333333333333`,
    );
    await expect(composer).toBeEnabled();
    await composer.fill("Explain this one too");
    await page
      .getByRole("button", {
        name: language === "en" ? "Send message" : "Wyślij wiadomość",
        exact: true,
      })
      .click();
    await expect.poll(() => requests.length).toBe(2);
    const second = requests[1] as {
      questionContextSnapshots: { questionId: string }[];
    };
    expect(second.questionContextSnapshots.map((s) => s.questionId)).toEqual([
      questionId,
      "33333333-3333-4333-8333-333333333333",
    ]);
    await expect
      .poll(() =>
        page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key) ?? "[]").length,
          `testownik.v1.chat.assistant-fixture.${quizId}`,
        ),
      )
      .toBe(4);
    await composer.fill("Preserve my draft");
    // History keeps earlier conversations, so this starts over right away.
    await page
      .getByRole("button", {
        name: language === "en" ? "New Conversation" : "Nowa rozmowa",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", {
        name: language === "en" ? "How Can I Help?" : "Jak mogę Ci pomóc?",
      }),
    ).toBeVisible();
    await expect(composer).toHaveValue("Preserve my draft");
    await page.reload();
    await expect(composer).toHaveValue("Preserve my draft");
    await expect(
      page.getByRole("heading", {
        name: language === "en" ? "How Can I Help?" : "Jak mogę Ci pomóc?",
      }),
    ).toBeVisible();
  });
}

for (const language of ["en", "pl"] as const) {
  test(`structured practice works, survives reopening, and replays context (${language})`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) =>
        localStorage.setItem("testownik.v1.language", JSON.stringify(value)),
      language,
    );
    const questions = [
      {
        text: "Select prime numbers",
        answers: [
          { text: "Two", is_correct: true },
          { text: "Three", is_correct: true },
          { text: "Four", is_correct: false },
        ],
        explanation: "Two and three are prime.",
      },
      {
        text: "Which number is even?",
        answers: [
          { text: "Five", is_correct: false },
          { text: "Six", is_correct: true },
        ],
        explanation: "Six divides by two.",
      },
    ];
    const event = (value: object) => `data: ${JSON.stringify(value)}\n\n`;
    let requests = 0;
    await page.route("**/ai/chat", async (route) => {
      requests++;
      if (requests === 1)
        await route.fulfill({
          contentType: "text/event-stream",
          body:
            event({
              type: "tool-input-available",
              toolName: "generate_practice_questions",
              toolCallId: "practice-1",
              input: { questions },
            }) +
            event({
              type: "tool-output-available",
              toolCallId: "practice-1",
              output: JSON.stringify({ questions }),
            }) +
            "data: [DONE]\n",
        });
      else {
        const body = route.request().postDataJSON();
        expect(body.messages[1].parts[0]).toMatchObject({
          type: "dynamic-tool",
          toolName: "generate_practice_questions",
          toolCallId: "practice-1",
          state: "output-available",
          output: JSON.stringify({ questions }),
        });
        await route.fulfill({ contentType: "text/event-stream", body: reply });
      }
    });
    await page.goto(`/ai?id=${quizId}&question=${questionId}`);
    const composer = page.getByTestId("assistant-composer");
    await composer.fill("Give me two practice questions");
    await page
      .getByRole("button", {
        name: language === "en" ? "Send message" : "Wyślij wiadomość",
        exact: true,
      })
      .click();
    const exercise = page.getByTestId("assistant-practice");
    const check = exercise.getByRole("button", {
      name: language === "en" ? "Check Answer" : "Sprawdź odpowiedź",
      exact: true,
    });
    await expect(exercise).toBeVisible();
    await expect(check).toBeDisabled();
    await exercise.getByTestId("practice-answer-0").click();
    await check.scrollIntoViewIfNeeded();
    const questionTop = (await exercise.boundingBox())!.y;
    await check.click();
    await expect
      .poll(async () =>
        Math.abs((await exercise.boundingBox())!.y - questionTop),
      )
      .toBeLessThan(3);
    await expect(
      exercise.getByText(
        language === "en"
          ? "Not quite. Review the correct answer."
          : "Jeszcze nie. Zobacz poprawną odpowiedź.",
        { exact: true },
      ),
    ).toBeVisible();
    await exercise
      .getByRole("button", {
        name: language === "en" ? "Try Again" : "Spróbuj ponownie",
        exact: true,
      })
      .click();
    await exercise.getByTestId("practice-answer-0").click();
    await exercise.getByTestId("practice-answer-1").click();
    await check.click();
    await expect(
      exercise.getByText(language === "en" ? "Correct!" : "Dobrze!", {
        exact: true,
      }),
    ).toBeVisible();
    await exercise
      .getByRole("button", {
        name: language === "en" ? "Next" : "Następne",
        exact: true,
      })
      .click();
    await expect(exercise.getByRole("radio")).toHaveCount(2);
    await exercise.getByTestId("practice-answer-0").click();
    await exercise.getByTestId("practice-answer-1").click();
    await expect(exercise.getByTestId("practice-answer-0")).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await check.click();
    await expect(
      exercise.getByText(language === "en" ? "Correct!" : "Dobrze!", {
        exact: true,
      }),
    ).toBeVisible();
    await exercise
      .getByRole("button", {
        name: language === "en" ? "Previous" : "Poprzednie",
        exact: true,
      })
      .click();
    await expect(
      exercise.getByText(language === "en" ? "Correct!" : "Dobrze!", {
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    await expect(exercise).toBeVisible();
    await expect(check).toBeDisabled();
    await composer.fill("Explain the first exercise");
    await page
      .getByRole("button", {
        name: language === "en" ? "Send message" : "Wyślij wiadomość",
        exact: true,
      })
      .click();
    await expect.poll(() => requests).toBe(2);
    await expect(page.getByTestId("assistant-reply")).toHaveCount(2);
  });
}

test("malformed tool output has visible feedback instead of an empty successful reply", async ({
  page,
}) => {
  await page.route("**/ai/chat", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: 'data: {"type":"tool-input-available","toolName":"generate_practice_questions","toolCallId":"broken","input":{}}\n\ndata: {"type":"tool-output-available","toolCallId":"broken","output":"not json"}\n\ndata: [DONE]\n',
    }),
  );
  await page.goto(`/ai?id=${quizId}&question=${questionId}`);
  await page.getByTestId("assistant-composer").fill("Create practice");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "This result could not be displayed. Ask the assistant to try again.",
  );
  await expect(page.getByTestId("assistant-composer")).toHaveValue("");
});

test("quiz assistant model is selectable, persists, and leaves the draft intact", async ({
  page,
}) => {
  await page.route("**/api/ai/models/", (route) =>
    route.fulfill({
      json: {
        models: [
          { model: "fixture/deep", label: "Deep Model", provider: "openai" },
        ],
        default_model: "fixture/deep",
      },
    }),
  );
  const requests: { config: { modelName: string | null } }[] = [];
  await page.route("**/ai/chat", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ contentType: "text/event-stream", body: reply });
  });
  await page.goto(`/ai?id=${quizId}&question=${questionId}`);
  const composer = page.getByTestId("assistant-composer");
  await expect(composer).toBeEnabled();
  await composer.fill("Keep this draft while picking a model");
  await page.getByRole("button", { name: "AI Model", exact: true }).click();
  await page.getByRole("radio", { name: "Deep Model", exact: true }).click();
  await expect(composer).toHaveValue("Keep this draft while picking a model");
  await expect(page.getByText("Deep Model", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) ?? "null"),
        `testownik.v1.chat-draft.assistant-fixture.${quizId}.${questionId}`,
      ),
    )
    .toBe("Keep this draft while picking a model");
  await page.reload();
  await expect(composer).toHaveValue("Keep this draft while picking a model");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].config.modelName).toBe("fixture/deep");
  await expect(composer).toBeEnabled();
  await composer.fill("Use the account default now");
  await page.getByRole("button", { name: "AI Model", exact: true }).click();
  await page
    .getByRole("radio", { name: "Use Study Settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].config.modelName).toBeNull();
  await page.route("**/api/quizzes/other-quiz/", (route) =>
    route.fulfill({
      json: {
        id: "other-quiz",
        title: "Other quiz",
        description: "",
        questions: [
          {
            id: questionId,
            text: "Other question",
            answers: [],
            multiple: false,
          },
        ],
      },
    }),
  );
  await page.goto(`/ai?id=other-quiz&question=${questionId}`);
  await expect(page.getByText("Deep Model", { exact: true })).toBeVisible();
  await composer.fill("Use Study Settings for this other quiz too");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect.poll(() => requests.length).toBe(3);
  expect(requests[2].config.modelName).toBeNull();
});

test("model catalog failure has retry and does not silently save a choice", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/api/ai/models/", (route) => {
    attempts++;
    return route.fulfill(
      attempts <= 2
        ? { status: 503, json: { detail: "Unavailable" } }
        : {
            json: {
              models: [{ model: "fixture/deep", label: "Deep Model" }],
              default_model: "fixture/deep",
            },
          },
    );
  });
  await page.goto(`/settings-model?quiz=${quizId}`);
  await expect(
    page.getByRole("heading", { name: "Down for Maintenance", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      `testownik.v1.quiz-ai-model.assistant-fixture.${quizId}`,
    ),
  ).toBeNull();
  await page.getByRole("button", { name: "Try Again", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "Deep Model", exact: true }),
  ).toBeVisible();
});

test("failed saved-history loading can retry without closing the assistant", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.getItem;
    let fail = true;
    Storage.prototype.getItem = function (key) {
      if (fail && key.startsWith("testownik.v1.chat.")) {
        fail = false;
        throw new Error("Device read failed");
      }
      return original.call(this, key);
    };
  });
  await page.goto(`/ai?id=${quizId}&question=${questionId}`);
  const composer = page.getByTestId("assistant-composer");
  await expect(
    page.getByText("Could not open the saved conversation on this device.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(composer).toHaveAttribute("readonly", "");
  await expect(
    page.getByRole("button", { name: "Previous Conversations", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Try Again", exact: true }).click();
  await expect(composer).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Previous Conversations", exact: true }),
  ).toBeEnabled();
  await composer.fill("Recovered draft");
});

test("history remains reachable from an existing thread and browsing never erases it", async ({
  page,
}) => {
  const current = [
    {
      id: "current-user",
      role: "user",
      questionId,
      parts: [{ type: "text", text: "Current question to preserve" }],
    },
    {
      id: "current-reply",
      role: "assistant",
      questionId,
      parts: [{ type: "text", text: "Current reply to preserve" }],
    },
  ];
  await page.addInitScript(
    ({ current, quizId }) => {
      localStorage.setItem(
        `testownik.v1.chat.assistant-fixture.${quizId}`,
        JSON.stringify(current),
      );
    },
    { current, quizId },
  );
  await page.route("**/api/ai/chats/?*", (route) =>
    route.fulfill({
      json: {
        results: [
          {
            id: "saved-thread",
            title: "Saved lesson",
            updated_at: "2026-10-01T10:00:00Z",
            message_count: 1,
          },
        ],
      },
    }),
  );
  let available = false;
  let loads = 0;
  await page.route("**/api/ai/chats/saved-thread/", (route) => {
    loads++;
    return route.fulfill(
      available
        ? {
            json: {
              id: "saved-thread",
              messages: [
                {
                  message_id: "saved-reply",
                  role: "assistant",
                  order: 1,
                  content: [{ type: "text", text: "Selected saved reply" }],
                },
              ],
            },
          }
        : { status: 503, json: { detail: "Unavailable" } },
    );
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(`/ai?id=${quizId}&question=${questionId}`);
  const composer = page.getByTestId("assistant-composer");
  await expect(composer).toBeEditable();
  await composer.fill("Unsent draft to preserve");
  const history = page.getByRole("button", {
    name: "Previous Conversations",
    exact: true,
  });
  await expect(history).toHaveCount(1);
  await expect(history).toBeVisible();
  await history.click();
  await page
    .getByRole("button", { name: "Back to Conversation", exact: true })
    .click();
  await expect(composer).toHaveValue("Unsent draft to preserve");
  await expect(
    page
      .locator("iframe")
      .last()
      .contentFrame()
      .getByText("Current reply to preserve", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      (quizId) =>
        JSON.parse(
          localStorage.getItem(
            `testownik.v1.chat.assistant-fixture.${quizId}`,
          ) ?? "[]",
        ),
      quizId,
    ),
  ).toEqual(current);
  // A failed selection also keeps the current thread until another one loads.
  await history.click();
  await page.getByRole("button", { name: "Saved lesson", exact: true }).click();
  await expect.poll(() => loads).toBe(1);
  await expect(
    page.getByRole("button", { name: "Saved lesson", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      (quizId) =>
        JSON.parse(
          localStorage.getItem(
            `testownik.v1.chat.assistant-fixture.${quizId}`,
          ) ?? "[]",
        ),
      quizId,
    ),
  ).toEqual(current);
  await page
    .getByRole("button", { name: "Back to Conversation", exact: true })
    .click();
  await expect(composer).toHaveValue("Unsent draft to preserve");
  await expect(
    page
      .locator("iframe")
      .last()
      .contentFrame()
      .getByText("Current reply to preserve", { exact: true }),
  ).toBeVisible();
  available = true;
  await history.click();
  await page.getByRole("button", { name: "Saved lesson", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Previous Conversations", exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        (quizId) =>
          JSON.parse(
            localStorage.getItem(
              `testownik.v1.chat.assistant-fixture.${quizId}`,
            ) ?? "[]",
          )[0]?.parts[0]?.text,
        quizId,
      ),
    )
    .toBe("Selected saved reply");
  await expect(
    page
      .locator("iframe")
      .last()
      .contentFrame()
      .getByText("Selected saved reply", { exact: true }),
  ).toBeVisible();
  await expect(composer).toHaveValue("Unsent draft to preserve");
});

test("opening saved history prevents sending against the conversation being replaced", async ({
  page,
}) => {
  await page.route("**/api/ai/chats/?*", (route) =>
    route.fulfill({
      json: {
        results: [
          {
            id: "old-chat",
            title: "Earlier lesson",
            updated_at: "2026-10-01T10:00:00Z",
            message_count: 2,
          },
        ],
      },
    }),
  );
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/ai/chats/old-chat/", async (route) => {
    await pending;
    await route.fulfill({ json: { id: "old-chat", messages: [] } });
  });
  await page.goto(`/ai?id=${quizId}&question=${questionId}`);
  const composer = page.getByTestId("assistant-composer");
  await expect(composer).toBeEditable({ timeout: 15000 });
  await page
    .getByRole("button", { name: "Previous Conversations", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Previous Conversations", exact: true }),
  ).toBeVisible();
  await composer.fill("Do not send into a different conversation");
  await page
    .getByRole("button", { name: "Earlier lesson", exact: true })
    .click();
  try {
    await expect(composer).not.toBeEditable();
    await expect(
      page.getByRole("button", { name: "Previous Conversations", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Send message", exact: true }),
    ).toBeDisabled();
  } finally {
    release();
  }
  await expect(composer).toBeEditable();
  await expect(composer).toHaveValue(
    "Do not send into a different conversation",
  );
});

test("opening the model picker waits for the latest draft to be durable", async ({
  page,
}) => {
  await page.route("**/api/ai/models/", (route) =>
    route.fulfill({
      json: {
        models: [{ model: "fixture/deep", label: "Deep Model" }],
        default_model: "fixture/deep",
      },
    }),
  );
  await page.addInitScript(() => {
    const original = navigator.locks.request.bind(navigator.locks);
    const control = window as typeof window & {
      holdDraft?: boolean;
      releaseDraft?: () => void;
    };
    navigator.locks.request = ((
      name: string,
      options: LockOptions,
      callback: LockGrantedCallback<unknown>,
    ) => {
      return original(name, options, async (lock) => {
        if (control.holdDraft)
          await new Promise<void>((resolve) => {
            control.releaseDraft = resolve;
          });
        return callback(lock);
      });
    }) as typeof navigator.locks.request;
  });
  await page.goto(`/ai?id=${quizId}&question=${questionId}`);
  const composer = page.getByTestId("assistant-composer");
  await expect(composer).toBeEnabled();
  await composer.fill("A draft that must survive quick model navigation");
  await page.evaluate(() => {
    (window as typeof window & { holdDraft?: boolean }).holdDraft = true;
  });
  const model = page.getByRole("button", { name: "AI Model", exact: true });
  await model.click();
  await expect(model).toBeDisabled();
  await expect(composer).toHaveAttribute("readonly", "");
  await expect(
    page.getByRole("button", { name: "Send message", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Previous Conversations", exact: true }),
  ).toBeDisabled();
  expect(new URL(page.url()).pathname).toBe("/ai");
  await expect(composer).toHaveValue(
    "A draft that must survive quick model navigation",
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          typeof (window as typeof window & { releaseDraft?: () => void })
            .releaseDraft,
      ),
    )
    .toBe("function");
  await page.evaluate(() => {
    const control = window as typeof window & {
      holdDraft?: boolean;
      releaseDraft?: () => void;
    };
    control.holdDraft = false;
    control.releaseDraft?.();
  });
  await expect(
    page.getByRole("radio", { name: "Deep Model", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? "null"),
      `testownik.v1.chat-draft.assistant-fixture.${quizId}.${questionId}`,
    ),
  ).toBe("A draft that must survive quick model navigation");
});

test("failed draft storage keeps the assistant open and permits a model-picker retry", async ({
  page,
}) => {
  let aiRequests = 0;
  await page.route("**/ai/chat", (route) => {
    aiRequests += 1;
    return route.abort();
  });
  await page.route("**/api/ai/models/", (route) =>
    route.fulfill({
      json: {
        models: [{ model: "fixture/deep", label: "Deep Model" }],
        default_model: "fixture/deep",
      },
    }),
  );
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    const control = window as typeof window & { failDraft?: boolean };
    control.failDraft = true;
    Storage.prototype.setItem = function (key, value) {
      if (control.failDraft && key.startsWith("testownik.v1.chat-draft."))
        throw new DOMException("synthetic quota failure", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.goto(`/ai?id=${quizId}&question=${questionId}`);
  const composer = page.getByTestId("assistant-composer");
  await expect(composer).toBeEnabled();
  await composer.fill("Retain this unsaved draft");
  const model = page.getByRole("button", { name: "AI Model", exact: true });
  await model.click();
  await expect(
    page.getByText("Could not save your draft on this device.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/ai");
  await expect(composer).toHaveValue("Retain this unsaved draft");
  await expect(model).toBeEnabled();
  await page.evaluate(() => {
    (window as typeof window & { failDraft?: boolean }).failDraft = false;
  });
  await page
    .getByRole("button", { name: "Retry Opening Model Picker", exact: true })
    .click();
  await expect(
    page.getByRole("radio", { name: "Deep Model", exact: true }),
  ).toBeVisible();
  expect(aiRequests).toBe(0);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? "null"),
      `testownik.v1.chat-draft.assistant-fixture.${quizId}.${questionId}`,
    ),
  ).toBe("Retain this unsaved draft");
});
