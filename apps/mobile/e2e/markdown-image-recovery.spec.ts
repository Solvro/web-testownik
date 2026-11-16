import { expect, test } from "@playwright/test";

const image =
  '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="blue"/></svg>';

for (const language of ["en", "pl"] as const)
  for (const linked of [false, true])
    test(`${language}: failed ${linked ? "linked described" : "empty-alt"} inline image retries without navigation or external requests`, async ({
      page,
    }) => {
      await page.addInitScript((language) => {
        sessionStorage.setItem(
          "testownik.oauth-session.v2",
          JSON.stringify({
            access: "inline-image-fixture",
            refresh: "fixture",
          }),
        );
        localStorage.setItem("testownik.v1.language", JSON.stringify(language));
      }, language);
      let attempts = 0,
        externalRequests = 0,
        navigations = 0;
      await page.route("https://outside.invalid/**", (route) => {
        externalRequests++;
        return route.abort();
      });
      await page.route("https://destination.invalid/**", (route) => {
        navigations++;
        return route.abort();
      });
      await page.route("**/media/inline-recovery.svg", (route) => {
        attempts++;
        return route.fulfill(
          attempts === 1
            ? { status: 503, body: "Synthetic unavailable image" }
            : { contentType: "image/svg+xml", body: image },
        );
      });
      const url = "https://images.unsplash.com/media/inline-recovery.svg";
      const alt = linked ? 'Circuit "A" & arrows' : "";
      const diagram = `![${alt}](${url})`;
      await page.route("**/api/**", (route) => {
        const path = new URL(route.request().url()).pathname;
        return route.fulfill({
          json: path.endsWith("/user/")
            ? { id: "inline-image-fixture", is_guest: false }
            : path.includes("/quizzes/")
              ? {
                  id: "inline-images",
                  title: "Inline recovery fixture",
                  questions: [
                    {
                      id: "inline-question",
                      text: `Question diagram:\n\n${linked ? `[${diagram}](https://destination.invalid/link)` : diagram}\n\n![Hidden](https://outside.invalid/tracker.svg)`,
                      multiple: false,
                      answers: [
                        { id: "answer", text: "Answer", is_correct: true },
                      ],
                    },
                  ],
                }
              : [],
        });
      });
      await page.goto("/quiz/inline-images");
      const frame = page.frameLocator("iframe").first();
      const retry = frame.getByRole("button", {
        name: language === "en" ? /Try Again/ : /Spróbuj ponownie/,
      });
      await expect(retry).toBeVisible();
      await expect(frame.getByRole("status")).toContainText(
        language === "en"
          ? "The image could not be loaded."
          : "Nie udało się wczytać obrazu.",
      );
      await expect(frame.locator("img")).toHaveAttribute("alt", alt);
      expect(attempts).toBe(1);
      expect(externalRequests).toBe(0);
      const studyUrl = page.url();
      await retry.click();
      await expect.poll(() => attempts).toBe(2);
      await expect
        .poll(() =>
          frame
            .locator("img")
            .evaluate((element: HTMLImageElement) => element.naturalWidth),
        )
        .toBe(80);
      await expect(retry).toBeHidden();
      expect(page.url()).toBe(studyUrl);
      expect(navigations).toBe(0);
      expect(externalRequests).toBe(0);
    });

for (const language of ["en", "pl"] as const)
  for (const returns of [false, true])
    test(`${language}: answer image ${returns ? "failure clears when the question returns" : "retry stays outside selection, works after reveal and ignores the previous question"}`, async ({
      page,
    }) => {
      await page.addInitScript((language) => {
        sessionStorage.setItem(
          "testownik.oauth-session.v2",
          JSON.stringify({
            access: "inline-image-fixture",
            refresh: "fixture",
          }),
        );
        localStorage.setItem("testownik.v1.language", JSON.stringify(language));
      }, language);
      let attempts = 0;
      await page.route("**/media/answer-recovery.svg", (route) => {
        attempts++;
        return route.fulfill(
          attempts < (returns ? 2 : 3)
            ? { status: 503, body: "Synthetic unavailable answer image" }
            : { contentType: "image/svg+xml", body: image },
        );
      });
      await page.route("**/media/next-answer.svg", (route) =>
        route.fulfill({ contentType: "image/svg+xml", body: image }),
      );
      await page.route("**/api/**", (route) => {
        const path = new URL(route.request().url()).pathname;
        return route.fulfill({
          json: path.endsWith("/user/")
            ? { id: "inline-image-fixture", is_guest: false }
            : path.includes("/quizzes/")
              ? {
                  id: "answer-images",
                  title: "Answer recovery fixture",
                  version: 1,
                  user_settings: { initial_reoccurrences: 2 },
                  current_session: {
                    id: "inline-session",
                    current_question: "answer-question",
                    answers: [],
                    study_time: 0,
                  },
                  questions: [
                    {
                      id: "answer-question",
                      text: "Select this answer and retry its image",
                      multiple: false,
                      answers: [
                        {
                          id: "image-answer",
                          text: "**Answer diagram**\n\n![Answer diagram](https://images.unsplash.com/media/answer-recovery.svg)",
                          is_correct: true,
                        },
                      ],
                    },
                    {
                      id: "next-question",
                      text: "The next question has no image failure",
                      multiple: false,
                      answers: [
                        {
                          id: "plain-answer",
                          text: "**Plain answer**\n\n![Next answer diagram](https://images.unsplash.com/media/next-answer.svg)",
                          is_correct: true,
                        },
                      ],
                    },
                  ],
                }
              : [],
        });
      });
      await page.goto("/quiz/answer-images");
      const answer = page.getByTestId("study-answer-image-answer");
      const frame = page.frameLocator("iframe").nth(1);
      const retry = page.getByTestId("retry-answer-images");
      await expect(retry).toBeVisible();
      await expect(frame.getByRole("button")).toHaveCount(0);
      await expect(page.getByRole("alert")).toContainText(
        language === "en"
          ? "An image in an answer could not be loaded."
          : "Nie udało się wczytać obrazu w odpowiedzi.",
      );
      await answer.click();
      await expect(answer).toHaveAttribute("aria-checked", "true");
      if (returns) {
        // Leave a genuine failure untouched, answer another question, then revisit
        // the same question after its image becomes available.
        await page
          .getByRole("button", {
            name: language === "en" ? "Check" : "Sprawdź",
            exact: true,
          })
          .click();
        await page
          .getByRole("button", {
            name: language === "en" ? "Next" : "Dalej",
            exact: true,
          })
          .click();
        await page.getByTestId("study-answer-plain-answer").click();
        await page
          .getByRole("button", {
            name: language === "en" ? "Check" : "Sprawdź",
            exact: true,
          })
          .click();
        await page
          .getByRole("button", {
            name: language === "en" ? "Next" : "Dalej",
            exact: true,
          })
          .click();
        await expect(answer).toBeVisible();
        await expect.poll(() => attempts).toBe(2);
        await expect
          .poll(() =>
            frame
              .locator("img")
              .evaluate((element: HTMLImageElement) => element.naturalWidth),
          )
          .toBe(80);
        await expect(retry).toHaveCount(0);
        await expect(page.getByRole("alert")).toHaveCount(0);
        return;
      }
      await retry.click();
      await expect.poll(() => attempts).toBe(2);
      await expect(answer).toHaveAttribute("aria-checked", "true");
      await page
        .getByRole("button", {
          name: language === "en" ? "Check" : "Sprawdź",
          exact: true,
        })
        .click();
      await expect(answer).toHaveAttribute("aria-disabled", "true");
      await retry.click();
      await expect.poll(() => attempts).toBe(3);
      await expect
        .poll(() =>
          frame
            .locator("img")
            .evaluate((element: HTMLImageElement) => element.naturalWidth),
        )
        .toBe(80);
      await expect(answer).toHaveAttribute("aria-checked", "true");
      await page.evaluate(() => {
        (window as Window & { oldAnswerFrame?: Window | null }).oldAnswerFrame =
          document.querySelectorAll("iframe")[1].contentWindow;
      });
      await page
        .getByRole("button", {
          name: language === "en" ? "Next" : "Dalej",
          exact: true,
        })
        .click();
      await expect(page.getByTestId("study-answer-plain-answer")).toBeVisible();
      await expect(retry).toHaveCount(0);
      await page.evaluate(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            source: (window as Window & { oldAnswerFrame?: Window | null })
              .oldAnswerFrame,
            data: { testownikImageFailed: 2 },
          }),
        );
      });
      await expect(retry).toHaveCount(0);
      expect(attempts).toBe(3);
    });
