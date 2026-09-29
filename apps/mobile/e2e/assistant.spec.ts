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
  await page.evaluate(() => localStorage.removeItem("testownik.v1.last-user"));
  await page.goto(`/ai?id=${quizId}&question=${questionId}`);
  await expect(composer).toBeEnabled();
  await expect(composer).toHaveValue("");
  await page.unroute("**/api/user/");
  await page.evaluate(() => localStorage.removeItem("testownik.v1.last-user"));
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
