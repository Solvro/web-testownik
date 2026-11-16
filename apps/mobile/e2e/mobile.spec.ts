import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";

// Mutation coverage is opt-in and requires a disposable SQLite fixture runner.
const enabled = !!process.env.MOBILE_E2E_DB && !!process.env.MOBILE_E2E_BACKEND;
test.skip(
  !enabled,
  "Run with the isolated OAuth fixture environment; never personal tokens.",
);
const api = "http://127.0.0.1:8768/api";
let tokens: { access: string; refresh: string };
test.beforeEach(async ({ page, context, request }) => {
  tokens = JSON.parse(
    execFileSync(
      process.env.MOBILE_E2E_PYTHON ?? "python3",
      [path.resolve("scripts/e2e-oauth-fixture.py")],
      { encoding: "utf8" },
    ),
  );
  const updated = await request.patch(`${api}/settings/`, {
    headers: { Authorization: `Bearer ${tokens.access}` },
    data: { initial_reoccurrences: 1 },
  });
  expect(updated.ok()).toBeTruthy();
  await context.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: `${api}${url.pathname.slice(4)}${url.search}`,
    });
    await route.fulfill({ response });
  });
  await page.addInitScript((tokens) => {
    if (!sessionStorage.getItem("testownik.e2e.initialized")) {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify(tokens),
      );
      sessionStorage.setItem("testownik.e2e.initialized", "true");
      localStorage.setItem("testownik.v1.language", JSON.stringify("pl"));
    }
  }, tokens);
});
test.afterEach(async ({ page, context }) => {
  await page.unrouteAll({ behavior: "wait" });
  await context.unrouteAll({ behavior: "wait" });
});
test("create, study, persist progress, inspect statistics and settings", async ({
  page,
}) => {
  await page.goto("/editor");
  await page
    .getByRole("textbox", { name: "Tytuł quizu", exact: true })
    .fill("Mobilna matematyka");
  await page
    .getByRole("textbox", { name: "Treść pytania", exact: true })
    .fill("Ile wynosi $2 + 2$?");
  await page
    .getByRole("textbox", { name: "Odpowiedź 1", exact: true })
    .fill("Cztery");
  await page
    .getByRole("textbox", { name: "Odpowiedź 2", exact: true })
    .fill("Pięć");
  await page.getByRole("button", { name: "Zapisz quiz", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "Cztery", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/study-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("radio", { name: "Cztery", exact: true }).click();
  await page.getByRole("button", { name: "Sprawdź", exact: true }).click();
  await expect(page.getByText("Dobrze!", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Dalej", exact: true }).click();
  await expect(
    page.getByText("Quiz ukończony!", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Quiz ukończony!", { exact: true }),
  ).toBeVisible();
  const studyUrl = page.url();
  const historyQuizId = new URL(studyUrl).pathname.split("/").pop();
  await page.goto(`/history?id=${historyQuizId}`);
  await expect(
    page.getByText("Bieżąca sesja · 1 z 1 poprawnie", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Poprawnie: Ile wynosi $2 + 2$?",
      exact: false,
    })
    .click();
  await expect(
    page.getByLabel("Poprawna odpowiedź", { exact: true }),
  ).toBeVisible();
  await expect(
    page.frameLocator("iframe").nth(1).getByText("Cztery", { exact: true }),
  ).toBeVisible();
  await page.goto(studyUrl);
  await page
    .getByRole("button", { name: "Wyniki i historia sesji", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Otwórz raport", exact: true }),
  ).toBeVisible();
  // Native embedded-report rendering is covered by its own signed-in iOS test.
  const quizId = new URL(page.url()).searchParams.get("id");
  const stats = await page.request.get(`${api}/quizzes/${quizId}/stats/`, {
    headers: { Authorization: `Bearer ${tokens.access}` },
  });
  expect((await stats.json()).total_answers).toBe(1);
  await page.goto("/settings");
  const setting = page.getByText("Do opanowania: 1", { exact: true });
  await expect(setting).toBeVisible();
  await setting
    .locator("..")
    .getByRole("button", { name: "+", exact: true })
    .click();
  // Settings save automatically after a short pause.
  await page.waitForResponse(
    (response) =>
      response.url().includes("/settings/") &&
      response.request().method() === "PATCH",
  );
  await page.reload();
  await expect(
    page.getByText("Do opanowania: 2", { exact: true }),
  ).toBeVisible();
});
test("offline answer survives restart and synchronizes once", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Dodaj quiz", exact: true }),
  ).toBeVisible();
  const tokens = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("testownik.oauth-session.v2")!),
  );
  const response = await request.post(`${api}/quizzes/`, {
    headers: { Authorization: `Bearer ${tokens.access}` },
    data: {
      title: "Offline quiz",
      description: "",
      questions: [
        {
          text: "Pytanie offline",
          order: 1,
          multiple: false,
          answers: [
            { text: "Tak", order: 1, is_correct: true },
            { text: "Nie", order: 2, is_correct: false },
          ],
        },
      ],
    },
  });
  expect(response.ok()).toBeTruthy();
  const quiz = await response.json();
  await page.goto(`/quiz/${quiz.id}`);
  await expect(
    page.getByRole("radio", { name: "Tak", exact: true }),
  ).toBeVisible();
  await page.route("**/api/**", (route) => route.abort("internetdisconnected"));
  await page.getByRole("radio", { name: "Tak", exact: true }).click();
  await page.getByRole("button", { name: "Sprawdź", exact: true }).click();
  await expect(page.getByText("Dobrze!", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Dalej", exact: true }).click();
  await page.reload();
  await expect(
    page.getByText("Quiz ukończony!", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/**");
  await page.getByRole("button", { name: "Synchronizuj", exact: true }).click();
  await expect
    .poll(async () => {
      const r = await request.get(`${api}/quizzes/${quiz.id}/stats/`, {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      return (await r.json()).total_answers;
    })
    .toBe(1);
});
test("library and profile render at phone and tablet sizes", async ({
  page,
}) => {
  await page.goto("/library");
  await expect(
    page.getByRole("textbox", { name: "Szukaj quizu", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/library-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.goto("/profile");
  await expect(
    page.getByRole("button", { name: "Ustawienia nauki", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/profile-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("import, share, rate, comment and protect privacy during a failed update", async ({
  page,
}) => {
  await page.goto("/import");
  await page.getByRole("button", { name: "Wklej JSON", exact: true }).click();
  await page.getByRole("textbox", { name: "JSON quizu", exact: true }).fill(
    JSON.stringify({
      title: "Import E2E",
      questions: [
        {
          text: "Imported question",
          answers: [
            { text: "Yes", is_correct: true },
            { text: "No", is_correct: false },
          ],
        },
      ],
    }),
  );
  await page.getByRole("button", { name: "Sprawdź quiz", exact: true }).click();
  await page
    .getByRole("button", { name: "Importuj i rozpocznij naukę", exact: true })
    .click();
  await expect(
    page.getByRole("radio", { name: "Yes", exact: true }),
  ).toBeVisible();
  const importedId = new URL(page.url()).pathname.split("/").at(-1);
  const imported = await page.request.get(`${api}/quizzes/${importedId}/`, {
    headers: { Authorization: `Bearer ${tokens.access}` },
  });
  expect((await imported.json()).visibility).toBe(0);
  await page.getByRole("button", { name: "Opcje quizu", exact: true }).click();
  await page
    .getByRole("button", { name: "Opinie i komentarze", exact: true })
    .click();
  // Tapping a star saves the rating.
  await page.getByRole("button", { name: "Ocena 5 z 5", exact: true }).click();
  await expect(page.getByText("Twoja ocena: 5/5")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Twój komentarz", exact: true })
    .fill("Test integration comment");
  await page
    .getByRole("button", { name: "Wyślij komentarz", exact: true })
    .click();
  await expect(
    page.getByText("Test integration comment", { exact: true }),
  ).toBeVisible();
  page.on("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Usuń komentarz", exact: true })
    .click();
  await expect(
    page.getByText("Test integration comment", { exact: true }),
  ).toHaveCount(0);
  const id = new URL(page.url()).searchParams.get("id");
  await page.goto(`/share?id=${id}`);
  await page
    .getByRole("button", { name: "Zmień widoczność", exact: true })
    .click();
  await page.getByRole("button", { name: "Publiczny", exact: true }).click();
  await expect
    .poll(async () =>
      page.request
        .get(`${api}/quizzes/${id}/`, {
          headers: { Authorization: `Bearer ${tokens.access}` },
        })
        .then((r) => r.json())
        .then((r) => r.visibility),
    )
    .toBe(3);
  await page.goto("/account");
  const toggle = page.getByRole("switch", {
    name: "Ukryj profil",
    exact: true,
  });
  await expect(toggle).toBeVisible();
  const wasChecked = await toggle.isChecked();
  await page.route("**/api/user/", async (route) => {
    if (route.request().method() === "PATCH")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: "{}",
      });
    else await route.continue();
  });
  await toggle.click();
  await expect(
    page.getByText("Przerwa techniczna. Spróbuj ponownie później.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Nie zapisano zmiany",
      exact: true,
    }),
  ).toBeVisible();
  await expect(toggle).toBeChecked({ checked: wasChecked });
  await page.screenshot({
    path: `test-results/privacy-failure-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("folder creation and protected-folder controls", async ({ page }) => {
  await page.goto("/library");
  await expect(
    page.getByRole("button", { name: "Usuń folder", exact: true }),
  ).toHaveCount(0);
  const name = `Folder ${test.info().project.name} ${Date.now()}`;
  await page
    .getByRole("button", { name: "Dodaj do biblioteki", exact: true })
    .click();
  await page.getByRole("button", { name: "Nowy folder", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Nazwa folderu", exact: true })
    .fill(name);
  await page
    .getByRole("button", { name: "Utwórz folder", exact: true })
    .click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  page.on("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: `Opcje: ${name}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Usuń folder", exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  await page.getByText("Kosz", { exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Nazwa folderu", exact: true }),
  ).toHaveCount(0);
});

test("editor load failure never replaces an existing quiz with an empty draft", async ({
  page,
  request,
}) => {
  const created = await request.post(`${api}/quizzes/`, {
    headers: { Authorization: `Bearer ${tokens.access}` },
    data: {
      title: "Editor recovery fixture",
      description: "Keep this content after a failed load",
      questions: [
        {
          id: randomUUID(),
          text: "Original question",
          order: 1,
          multiple: false,
          answers: [
            {
              id: randomUUID(),
              text: "Original answer",
              order: 1,
              is_correct: true,
            },
          ],
        },
      ],
    },
  });
  expect(created.ok()).toBeTruthy();
  const quiz = (await created.json()) as { id: string };
  const path = `**/api/quizzes/${quiz.id}/`;
  await page.route(path, (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
  await page.goto(`/editor?id=${quiz.id}`);
  await expect(
    page.getByRole("heading", {
      name: "Nie udało się otworzyć quizu",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Tytuł quizu", exact: true }),
  ).toHaveCount(0);
  await page.unroute(path);
  await page
    .getByRole("button", { name: "Spróbuj ponownie", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Tytuł quizu", exact: true }),
  ).toHaveValue("Editor recovery fixture");
  await expect(
    page.getByRole("textbox", { name: "Treść pytania", exact: true }),
  ).toHaveValue("Original question");
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Treść pytania", exact: true }),
  ).toHaveValue("Original question");
});

test("owned quiz can be archived, trashed and restored from the library", async ({
  page,
  request,
}) => {
  const title = `Recovery ${randomUUID()}`;
  const created = await request.post(`${api}/quizzes/`, {
    headers: { Authorization: `Bearer ${tokens.access}` },
    data: {
      title,
      description: "",
      questions: [
        {
          id: randomUUID(),
          text: "Recovery question",
          order: 1,
          multiple: false,
          answers: [
            { id: randomUUID(), text: "Answer", order: 1, is_correct: true },
          ],
        },
      ],
    },
  });
  expect(created.ok()).toBeTruthy();
  await page.goto("/library");
  await page
    .getByRole("button", { name: `Opcje: ${title}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Archiwizuj", exact: true }).click();
  await expect(
    page.getByText(title, { exact: true }).filter({ visible: true }),
  ).toHaveCount(0);
  await page.getByText("Archiwum", { exact: true }).click();
  await page
    .getByRole("button", { name: `Opcje: ${title}`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Przywróć do biblioteki", exact: true })
    .click();
  await expect(
    page.getByText(title, { exact: true }).filter({ visible: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: /back$/i }).first().click();
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: `Opcje: ${title}`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Przenieś do kosza", exact: true })
    .click();
  await expect(
    page.getByText(title, { exact: true }).filter({ visible: true }),
  ).toHaveCount(0);
  await page.getByText("Kosz", { exact: true }).click();
  await page
    .getByRole("button", { name: `Opcje: ${title}`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Przywróć do biblioteki", exact: true })
    .click();
  await expect(
    page.getByText(title, { exact: true }).filter({ visible: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: /back$/i }).first().click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});

test("sign-out removes protected history and rejects a protected deep link", async ({
  page,
}) => {
  await page.goto("/editor");
  await page
    .getByRole("textbox", { name: "Tytuł quizu", exact: true })
    .fill("Private local draft");
  await page.goto("/profile");
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Wyloguj się", exact: true }).click();
  await expect(
    page.getByText("Ucz się po swojemu.", { exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByText("Ucz się po swojemu.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Tytuł quizu", exact: true }),
  ).toHaveCount(0);
  await page.goto("/settings");
  await expect(
    page.getByText("Ucz się po swojemu.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Zapisz ustawienia", { exact: true }),
  ).toHaveCount(0);
});

test("hint and assistant keep the selected answer and recover a failed response", async ({
  page,
  request,
}) => {
  const created = await request.post(`${api}/quizzes/`, {
    headers: { Authorization: `Bearer ${tokens.access}` },
    data: {
      title: "AI sheet fixture",
      description: "",
      questions: [
        {
          id: randomUUID(),
          text: "Context for native assistance",
          order: 1,
          multiple: false,
          answers: [
            {
              id: randomUUID(),
              text: "Selected answer",
              order: 1,
              is_correct: true,
            },
          ],
        },
      ],
    },
  });
  expect(created.ok()).toBeTruthy();
  const quiz = await created.json();
  await page.route("**/ai/hint", async (route) => {
    expect(route.request().postDataJSON().question.text).toBe(
      "Context for native assistance",
    );
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    await route.fulfill({
      contentType: "text/plain",
      body: "Consider the first principle.",
    });
  });
  let attempts = 0;
  await page.route("**/ai/chat", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.question.text).toBe("Context for native assistance");
    expect(body.messages.at(-1).parts[0].text).toBe("Explain the principle");
    if (++attempts === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ code: "ai_disabled" }),
      });
    } else {
      await route.fulfill({
        contentType: "text/event-stream",
        body: 'data: {"type":"text-delta","delta":"Start with the definition."}\n\ndata: {"type":"finish"}\n\ndata: [DONE]\n\n',
      });
    }
  });
  await page.goto(`/quiz/${quiz.id}`);
  await page
    .getByRole("radio", { name: "Selected answer", exact: true })
    .click();
  await expect(
    page.getByRole("radio", { name: "Selected answer", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Podpowiedź AI", exact: true })
    .click();
  await expect(
    page
      .getByRole("heading", { name: "Podpowiedź AI", exact: true })
      .locator("..")
      .locator("..")
      .locator("iframe")
      .contentFrame()
      .getByText("Consider the first principle.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Zamknij podpowiedź", exact: true })
    .click();
  await expect(
    page.getByRole("radio", { name: "Selected answer", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Asystent", exact: true }).click();
  const prompt = page.getByRole("textbox", {
    name: "Wiadomość do asystenta",
    exact: true,
  });
  await prompt.fill("Explain the principle");
  await page
    .getByRole("button", { name: "Wyślij wiadomość", exact: true })
    .click();
  await expect(
    page.getByText(
      "Asystent jest chwilowo niedostępny. Spróbuj ponownie później.",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  await expect(prompt).toHaveValue("Explain the principle");
  await page
    .getByRole("button", { name: "Wyślij wiadomość", exact: true })
    .click();
  await expect(
    page
      .locator("iframe")
      .filter({ visible: true })
      .last()
      .contentFrame()
      .getByText("Start with the definition.", { exact: true }),
  ).toBeVisible();
  await expect(prompt).toHaveValue("");
  await page.goBack();
  await expect(
    page.getByRole("radio", { name: "Selected answer", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Sprawdź", exact: true }).click();
  await expect(page.getByText("Dobrze!", { exact: true })).toBeVisible();
});

test("assistant explains and recovers a missing quiz context", async ({
  page,
  request,
}) => {
  const questionId = randomUUID();
  const created = await request.post(`${api}/quizzes/`, {
    headers: { Authorization: `Bearer ${tokens.access}` },
    data: {
      title: "Assistant recovery fixture",
      description: "",
      questions: [
        {
          id: questionId,
          text: "Recovered question context",
          order: 1,
          multiple: false,
          answers: [
            { id: randomUUID(), text: "Answer", order: 1, is_correct: true },
          ],
        },
      ],
    },
  });
  expect(created.ok()).toBeTruthy();
  const quiz = await created.json();
  const path = `**/api/quizzes/${quiz.id}/`;
  await page.route(path, (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
  await page.goto(`/ai?id=${quiz.id}&question=${quiz.questions[0].id}`);
  await expect(
    page.getByText("Nie udało się otworzyć pytania", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Wyślij wiadomość", exact: true }),
  ).toBeDisabled();
  await page.unroute(path);
  await page
    .getByRole("button", { name: "Spróbuj ponownie", exact: true })
    .click();
  // The recovered question brings back the question-specific starters.
  await expect(
    page.getByRole("button", { name: "Wyjaśnij pojęcie", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Wiadomość do asystenta", exact: true })
    .fill("Explain");
  await expect(
    page.getByRole("button", { name: "Wyślij wiadomość", exact: true }),
  ).toBeEnabled();
});

test("large quiz editor keeps rapid edits and restores its draft", async ({
  page,
  request,
}) => {
  const created = await request.post(`${api}/quizzes/`, {
    headers: { Authorization: `Bearer ${tokens.access}` },
    data: {
      title: "Large editor fixture",
      description: "500-question disposable regression fixture",
      questions: Array.from({ length: 500 }, (_, index) => ({
        id: randomUUID(),
        text: `Question ${index + 1}`,
        order: index + 1,
        multiple: false,
        answers: [
          { id: randomUUID(), text: "Correct", order: 1, is_correct: true },
          { id: randomUUID(), text: "Other", order: 2, is_correct: false },
        ],
      })),
    },
  });
  expect(created.ok()).toBeTruthy();
  const quiz = await created.json();
  await page.goto(`/editor?id=${quiz.id}`);
  await expect(
    page.getByRole("heading", { name: "Pytanie 1 z 500", exact: true }),
  ).toBeVisible();
  const question = page.getByRole("textbox", {
    name: "Treść pytania",
    exact: true,
  });
  await question.fill("");
  const text =
    "Rapid editing preserves every character in a large question bank.";
  const started = performance.now();
  await question.pressSequentially(text);
  await expect(question).toHaveValue(text);
  await test.info().attach("large-editor-typing", {
    body: JSON.stringify({
      questions: 500,
      characters: text.length,
      elapsedMs: performance.now() - started,
    }),
    contentType: "application/json",
  });
  await page
    .getByRole("button", { name: "Następne pytanie", exact: true })
    .click();
  await expect(question).toHaveValue("Question 2");
  await page
    .getByRole("button", { name: "Poprzednie pytanie", exact: true })
    .click();
  await expect(question).toHaveValue(text);
  // Leaving the editor flushes its draft; reopening must not reload stale server text.
  await page.goto("/library");
  await page.goto(`/editor?id=${quiz.id}`);
  await expect(question).toHaveValue(text);
  const original = await request.get(`${api}/quizzes/${quiz.id}/`, {
    headers: { Authorization: `Bearer ${tokens.access}` },
  });
  expect((await original.json()).questions[0].text).toBe("Question 1");
});

test("English account privacy controls save and persist", async ({ page }) => {
  await page.goto("/account");
  await page.evaluate(() =>
    localStorage.setItem("testownik.v1.language", JSON.stringify("en")),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Account & Privacy", exact: true }),
  ).toBeVisible();
  const privacy = page.getByRole("switch", {
    name: "Hide Profile",
    exact: true,
  });
  const previous = await privacy.isChecked();
  await privacy.click();
  await expect(privacy).toBeChecked({ checked: !previous });
  await page.reload();
  await expect(privacy).toBeChecked({ checked: !previous });
  await expect(page.getByText("Connected Apps", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Privacy Policy", exact: true }),
  ).toBeVisible();
});

test("edit a targeted question and preserve the other server questions", async ({
  page,
  request,
}) => {
  const created = await request.post(`${api}/quizzes/`, {
    headers: { Authorization: `Bearer ${tokens.access}` },
    data: {
      title: "Targeted editor fixture",
      description: "",
      visibility: 0,
      questions: ["Keep this question", "Edit this question"].map(
        (text, index) => ({
          text,
          order: index + 1,
          multiple: false,
          answers: [
            { text: "Yes", order: 1, is_correct: true },
            { text: "No", order: 2, is_correct: false },
          ],
        }),
      ),
    },
  });
  expect(created.ok()).toBeTruthy();
  const quiz = await created.json();
  const first = quiz.questions[0],
    target = quiz.questions[1];
  await page.goto(`/editor?id=${quiz.id}&question=${target.id}`);
  const question = page.getByRole("textbox", {
    name: "Treść pytania",
    exact: true,
  });
  await expect(question).toHaveValue("Edit this question");
  await question.fill("Edited target question");
  await page.getByRole("button", { name: "Zapisz quiz", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/quiz/${quiz.id}$`));
  const result = await request.get(`${api}/quizzes/${quiz.id}/`, {
    headers: { Authorization: `Bearer ${tokens.access}` },
  });
  expect(result.ok()).toBeTruthy();
  const updated = await result.json();
  expect(updated.questions).toHaveLength(2);
  expect(updated.questions[0]).toEqual(first);
  expect(updated.questions[1]).toMatchObject({
    id: target.id,
    text: "Edited target question",
    answers: target.answers,
  });
});

test("save and remove an avatar using the confirmed profile response", async ({
  page,
  request,
}) => {
  // A tiny synthetic PNG; no personal photo is read or uploaded.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGPUSrnDgA0wYRUdtBIAHmEBemUPQqoAAAAASUVORK5CYII=",
    "base64",
  );
  await page.route("https://api.dicebear.com/**", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await page.route("https://gravatar.com/**", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await page.goto("/profile");
  await page
    .getByRole("button", { name: "Zmień zdjęcie", exact: true })
    .first()
    .click();
  await page.getByRole("radio", { name: "Awatar 1", exact: true }).click();
  await page
    .getByRole("button", { name: "Zapisz zdjęcie", exact: true })
    .click();
  await expect(page).toHaveURL(/\/profile$/);
  const current = () =>
    request
      .get(`${api}/user/`, {
        headers: { Authorization: `Bearer ${tokens.access}` },
      })
      .then((response) => response.json());
  expect((await current()).has_custom_photo).toBe(true);
  await page
    .getByRole("button", { name: "Zmień zdjęcie", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Usuń własne zdjęcie", exact: true })
    .click();
  await expect(page).toHaveURL(/\/profile$/);
  expect((await current()).has_custom_photo).toBe(false);
  await page
    .getByRole("button", { name: "Zmień zdjęcie", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Usuń własne zdjęcie", exact: true }),
  ).toHaveCount(0);
});
