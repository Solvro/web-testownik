import { quizCreateResponse } from "./quiz-create-response";
import { expect, test } from "@playwright/test";

const id = "88888888-8888-4888-8888-888888888888";
for (const create of [false, true])
  test(`${create ? "new quiz" : "study edit"}: saving returns to one study screen above the library`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "navigation-fixture", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
    });
    let quiz = {
      id,
      version: 1,
      title: "Navigation fixture",
      description: "",
      can_edit: true,
      questions: [
        {
          id: "99999999-9999-4999-8999-999999999999",
          order: 1,
          text: "Navigation question",
          multiple: false,
          answers: [
            {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              order: 1,
              text: "Answer",
              is_correct: true,
            },
          ],
        },
      ],
    };
    let writes = 0;
    await page.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/user/"))
        return route.fulfill({
          json: { id: "navigation-fixture", is_guest: false },
        });
      if (path.endsWith("/library/"))
        return route.fulfill({
          json: {
            path: [{ id: "root", name: "Library" }],
            can_create_folder: true,
            items: create
              ? []
              : [
                  {
                    id,
                    name: quiz.title,
                    type: "quiz",
                    can_edit: true,
                    question_count: 1,
                  },
                ],
          },
        });
      if (
        path.includes("/quizzes/") &&
        ["POST", "PATCH"].includes(route.request().method())
      ) {
        writes++;
        quiz = {
          ...quiz,
          ...(route.request().postDataJSON().quiz ??
            route.request().postDataJSON()),
          version: quiz.version + 1,
        };
        return route.fulfill({
          json: quizCreateResponse(route.request().postDataJSON(), quiz),
        });
      }
      return route.fulfill({
        json: path.includes(`/quizzes/${id}/`) ? quiz : [],
      });
    });
    await page.goto("/library");
    if (create) {
      await page
        .getByRole("button", { name: "Add to Library", exact: true })
        .click();
      await page.getByRole("button", { name: "New Quiz", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Question text", exact: true })
        .fill("Navigation question");
      await page
        .getByRole("textbox", { name: "Answer 1", exact: true })
        .fill("Answer");
      await page
        .getByRole("textbox", { name: "Answer 2", exact: true })
        .fill("Other");
    } else {
      await page.getByRole("button", { name: quiz.title, exact: true }).click();
      await expect(
        page.getByRole("radio", { name: "Answer", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Quiz options", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Edit Quiz", exact: true })
        .click();
    }
    await page
      .getByRole("textbox", { name: "Quiz title", exact: true })
      .fill("Saved navigation fixture");
    await page.getByRole("button", { name: "Save Quiz", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/quiz/${id}$`));
    await expect(
      page.getByRole("radio", { name: "Answer", exact: true }),
    ).toBeVisible();
    expect(writes).toBe(1);
    if (!create) {
      await page
        .getByRole("button", { name: "Quiz options", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Edit Quiz", exact: true })
        .click();
      const title = page.getByRole("textbox", {
        name: "Quiz title",
        exact: true,
      });
      await expect(title).toHaveValue("Saved navigation fixture");
      await title.fill("Saved twice");
      await page
        .getByRole("button", { name: "Save Quiz", exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`/quiz/${id}$`));
      await expect(
        page.getByRole("radio", { name: "Answer", exact: true }),
      ).toBeVisible();
      expect(writes).toBe(2);
    }
    await page.getByRole("link", { name: /back/i }).click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(
      page.getByRole("button", { name: "Add to Library", exact: true }),
    ).toBeVisible();
  });
