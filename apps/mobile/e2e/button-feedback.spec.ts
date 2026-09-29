import { test, expect } from "@playwright/test";

for (const language of ["en", "pl"] as const)
  test(`${language}: a slow action keeps its size, prevents repeat submission and restores its draft on failure`, async ({
    page,
  }) => {
    await page.addInitScript((language) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "button-fixture", refresh: "button-refresh" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
    }, language);
    let submissions = 0;
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/feedback/send")) {
        submissions += 1;
        await pending;
        return route.fulfill({ status: 503, json: {} });
      }
      return route.fulfill({
        json: path.endsWith("/user/")
          ? { id: "button-fixture", is_guest: false }
          : [],
      });
    });
    await page.goto("/feedback");
    await page
      .getByRole("textbox", {
        name: language === "en" ? "Subject" : "Temat",
        exact: true,
      })
      .fill("Fixture only");
    const message = page.getByRole("textbox", {
      name: language === "en" ? "Message" : "Wiadomość",
      exact: true,
    });
    await message.fill("Keep this unsent draft");
    const button = page.getByRole("button", {
      name: language === "en" ? "Send" : "Wyślij",
      exact: true,
    });
    const before = await button.boundingBox();
    await button.click();
    await expect.poll(() => submissions).toBe(1);
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("aria-busy", "true");
    const during = await button.boundingBox();
    expect(during?.width).toBe(before?.width);
    expect(during?.height).toBe(before?.height);
    // A second physical tap must not queue a second request while the first is pending.
    await page.mouse.click(
      during!.x + during!.width / 2,
      during!.y + during!.height / 2,
    );
    expect(submissions).toBe(1);
    finish();
    // The failure is reported beside the form, keeping the draft in place.
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(button).toBeEnabled();
    await expect(button).toHaveAttribute("aria-busy", "false");
    await expect(message).toHaveValue("Keep this unsent draft");
  });
