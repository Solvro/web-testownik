import { expect, test } from "@playwright/test";
const owner = "editor-storage-owner";
const id = "77777777-7777-4777-8777-777777777777";
const questionId = "88888888-8888-4888-8888-888888888888";
const answerId = "99999999-9999-4999-8999-999999999999";
const quiz = {
  id,
  title: "Storage editor fixture",
  description: "",
  version: 1,
  visibility: 0,
  allow_anonymous: false,
  is_anonymous: false,
  can_edit: true,
  questions: [
    {
      id: questionId,
      order: 1,
      text: "Saved question",
      multiple: false,
      answers: [
        { id: answerId, order: 1, text: "Correct choice", is_correct: true },
      ],
    },
  ],
  current_session: {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    current_question: questionId,
    study_time: 0,
    answers: [],
  },
};
test("saving an edit preserves the known stale-copy gate when storage and the following refresh fail", async ({
  page,
}) => {
  const initial = { quizzes: { [id]: quiz }, queue: [], errors: {} };
  await page.addInitScript(
    ({ owner, id, initial }) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "fixture", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
      localStorage.setItem(
        `testownik.v1.offline.${owner}`,
        JSON.stringify(initial),
      );
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (
          key === `testownik.v1.offline.${owner}` &&
          JSON.parse(value).quizzes[id]?.version >= 2
        )
          throw Object.assign(new Error("Native disk full"), {
            code: "storageFull",
          });
        return original.call(this, key, value);
      };
    },
    { owner, id, initial },
  );
  let writes = 0,
    studyReads = 0;
  await page.route("**/api/**", (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.pathname.endsWith("/user/"))
      return route.fulfill({ json: { id: owner, account_type: "email" } });
    if (url.pathname.includes(`/quizzes/${id}/`)) {
      if (request.method() === "PATCH") {
        writes++;
        const { current_session: _session, ...saved } = quiz;
        return route.fulfill({
          json: { ...saved, ...request.postDataJSON(), version: 3 },
        });
      }
      if (url.searchParams.has("include")) {
        studyReads++;
        if (writes) return route.abort("timedout");
      }
      return route.fulfill({ json: { ...quiz, version: 2 } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto(`/quiz/${id}`);
  const radio = page.getByRole("radio", {
    name: "Correct choice",
    exact: true,
  });
  await radio.click();
  const check = page.getByRole("button", { name: "Check", exact: true });
  await expect(check).toBeDisabled();
  await expect(
    page.getByText(/quiz version on the server has changed/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Quiz options", exact: true }).click();
  await page.getByRole("button", { name: "Edit Quiz", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Quiz title", exact: true })
    .fill("Saved despite full storage");
  await page.getByRole("button", { name: "Save Quiz", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/quiz/${id}$`));
  await expect.poll(() => studyReads).toBeGreaterThan(1);
  await radio.click();
  await expect(check).toBeDisabled();
  await expect(
    page.getByText(/quiz version on the server has changed/),
  ).toBeVisible();
  expect(writes).toBe(1);
  expect(
    await page.evaluate(
      (owner) =>
        JSON.parse(localStorage.getItem(`testownik.v1.offline.${owner}`)!),
      owner,
    ),
  ).toEqual(initial);
});
