import { expect, test } from "@playwright/test";

const quiz = (id: string) => ({
  id,
  title: id,
  description: "",
  version: 1,
  questions: [
    {
      id: "question",
      text: "Saved question",
      multiple: false,
      answers: [{ id: "correct", text: "Correct choice", is_correct: true }],
    },
  ],
  current_session: {
    id: `${id}-session`,
    current_question: "question",
    study_time: 0,
    answers: [] as object[],
  },
});

for (const language of ["en", "pl"] as const) {
  for (const scenario of [
    "cached",
    "new",
    "oversized",
    "answer",
    "answer-stale",
    "answer-alone-stale",
    "full",
  ] as const) {
    test(`${language}: ${scenario} storage failure preserves saved work and gives explicit recovery`, async ({
      page,
    }, testInfo) => {
      const target = quiz("capacity-target"),
        removable = quiz("removable"),
        protectedQuiz = quiz("protected");
      const local = {
        id: "protected-answer",
        question: "question",
        selected_answers: [],
        was_correct: false,
        answered_at: "2026-10-11T20:00:00Z",
      };
      protectedQuiz.current_session.answers = [local];
      const pending = {
        request_id: local.id,
        quiz_id: protectedQuiz.id,
        session_id: protectedQuiz.current_session.id,
        version: 1,
        question_id: "question",
        selected_answers: [],
        elapsed_seconds: 0,
        next_question: "question",
        local,
      };
      if (scenario === "answer-alone-stale")
        target.description = "x".repeat(
          8 * 1024 * 1024 -
            Buffer.byteLength(
              JSON.stringify({
                quizzes: { [target.id]: target },
                queue: [],
                errors: {},
              }),
            ) -
            300,
        );
      const initial = {
        quizzes: {
          [removable.id]: removable,
          [protectedQuiz.id]: protectedQuiz,
          ...(scenario === "cached" ||
          scenario.startsWith("answer") ||
          scenario === "full"
            ? { [target.id]: target }
            : {}),
        },
        queue: [pending],
        errors: { [protectedQuiz.id]: "Already rejected" },
      };
      await page.addInitScript(
        ({ initial, scenario, language }) => {
          sessionStorage.setItem(
            "testownik.oauth-session.v2",
            JSON.stringify({ access: "capacity-owner", refresh: "fixture" }),
          );
          localStorage.setItem(
            "testownik.v1.language",
            JSON.stringify(language),
          );
          // The browser's own 5 MB limit is smaller than Android's value cap.
          // This scenario needs a faithful large legacy value in its storage API.
          let virtualValue = JSON.stringify(initial);
          if (scenario !== "answer-alone-stale")
            localStorage.setItem(
              "testownik.v1.offline.capacity-owner",
              virtualValue,
            );
          const originalGet = Storage.prototype.getItem;
          Storage.prototype.getItem = function (key) {
            return scenario === "answer-alone-stale" &&
              key === "testownik.v1.offline.capacity-owner"
              ? virtualValue
              : originalGet.call(this, key);
          };
          let online = true;
          Object.defineProperty(navigator, "onLine", {
            configurable: true,
            get: () => online,
          });
          for (const name of [
            "connection",
            "mozConnection",
            "webkitConnection",
          ])
            Object.defineProperty(navigator, name, {
              configurable: true,
              value: undefined,
            });
          (
            window as unknown as { quotaOnline: (value: boolean) => void }
          ).quotaOnline = (value) => {
            online = value;
            window.dispatchEvent(new Event(value ? "online" : "offline"));
          };
          const original = Storage.prototype.setItem;
          Storage.prototype.setItem = function (key, value) {
            if (key === "testownik.v1.offline.capacity-owner") {
              const state = JSON.parse(String(value));
              const target = state.quizzes["capacity-target"];
              const attempted =
                target &&
                (scenario.startsWith("answer")
                  ? target.current_session.answers.length > 0 ||
                    target.version === 2
                  : target.version === 2);
              if (
                attempted &&
                (scenario === "oversized" || state.quizzes.removable)
              )
                throw Object.assign(new Error("Mocked native value quota"), {
                  code:
                    scenario === "full"
                      ? "storageFull"
                      : "storageValueTooLarge",
                });
            }
            if (
              scenario === "answer-alone-stale" &&
              key === "testownik.v1.offline.capacity-owner"
            ) {
              virtualValue = String(value);
              return;
            }
            return original.call(this, key, value);
          };
        },
        { initial, scenario, language },
      );
      const fresh = {
        ...target,
        version: scenario.startsWith("answer") ? 1 : 2,
        description:
          scenario === "oversized"
            ? "x".repeat(8 * 1024 * 1024)
            : target.description,
      };
      let fetches = 0,
        targetPosts = 0,
        protectedPosts = 0;
      let unavailable = false;
      let serverVersion = fresh.version;
      await page.route("**/api/**", (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith("/user/"))
          return route.fulfill({
            json: { id: "capacity-owner", is_guest: false },
          });
        if (path.includes("/protected/answer/")) {
          protectedPosts++;
          return route.fulfill({
            status: 409,
            json: { detail: "Already rejected" },
          });
        }
        if (path.includes("/capacity-target/answer/")) {
          targetPosts++;
          return route.fulfill({
            json: {
              id: "server-answer",
              question: "question",
              selected_answers: ["correct"],
              was_correct: true,
              answered_at: "2026-10-11T21:00:00Z",
            },
          });
        }
        if (path.includes("/quizzes/capacity-target/")) {
          fetches++;
          return unavailable
            ? route.fulfill({ status: 500, json: {} })
            : route.fulfill({
                json: {
                  ...fresh,
                  version: serverVersion,
                  ...(scenario === "answer-alone-stale" && serverVersion === 2
                    ? { description: "" }
                    : {}),
                },
              });
        }
        return route.fulfill({ json: [] });
      });
      const pl = language === "pl";
      const manage = page.getByRole("button", {
        name: pl ? "Zarządzaj zapisanymi quizami" : "Manage Saved Quizzes",
        exact: true,
      });
      const check = page.getByRole("button", {
        name: pl ? "Sprawdź" : "Check",
        exact: true,
      });
      const selected = page.getByRole("radio", {
        name: "Correct choice",
        exact: true,
      });
      await page.goto("/quiz/capacity-target");
      if (scenario.startsWith("answer")) {
        await expect(selected).toBeVisible();
        await selected.click();
        const dialog = page.waitForEvent("dialog");
        const checking = check.click();
        const alert = await dialog;
        expect(alert.message()).toContain("8 MB");
        await alert.dismiss();
        await checking;
        await expect(selected).toBeChecked();
        await expect(check).toBeEnabled();
        await expect(
          page.getByRole("button", {
            name: pl ? "Sprawdź aktualizacje" : "Retry Updates",
            exact: true,
          }),
        ).toHaveCount(0);
      }
      if (scenario === "oversized") {
        await expect(
          page.getByText(
            pl
              ? /nawet bez innych zapisanych quizów/
              : /even without other saved quizzes/,
          ),
        ).toBeVisible();
        await expect(manage).toHaveCount(0);
        await expect(
          page.getByRole("button", {
            name: pl ? "Spróbuj ponownie" : "Try Again",
            exact: true,
          }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("button", {
            name: pl ? "Przeglądaj bibliotekę" : "Browse Library",
            exact: true,
          }),
        ).toBeVisible();
      } else if (scenario === "answer-alone-stale") {
        await expect(manage).toHaveCount(0);
        await expect(
          page.getByText(
            pl
              ? /nawet bez innych zapisanych quizów/
              : /even without other saved quizzes/,
          ),
        ).toBeVisible();
      } else {
        await expect(manage).toBeVisible();
        await expect(
          page.getByText(
            scenario === "full"
              ? pl
                ? /Brak miejsca na zapis danych/
                : /Storage is full/
              : pl
                ? /wspólny limit 8 MB/
                : /shared 8 MB limit/,
          ),
        ).toBeVisible();
      }
      if (scenario === "cached") {
        await expect(check).toBeDisabled();
        await expect(selected).toBeVisible();
        await expect(
          page.getByText(
            pl
              ? /Wersja quizu na serwerze się zmieniła/
              : /quiz version on the server has changed/,
          ),
        ).toBeVisible();
      }
      expect(fetches).toBe(1); // Capacity errors do not re-download automatically.
      if (scenario === "cached") {
        unavailable = true;
        await page
          .getByRole("button", {
            name: pl ? "Sprawdź aktualizacje" : "Retry Updates",
            exact: true,
          })
          .click();
        await expect.poll(() => fetches).toBe(2);
        await expect(check).toBeDisabled();
        await expect(
          page.getByText(
            pl
              ? /Wersja quizu na serwerze się zmieniła/
              : /quiz version on the server has changed/,
          ),
        ).toBeVisible();
        unavailable = false;
      }
      if (scenario === "answer-stale" || scenario === "answer-alone-stale") {
        serverVersion = 2;
        await page.evaluate(() =>
          (
            window as unknown as { quotaOnline: (value: boolean) => void }
          ).quotaOnline(false),
        );
        await expect(
          page
            .getByText(
              pl
                ? "Tryb offline — odpowiedzi zapisujemy na urządzeniu."
                : "You’re offline. Answers are saved on this device.",
              { exact: true },
            )
            .filter({ visible: true }),
        ).toBeVisible();
        await page.evaluate(() =>
          (
            window as unknown as { quotaOnline: (value: boolean) => void }
          ).quotaOnline(true),
        );
        await expect.poll(() => fetches).toBe(2);
        await expect(check).toBeDisabled();
        await expect(
          page.getByRole("button", {
            name: pl ? "Sprawdź aktualizacje" : "Retry Updates",
            exact: true,
          }),
        ).toBeVisible();
      }
      if (pl && ["cached", "oversized", "full"].includes(scenario))
        await page.screenshot({
          path: testInfo.outputPath("storage-recovery.png"),
          fullPage: true,
        });
      expect(targetPosts).toBe(0);
      const stored = () =>
        page.evaluate(() =>
          JSON.parse(
            localStorage.getItem("testownik.v1.offline.capacity-owner")!,
          ),
        );
      await expect
        .poll(async () => (await stored()).generations?.[protectedQuiz.id] ?? 0)
        .toBeGreaterThan(0);
      const { generations, ...preserved } = await stored();
      // Sync rejection and successful initial cache commits advance only metadata.
      // All saved quiz/answer/error contents must still match the original payload.
      expect(preserved).toEqual(initial);
      expect(generations).toEqual({
        [protectedQuiz.id]: expect.any(Number),
        ...(scenario.startsWith("answer") ? { [target.id]: 1 } : {}),
      });
      expect(Number.isSafeInteger(generations[protectedQuiz.id])).toBe(true);
      expect(generations[protectedQuiz.id]).toBeGreaterThan(0);
      expect(generations[protectedQuiz.id]).toBeLessThanOrEqual(protectedPosts);
      if (scenario === "oversized") return;
      await manage.click();
      await expect(page).toHaveURL(/\/downloads$/);
      await page
        .getByRole("button", {
          name: pl
            ? "Usuń „removable” z urządzenia"
            : "Remove removable from this device",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("button", {
          name: pl
            ? "Usuń „removable” z urządzenia"
            : "Remove removable from this device",
          exact: true,
        }),
      ).toHaveCount(0);
      await page.goBack();
      if (scenario.startsWith("answer")) {
        if (scenario === "answer-stale" || scenario === "answer-alone-stale") {
          await page
            .getByRole("button", {
              name: pl ? "Sprawdź aktualizacje" : "Retry Updates",
              exact: true,
            })
            .click();
          await expect(check).toBeEnabled();
          await selected.click();
        } else await expect(selected).toBeChecked();
        await check.click();
        await expect(
          page.getByText(pl ? "Dobrze!" : "Correct!", { exact: true }),
        ).toBeVisible();
        await expect.poll(() => targetPosts).toBe(1);
      } else {
        await page
          .getByRole("button", {
            name:
              scenario === "cached" || scenario === "full"
                ? pl
                  ? "Sprawdź aktualizacje"
                  : "Retry Updates"
                : pl
                  ? "Spróbuj ponownie"
                  : "Try Again",
            exact: true,
          })
          .click();
        await expect(check).toBeEnabled();
        await expect(manage).toHaveCount(0);
      }
      const recovered = await stored();
      expect(
        recovered.queue.filter(
          (item: { quiz_id: string }) => item.quiz_id === protectedQuiz.id,
        ),
      ).toEqual([pending]);
      expect(recovered.errors[protectedQuiz.id]).toBe("Already rejected");
      expect(recovered.quizzes[protectedQuiz.id]).toEqual(protectedQuiz);
      expect(recovered.quizzes.removable).toBeUndefined();
      expect(recovered.quizzes[target.id].version).toBe(serverVersion);
      expect(Object.keys(recovered.generations).sort()).toEqual(
        [protectedQuiz.id, removable.id, target.id].sort(),
      );
      expect(recovered.generations[removable.id]).toBe(1);
      expect(recovered.generations[protectedQuiz.id]).toBeGreaterThanOrEqual(
        generations[protectedQuiz.id],
      );
      expect(recovered.generations[protectedQuiz.id]).toBeLessThanOrEqual(
        protectedPosts,
      );
      expect(recovered.generations[target.id]).toBeGreaterThan(
        generations[target.id] ?? 0,
      );
    });
  }
}
