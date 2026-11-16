import { expect, test } from "@playwright/test";

for (const language of ["en", "pl"] as const) {
  test(`${language}: pending feedback cannot be cancelled and a failed draft can be retried`, async ({
    page,
  }) => {
    await page.addInitScript((language) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "compose-fixture", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
    }, language);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let writes = 0;
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/feedback/send")) {
        writes++;
        if (writes === 1) {
          await gate;
          return route.fulfill({ status: 503, json: {} });
        }
        return route.fulfill({ status: 200, json: {} });
      }
      return route.fulfill({
        json: path.endsWith("/user/")
          ? { id: "compose-fixture", full_name: "Fixture", is_guest: false }
          : [],
      });
    });
    const c =
      language === "en"
        ? {
            open: "Send Feedback",
            subject: "Subject",
            message: "Message",
            send: "Send",
            cancel: "Cancel",
            pending: "Sending…",
          }
        : {
            open: "Prześlij opinię",
            subject: "Temat",
            message: "Wiadomość",
            send: "Wyślij",
            cancel: "Anuluj",
            pending: "Wysyłanie…",
          };
    await page.goto("/profile");
    await page.getByRole("button", { name: c.open, exact: true }).click();
    const subject = page.getByRole("textbox", { name: c.subject, exact: true });
    const message = page.getByRole("textbox", { name: c.message, exact: true });
    await subject.fill("Fixture only");
    await message.fill("Preserve this feedback draft");
    const send = page.getByRole("button", { name: c.send, exact: true });
    const cancel = page.getByRole("button", { name: c.cancel, exact: true });
    await send.click();
    await expect.poll(() => writes).toBe(1);
    await expect(send).toBeDisabled();
    await expect(cancel).toBeDisabled();
    await expect(send).toHaveAttribute("aria-busy", "true");
    await cancel.click({ force: true });
    await expect(page).toHaveURL(/\/feedback$/);
    release();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(subject).toHaveValue("Fixture only");
    await expect(message).toHaveValue("Preserve this feedback draft");
    await expect(cancel).toBeEnabled();
    await expect(send).toBeEnabled();
    await send.click();
    await expect.poll(() => writes).toBe(2);
    await expect(page).toHaveURL(/\/profile$/);
    await expect(
      page.getByRole("button", { name: c.open, exact: true }),
    ).toBeVisible();
  });
}

test("dirty feedback back navigation asks before discarding and keeps a declined draft", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({ access: "compose-back-fixture", refresh: "fixture" }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
  });
  await page.route("**/api/**", (route) =>
    route.fulfill({
      json: new URL(route.request().url()).pathname.endsWith("/user/")
        ? { id: "compose-back-fixture", is_guest: false }
        : [],
    }),
  );
  await page.goto("/profile");
  await page
    .getByRole("button", { name: "Send Feedback", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Subject", exact: true })
    .fill("Keep this draft");
  await Promise.all([
    page.waitForEvent("dialog").then((dialog) => dialog.dismiss()),
    page.getByRole("button", { name: "Cancel", exact: true }).click(),
  ]);
  await expect(
    page.getByRole("textbox", { name: "Subject", exact: true }),
  ).toHaveValue("Keep this draft");
  await Promise.all([
    page.waitForEvent("dialog").then((dialog) => dialog.accept()),
    page.getByRole("button", { name: "Cancel", exact: true }).click(),
  ]);
  await expect(page).toHaveURL(/\/profile$/);
});

test("invalid statistics links show an unavailable report without minting a web session", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "testownik.oauth-session.v2",
      JSON.stringify({ access: "report-link-fixture", refresh: "fixture" }),
    );
    localStorage.setItem("testownik.v1.language", JSON.stringify("en"));
  });
  let issuedSessions = 0;
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/mobile/auth/web-session/")) issuedSessions++;
    return route.fulfill({
      json: path.endsWith("/user/")
        ? { id: "report-link-fixture", is_guest: false }
        : [],
    });
  });
  for (const link of ["/stats", "/stats?id=not-a-quiz"]) {
    await page.goto(link);
    await expect(
      page.getByText(
        "This isn’t available. It may have been deleted, or you no longer have access.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open Report", exact: true }),
    ).toHaveCount(0);
  }
  expect(issuedSessions).toBe(0);
});
