import { expect, test } from "@playwright/test";

function pendingQuiz(id: string) {
  const answer = {
    id: `${id}-answer`,
    question: `${id}-question`,
    selected_answers: [],
    was_correct: false,
    answered_at: "2026-10-11T20:00:00Z",
  };
  const quiz = {
    id,
    title: id,
    version: 1,
    user_settings: { default_ai_model: null },
    questions: [
      {
        id: answer.question,
        text: `Question for ${id}`,
        multiple: false,
        answers: [
          { id: `${id}-correct`, text: "Correct answer", is_correct: true },
        ],
      },
    ],
    current_session: {
      id: `${id}-session`,
      current_question: answer.question,
      study_time: 12,
      answers: [answer],
    },
  };
  return {
    quiz,
    pending: {
      request_id: answer.id,
      quiz_id: id,
      session_id: quiz.current_session.id,
      version: 1,
      question_id: answer.question,
      selected_answers: [],
      elapsed_seconds: 12,
      next_question: answer.question,
      local: answer,
    },
  };
}

test("a background second-quiz rejection appears while global pending count and first error stay unchanged", async ({
  page,
}) => {
  const a = pendingQuiz("quiz-a"),
    b = pendingQuiz("quiz-b");
  await page.addInitScript(
    ({ a, b }) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "background-owner", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
      localStorage.setItem(
        "testownik.v1.offline.background-owner",
        JSON.stringify({
          quizzes: { [a.quiz.id]: a.quiz, [b.quiz.id]: b.quiz },
          queue: [a.pending, b.pending],
          errors: { [a.quiz.id]: "Existing conflict A" },
        }),
      );
    },
    { a, b },
  );
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let bStarted = false;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/user/"))
      return route.fulfill({
        json: { id: "background-owner", is_guest: false },
      });
    if (path.includes("/quiz-a/answer/"))
      return route.fulfill({
        status: 409,
        json: { detail: "Existing conflict A" },
      });
    if (path.includes("/quiz-b/answer/")) {
      bStarted = true;
      await held;
      return route.fulfill({ status: 409, json: { detail: "Rejected B" } });
    }
    return route.fulfill({ json: [] });
  });
  try {
    await page.goto("/quiz/quiz-b");
    await expect.poll(() => bStarted).toBe(true);
    await expect(
      page
        .getByText("Existing conflict A", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Answers Need Attention", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Check", exact: true }),
    ).toBeEnabled();
    release();
    // No tap, navigation, or changed global count/error is needed to discover B.
    await expect(
      page.getByText("Answers Need Attention", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Check", exact: true }),
    ).toBeDisabled();
    const state = await page.evaluate(() =>
      JSON.parse(
        localStorage.getItem("testownik.v1.offline.background-owner")!,
      ),
    );
    expect(
      state.queue.map((item: { request_id: string }) => item.request_id),
    ).toEqual([a.pending.request_id, b.pending.request_id]);
    expect(Object.values(state.errors)[0]).toBe("Existing conflict A");
    expect(state.errors[b.quiz.id]).toBe("Rejected B");
    expect(state.quizzes[a.quiz.id].current_session.answers).toHaveLength(1);
    expect(state.quizzes[b.quiz.id].current_session.answers).toHaveLength(1);
  } finally {
    release();
  }
});
