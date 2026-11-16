import { expect, test, type Page } from "@playwright/test";

const quizId = "11111111-1111-4111-8111-111111111111";
const questionId = "22222222-2222-4222-8222-222222222222";
const accountId = "model-default-fixture";
const accountModel = "fixture/account";
const quizModel = "fixture/quiz";
const settings = {
  initial_reoccurrences: 1,
  wrong_answer_reoccurrences: 1,
  max_question_reoccurrences: 5,
  ai_disabled: false,
  default_ai_model: accountModel,
  notify_quiz_shared: true,
  notify_bug_reported: true,
  notify_marketing: false,
};

async function fixture(page: Page, override: string | null = null) {
  await page.addInitScript(
    ({ accountId, quizId, override }) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({
          access: "model-default-token",
          refresh: "fixture",
        }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
      const key = `testownik.v1.quiz-ai-model.${accountId}.${quizId}`;
      if (localStorage.getItem(key) === null)
        localStorage.setItem(key, JSON.stringify(override));
      // A different account's quiz choice must never affect this account.
      localStorage.setItem(
        `testownik.v1.quiz-ai-model.other-account.${quizId}`,
        JSON.stringify("fixture/other"),
      );
    },
    { accountId, quizId, override },
  );
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json: path.endsWith("/user/")
        ? {
            id: accountId,
            full_name: "Fixture",
            account_level: "gold",
            is_guest: false,
          }
        : path.endsWith("/settings/")
          ? settings
          : path.endsWith("/ai/models/")
            ? {
                models: [
                  {
                    model: accountModel,
                    label: "Account Model",
                    provider: "openai",
                  },
                  {
                    model: quizModel,
                    label: "Quiz Model",
                    provider: "anthropic",
                  },
                ],
                default_model: quizModel,
              }
            : path.includes("/quizzes/")
              ? {
                  id: quizId,
                  title: "Model fixture",
                  description: "",
                  questions: [
                    {
                      id: questionId,
                      text: "What is a derivative?",
                      multiple: false,
                      answers: [
                        {
                          id: "answer",
                          text: "A rate of change",
                          is_correct: true,
                        },
                      ],
                    },
                  ],
                }
              : [],
    });
  });
}

async function send(page: Page) {
  await page.getByTestId("assistant-composer").fill("Explain this question");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
}

test("browsing models and going back preserves the assistant draft without changing its model", async ({
  page,
}) => {
  await fixture(page);
  let writes = 0;
  await page.route("**/api/**", async (route) => {
    if (route.request().method() !== "GET") writes++;
    await route.fallback();
  });
  await page.goto(`/ai?id=${quizId}&question=${questionId}`);
  const composer = page.getByTestId("assistant-composer");
  await composer.fill("Keep this unsent question");
  await page.getByRole("button", { name: "AI Model", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "Account Model", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(composer).toHaveValue("Keep this unsent question");
  expect(writes).toBe(0);
  expect(
    await page.evaluate(
      ({ accountId, quizId }) =>
        localStorage.getItem(
          `testownik.v1.quiz-ai-model.${accountId}.${quizId}`,
        ),
      { accountId, quizId },
    ),
  ).toBe("null");
});

function chatReply(page: Page, requests: (string | null)[]) {
  return page.route("**/ai/chat", (route) => {
    requests.push(route.request().postDataJSON().config.modelName);
    return route.fulfill({
      contentType: "text/event-stream",
      body: 'data: {"type":"text-delta","delta":"The rate of change."}\n\ndata: [DONE]\n\n',
    });
  });
}

test("chat uses the account default and ignores another account's saved override", async ({
  page,
}) => {
  await fixture(page);
  const requests: (string | null)[] = [];
  await chatReply(page, requests);
  await page.goto(`/ai?id=${quizId}&question=${questionId}`);
  await expect(page.getByText("Account Model", { exact: true })).toBeVisible();
  await send(page);
  await expect.poll(() => requests).toEqual([accountModel]);
});

test("quiz override wins and reset restores Study Settings without changing the account", async ({
  page,
}) => {
  await fixture(page, quizModel);
  const requests: (string | null)[] = [];
  const accountWrites: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/settings/") && request.method() !== "GET")
      accountWrites.push(request.method());
  });
  await chatReply(page, requests);
  await page.goto(`/ai?id=${quizId}&question=${questionId}`);
  await send(page);
  await expect.poll(() => requests).toEqual([quizModel]);
  await expect(
    page.getByRole("button", { name: "AI Model", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "AI Model", exact: true }).click();
  const reset = page.getByRole("radio", {
    name: "Use Study Settings",
    exact: true,
  });
  await expect(reset.getByText("Account Model", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "This choice applies only to this quiz. Change your account default in Study Settings.",
      { exact: true },
    ),
  ).toBeVisible();
  await reset.click();
  await expect(
    page
      .getByRole("button", { name: "AI Model", exact: true })
      .getByText("Account Model", { exact: true }),
  ).toBeVisible();
  await send(page);
  await expect.poll(() => requests).toEqual([quizModel, accountModel]);
  expect(accountWrites).toEqual([]);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? '"missing"'),
      `testownik.v1.quiz-ai-model.${accountId}.${quizId}`,
    ),
  ).toBeNull();
  await page.reload();
  await expect(page.getByText("Account Model", { exact: true })).toBeVisible();
  await send(page);
  await expect
    .poll(() => requests)
    .toEqual([quizModel, accountModel, accountModel]);
});

for (const mode of ["hint", "explain"] as const) {
  for (const override of [null, quizModel]) {
    test(`${mode} uses ${override ? "the quiz override" : "Study Settings"}`, async ({
      page,
    }) => {
      await fixture(page, override);
      const requests: (string | null)[] = [];
      await page.route(`**/ai/${mode}`, (route) => {
        requests.push(route.request().postDataJSON().config.modelName);
        return route.fulfill({
          contentType: "text/plain",
          body:
            mode === "hint"
              ? "<general_hint>Think about change.</general_hint>"
              : "It measures change.",
        });
      });
      await page.goto(`/hint?id=${quizId}&question=${questionId}&mode=${mode}`);
      await expect.poll(() => requests).toEqual([override ?? accountModel]);
    });
  }
}

test("missing account settings exposes retry before sending any AI request", async ({
  page,
}) => {
  await fixture(page);
  let available = false;
  await page.route("**/api/settings/", (route) =>
    route.fulfill(
      available
        ? { json: settings }
        : { status: 503, json: { detail: "Unavailable" } },
    ),
  );
  const requests: (string | null)[] = [];
  await chatReply(page, requests);
  await page.goto(`/ai?id=${quizId}&question=${questionId}`);
  await page.getByTestId("assistant-composer").fill("Keep this draft");
  await expect(
    page.getByRole("button", { name: "Send message", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Try Again", exact: true }),
  ).toBeVisible();
  expect(requests).toEqual([]);
  available = true;
  await page.getByRole("button", { name: "Try Again", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Send message", exact: true }),
  ).toBeEnabled();
  await expect(page.getByTestId("assistant-composer")).toHaveValue(
    "Keep this draft",
  );
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect.poll(() => requests).toEqual([accountModel]);
});

test("an explicit quiz model still works while account settings are unavailable", async ({
  page,
}) => {
  await fixture(page, quizModel);
  await page.route("**/api/settings/", (route) =>
    route.fulfill({ status: 503, json: { detail: "Unavailable" } }),
  );
  const requests: (string | null)[] = [];
  await chatReply(page, requests);
  await page.goto(`/ai?id=${quizId}&question=${questionId}`);
  await send(page);
  await expect.poll(() => requests).toEqual([quizModel]);
});

test("hint recovers after the account default could not be loaded", async ({
  page,
}) => {
  await fixture(page);
  let available = false;
  await page.route("**/api/settings/", (route) =>
    route.fulfill(
      available
        ? { json: settings }
        : { status: 503, json: { detail: "Unavailable" } },
    ),
  );
  const requests: (string | null)[] = [];
  await page.route("**/ai/hint", (route) => {
    requests.push(route.request().postDataJSON().config.modelName);
    return route.fulfill({
      contentType: "text/plain",
      body: "<general_hint>Think about change.</general_hint>",
    });
  });
  await page.goto(`/hint?id=${quizId}&question=${questionId}&mode=hint`);
  await expect(page.getByRole("alert")).toBeVisible();
  expect(requests).toEqual([]);
  available = true;
  await page.getByRole("button", { name: "Try Again", exact: true }).click();
  await expect(page.getByTestId("hint-response")).toHaveAccessibleName(
    "Think about change.",
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect.poll(() => requests).toEqual([accountModel]);
});

for (const override of [null, quizModel]) {
  test(`picker can create an override while settings fail (${override ? "existing override" : "no override"})`, async ({
    page,
  }) => {
    await fixture(page, override);
    await page.route("**/api/settings/", (route) =>
      route.fulfill({ status: 503, json: { detail: "Unavailable" } }),
    );
    const requests: (string | null)[] = [];
    await chatReply(page, requests);
    await page.goto(`/ai?id=${quizId}&question=${questionId}`);
    await page.getByRole("button", { name: "AI Model", exact: true }).click();
    const reset = page.getByRole("radio", {
      name: "Use Study Settings",
      exact: true,
    });
    await expect(reset).toBeVisible();
    // Unknown account settings must not be presented as the global model.
    await expect(reset).toHaveText("Use Study Settings");
    await page.getByRole("radio", { name: "Quiz Model", exact: true }).click();
    await send(page);
    await expect.poll(() => requests).toEqual([quizModel]);
  });
}

test("null account preference uses Testownik's default without inventing an override", async ({
  page,
}) => {
  await fixture(page);
  await page.route("**/api/settings/", (route) =>
    route.fulfill({ json: { ...settings, default_ai_model: null } }),
  );
  const requests: (string | null)[] = [];
  await chatReply(page, requests);
  await page.goto(`/ai?id=${quizId}&question=${questionId}`);
  await expect(page.getByText("Quiz Model", { exact: true })).toBeVisible();
  await send(page);
  await expect.poll(() => requests).toEqual([null]);
  await expect(
    page.getByRole("button", { name: "AI Model", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "AI Model", exact: true }).click();
  await expect(
    page
      .getByRole("radio", { name: "Use Study Settings", exact: true })
      .getByText("Quiz Model", { exact: true }),
  ).toBeVisible();
});

test("global model catalog failure keeps the default usable and the picker available", async ({
  page,
}) => {
  await fixture(page);
  await page.route("**/api/settings/", (route) =>
    route.fulfill({ json: { ...settings, default_ai_model: null } }),
  );
  let modelReads = 0;
  await page.route("**/api/ai/models/", (route) => {
    modelReads++;
    return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
  });
  const requests: (string | null)[] = [];
  await chatReply(page, requests);
  await page.goto(`/ai?id=${quizId}&question=${questionId}`);
  await expect.poll(() => modelReads).toBeGreaterThan(0);
  await expect(page.getByText("Default", { exact: true })).toBeVisible();
  await send(page);
  await expect.poll(() => requests).toEqual([null]);
  await page.getByRole("button", { name: "AI Model", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Try Again", exact: true }),
  ).toBeVisible();
});

test("an unlisted global default shows its identifier without creating a quiz override", async ({
  page,
}) => {
  await fixture(page);
  await page.route("**/api/settings/", (route) =>
    route.fulfill({ json: { ...settings, default_ai_model: null } }),
  );
  await page.route("**/api/ai/models/", (route) =>
    route.fulfill({
      json: { models: [], default_model: "fixture/global-unlisted" },
    }),
  );
  const requests: (string | null)[] = [];
  await chatReply(page, requests);
  await page.goto(`/ai?id=${quizId}&question=${questionId}`);
  await expect(
    page.getByText("fixture/global-unlisted", { exact: true }),
  ).toBeVisible();
  await send(page);
  await expect.poll(() => requests).toEqual([null]);
  await page.getByRole("button", { name: "AI Model", exact: true }).click();
  await expect(
    page
      .getByRole("radio", { name: "Use Study Settings", exact: true })
      .getByText("fixture/global-unlisted", { exact: true }),
  ).toBeVisible();
});

test("assistant model row shows loading until the global catalog name is available", async ({
  page,
}) => {
  await fixture(page);
  await page.route("**/api/settings/", (route) =>
    route.fulfill({ json: { ...settings, default_ai_model: null } }),
  );
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reads = 0;
  await page.route("**/api/ai/models/", async (route) => {
    reads++;
    await ready;
    await route.fulfill({
      json: {
        models: [{ model: quizModel, label: "Quiz Model" }],
        default_model: quizModel,
      },
    });
  });
  await page.goto(`/ai?id=${quizId}&question=${questionId}`);
  const row = page.getByRole("button", { name: "AI Model", exact: true });
  try {
    await expect.poll(() => reads).toBe(1);
    await expect(row.getByText("Loading…", { exact: true })).toBeVisible();
    await page
      .getByTestId("assistant-composer")
      .fill("Keep this draft while labels load");
    await expect(
      page.getByRole("button", { name: "Send message", exact: true }),
    ).toBeEnabled();
  } finally {
    release();
  }
  await expect(row.getByText("Quiz Model", { exact: true })).toBeVisible();
  await expect(page.getByTestId("assistant-composer")).toHaveValue(
    "Keep this draft while labels load",
  );
});

for (const override of [null, quizModel]) {
  test(`explicit ${override ? "quiz" : "account"} choice stays usable when catalog labels fail`, async ({
    page,
  }) => {
    await fixture(page, override);
    await page.route("**/api/ai/models/", (route) =>
      route.fulfill({ status: 503, json: { detail: "Unavailable" } }),
    );
    const requests: (string | null)[] = [];
    await chatReply(page, requests);
    await page.goto(`/ai?id=${quizId}&question=${questionId}`);
    await expect(
      page.getByText(override ?? accountModel, { exact: true }),
    ).toBeVisible();
    await send(page);
    await expect.poll(() => requests).toEqual([override ?? accountModel]);
  });
}

test("an account default changed in Study Settings reaches the assistant through the shared cache", async ({
  page,
}) => {
  await fixture(page);
  let saved = { ...settings };
  let reads = 0;
  let writes = 0;
  await page.route("**/api/settings/", (route) => {
    if (route.request().method() === "PATCH") {
      writes++;
      saved = route.request().postDataJSON();
    } else reads++;
    return route.fulfill({ json: saved });
  });
  const requests: (string | null)[] = [];
  await chatReply(page, requests);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Quiz Model", exact: true }).click();
  await expect.poll(() => writes).toBe(1);
  // Wait for the save response to update the shared query, then use the same
  // router/document so a fresh application boot cannot hide a cache defect.
  await expect.poll(() => saved.default_ai_model).toBe(quizModel);
  await page.evaluate(
    ({ quizId, questionId }) => {
      history.pushState({}, "", `/ai?id=${quizId}&question=${questionId}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
    { quizId, questionId },
  );
  await expect(page.getByText("Quiz Model", { exact: true })).toBeVisible();
  await send(page);
  await expect.poll(() => requests).toEqual([quizModel]);
  expect(reads).toBe(1);
});

test("uncached account default fails with retry when a quiz hint is opened offline", async ({
  page,
}) => {
  await fixture(page);
  let settingsRequests = 0;
  let available = false;
  await page.route("**/api/settings/", (route) => {
    settingsRequests++;
    return available
      ? route.fulfill({ json: settings })
      : route.abort("internetdisconnected");
  });
  const requests: (string | null)[] = [];
  await page.route("**/ai/hint", (route) => {
    requests.push(route.request().postDataJSON().config.modelName);
    return route.fulfill({
      contentType: "text/plain",
      body: "<general_hint>Connection restored.</general_hint>",
    });
  });
  await page.goto(`/quiz/${quizId}`);
  const hint = page.getByRole("button", { name: "AI Hint", exact: true });
  await expect(hint).toBeVisible();
  await page.context().setOffline(true);
  await hint.click();
  await expect(
    page.getByRole("button", { name: "Try Again", exact: true }),
  ).toBeVisible();
  expect(settingsRequests).toBeGreaterThan(0);
  expect(requests).toEqual([]);
  available = true;
  await page.context().setOffline(false);
  await page.getByRole("button", { name: "Try Again", exact: true }).click();
  await expect(page.getByTestId("hint-response")).toHaveAccessibleName(
    "Connection restored.",
  );
  await expect.poll(() => requests).toEqual([accountModel]);
});

test("background account-model refresh does not restart a streaming hint", async ({
  page,
}) => {
  await fixture(page);
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (!url.endsWith("/ai/hint")) return original(input, init);
      const models = JSON.parse(
        sessionStorage.getItem("hint-model-requests") ?? "[]",
      );
      models.push(JSON.parse(String(init?.body)).config.modelName);
      sessionStorage.setItem("hint-model-requests", JSON.stringify(models));
      return Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  "<general_hint>Streaming hint.</general_hint>",
                ),
              );
            },
            cancel() {
              sessionStorage.setItem("hint-model-cancelled", "yes");
            },
          }),
          { headers: { "Content-Type": "text/plain" } },
        ),
      );
    };
  });
  let preference = accountModel;
  await page.route("**/api/settings/", (route) =>
    route.fulfill({ json: { ...settings, default_ai_model: preference } }),
  );
  // Seed the shared settings cache, then age it before opening the hint. The
  // already mounted Study Settings observer will refresh the same query.
  await page.goto("/settings");
  await expect(page.getByText("Account Model", { exact: true })).toBeVisible();
  await page.clock.install();
  await page.clock.fastForward(31000);
  preference = quizModel;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/settings/", async (route) => {
    await gate;
    await route.fulfill({
      json: { ...settings, default_ai_model: preference },
    });
  });
  // Navigate through Expo Router without reloading the document/cache.
  await page.evaluate(
    ({ quizId, questionId }) => {
      // React Navigation listens to popstate for browser history navigation.
      history.pushState(
        {},
        "",
        `/hint?id=${quizId}&question=${questionId}&mode=hint`,
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
    { quizId, questionId },
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(sessionStorage.getItem("hint-model-requests") ?? "[]"),
      ),
    )
    .toEqual([accountModel]);
  const refreshedSettings = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/settings/") && response.status() === 200,
  );
  release();
  await (await refreshedSettings).finished();
  // Let the query response commit and effects run after the refresh completes.
  await page.clock.runFor(100);
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(sessionStorage.getItem("hint-model-requests") ?? "[]"),
      ),
    )
    .toEqual([accountModel]);
  expect(
    await page.evaluate(() => sessionStorage.getItem("hint-model-cancelled")),
  ).toBeNull();
});
