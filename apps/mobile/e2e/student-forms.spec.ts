import { test, expect } from "@playwright/test";
for (const language of ["en", "pl"] as const)
  test(`${language}: reports retain failed drafts and ratings wait for existing data`, async ({
    page,
  }) => {
    await page.addInitScript((language) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "forms-fixture", refresh: "forms-refresh" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
    }, language);
    let ratingFails = true,
      score = 2;
    await page.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/user/"))
        return route.fulfill({
          json: { id: "forms-fixture", full_name: "Fixture", is_guest: false },
        });
      if (path.includes("quiz-ratings/me"))
        return route.fulfill(
          ratingFails
            ? { status: 503, json: {} }
            : { json: [{ id: "rating", score }] },
        );
      if (path.includes("quiz-ratings/rating")) {
        score = route.request().postDataJSON().score;
        return route.fulfill({ json: { id: "rating", score } });
      }
      if (route.request().method() === "POST")
        return route.fulfill({ status: 503, json: {} });
      return route.fulfill({ json: [] });
    });
    const c =
      language === "en"
        ? {
            retry: "Try Again",
            comment: "Your comment",
            submit: "Post comment",
            report: "Describe the problem",
            subject: "Subject",
            message: "Message",
            send: "Send",
          }
        : {
            retry: "Spróbuj ponownie",
            comment: "Twój komentarz",
            submit: "Wyślij komentarz",
            report: "Opis problemu",
            subject: "Temat",
            message: "Wiadomość",
            send: "Wyślij",
          };
    const star = page.getByRole("button", {
      name: language === "en" ? "Rate 4 out of 5" : "Ocena 4 z 5",
      exact: true,
    });
    await page.goto("/community?id=fixture");
    await expect(
      page.getByRole("button", { name: c.retry, exact: true }),
    ).toBeVisible();
    ratingFails = false;
    await page.getByRole("button", { name: c.retry, exact: true }).click();
    // Tapping a star saves it, once the existing rating has loaded.
    await expect(
      page.getByText(
        language === "en" ? "Your rating: 2/5" : "Twoja ocena: 2/5",
        {
          exact: true,
        },
      ),
    ).toBeVisible();
    await star.click();
    await expect.poll(() => score).toBe(4);
    const comment = page.getByRole("textbox", { name: c.comment, exact: true });
    await comment.fill("Keep my study tip");
    await Promise.all([
      page.waitForEvent("dialog").then((dialog) => dialog.accept()),
      page.getByRole("button", { name: c.submit, exact: true }).click(),
    ]);
    await expect(comment).toHaveValue("Keep my study tip");
    await page.goto("/report?id=fixture&question=question");
    const report = page.getByRole("textbox", { name: c.report, exact: true });
    await report.fill("Keep my report");
    await page.getByRole("button", { name: c.send, exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(report).toHaveValue("Keep my report");
    await page.goto("/feedback");
    await page
      .getByRole("textbox", { name: c.subject, exact: true })
      .fill("Feedback");
    const message = page.getByRole("textbox", { name: c.message, exact: true });
    await message.fill("Keep my feedback");
    await page.getByRole("button", { name: c.send, exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(message).toHaveValue("Keep my feedback");
  });
