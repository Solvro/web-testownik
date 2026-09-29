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
