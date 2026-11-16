import { expect, test } from "@playwright/test";

const quiz = {
  id: "study-copy-source",
  title: "Synthetic source quiz",
  description: "",
  version: 1,
  can_edit: true,
  visibility: 0,
  allow_anonymous: false,
  is_anonymous: false,
  user_settings: {
    initial_reoccurrences: 1,
    wrong_answer_reoccurrences: 1,
    max_question_reoccurrences: 5,
  },
  questions: [
    {
      id: "question",
      text: "Synthetic copy question?",
      multiple: false,
      order: 0,
      answers: [
        { id: "answer", text: "Synthetic answer", is_correct: true, order: 0 },
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
const copiedId = "11111111-1111-4111-8111-000000000001";
for (const language of ["en", "pl"] as const) {
  const menu = language === "pl" ? "Opcje quizu" : "Quiz options";
  const action = language === "pl" ? "Utwórz kopię" : "Make a Copy";
  const pending = language === "pl" ? "Tworzenie kopii…" : "Creating Copy…";
  for (const firstFails of [false, true])
    test(`${language}: copying a quiz blocks concurrent taps and ${firstFails ? "unlocks after failure" : "opens one accepted copy"}`, async ({
      page,
    }) => {
      await page.addInitScript((language) => {
        if (window.top !== window) return;
        sessionStorage.setItem(
          "testownik.oauth-session.v2",
          JSON.stringify({ access: "study-copy-owner", refresh: "synthetic" }),
        );
        localStorage.setItem("testownik.v1.language", JSON.stringify(language));
      }, language);
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let requests = 0,
        accepted = 0;
      const dialogs: string[] = [];
      page.on("dialog", async (dialog) => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });
      await page.route("**/api/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith(`/quizzes/${quiz.id}/copy/`)) {
          requests++;
          if (requests === 1) {
            await gate;
            if (firstFails)
              return route.fulfill({
                status: 503,
                json: { detail: "Synthetic copy unavailable" },
              });
          }
          accepted++;
          return route.fulfill({ status: 201, json: { id: copiedId } });
        }
        return route.fulfill({
          json: path.endsWith("/user/")
            ? { id: "study-copy-owner", is_guest: false }
            : /\/quizzes\/[^/]+\/$/.test(path)
              ? { ...quiz, id: path.split("/").at(-2) }
              : path.endsWith("/settings/")
                ? quiz.user_settings
                : [],
        });
      });
      try {
        await page.goto(`/quiz/${quiz.id}`);
        const storageKey = "testownik.v1.offline.study-copy-owner";
        await expect
          .poll(() =>
            page.evaluate((key) => localStorage.getItem(key), storageKey),
          )
          .not.toBeNull();
        const saved = await page.evaluate(
          (key) => localStorage.getItem(key),
          storageKey,
        );
        await page.getByRole("button", { name: menu, exact: true }).click();
        await page.getByRole("button", { name: action, exact: true }).click();
        await expect.poll(() => requests).toBe(1);
        await page.getByRole("button", { name: menu, exact: true }).click();
        const busy = page.getByRole("button", { name: pending, exact: true });
        await expect(busy).toBeDisabled();
        // Even a forced second pointer activation must not create a second request.
        await busy.click({ force: true });
        expect(requests).toBe(1);
        release();
        if (firstFails) {
          await expect.poll(() => dialogs.length).toBe(1);
          await expect(page).toHaveURL(new RegExp(`/quiz/${quiz.id}$`));
          await page.getByLabel("Zamknij menu", { exact: true }).click({
            position: { x: 4, y: 4 },
          });
          await page.getByRole("button", { name: menu, exact: true }).click();
          await expect(
            page.getByRole("button", { name: action, exact: true }),
          ).toBeEnabled();
          await page.getByRole("button", { name: action, exact: true }).click();
        }
        await expect(page).toHaveURL(new RegExp(`/editor\\?id=${copiedId}`));
        expect(accepted).toBe(1);
        expect(requests).toBe(firstFails ? 2 : 1);
        expect(dialogs).toHaveLength(firstFails ? 1 : 0);
        expect(
          await page.evaluate((key) => localStorage.getItem(key), storageKey),
        ).toBe(saved);
      } finally {
        release();
      }
    });
}
