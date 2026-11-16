import { expect, test } from "@playwright/test";

const quiz = {
  id: "hint-refresh",
  version: 1,
  title: "Hint refresh fixture",
  user_settings: { default_ai_model: null },
  questions: [
    {
      id: "question",
      text: "Original question",
      multiple: false,
      answers: [
        { id: "correct", text: "First answer", is_correct: true },
        { id: "wrong", text: "Second answer", is_correct: false },
      ],
    },
  ],
  current_session: {
    id: "session",
    current_question: "question",
    study_time: 0,
    answers: [],
  },
};

for (const change of ["identical", "text", "answer order"] as const) {
  test(`${change} background question refresh ${change === "identical" ? "preserves" : "invalidates"} an open hint`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ quiz, completeFirst }) => {
        let online = false;
        Object.defineProperty(navigator, "onLine", {
          configurable: true,
          get: () => online,
        });
        for (const name of ["connection", "mozConnection", "webkitConnection"])
          Object.defineProperty(navigator, name, {
            configurable: true,
            value: undefined,
          });
        (window as unknown as { qaConnect: () => void }).qaConnect = () => {
          online = true;
          window.dispatchEvent(new Event("online"));
        };
        sessionStorage.setItem(
          "testownik.oauth-session.v2",
          JSON.stringify({ access: "hint-refresh-owner", refresh: "fixture" }),
        );
        localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
        localStorage.setItem(
          "testownik.v1.last-user",
          JSON.stringify({ id: "hint-refresh-owner", is_guest: false }),
        );
        localStorage.setItem(
          "testownik.v1.offline.hint-refresh-owner",
          JSON.stringify({
            quizzes: { [quiz.id]: quiz },
            queue: [],
            errors: {},
          }),
        );
        const original = window.fetch.bind(window);
        window.fetch = (input, init) => {
          const url = input instanceof Request ? input.url : String(input);
          if (!url.endsWith("/ai/hint")) return original(input, init);
          const requests = JSON.parse(
            sessionStorage.getItem("hint-requests") ?? "[]",
          );
          requests.push(JSON.parse(String(init?.body)).question);
          sessionStorage.setItem("hint-requests", JSON.stringify(requests));
          return Promise.resolve(
            new Response(
              new ReadableStream({
                start(controller) {
                  if (requests.length === 1) {
                    controller.enqueue(
                      new TextEncoder().encode(
                        '<general_hint>Fixture hint.</general_hint><hint answer="1">First answer hint.</hint>',
                      ),
                    );
                    if (completeFirst) controller.close();
                  } else {
                    (
                      window as unknown as { qaReleaseHint: () => void }
                    ).qaReleaseHint = () => {
                      controller.enqueue(
                        new TextEncoder().encode(
                          '<general_hint>Updated hint.</general_hint><hint answer="1">Updated answer hint.</hint>',
                        ),
                      );
                      controller.close();
                    };
                  }
                },
                cancel() {
                  sessionStorage.setItem("hint-cancelled", "yes");
                },
              }),
              { headers: { "Content-Type": "text/plain" } },
            ),
          );
        };
      },
      { quiz, completeFirst: change !== "identical" },
    );
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let fetching = false;
    const refreshed = structuredClone(quiz);
    if (change === "text") refreshed.questions[0].text = "Changed question";
    if (change === "answer order") refreshed.questions[0].answers.reverse();
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/user/"))
        return route.fulfill({
          json: { id: "hint-refresh-owner", is_guest: false },
        });
      if (path.endsWith("/settings/"))
        return route.fulfill({ json: { default_ai_model: null } });
      if (path.includes(`/quizzes/${quiz.id}/`)) {
        fetching = true;
        await gate;
        return route.fulfill({ json: refreshed });
      }
      return route.fulfill({ json: [] });
    });
    try {
      await page.goto(`/quiz/${quiz.id}`);
      const hint = page.getByRole("button", { name: "AI Hint", exact: true });
      await expect(hint).toBeVisible();
      await page.evaluate(() =>
        (window as unknown as { qaConnect: () => void }).qaConnect(),
      );
      await expect.poll(() => fetching).toBe(true);
      await hint.click();
      const requests = () =>
        page.evaluate(() =>
          JSON.parse(sessionStorage.getItem("hint-requests") ?? "[]"),
        );
      await expect.poll(async () => (await requests()).length).toBe(1);
      const response = page.waitForResponse(
        (r) => r.url().includes(`/quizzes/${quiz.id}/`) && r.status() === 200,
      );
      release();
      await (await response).finished();
      // Allow the new query data and effect cleanup to commit.
      await page.waitForTimeout(300);
      expect((await requests()).length).toBe(change === "identical" ? 1 : 2);
      // Completed old responses also must not be shown against new answers.
      if (change !== "identical") {
        await expect(page.getByTestId("hint-response")).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: "Regenerate", exact: true }),
        ).toHaveCount(0);
        await expect(
          page.getByText("Thinking…", { exact: true }),
        ).toBeVisible();
        await page.evaluate(() =>
          (window as unknown as { qaReleaseHint: () => void }).qaReleaseHint(),
        );
        await expect(page.getByTestId("hint-response")).toHaveAccessibleName(
          "Updated hint.",
        );
        await expect(
          page.getByRole("button", { name: "Regenerate", exact: true }),
        ).toBeVisible();
      } else
        await expect(page.getByTestId("hint-response")).toHaveAccessibleName(
          "Fixture hint.",
        );
      if (change !== "identical")
        expect((await requests())[1]).toEqual(refreshed.questions[0]);
    } finally {
      release();
    }
  });
}
