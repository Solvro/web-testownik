import { expect, test } from "@playwright/test";

const quiz = {
  id: "discard-race",
  title: "Discard race fixture",
  version: 1,
  questions: [
    {
      id: "question",
      text: "Question",
      multiple: false,
      answers: [{ id: "choice", text: "Choice", is_correct: true }],
    },
  ],
  current_session: {
    id: "session",
    current_question: "question",
    study_time: 0,
    answers: [],
  },
};
const answer = {
  id: "pending",
  question: "question",
  selected_answers: ["choice"],
  was_correct: true,
  answered_at: "2026-10-12T00:00:00Z",
};
const pending = {
  request_id: "pending",
  quiz_id: quiz.id,
  session_id: "session",
  version: 1,
  question_id: "question",
  selected_answers: ["choice"],
  elapsed_seconds: 1,
  next_question: "question",
  local: answer,
};
const key = "testownik.v1.offline.discard-owner";
const retainedQuiz = { ...quiz, id: "retained-quiz", title: "Retained quiz" };
const retainedAnswer = {
  ...pending,
  request_id: "retained-answer",
  quiz_id: retainedQuiz.id,
  local: { ...answer, id: "retained-answer" },
};

for (const language of ["en", "pl"] as const) {
  for (const recovery of [
    "empty",
    "rejection",
    "queued",
    "unreadable",
  ] as const) {
    const retainOther = recovery !== "empty";
    const rejected = recovery === "rejection";
    test(`${language}: a late failed answer after discard reconciles ${recovery} device state`, async ({
      page,
    }) => {
      const pl = language === "pl";
      await page.addInitScript(
        ({
          language,
          quiz,
          pending,
          key,
          retainOther,
          retainedQuiz,
          retainedAnswer,
          rejected,
        }) => {
          const probe = window as typeof window & {
            __syncProbe: { failed: boolean; reads: number };
          };
          probe.__syncProbe = { failed: false, reads: 0 };
          const fetch = window.fetch;
          window.fetch = async (...args) => {
            const response = await fetch(...args);
            if (response.url.includes("/answer/") && response.status === 503)
              probe.__syncProbe.failed = true;
            return response;
          };
          const getItem = Storage.prototype.getItem;
          Storage.prototype.getItem = function (item) {
            if (item === key && probe.__syncProbe.failed)
              probe.__syncProbe.reads++;
            return getItem.call(this, item);
          };
          sessionStorage.setItem(
            "testownik.oauth-session.v2",
            JSON.stringify({ access: "discard-fixture", refresh: "fixture" }),
          );
          localStorage.setItem(
            "testownik.v1.language",
            JSON.stringify(language),
          );
          localStorage.setItem(
            key,
            JSON.stringify({
              quizzes: {
                [quiz.id]: quiz,
                ...(retainOther ? { [retainedQuiz.id]: retainedQuiz } : {}),
              },
              queue: [pending, ...(retainOther ? [retainedAnswer] : [])],
              errors: rejected
                ? { [retainedQuiz.id]: "Remaining session changed" }
                : {},
            }),
          );
        },
        {
          language,
          quiz,
          pending,
          key,
          retainOther,
          retainedQuiz,
          retainedAnswer,
          rejected,
        },
      );
      let release!: () => void;
      let requested = false;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/api/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith("/user/"))
          return route.fulfill({
            json: { id: "discard-owner", is_guest: false },
          });
        if (path.endsWith("/answer/")) {
          requested = true;
          await gate;
          return route
            .fulfill({ status: 503, json: {} })
            .catch(() => undefined);
        }
        return route.fulfill({ json: [] });
      });
      try {
        await page.goto("/");
        await expect.poll(() => requested).toBe(true);
        await expect(
          page.getByText(
            pl
              ? `Odpowiedzi do synchronizacji: ${retainOther ? 2 : 1}.`
              : `Answers waiting to sync: ${retainOther ? 2 : 1}.`,
            { exact: true },
          ),
        ).toBeVisible();
        await page
          .getByRole("button", {
            name: pl ? "Zapisane offline" : "Saved Offline",
            exact: true,
          })
          .click();
        page.once("dialog", (dialog) => dialog.accept());
        await page
          .getByRole("button", {
            name: pl
              ? `Usuń „${quiz.title}” z urządzenia`
              : `Remove ${quiz.title} from this device`,
            exact: true,
          })
          .click();
        if (retainOther)
          await expect(
            page.getByRole("button", { name: retainedQuiz.title, exact: true }),
          ).toBeVisible();
        else
          await expect(
            page.getByText(pl ? "Brak zapisanych quizów" : "No Saved Quizzes", {
              exact: true,
            }),
          ).toBeVisible();
        await page.goBack();
        const sync = page.getByRole("button", {
          name: pl ? "Synchronizuj" : "Sync Now",
          exact: true,
        });
        if (retainOther) await expect(sync).toBeVisible();
        else await expect(sync).toHaveCount(0);
        const settled = page.waitForResponse(
          (response) =>
            response.url().includes("/answer/") && response.status() === 503,
        );
        const unreadableBytes =
          recovery === "unreadable"
            ? await page.evaluate((key) => {
                const bytes = `${localStorage.getItem(key)!}{unreadable suffix`;
                localStorage.setItem(key, bytes);
                return bytes;
              }, key)
            : null;
        release();
        await (await settled).finished();
        // Observe the catch's fresh device read, then allow React to commit its UI.
        await expect
          .poll(() =>
            page.evaluate(
              () =>
                (window as typeof window & { __syncProbe: { reads: number } })
                  .__syncProbe.reads,
            ),
          )
          .toBeGreaterThan(0);
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              ),
            ),
        );
        if (recovery === "unreadable") {
          await expect(sync).toBeVisible();
          await expect(
            page.getByText(
              pl
                ? "Odpowiedzi do synchronizacji: 1."
                : "Answers waiting to sync: 1.",
              { exact: true },
            ),
          ).toBeVisible();
          await expect(
            page.getByText(
              pl
                ? "Nie udało się odczytać danych z urządzenia. Zachowaliśmy je bez zmian. Spróbuj ponownie lub skontaktuj się z pomocą."
                : "Could not read the data saved on this device. It has been kept unchanged. Try again or contact support.",
              { exact: true },
            ),
          ).toBeVisible();
          expect(
            await page.evaluate((key) => localStorage.getItem(key), key),
          ).toBe(unreadableBytes);
          await sync.scrollIntoViewIfNeeded();
          await page.screenshot({
            path: test.info().outputPath("sync-unreadable-state.png"),
          });
          return;
        }
        if (retainOther) {
          await expect(sync).toBeVisible();
          await expect(
            page.getByText(
              rejected
                ? "Remaining session changed"
                : pl
                  ? "Przerwa techniczna. Spróbuj ponownie później."
                  : "The service is temporarily unavailable. Please try again later.",
              { exact: true },
            ),
          ).toBeVisible();
          await expect(
            page.getByText(
              pl
                ? "Odpowiedzi do synchronizacji: 1."
                : "Answers waiting to sync: 1.",
              { exact: true },
            ),
          ).toBeVisible();
        } else await expect(sync).toHaveCount(0);
        expect(
          await page.evaluate(
            (key) => JSON.parse(localStorage.getItem(key)!),
            key,
          ),
        ).toEqual({
          generations: { [quiz.id]: 1 },
          quizzes: retainOther ? { [retainedQuiz.id]: retainedQuiz } : {},
          queue: retainOther ? [retainedAnswer] : [],
          errors: rejected
            ? { [retainedQuiz.id]: "Remaining session changed" }
            : {},
        });
      } finally {
        release();
      }
    });
  }
}
