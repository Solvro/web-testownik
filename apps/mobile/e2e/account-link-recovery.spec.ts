import { expect, test } from "@playwright/test";

for (const language of ["en", "pl"]) {
  test(`${language}: privacy policy browser failure gives recoverable feedback`, async ({
    page,
  }) => {
    await page.addInitScript((language) => {
      sessionStorage.setItem(
        "testownik.oauth-session.v2",
        JSON.stringify({ access: "link-fixture", refresh: "fixture" }),
      );
      localStorage.setItem("testownik.v1.language", JSON.stringify(language));
      window.open = () => {
        throw new Error("Browser fixture unavailable");
      };
    }, language);
    await page.route("**/api/**", (route) =>
      route.fulfill({
        json: new URL(route.request().url()).pathname.endsWith("/user/")
          ? { id: "link-fixture", is_guest: false, hide_profile: false }
          : [],
      }),
    );
    let message = "";
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("dialog", async (dialog) => {
      message = dialog.message();
      await dialog.accept();
    });
    await page.goto("/account");
    const policy = page.getByRole("button", {
      name: language === "pl" ? "Polityka prywatności" : "Privacy Policy",
      exact: true,
    });
    await policy.click();
    await expect
      .poll(() => message)
      .toContain(
        language === "pl"
          ? "Nie udało się otworzyć linku"
          : "Couldn’t Open Link",
      );
    await expect(policy).toBeEnabled();
    expect(errors).toEqual([]);
  });
}
