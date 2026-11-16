import { expect, test } from "@playwright/test";

test("per-answer AI hints appear under their answers and regenerate", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({ access: "hint-fixture", refresh: "fixture" }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
  });
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json: path.endsWith("/user/")
        ? { id: "hint-fixture", is_guest: false }
        : path.includes("/quizzes/")
          ? {
              id: "hints",
              title: "Hint fixture",
              questions: [
                {
                  id: "question",
                  text: "Which planet is red?",
                  multiple: false,
                  answers: [
                    { id: "a", text: "Mars", is_correct: true },
                    { id: "b", text: "Venus", is_correct: false },
                  ],
                },
              ],
            }
          : [],
    });
  });
  let requests = 0;
  await page.route("**/ai/hint", async (route) => {
    requests++;
    await route.fulfill({
      contentType: "text/plain",
      body:
        requests === 1
          ? '<general_hint>Think about colour.</general_hint><answer_hints><hint answer="1">Iron oxide.</hint><hint answer="2">Thick clouds.</hint></answer_hints>'
          : "<general_hint>Look at the surface.</general_hint>",
    });
  });
  await page.goto("/quiz/hints");
  await page.getByRole("button", { name: "AI Hint", exact: true }).click();
  await expect(
    page.getByLabel("AI tip: Iron oxide.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("AI tip: Thick clouds.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Tips for individual answers appear below them.", {
      exact: true,
    }),
  ).toBeVisible();
  // Asking again replaces the hint rather than doing nothing.
  await page.getByRole("button", { name: "Regenerate", exact: true }).click();
  await expect(
    page.getByLabel("AI tip: Iron oxide.", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByTestId("hint-response")).toHaveAccessibleName(
    "Look at the surface.",
  );
  expect(requests).toBe(2);
});

test("empty direct hint response exposes retry instead of endless preparation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({ access: "hint-fixture", refresh: "fixture" }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
    localStorage.setItem(
      "testownik.v1.quiz-ai-model.hint-fixture.hints",
      JSON.stringify("fixture/deep"),
    );
  });
  await page.route("**/api/**", (route) =>
    route.fulfill({
      json: new URL(route.request().url()).pathname.endsWith("/user/")
        ? { id: "hint-fixture", is_guest: false }
        : {
            id: "hints",
            questions: [
              {
                id: "question",
                text: "Red planet?",
                answers: [{ id: "a", text: "Mars", is_correct: true }],
                multiple: false,
              },
            ],
          },
    }),
  );
  let requests = 0;
  await page.route("**/ai/hint", (route) => {
    requests++;
    expect(route.request().postDataJSON()).toMatchObject({
      language: "en",
      config: { modelName: "fixture/deep" },
    });
    return route.fulfill({
      contentType: "text/plain",
      body:
        requests === 1
          ? ""
          : '<general_hint>Look for iron oxide.</general_hint><hint answer="1">Rusty surface.</hint>',
    });
  });
  await page.goto("/hint?id=hints&question=question&mode=hint");
  await expect(page.getByRole("alert")).toHaveText(
    "No response received. Please try again.",
  );
  await page.getByRole("button", { name: "Try Again", exact: true }).click();
  await expect(page.getByTestId("hint-response")).toHaveAccessibleName(
    "Look for iron oxide.",
  );
  await expect(
    page.getByLabel("AI tip: Rusty surface.", { exact: true }),
  ).toBeVisible();
  expect(requests).toBe(2);
});
