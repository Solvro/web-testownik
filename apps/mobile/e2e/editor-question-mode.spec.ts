import { expect, test } from "@playwright/test";

for (const scenario of [
  {
    name: "checkbox question with one correct answer",
    multiple: true,
    secondCorrect: false,
    expected: true,
  },
  {
    name: "radio question with one correct answer",
    multiple: false,
    secondCorrect: false,
    expected: false,
  },
  {
    name: "question with two correct answers",
    multiple: false,
    secondCorrect: true,
    expected: true,
  },
  {
    name: "checkbox mode after reducing to one correct answer",
    multiple: true,
    secondCorrect: true,
    expected: true,
    reduceCorrect: true,
  },
]) {
  test(`${"reduceCorrect" in scenario ? "answer edit" : "title-only edit"} preserves ${scenario.name}`, async ({
    page,
  }) => {
    const quiz = {
      id: "44444444-4444-4444-8444-444444444444",
      version: 1,
      title: "Original title",
      description: "",
      questions: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          text: "Choose the correct answer",
          order: 1,
          multiple: scenario.multiple,
          answers: [
            {
              id: "66666666-6666-4666-8666-666666666666",
              order: 1,
              text: "Answer one",
              is_correct: true,
            },
            {
              id: "77777777-7777-4777-8777-777777777777",
              order: 2,
              text: "Answer two",
              is_correct: scenario.secondCorrect,
            },
          ],
        },
      ],
    };
    await page.addInitScript(() => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "question-mode-fixture", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
    });
    const writes: { title: string; questions: { multiple: boolean }[] }[] = [];
    let saved = quiz;
    await page.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith(`/quizzes/${quiz.id}/`)) {
        if (route.request().method() === "PATCH") {
          const submitted = route.request().postDataJSON();
          writes.push(submitted);
          saved = { ...quiz, ...submitted };
          return route.fulfill({ json: saved });
        }
        return route.fulfill({ json: saved });
      }
      return route.fulfill({
        json: path.endsWith("/user/")
          ? { id: "question-mode-fixture", is_guest: false }
          : [],
      });
    });
    await page.goto(`/editor?id=${quiz.id}`);
    const title = page.getByRole("textbox", {
      name: "Quiz title",
      exact: true,
    });
    await expect(title).toHaveValue(quiz.title);
    await title.fill("Updated title only");
    if ("reduceCorrect" in scenario)
      await page
        .getByRole("switch", { name: "Correct Answer 2", exact: true })
        .uncheck();
    await page.getByRole("button", { name: "Save Quiz", exact: true }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].title).toBe("Updated title only");
    expect(writes[0].questions[0].multiple).toBe(scenario.expected);
    await expect(
      page.getByRole(scenario.expected ? "checkbox" : "radio", {
        name: "Answer one",
        exact: true,
      }),
    ).toBeVisible();
  });
}
