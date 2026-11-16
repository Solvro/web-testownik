import { expect, test, type Page } from "@playwright/test";

const quiz = {
  id: "write-quiz",
  title: "Write recovery fixture",
  version: 1,
  user_settings: { default_ai_model: null },
  questions: [
    {
      id: "question",
      text: "Saved question",
      multiple: false,
      answers: [{ id: "choice", text: "Choice", is_correct: true }],
    },
  ],
  current_session: { id: "session", current_question: "question", answers: [] },
};
const pending = {
  request_id: "retained-answer",
  quiz_id: quiz.id,
  session_id: "session",
  version: 1,
  question_id: "question",
  selected_answers: ["choice"],
  elapsed_seconds: 1,
  next_question: "question",
  local: {
    id: "retained-answer",
    question: "question",
    selected_answers: ["choice"],
    was_correct: true,
    answered_at: "2026-10-12T00:00:00Z",
  },
};
const key = "testownik.v1.offline.write-owner";

async function setup(
  page: Page,
  value: unknown,
  queue: unknown[] = [],
  language = "en",
) {
  const raw = JSON.stringify({
    quizzes: { [quiz.id]: value },
    queue,
    errors: {},
  });
  await page.addInitScript(
    ({ raw, key, language }) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "write-fixture", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
      if (localStorage.getItem(key) === null) localStorage.setItem(key, raw);
    },
    { raw, key, language },
  );
  let submissions = 0;
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/user/"))
      return route.fulfill({ json: { id: "write-owner", is_guest: false } });
    if (path.endsWith("/answer/")) submissions++;
    if (path.includes(`/quizzes/${quiz.id}/`))
      return route.fulfill({ status: 503, json: {} });
    return route.fulfill({ json: [] });
  });
  return { raw, submissions: () => submissions };
}

for (const study_time of [undefined, null]) {
  test(`checking a legacy saved quiz with study_time=${study_time} persists a readable answer`, async ({
    page,
  }) => {
    await setup(page, {
      ...quiz,
      current_session: { ...quiz.current_session, study_time },
    });
    await page.goto(`/quiz/${quiz.id}`);
    await page.getByRole("radio", { name: "Choice", exact: true }).check();
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await expect(page.getByText("Correct!", { exact: true })).toBeVisible();
    const state = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      key,
    );
    expect(state.queue).toHaveLength(1);
    expect(state.quizzes[quiz.id].current_session.answers).toHaveLength(1);
    expect(
      Number.isFinite(state.quizzes[quiz.id].current_session.study_time),
    ).toBe(true);
    await page.goto("/downloads");
    await expect(
      page.getByRole("button", { name: quiz.title, exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("error-screen")).toHaveCount(0);
    expect(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).queue.length,
        key,
      ),
    ).toBe(1);
  });
}

test("a versionless saved quiz explains refresh and preserves selection and all saved answers", async ({
  page,
}) => {
  const { version: _version, ...legacy } = quiz;
  const fixture = {
    ...legacy,
    current_session: {
      ...legacy.current_session,
      answers: [{ ...pending.local, selected_answers: [], was_correct: false }],
    },
  };
  const { raw, submissions } = await setup(page, fixture);
  let message = "";
  page.on("dialog", async (dialog) => {
    message = dialog.message();
    await dialog.accept();
  });
  await page.goto(`/quiz/${quiz.id}`);
  const choice = page.getByRole("radio", { name: "Choice", exact: true });
  await choice.check();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect
    .poll(() => message)
    .toContain("Connect to the internet and retry updates.");
  await expect(choice).toBeChecked();
  expect(submissions()).toBe(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
    raw,
  );
});

for (const language of ["en", "pl"]) {
  test(`${language}: saved-quiz remove action is reachable and cancellation preserves unsynced answers`, async ({
    page,
  }) => {
    const { raw } = await setup(page, quiz, [pending], language);
    await page.goto("/downloads");
    const remove = page.getByRole("button", {
      name:
        language === "pl"
          ? `Usuń „${quiz.title}” z urządzenia`
          : `Remove ${quiz.title} from this device`,
      exact: true,
    });
    await expect(remove).toBeVisible();
    const box = await remove.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(48);
    expect(box!.height).toBeGreaterThanOrEqual(48);
    await expect(page.getByText(/Swipe a quiz|Przesuń quiz/)).toHaveCount(0);
    page.once("dialog", (dialog) => dialog.dismiss());
    await remove.click();
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
      raw,
    );
    page.once("dialog", (dialog) => dialog.accept());
    await remove.click();
    await expect(
      page.getByText(
        language === "pl" ? "Brak zapisanych quizów" : "No Saved Quizzes",
        { exact: true },
      ),
    ).toBeVisible();
    const state = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      key,
    );
    expect(state.queue).toEqual([]);
    expect(state.quizzes).toEqual({});
  });
}

test("returning to Downloads after an offline answer still asks before removing it", async ({
  page,
}) => {
  await setup(page, quiz);
  await page.goto("/downloads");
  await page.getByRole("button", { name: quiz.title, exact: true }).click();
  await page.getByRole("radio", { name: "Choice", exact: true }).check();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByText("Correct!", { exact: true })).toBeVisible();
  const saved = await page.evaluate((key) => localStorage.getItem(key), key);
  expect(JSON.parse(saved!).queue).toHaveLength(1);
  await page.goBack();
  let confirmation = "";
  page.once("dialog", async (dialog) => {
    confirmation = dialog.message();
    await dialog.dismiss();
  });
  await page
    .getByRole("button", {
      name: `Remove ${quiz.title} from this device`,
      exact: true,
    })
    .click();
  await expect
    .poll(() => confirmation)
    .toContain("Unsynced answers will be lost.");
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
    saved,
  );
});
